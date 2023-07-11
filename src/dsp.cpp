#include "dsp.hpp"
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <string>
#include <unsupported/Eigen/FFT>
#include <vector>

static constexpr float PI = 3.14159265359F;

// forward declaration of inner stft
std::vector<std::vector<std::complex<float>>>
stft_inner(const std::vector<float> &waveform, const std::vector<float> &window,
           int nfft, int hop_size);

std::vector<float>
istft_inner(const std::vector<std::vector<std::complex<float>>> &input,
            const std::vector<float> &window, int nfft, int hop_size);

std::vector<float> hann_window(int window_size)
{
    // create a periodic hann window
    // by generating L+1 points and deleting the last one
    std::size_t N = window_size + 1;

    std::vector<float> window(N);
    auto floatN = (float)(N);

    for (std::size_t n = 0; n < N; ++n)
    {
        window[n] = 0.5F * (1.0F - cosf(2.0F * PI * (float)n / (floatN - 1)));
    }
    // delete the last element
    window.pop_back();
    return window;
}

// reflect padding
std::vector<float> pad_signal(const std::vector<float> &signal, int n_fft)
{
    int pad = n_fft / 2;
    std::vector<float> pad_start(signal.begin(), signal.begin() + pad);
    std::vector<float> pad_end(signal.end() - pad, signal.end());
    std::reverse(pad_start.begin(), pad_start.end());
    std::reverse(pad_end.begin(), pad_end.end());
    std::vector<float> padded_signal = signal;
    padded_signal.insert(padded_signal.begin(), pad_start.begin(),
                         pad_start.end());
    padded_signal.insert(padded_signal.end(), pad_end.begin(), pad_end.end());
    return padded_signal;
}

// reflect unpadding
std::vector<float> unpad_signal(const std::vector<float> &signal, int n_fft)
{
    int pad = n_fft / 2;
    std::vector<float> unpadded_signal = signal;
    unpadded_signal.erase(unpadded_signal.begin(),
                          unpadded_signal.begin() +
                              pad); // remove 'pad' elements from the start
    unpadded_signal.erase(
        unpadded_signal.end() - pad,
        unpadded_signal.end()); // remove 'pad' elements from the end
    return unpadded_signal;
}

umxcpp::StereoSpectrogramR umxcpp::magnitude(const StereoSpectrogramC &spec)
{
    // compute the magnitude of a complex spectrogram
    StereoSpectrogramR ret;
    ret.left.resize(spec.left.size());
    ret.right.resize(spec.right.size());

    for (std::size_t i = 0; i < spec.left.size(); ++i)
    {
        ret.left[i].resize(spec.left[i].size());
        ret.right[i].resize(spec.right[i].size());

        for (std::size_t j = 0; j < spec.left[i].size(); ++j)
        {
            // compute the magnitude on the std::complex<float>
            ret.left[i][j] = std::abs(spec.left[i][j]);
            ret.right[i][j] = std::abs(spec.right[i][j]);
        }
    }

    return ret;
}

// repeat the above magnitude function but adapt for phase
umxcpp::StereoSpectrogramR umxcpp::phase(const StereoSpectrogramC &spec)
{
    // compute the phase of a complex spectrogram
    StereoSpectrogramR ret;
    ret.left.resize(spec.left.size());
    ret.right.resize(spec.right.size());

    for (std::size_t i = 0; i < spec.left.size(); ++i)
    {
        ret.left[i].resize(spec.left[i].size());
        ret.right[i].resize(spec.right[i].size());

        for (std::size_t j = 0; j < spec.left[i].size(); ++j)
        {
            // compute phase using std::complex<float>
            ret.left[i][j] = std::arg(spec.left[i][j]);
            ret.right[i][j] = std::arg(spec.right[i][j]);
        }
    }

    return ret;
}

umxcpp::StereoSpectrogramC umxcpp::combine(const StereoSpectrogramR &mag,
                                           const StereoSpectrogramR &phase)
{
    // combine magnitude and phase into a complex spectrogram
    StereoSpectrogramC ret;
    ret.left.resize(mag.left.size());
    ret.right.resize(mag.right.size());

    for (std::size_t i = 0; i < mag.left.size(); ++i)
    {
        ret.left[i].resize(mag.left[i].size());
        ret.right[i].resize(mag.right[i].size());

        for (std::size_t j = 0; j < mag.left[i].size(); ++j)
        {
            // compute the complex number from the polar form
            ret.left[i][j] = std::polar(mag.left[i][j], phase.left[i][j]);
            ret.right[i][j] = std::polar(mag.right[i][j], phase.right[i][j]);
        }
    }

    return ret;
}

