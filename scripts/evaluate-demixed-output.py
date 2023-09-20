import museval
import musdb
import numpy as np
import torch
import torchaudio
import openunmix
import os
import argparse

# sorted order of ggml bin file names
target_digit_map = {
    'bass': 0,
    'drums': 1,
    'other': 2,
    'vocals': 3,
}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Evaluate demixed output')

    parser.add_argument('--musdb-root', type=str, help='path to MUSDB18-HQ')
    parser.add_argument('input_dir', type=str, help='path to dir containing target files')
    parser.add_argument('track', type=str, help='track to evaluate')

    args = parser.parse_args()

    mus = musdb.DB(root=args.musdb_root, subsets='test', is_wav=True)

    # measure bss metrics for demixed output in directory
    # compared to reference track in musdb

    # load reference track
    tracks = mus.load_mus_tracks()
    track = [t for t in tracks if t.name == args.track][0]

    # load stems from input_dir
    est_targets = {}
    for target in target_digit_map.keys():
        # load target_{target_digit_map[target]}.wav
        #target_path = os.path.join(args.input_dir, f"target_{target_digit_map[target]}.wav")

        if target != 'other':
            target_path = os.path.join(args.input_dir, f"{target}.wav")
        else:
            target_path = os.path.join(args.input_dir, "melody.wav")
        print(f"loading path {target_path} for {target}")

        # load wav file with numpy
        track_tensor, _ = torchaudio.load(target_path)
        track_tensor = track_tensor.T.cpu().numpy().astype(np.float32)
        print(f"{track_tensor.shape} {track_tensor.dtype}")
        est_targets[target] = track_tensor

    # evaluate
    scores = museval.eval_mus_track(track, est_targets, output_dir=args.input_dir)
    print(scores)
