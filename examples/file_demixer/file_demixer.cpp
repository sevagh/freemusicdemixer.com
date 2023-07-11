#include "dsp.hpp"
#include "lstm.hpp"
#include "model.hpp"
#include <Eigen/Core>
#include <Eigen/Dense>
#include <cassert>
#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <thread>
#include <array>
#include <unsupported/Eigen/FFT>
#include <vector>
#include <libnyquist/Common.h>
#include <libnyquist/Decoders.h>
#include <libnyquist/Encoders.h>

using namespace umxcpp;
using namespace nqr;

// forward declarations
static StereoWaveform load_audio(std::string filename);

static void write_audio_file(const umxcpp::StereoWaveform &waveform,
                      std::string filename);

static std::array<StereoWaveform, 4> separate(struct umxcpp::umx_model *model, const StereoWaveform &audio);

int main(int argc, const char **argv)
{
    if (argc != 4)
    {
        std::cerr << "Usage: " << argv[0] << " <model dir> <wav file> <out dir>"
                  << std::endl;
        exit(1);
    }

    std::cout << "umx.cpp Main driver program" << std::endl;

    // load model passed as argument
    std::string model_dir = argv[1];

    // load audio passed as argument
    std::string wav_file = argv[2];

    // output dir passed as argument
    std::string out_dir = argv[3];

    // initialize a struct umx_model
    struct umx_model model
    {
    };

    auto ret = load_umx_model(model_dir, &model);
    std::cout << "umx_model_load returned " << (ret ? "true" : "false")
              << std::endl;
    if (!ret)
    {
        std::cerr << "Error loading model" << std::endl;
        exit(1);
    }

    StereoWaveform audio = load_audio(wav_file);

    std::array<StereoWaveform, 4> target_waveforms = separate(&model, audio);

    for (int target = 0; target < 4; target++) {
        // now write the 4 audio waveforms to files in the output dir
        // using libnyquist
        // join out_dir with "/target_0.wav"
        // using std::filesystem::path;

        std::filesystem::path p = out_dir;
        // make sure the directory exists
        std::filesystem::create_directories(p);

        auto p_target = p;
        switch(target) {
            case 0:
                p_target = p_target / "bass.wav";
                break;
            case 1:
                p_target = p_target / "drums.wav";
                break;
            case 2:
                p_target = p_target / "other.wav";
                break;
            case 3:
                p_target = p_target / "vocals.wav";
                break;
        }

        std::cout << "Writing wav file " << p_target << std::endl;

        write_audio_file(target_waveforms[target], p_target);
    }
}

static umxcpp::StereoWaveform load_audio(std::string filename)
{
    // load a wav file with libnyquist
    std::shared_ptr<AudioData> fileData = std::make_shared<AudioData>();

    NyquistIO loader;

    loader.Load(fileData.get(), filename);

    if (fileData->sampleRate != SUPPORTED_SAMPLE_RATE)
    {
        std::cerr
            << "[ERROR] umx.cpp only supports the following sample rate (Hz): "
            << SUPPORTED_SAMPLE_RATE << std::endl;
        exit(1);
    }

    std::cout << "Input Samples: " << fileData->samples.size() << std::endl;
    std::cout << "Length in seconds: " << fileData->lengthSeconds << std::endl;
    std::cout << "Number of channels: " << fileData->channelCount << std::endl;

    if (fileData->channelCount != 2 && fileData->channelCount != 1)
    {
        std::cerr << "[ERROR] umx.cpp only supports mono and stereo audio"
                  << std::endl;
        exit(1);
    }

    // number of samples per channel
    size_t N = fileData->samples.size() / fileData->channelCount;

    // create a struct to hold two float vectors for left and right channels
    umxcpp::StereoWaveform ret;
    ret.left.resize(N);
    ret.right.resize(N);

    if (fileData->channelCount == 1)
    {
        // Mono case
        for (size_t i = 0; i < N; ++i)
        {
            ret.left[i] = fileData->samples[i];  // left channel
            ret.right[i] = fileData->samples[i]; // right channel
        }
    }
    else
    {
        // Stereo case
        for (size_t i = 0; i < N; ++i)
        {
            ret.left[i] = fileData->samples[2 * i];      // left channel
            ret.right[i] = fileData->samples[2 * i + 1]; // right channel
        }
    }

    return ret;
}

