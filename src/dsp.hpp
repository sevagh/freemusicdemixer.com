#ifndef DSP_HPP
#define DSP_HPP

#include <Eigen/Dense>
#include <cassert>
#include <complex>
#include <iostream>
#include <string>
#include <tensor.hpp>
#include <unsupported/Eigen/FFT>
#include <vector>

namespace umxcpp
{

const int SUPPORTED_SAMPLE_RATE = 44100;
const int FFT_WINDOW_SIZE = 4096;

const int FFT_HOP_SIZE = 1024; // 25% hop i.e. 75% overlap

struct stft_buffers
{
    int nb_frames;
    int nb_bins;
    int pad;

    Eigen::MatrixXf waveform;

    const std::vector<float> window;
    const std::vector<float> normalized_window;

    std::vector<float> pad_start;
    std::vector<float> pad_end;
    std::vector<float> padded_waveform_mono_in;
    std::vector<float> padded_waveform_mono_out;
    std::vector<float> windowed_waveform_mono;

    std::vector<std::vector<std::complex<float>>> complex_spec_mono;

    Eigen::Tensor3dXcf spec;
    Eigen::FFT<float> cfg;

    // constructor for stft_buffers that takes some parameters
    // to hint at the sizes of the buffers
    stft_buffers(int n_samples)
        : nb_frames(n_samples / FFT_HOP_SIZE + 1),
          nb_bins(FFT_WINDOW_SIZE / 2 + 1), pad(FFT_WINDOW_SIZE / 2),
          waveform(Eigen::MatrixXf(2, n_samples)),
          window(init_const_hann_window()),
          normalized_window(init_const_normalized_window(window, nb_frames)),
          pad_start(std::vector<float>(pad)), pad_end(std::vector<float>(pad)),
          padded_waveform_mono_in(
              std::vector<float>(n_samples + FFT_WINDOW_SIZE)),
          padded_waveform_mono_out(
              std::vector<float>(n_samples + FFT_WINDOW_SIZE)),
          windowed_waveform_mono(std::vector<float>(FFT_WINDOW_SIZE)),
          complex_spec_mono(std::vector<std::vector<std::complex<float>>>(
              nb_frames, std::vector<std::complex<float>>(nb_bins))),
          spec(Eigen::Tensor3dXcf(2, nb_frames, nb_bins)){};

    static std::vector<float> init_const_hann_window()
    {
        static constexpr float PI = 3.14159265359F;
        std::vector<float> window(FFT_WINDOW_SIZE);

        // create a periodic hann window
        // by generating L+1 points and deleting the last one
        auto floatN = (float)(FFT_WINDOW_SIZE + 1);

        for (std::size_t n = 0; n < FFT_WINDOW_SIZE; ++n)
        {
            window[n] =
                0.5F * (1.0F - cosf(2.0F * PI * (float)n / (floatN - 1)));
        }

        return window;
    }

    static std::vector<float>
    init_const_normalized_window(const std::vector<float> &window,
                                 int nb_frames)
    {
        float window_normalization_factor =
            FFT_WINDOW_SIZE + FFT_HOP_SIZE * (nb_frames - 1);
        std::vector<float> normalized_window =
            std::vector<float>(window_normalization_factor, 0.0f);

        // Compute the window normalization factor
        // using librosa window_sumsquare to compute the squared window
        // https://github.com/librosa/librosa/blob/main/librosa/filters.py#L1545
        for (int i = 0; i < nb_frames; ++i)
        {
            auto sample = i * FFT_HOP_SIZE;
            for (int j = sample; j < std::min((int)window_normalization_factor,
                                              sample + FFT_WINDOW_SIZE);
                 ++j)
            {
                normalized_window[j] += window[j - sample] * window[j - sample];
            }
        }
        return normalized_window;
    }
};

// waveform = 2d: (channels, samples)
Eigen::MatrixXf load_audio(std::string filename);

void write_audio_file(const Eigen::MatrixXf &waveform, std::string filename);

// combine magnitude and phase spectrograms into complex
Eigen::Tensor3dXcf polar_to_complex(const Eigen::Tensor3dXf &magnitude,
                                    const Eigen::Tensor3dXf &phase);

void stft(struct stft_buffers &stft_buf);
void istft(struct stft_buffers &stft_buf);

} // namespace umxcpp

#endif // DSP_HPP
