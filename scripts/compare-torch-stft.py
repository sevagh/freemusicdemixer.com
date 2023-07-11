import torch
import subprocess
from openunmix.transforms import make_filterbanks


if __name__ == '__main__':
    stft, istft = make_filterbanks(n_fft=4096, n_hop=1024, center=True, sample_rate=44100.0, method="torch")

    audio_in = torch.zeros((1, 2, 4096), dtype=torch.float32)
    for i in range(20):
        audio_in[0, 0, i] = 0.5 if i % 2 == 0 else -0.5
        audio_in[0, 1, i] = 0.5 if i % 2 == 0 else -0.5

    spec = stft(audio_in)
    print(f"spec shape: {spec.shape} {spec.dtype}")

    # frames of stft
    # center frame is the one that matters
    
    for i in range(20):
        print(f"CENTER FRAME spec REAL left: {spec[0, 0, i, 2, 0]}, spec IMAG left: {spec[0, 0, i, 2, 1]}")
    for i in range(20):
        print(f"CENTER FRAME spec REAL left: {spec[0, 0, 2049-20+i, 2, 0]}, spec IMAG left: {spec[0, 0, 2049-20+i, 2, 1]}")

    audio_out = istft(spec, length=4096)

    for i in range(20):
        print(f"in left: {audio_in[0, 0, i]}, in right: {audio_in[0, 1, i]}")
        print(f"out left: {audio_out[0, 0, i]}, out right: {audio_out[0, 1, i]}")

    #cpp_gtest_out = subprocess.check_output(
    #    "cd ./build && make && ./umx.cpp.test --gtest_filter='*STFTRoundtrip*'",
    #    shell=True
    #)
    #print("cpp_gtest_out: ", cpp_gtest_out.decode("utf-8"))
