#ifndef DSP_HPP
#define DSP_HPP

#include <complex>
#include <string>
#include <unsupported/Eigen/FFT>
#include <vector>

namespace umxcpp
{

const int SUPPORTED_SAMPLE_RATE = 44100;
const int FFT_WINDOW_SIZE = 4096;

const int FFT_HOP_SIZE = 1024; // 25% hop i.e. 75% overlap

// create a struct to hold two float vectors for left and right channels
// simply give it two fields std::vector<float> left and std::vector<float>
// right
struct StereoWaveform
{
    std::vector<float> left;
    std::vector<float> right;
};

// complex-valued
struct StereoSpectrogramC
{
    // dimensions: frames x frequency bins (typically 1+NFFT//2)
    std::vector<std::vector<std::complex<float>>> left;
    std::vector<std::vector<std::complex<float>>> right;
};

// real-valued (can be used for mag or phase)
struct StereoSpectrogramR
{
    // dimensions: frames x frequency bins (typically 1+NFFT//2)
    std::vector<std::vector<float>> left;
    std::vector<std::vector<float>> right;

    // Define a default constructor that initializes the vectors to empty
    StereoSpectrogramR() : left(), right() {}

    // Define a copy constructor that performs a deep copy of the vectors
    StereoSpectrogramR(const StereoSpectrogramR &other)
        : left(other.left), right(other.right)
    {
    }
};

// get real StereoSpectrogramR which are the magnitude, phase of the input
// StereoSpectrogramC
StereoSpectrogramR magnitude(const StereoSpectrogramC &spec);
StereoSpectrogramR phase(const StereoSpectrogramC &spec);

// combine magnitude and phase StereoSpectrogramR into complex
// StereoSpectrogramC
StereoSpectrogramC combine(const StereoSpectrogramR &mag,
                           const StereoSpectrogramR &phase);

StereoSpectrogramC stft(const StereoWaveform &audio);
StereoWaveform istft(const StereoSpectrogramC &spec);

} // namespace umxcpp

#endif // DSP_HPP