umxcpp::StereoSpectrogramC umxcpp::stft(const StereoWaveform &audio)
{
    StereoSpectrogramC spec;
    auto window = hann_window(FFT_WINDOW_SIZE);

    // apply padding equivalent to center padding with center=True
    // in torch.stft:
    // https://pytorch.org/docs/stable/generated/torch.stft.html
    auto chn_left = pad_signal(audio.left, FFT_WINDOW_SIZE);
    auto chn_right = pad_signal(audio.right, FFT_WINDOW_SIZE);

    spec.left = stft_inner(chn_left, window, FFT_WINDOW_SIZE, FFT_HOP_SIZE);
    spec.right = stft_inner(chn_right, window, FFT_WINDOW_SIZE, FFT_HOP_SIZE);

    return spec;
}

umxcpp::StereoWaveform umxcpp::istft(const StereoSpectrogramC &spec)
{
    StereoWaveform audio;
    auto window = hann_window(FFT_WINDOW_SIZE);

    auto chn_left =
        istft_inner(spec.left, window, FFT_WINDOW_SIZE, FFT_HOP_SIZE);
    auto chn_right =
        istft_inner(spec.right, window, FFT_WINDOW_SIZE, FFT_HOP_SIZE);

    audio.left = unpad_signal(chn_left, FFT_WINDOW_SIZE);
    audio.right = unpad_signal(chn_right, FFT_WINDOW_SIZE);

    return audio;
}

static Eigen::FFT<float> get_fft_cfg()
{
    Eigen::FFT<float> cfg;
    cfg.SetFlag(Eigen::FFT<float>::Speedy);
    cfg.SetFlag(Eigen::FFT<float>::HalfSpectrum);
    cfg.SetFlag(Eigen::FFT<float>::Unscaled);
    return cfg;
}

std::vector<std::vector<std::complex<float>>>
stft_inner(const std::vector<float> &waveform, const std::vector<float> &window,
           int nfft, int hop_size)
{
    // Check input
    if (waveform.size() < nfft || window.size() != nfft)
    {
        throw std::invalid_argument(
            "Waveform size must be >= nfft, window size must be == nfft.");
    }

    // Output container
    std::vector<std::vector<std::complex<float>>> output;

    // Create an FFT object
    Eigen::FFT<float> cfg = get_fft_cfg();

    // Loop over the waveform with a stride of hop_size
    for (std::size_t start = 0; start <= waveform.size() - nfft;
         start += hop_size)
    {
        // Apply window and run FFT
        std::vector<float> windowed(nfft);
        std::vector<std::complex<float>> spectrum(nfft / 2 + 1);

        for (int i = 0; i < nfft; ++i)
        {
            windowed[i] = waveform[start + i] * window[i];
        }
        cfg.fwd(spectrum, windowed);

        // Add the spectrum to output
        output.push_back(spectrum);
    }

    return output;
}

std::vector<float>
istft_inner(const std::vector<std::vector<std::complex<float>>> &input,
            const std::vector<float> &window, int nfft, int hop_size)
{
    // Check input
    if (input.empty() || input[0].size() != nfft / 2 + 1 ||
        window.size() != nfft)
    {
        throw std::invalid_argument("Input size is not compatible with nfft "
                                    "or window size does not match nfft.");
    }

    // Compute the window normalization factor
    // using librosa window_sumsquare to compute the squared window
    // https://github.com/librosa/librosa/blob/main/librosa/filters.py#L1545

    float win_n = nfft + hop_size * (input.size() - 1);
    std::vector<float> x(win_n, 0.0f);

    for (int i = 0; i < input.size(); ++i)
    {
        auto sample = i * hop_size;
        for (int j = sample; j < std::min((int)win_n, sample + nfft); ++j)
        {
            x[j] += window[j - sample] * window[j - sample];
        }
    }

    // Output container
    std::vector<float> output(win_n, 0.0f);

    // Create an FFT object
    Eigen::FFT<float> cfg = get_fft_cfg();

    // Loop over the input with a stride of (hop_size)
    for (std::size_t start = 0; start < input.size() * hop_size;
         start += hop_size)
    {
        // Run iFFT
        std::vector<float> waveform(nfft);
        cfg.inv(waveform, input[start / hop_size]);

        // Apply window and add to output
        for (int i = 0; i < nfft; ++i)
        {
            // x[start+i] is the sum of squared window values
            // https://github.com/librosa/librosa/blob/main/librosa/core/spectrum.py#L613
            // 1e-8f is a small number to avoid division by zero
            output[start + i] += waveform[i] * window[i] * 1.0f / float(nfft) /
                                 (x[start + i] + 1e-8f);
        }
    }

    return output;
}
