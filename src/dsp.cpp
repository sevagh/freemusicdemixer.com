#include "dsp.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <string>
#include <unsupported/Eigen/FFT>
#include <vector>

// forward declaration of inner stft
void
stft_inner(struct umxcpp::stft_buffers &stft_buf, Eigen::FFT<float> &cfg);

void
istft_inner(struct umxcpp::stft_buffers &stft_buf, Eigen::FFT<float> &cfg);

// reflect padding
void pad_signal(struct umxcpp::stft_buffers &stft_buf)
{
    // copy from stft_buf.padded_waveform_mono_in+pad into stft_buf.pad_start, stft_buf.pad_end
    std::copy_n(stft_buf.padded_waveform_mono_in.begin() + stft_buf.pad, stft_buf.pad, stft_buf.pad_start.begin());
    std::copy_n(stft_buf.padded_waveform_mono_in.end() - 2*stft_buf.pad, stft_buf.pad,
                stft_buf.pad_end.begin());

    std::reverse(stft_buf.pad_start.begin(), stft_buf.pad_start.end());
    std::reverse(stft_buf.pad_end.begin(), stft_buf.pad_end.end());

    // copy stft_buf.pad_start into stft_buf.padded_waveform_mono_in
    std::copy_n(stft_buf.pad_start.begin(), stft_buf.pad,
                stft_buf.padded_waveform_mono_in.begin());

    // copy stft_buf.pad_end into stft_buf.padded_waveform_mono_in
    std::copy_n(stft_buf.pad_end.begin(), stft_buf.pad,
                stft_buf.padded_waveform_mono_in.end() - stft_buf.pad);
}

Eigen::FFT<float> get_fft_cfg() {
    Eigen::FFT<float> cfg;

    cfg.SetFlag(Eigen::FFT<float>::Speedy);
    cfg.SetFlag(Eigen::FFT<float>::HalfSpectrum);
    cfg.SetFlag(Eigen::FFT<float>::Unscaled);

    return cfg;
}

void umxcpp::stft(struct stft_buffers &stft_buf)
{
    // get the fft config
    Eigen::FFT<float> cfg = get_fft_cfg();

    /*****************************************/
    /*  operate on each channel sequentially */
    /*****************************************/

    for (int channel = 0; channel < 2; ++channel) {
        Eigen::VectorXf row_vec = stft_buf.waveform.row(channel);

        std::copy_n(row_vec.data(), row_vec.size(), stft_buf.padded_waveform_mono_in.begin() + stft_buf.pad);

        // apply padding equivalent to center padding with center=True
        // in torch.stft:
        // https://pytorch.org/docs/stable/generated/torch.stft.html

        // reflect pads stft_buf.padded_waveform_mono in-place
        pad_signal(stft_buf);

        // does forward fft on stft_buf.padded_waveform_mono, stores spectrum in complex_spec_mono
        stft_inner(stft_buf, cfg);

        for (int i = 0; i < stft_buf.nb_frames; ++i)
        {
            for (int j = 0; j < stft_buf.nb_bins; ++j)
            {
                stft_buf.spec(channel, i, j) = stft_buf.complex_spec_mono[i][j];
            }
        }
    }
}

void umxcpp::istft(struct stft_buffers &stft_buf)
{
    // get the fft config
    Eigen::FFT<float> cfg = get_fft_cfg();

    /*****************************************/
    /*  operate on each channel sequentially */
    /*****************************************/

    for (int channel = 0; channel < 2; ++channel) {
        // Populate the nested vectors
        for (int i = 0; i < stft_buf.nb_frames; ++i)
        {
            for (int j = 0; j < stft_buf.nb_bins; ++j)
            {
                stft_buf.complex_spec_mono[i][j] = stft_buf.spec(channel, i, j);
            }
        }

        // does inverse fft on stft_buf.complex_spec_mono, stores waveform in padded_waveform_mono
        istft_inner(stft_buf, cfg);

        // copies waveform_mono into stft_buf.waveform past first pad samples
        stft_buf.waveform.row(channel) =
            Eigen::Map<Eigen::MatrixXf>(stft_buf.padded_waveform_mono_out.data() + stft_buf.pad, 1, stft_buf.padded_waveform_mono_out.size()-FFT_WINDOW_SIZE);
    }
}

void
stft_inner(struct umxcpp::stft_buffers &stft_buf, Eigen::FFT<float> &cfg)
{
    int frame_idx = 0;

    // Loop over the waveform with a stride of hop_size
    for (std::size_t start = 0; start <= stft_buf.padded_waveform_mono_in.size() - umxcpp::FFT_WINDOW_SIZE;
         start += umxcpp::FFT_HOP_SIZE)
    {
        // Apply window and run FFT
        for (int i = 0; i < umxcpp::FFT_WINDOW_SIZE; ++i)
        {
            stft_buf.windowed_waveform_mono[i] = stft_buf.padded_waveform_mono_in[start + i] * stft_buf.window[i];
        }
        cfg.fwd(stft_buf.complex_spec_mono[frame_idx++], stft_buf.windowed_waveform_mono);
    }
}

void
istft_inner(struct umxcpp::stft_buffers &stft_buf, Eigen::FFT<float> &cfg)
{
    // clear padded_waveform_mono
    std::fill(stft_buf.padded_waveform_mono_out.begin(), stft_buf.padded_waveform_mono_out.end(), 0.0f);

    // Loop over the input with a stride of (hop_size)
    for (std::size_t start = 0; start < stft_buf.nb_frames * umxcpp::FFT_HOP_SIZE;
         start += umxcpp::FFT_HOP_SIZE)
    {
        // Run iFFT
        cfg.inv(stft_buf.windowed_waveform_mono, stft_buf.complex_spec_mono[start / umxcpp::FFT_HOP_SIZE]);

        // Apply window and add to output
        for (int i = 0; i < umxcpp::FFT_WINDOW_SIZE; ++i)
        {
            // x[start+i] is the sum of squared window values
            // https://github.com/librosa/librosa/blob/main/librosa/core/spectrum.py#L613
            // 1e-8f is a small number to avoid division by zero
            stft_buf.padded_waveform_mono_out[start + i] += stft_buf.windowed_waveform_mono[i] * stft_buf.window[i] * 1.0f / float(umxcpp::FFT_WINDOW_SIZE) /
                                 (stft_buf.normalized_window[start + i] + 1e-8f);
        }
    }
}

Eigen::Tensor3dXcf
umxcpp::polar_to_complex(const Eigen::Tensor3dXf &magnitude,
                            const Eigen::Tensor3dXf &phase)
{
    // Assert dimensions are the same
    assert(magnitude.dimensions() == phase.dimensions());

    // Get dimensions for convenience
    int dim1 = magnitude.dimension(0);
    int dim2 = magnitude.dimension(1);
    int dim3 = magnitude.dimension(2);

    // Initialize complex spectrogram tensor
    Eigen::Tensor3dXcf complex_spectrogram(dim1, dim2, dim3);

    // Iterate over all indices and apply the transformation
    for (int i = 0; i < dim1; ++i)
    {
        for (int j = 0; j < dim2; ++j)
        {
            for (int k = 0; k < dim3; ++k)
            {
                float mag = magnitude(i, j, k);
                float ph = phase(i, j, k);
                complex_spectrogram(i, j, k) = std::polar(mag, ph);
            }
        }
    }

    return complex_spectrogram;
}
