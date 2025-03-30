export function sumSegments(segments, desiredLength, overlapSamples) {
    const totalLength = desiredLength;
    const segmentLengthWithPadding = segments[0][0].length;
    const actualSegmentLength = segmentLengthWithPadding - 2 * overlapSamples;
    const output = new Array(segments[0].length).fill().map(() => new Float32Array(totalLength));

    // Create weights for the segment
    const weight = new Float32Array(actualSegmentLength);
    for (let i = 0; i < actualSegmentLength; i++) {
        weight[i] = (i + 1);
        weight[actualSegmentLength - 1 - i] = (i + 1);
    }
    // normalize by its max coefficient
    const maxWeight = weight.reduce((max, x) => Math.max(max, x), -Infinity);
    const ramp = weight.map(x => x / maxWeight);

    const sumWeight = new Float32Array(totalLength).fill(0);

    segments.forEach((segment, index) => {
        const start = index * actualSegmentLength;

        for (let target = 0; target < segment.length; target++) {
            const channelSegment = segment[target];

            for (let i = 0; i < channelSegment.length; i++) {
                const segmentPos = i - overlapSamples;
                const outputIndex = start + segmentPos;

                if (outputIndex >= 0 && outputIndex < totalLength) {
                    output[target][outputIndex] += ramp[i % actualSegmentLength] * channelSegment[i];
                    // accumulate weight n_targets times
                    sumWeight[outputIndex] += ramp[i % actualSegmentLength];
                }
            }
        }
    });

    // Normalize the output by the sum of weights
    for (let target = 0; target < output.length; target++) {
        for (let i = 0; i < totalLength; i++) {
            if (sumWeight[i] !== 0) {
                // divide by sum of weights with 1/n_targets adjustment
                output[target][i] /= (sumWeight[i]/(output.length));
            }
        }
    }

    return output;
}

function segmentWaveform(left, right, n_segments, overlapSamples) {
    const totalLength = left.length;
    const segmentLength = Math.ceil(totalLength / n_segments);
    const segments = [];

    for (let i = 0; i < n_segments; i++) {
        const start = i * segmentLength;
        const end = Math.min(totalLength, start + segmentLength);
        const leftSegment = new Float32Array(end - start + 2 * overlapSamples);
        const rightSegment = new Float32Array(end - start + 2 * overlapSamples);

        // Overlap-padding for the left and right channels
        // For the first segment, no padding at the start
        if (i === 0) {
            leftSegment.fill(left[0], 0, overlapSamples);
            rightSegment.fill(right[0], 0, overlapSamples);
        } else {
            leftSegment.set(left.slice(start - overlapSamples, start), 0);
            rightSegment.set(right.slice(start - overlapSamples, start), 0);
        }

        // For the last segment, no padding at the end
        if (i === n_segments - 1) {
            const remainingSamples = totalLength - end;
            leftSegment.set(left.slice(end, end + Math.min(overlapSamples, remainingSamples)), end - start + overlapSamples);
            rightSegment.set(right.slice(end, end + Math.min(overlapSamples, remainingSamples)), end - start + overlapSamples);
        } else {
            leftSegment.set(left.slice(end, end + overlapSamples), end - start + overlapSamples);
            rightSegment.set(right.slice(end, end + overlapSamples), end - start + overlapSamples);
        }

        // Assign the original segment data
        leftSegment.set(left.slice(start, end), overlapSamples);
        rightSegment.set(right.slice(start, end), overlapSamples);

        segments.push([leftSegment, rightSegment]);
    }

    return segments;
}

export function processSegments(workers, leftChannel, rightChannel, numSegments, originalLength, overlapSamples, filename = null) {
    let segments = segmentWaveform(leftChannel, rightChannel, numSegments, overlapSamples);

    segments.forEach((segment, index) => {
        workers[index].postMessage({
            msg: filename ? 'PROCESS_AUDIO_BATCH' : 'PROCESS_AUDIO',
            leftChannel: segment[0],
            rightChannel: segment[1],
            originalLength,
            ...(filename && { filename })
        });
    });
}

