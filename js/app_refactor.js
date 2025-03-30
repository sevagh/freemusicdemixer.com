export function sumSegments(segments, desiredLength) {
    const totalLength = desiredLength;
    const segmentLengthWithPadding = segments[0][0].length;
    const actualSegmentLength = segmentLengthWithPadding - 2 * DEMUCS_OVERLAP_SAMPLES;
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
                const segmentPos = i - DEMUCS_OVERLAP_SAMPLES;
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
