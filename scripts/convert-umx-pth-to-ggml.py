#!/usr/bin/env python

import io
import sys
import torch
import numpy as np
import openunmix
import struct
import argparse
from pathlib import Path


def quantize(array, qtype=np.uint8):
    # Calculate min and max of the array
    min_val = np.min(array)
    max_val = np.max(array)

    # Calculate scale and offset for quantization
    scale = (max_val - min_val) / (float)(np.iinfo(qtype).max-1)
    offset = min_val

    # Quantize array
    quantized_array = np.round((array - offset) / scale).astype(qtype)

    # Return quantized array, scale and offset
    return quantized_array, scale, offset


def dequantize(quantized_array, scale, offset):
    # Dequantize array
    array = quantized_array * scale + offset

    # Return dequantized array
    return array


HUB_PATHS = {
    "umxhq": {
        "vocals": "vocals-b62c91ce.pth",
        "drums": "drums-9619578f.pth",
        "bass": "bass-8d85a5bd.pth",
        "other": "other-b52fbbf7.pth",
    },
    "umxl": {
        "vocals": "vocals-bccbd9aa.pth",
        "drums": "drums-69e0ebd4.pth",
        "bass": "bass-2ca1ce51.pth",
        "other": "other-c8c5b3e6.pth",
    },
}

LAYERS_TO_SKIP = [
    "stft.window",
    #"input_mean",
    #"input_scale",
    #"output_scale",
    #"output_mean",
    "sample_rate",
    "transform.0.window",
    #"bn1.running_mean",
    #"bn1.running_var",
    "bn1.num_batches_tracked",
    #"bn2.running_mean",
    #"bn2.running_var",
    "bn2.num_batches_tracked",
    #"bn3.running_mean",
    #"bn3.running_var",
    "bn3.num_batches_tracked",
]


if __name__ == '__main__':
    # add argparse to pick between umxhq and umxl models
    parser = argparse.ArgumentParser(description='Convert Open Unmix PyTorch models to GGML')
    parser.add_argument('--model', type=str, choices=('umxhq', 'umxl'), help='(umxhq, umxl)', default='umxhq')
    parser.add_argument("dest_dir", type=str, help="destination path for the converted model")

    args = parser.parse_args()

    dir_out = Path(args.dest_dir)
    dir_out.mkdir(parents=True, exist_ok=True)

    # Load model from torchhub, implicitly expecting them to land in the torchhub cache path
    #    root path for torchhub: /home/sevagh/.cache/torch/hub/checkpoints/
    #    hq paths: [vocals-b62c91ce.pth, drums-9619578f.pth, bass-8d85a5bd.pth, other-b52fbbf7.pth]
    #    xl paths: [vocals-bccbd9aa.pth, drums-69e0ebd4.pth, bass-2ca1ce51.pth, other-c8c5b3e6.pth]
    # using the spectrogram model since we don't need the surrounding stft/isft + wiener
    model = eval("openunmix."+args.model+"_spec")()
    print(model)

    # get torchub path
    torchhub_path = Path(torch.hub.get_dir()) / "checkpoints"

    # let's write it all to one file
    # copied from ggerganov/whisper.cpp convert-pt-to-ggml.py
    dest_name = dir_out / f"ggml-model-{args.model}-u8.bin"

    fout = dest_name.open("wb")
    fout.write(struct.pack("i", 0x756d7867))  # magic: umxg in hex

    # we want the order of bass, drums, other, vocals

    #for i, (target_name, target_model) in enumerate(model.items()):
    for i, target_name in enumerate(["bass", "drums", "other", "vocals"]):
        target_model = model[target_name]
        print(f"Converting target {target_name}")
        print(target_model)

        fname_inp = torchhub_path / HUB_PATHS[args.model][target_name]

        # try to load PyTorch binary data
        # even though we loaded it above to print its info
        # we need to load it again ggml/whisper.cpp-style
        try:
            model_bytes = open(fname_inp, "rb").read()
            with io.BytesIO(model_bytes) as fp:
                checkpoint = torch.load(fp, map_location="cpu")
        except Exception:
            print("Error: failed to load PyTorch model file:" , fname_inp)
            sys.exit(1)

        #print(checkpoint.keys())
        hidden_size = checkpoint['fc1.weight'].shape[0]

        if i == 0:
            # we only want to write this once
            fout.write(struct.pack("i", hidden_size)) # hidden size
            print(f"HIDDEN SIZE: {hidden_size}")

        # write layers
        for name in checkpoint.keys():
            if name in LAYERS_TO_SKIP:
                print(f"Skipping layer {name}")
                continue
            data = checkpoint[name].squeeze().numpy()
            print("Processing variable: " , name ,  " with shape: ", data.shape)

            n_dims = len(data.shape)

            data = data.astype(np.float32)

            # cast type to a uint8 to perform quantization
            # take into account the min/max values of the data for each tensor
            # and use that for appropriate quantization

            if any([x in name for x in ["bn2", "bn3", "fc2", "fc3"]]):
            # if bn3 or fc3 in name
                quantized_data, scale, offset = quantize(data, qtype=np.uint16)
            else:
                quantized_data, scale, offset = quantize(data)

            # header
            str_ = name.encode('utf-8')
            fout.write(struct.pack("ffii", scale, offset, n_dims, len(str_)))
            for i in range(n_dims):
                fout.write(struct.pack("i", data.shape[n_dims - 1 - i]))
            fout.write(str_)

            # data
            quantized_data.tofile(fout)

    fout.close()

    print("Done. Output file: " , dest_name)
    print("")