// write a function to write a StereoWaveform to a wav file
static void write_audio_file(const umxcpp::StereoWaveform &waveform,
                              std::string filename)
{
    // create a struct to hold the audio data
    std::shared_ptr<AudioData> fileData = std::make_shared<AudioData>();

    // set the sample rate
    fileData->sampleRate = SUPPORTED_SAMPLE_RATE;

    // set the number of channels
    fileData->channelCount = 2;

    // set the number of samples
    fileData->samples.resize(waveform.left.size() * 2);

    // write the left channel
    for (size_t i = 0; i < waveform.left.size(); ++i)
    {
        fileData->samples[2 * i] = waveform.left[i];
    }

    // write the right channel
    for (size_t i = 0; i < waveform.right.size(); ++i)
    {
        fileData->samples[2 * i + 1] = waveform.right[i];
    }

    int encoderStatus =
        encode_wav_to_disk({fileData->channelCount, PCM_FLT, DITHER_TRIANGLE},
                           fileData.get(), filename);
    std::cout << "Encoder Status: " << encoderStatus << std::endl;
}

std::array<StereoWaveform, 4> separate(
    struct umxcpp::umx_model *model,
    const StereoWaveform &audio) {
    std::array<StereoWaveform, 4> ret;

    StereoSpectrogramC spectrogram = stft(audio);
    StereoSpectrogramR mix_mag = magnitude(spectrogram);
    StereoSpectrogramR mix_phase = phase(spectrogram);

    // apply umx inference to the magnitude spectrogram
    int hidden_size = model->hidden_size;

    int nb_frames = mix_mag.left.size();
    int nb_bins = mix_mag.left[0].size();

    // input shape is (nb_frames*nb_samples, nb_channels*nb_bins) i.e. 2049*2
    assert(nb_bins == 2049);

    // 2974 is related to bandwidth=16000 Hz in open-unmix
    // wherein frequency bins above 16000 Hz, corresponding to
    // 2974/2 = 1487 bins, are discarded
    //
    // left = 2049 fft bins, cropped to 16000 Hz or :1487
    // right = 2049 fft bins, cropped to :1487
    // stack on top of each other for 2974 total input features
    //
    // this will be fed into the first linear encoder into hidden size
    Eigen::MatrixXf x(nb_frames, 2974);

    int nb_bins_cropped = 2974 / 2;

    for (int i = 0; i < nb_frames; i++)
    {
        for (int j = 0; j < nb_bins_cropped; j++)
        {
            // interleave fft frames from each channel
            // fill first half of 2974/2 bins from left
            x(i, j) = mix_mag.left[i][j];
            // fill second half of 2974/2 bins from right
            x(i, j + nb_bins_cropped) = mix_mag.right[i][j];
        }
    }

    std::array<Eigen::MatrixXf, 4> x_inputs = umx_inference(model, x, hidden_size);

    for (int target = 0; target < x_inputs.size(); ++target) {
        // print min and max elements of x_inputs[target]
        std::cout << "POST-RELU-FINAL x_inputs[target] min: "
                    << x_inputs[target].minCoeff()
                    << " x_inputs[target] max: " << x_inputs[target].maxCoeff()
                    << std::endl;

        // copy mix-mag
        StereoSpectrogramR mix_mag_target(mix_mag);

        // element-wise multiplication, taking into account the stacked outputs of the
        // neural network
        for (std::size_t i = 0; i < mix_mag.left.size(); i++)
        {
            for (std::size_t j = 0; j < mix_mag.left[0].size(); j++)
            {
                mix_mag_target.left[i][j] *= x_inputs[target](i, j);
                mix_mag_target.right[i][j] *=
                    x_inputs[target](i, j + mix_mag.left[0].size());
            }
        }

        // now let's get a stereo waveform back first with phase
        StereoSpectrogramC mix_complex_target =
            combine(mix_mag_target, mix_phase);

        ret[target] = istft(mix_complex_target);
    }
    return ret;
}