export function fetchAndCacheFiles(model, components, dlPrefix = "https://bucket.freemusicdemixer.com") {
    let modelFiles = [];
    if (model === 'demucs-free-4s') {
        modelFiles.push('htdemucs.ort.gz');
    } else if (model === 'demucs-free-6s') {
        modelFiles.push('htdemucs_6s.ort.gz');
    } else if (model === 'demucs-karaoke') {
        modelFiles.push('htdemucs_2s_cust.ort.gz');
    } else if (model === 'demucs-pro-ft' || model === 'demucs-pro-deluxe') {
        if (components.includes('drums')) {
            modelFiles.push('htdemucs_ft_drums.ort.gz');
        }
        if (components.includes('bass')) {
            modelFiles.push('htdemucs_ft_bass.ort.gz');
        }
        if (components.includes('melody')) {
            modelFiles.push('htdemucs_ft_other.ort.gz');
        }
        if (components.includes('vocals')) {
            modelFiles.push(model === 'demucs-pro-ft' ? 'htdemucs_ft_vocals.ort.gz' : 'htdemucs_2s_cust.ort.gz');
        }
    } else if (model === 'demucs-pro-cust') {
        modelFiles.push('htdemucs_ft_vocals.ort.gz');
        modelFiles.push('htdemucs_6s.ort.gz');
    } else if (model === 'demucs-pro-cust-spec') {
        modelFiles.push('htdemucs_2s_cust.ort.gz');
        modelFiles.push('htdemucs_ft_drums.ort.gz');
        modelFiles.push('htdemucs_ft_bass.ort.gz');
        modelFiles.push('htdemucs_6s.ort.gz');
    }

    // prepend raw gh url to all modelFiles
    modelFiles = modelFiles.map(file =>
        `${dlPrefix}/${file}`
    )

    // Map each file to a fetch request and then process the response
    const fetchPromises = modelFiles.map(file =>
        fetch(file).then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch ${file}`);
            }
            return response.arrayBuffer(); // Or another appropriate method depending on the file type
        })
    );
    return Promise.all(fetchPromises);
}

export function computeModelAndStems(processingMode, selectedFeatures, selectedQuality) {
    // 1) If strictly MIDI mode, short-circuit
    if (processingMode === 'midi') {
      return {
        model: 'basicpitch',
        stems: [] // or however you handle stems in midi-only
      };
    }

    // Default textual label
    let selectedModelLocal = "4-SOURCE (FREE)";

    // 2) Determine model label by rules
    if (selectedFeatures.includes("piano") || selectedFeatures.includes("guitar") || selectedFeatures.includes("other_melody")) {
      // Rule 1
      if (selectedQuality === "default") {
        selectedModelLocal = "6-SOURCE (PRO)";
      } else if (selectedQuality === "medium") {
        selectedModelLocal = "CUSTOM (PRO)";
      } else if (selectedQuality === "high") {
        selectedModelLocal = "CUSTOM SPECIAL (PRO)";
      }
    } else if (selectedFeatures.every(item => ["vocals", "instrumental"].includes(item))) {
      // Rule 2
      if (selectedQuality === "default") {
        selectedModelLocal = "4-SOURCE (FREE)";
      } else if (selectedQuality === "medium") {
        selectedModelLocal = "FINE-TUNED (PRO)";
      } else if (selectedQuality === "high") {
        selectedModelLocal = "KARAOKE (PRO)";
      }
    } else if (selectedFeatures.some(item => ["vocals", "drums", "bass", "melody"].includes(item))) {
      // Rule 3
      if (selectedQuality === "default") {
        selectedModelLocal = "4-SOURCE (FREE)";
      } else if (selectedQuality === "medium") {
        selectedModelLocal = "FINE-TUNED (PRO)";
      } else if (selectedQuality === "high") {
        selectedModelLocal = "DELUXE (PRO)";
      }
    }

    // 3) Convert textual label => internal model ID
    let model = '';
    switch (selectedModelLocal) {
      case "4-SOURCE (FREE)":
        model = 'demucs-free-4s';
        break;
      case "6-SOURCE (PRO)":
        model = 'demucs-free-6s';
        break;
      case "FINE-TUNED (PRO)":
        model = 'demucs-pro-ft';
        break;
      case "KARAOKE (PRO)":
        model = 'demucs-karaoke';
        break;
      case "CUSTOM (PRO)":
        model = 'demucs-pro-cust';
        break;
      case "DELUXE (PRO)":
        model = 'demucs-pro-deluxe';
        break;
      case "CUSTOM SPECIAL (PRO)":
        model = 'demucs-pro-cust-spec';
        break;
    }

    // 4) Copy the user’s stems
    let stems = [...selectedFeatures];

    // If stems includes "instrumental" but model != demucs-karaoke => expand
    if (stems.includes('instrumental') && model !== 'demucs-karaoke') {
      if (['demucs-free-4s', 'demucs-pro-ft', 'demucs-pro-deluxe'].includes(model)) {
        if (!stems.includes('drums')) stems.push('drums');
        if (!stems.includes('bass')) stems.push('bass');
        if (!stems.includes('melody')) stems.push('melody');
      }
      if (['demucs-free-6s', 'demucs-pro-cust', 'demucs-pro-cust-spec'].includes(model)) {
        if (!stems.includes('drums')) stems.push('drums');
        if (!stems.includes('bass')) stems.push('bass');
        if (!stems.includes('other_melody')) stems.push('other_melody');
        if (!stems.includes('guitar')) stems.push('guitar');
        if (!stems.includes('piano')) stems.push('piano');
      }
    }

    // If stems includes "melody" & model in big-6 => expand
    if (stems.includes('melody') && ['demucs-free-6s', 'demucs-pro-cust', 'demucs-pro-cust-spec'].includes(model)) {
      if (!stems.includes('other_melody')) stems.push('other_melody');
      if (!stems.includes('guitar')) stems.push('guitar');
      if (!stems.includes('piano')) stems.push('piano');
    }

    // 5) Sort stems
    stems.sort((a, b) => {
      const order = ["drums", "bass", "melody", "vocals", "guitar", "piano", "instrumental"];
      return order.indexOf(a) - order.indexOf(b);
    });

    return { model, stems };
  }
