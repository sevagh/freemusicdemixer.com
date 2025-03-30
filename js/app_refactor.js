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
