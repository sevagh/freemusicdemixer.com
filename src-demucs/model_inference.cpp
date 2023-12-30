#include "crosstransformer.hpp"
#include "dsp.hpp"
#include "encdec.hpp"
#include "layers.hpp"
#include "model.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <random>
#include <sstream>
#include <string>
#include <tuple>
#include <unsupported/Eigen/FFT>
#include <unsupported/Eigen/MatrixFunctions>
#include <vector>

// Function to do reflection padding
static void reflect_padding(Eigen::MatrixXf &padded_mix,
                            const Eigen::MatrixXf &mix, int left_padding,
                            int right_padding)
{
    // Assumes padded_mix has size (2, N + left_padding + right_padding)
    // Assumes mix has size (2, N)

    int N = mix.cols(); // The original number of columns

    // Copy the original mix into the middle of padded_mix
    padded_mix.block(0, left_padding, 2, N) = mix;

    // Reflect padding on the left
    for (int i = 0; i < left_padding; ++i)
    {
        padded_mix.block(0, left_padding - 1 - i, 2, 1) = mix.block(0, i, 2, 1);
    }

    // Reflect padding on the right
    for (int i = 0; i < right_padding; ++i)
    {
        padded_mix.block(0, N + left_padding + i, 2, 1) =
            mix.block(0, N - 1 - i, 2, 1);
    }
}

void demucscpp::model_inference(
    struct demucscpp::demucs_model &model,
    struct demucscpp::demucs_segment_buffers &buffers,
    struct demucscpp::stft_buffers &stft_buf)
{
    // apply demucs inference
    std::cout << "3., apply_model mix shape: (" << buffers.mix.rows() << ", "
              << buffers.mix.cols() << ")" << std::endl;

    // pad buffers.pad on the left, reflect
    // pad buffers.pad_end on the right, reflect
    // copy buffers.mix into buffers.padded_mix with reflect padding as above
    reflect_padding(buffers.padded_mix, buffers.mix, buffers.pad,
                    buffers.pad_end);

    // copy buffers.padded_mix into stft_buf.waveform
    stft_buf.waveform = buffers.padded_mix;

    // let's get a stereo complex spectrogram first
    demucscpp::stft(stft_buf);

    // remove 2: 2 + le of stft
    // same behavior as _spec in the python apply.py code
    buffers.z = stft_buf.spec.slice(
        Eigen::array<int, 3>{0, 0, 2},
        Eigen::array<int, 3>{2, (int)stft_buf.spec.dimension(1),
                             (int)stft_buf.spec.dimension(2) - 4});

    // print z shape
    std::cout << "buffers.z: " << buffers.z.dimension(0) << ", "
              << buffers.z.dimension(1) << ", " << buffers.z.dimension(2)
              << std::endl;

    // x = mag = z.abs(), but for CaC we're simply stacking the complex
    // spectrogram along the channel dimension
    for (int i = 0; i < buffers.z.dimension(0); ++i)
    {
        // limiting to j-1 because we're dropping 2049 to 2048 bins
        for (int j = 0; j < buffers.z.dimension(1) - 1; ++j)
        {
            for (int k = 0; k < buffers.z.dimension(2); ++k)
            {
                buffers.x(2 * i, j, k) = buffers.z(i, j, k).real();
                buffers.x(2 * i + 1, j, k) = buffers.z(i, j, k).imag();
            }
        }
    }

    // x shape is complex*chan, nb_frames, nb_bins (2048)
    // using CaC (complex-as-channels)
    // print x shape
    std::cout << "buffers.x: " << buffers.x.dimension(0) << ", "
              << buffers.x.dimension(1) << ", " << buffers.x.dimension(2)
              << std::endl;

    // apply following pytorch operations to buffers.x in Eigen C++ code:
    //  mean = x.mean(dim=(1, 2, 3), keepdim=True)
    //  std = x.std(dim=(1, 2, 3), keepdim=True)
    //  x = (x - mean) / (1e-5 + std)

    // Compute mean and standard deviation using Eigen
    Eigen::Tensor<float, 0> mean_tensor = buffers.x.mean();
    float mean = mean_tensor(0);
    float variance = demucscpp::calculate_variance(buffers.x, mean);
    float std_ = std::sqrt(variance);

    // Normalize x
    const float epsilon = 1e-5;

    // buffers.x will be the freq branch input
    buffers.x = (buffers.x - mean) / (std_ + epsilon);

    // prepare time branch input by copying buffers.mix into buffers.xt(0, ...)
    for (int i = 0; i < buffers.mix.rows(); ++i)
    {
        for (int j = 0; j < buffers.mix.cols(); ++j)
        {
            buffers.xt(0, i, j) = buffers.mix(i, j);
        }
    }

    std::cout << "Freq branch: normalized" << std::endl;

    // apply similar mean, std normalization as above using 2d mean, std
    Eigen::Tensor<float, 0> meant_tensor = buffers.xt.mean();
    float meant = meant_tensor(0);
    float variancet = demucscpp::calculate_variance(buffers.xt, meant);
    float stdt = std::sqrt(variancet);

    // Normalize x
    buffers.xt = (buffers.xt - meant) / (stdt + epsilon);

    std::cout << "Time branch: normalized" << std::endl;

    // buffers.xt will be the time branch input

    /* HEART OF INFERENCE CODE HERE !! */
    // ITERATION 0

    // apply tenc, enc

    demucscpp::apply_time_encoder(model, 0, buffers.xt, buffers.xt_0);
    std::cout << "Time encoder 0" << std::endl;

    demucscpp::apply_freq_encoder(model, 0, buffers.x, buffers.x_0);
    std::cout << "Freq encoder 0" << std::endl;

    // absorb both scaling factors in one expression
    //   i.e. eliminate const float freq_emb_scale = 0.2f;
    const float emb_scale = 10.0f * 0.2f;

    Eigen::MatrixXf emb =
        model.freq_emb_embedding_weight.transpose() * emb_scale;

    // apply embedding to buffers.x_0
    for (int i = 0; i < 48; ++i)
    {
        for (int j = 0; j < 512; ++j)
        {
            for (int k = 0; k < buffers.x_0.dimension(2); ++k)
            {
                // implicit broadcasting
                buffers.x_0(i, j, k) += emb(i, j);
            }
        }
    }

    buffers.saved_0 = buffers.x_0;
    buffers.savedt_0 = buffers.xt_0;

    std::cout << "Freq branch: applied frequency embedding" << std::endl;

    apply_time_encoder(model, 1, buffers.xt_0, buffers.xt_1);
    std::cout << "Time encoder 1" << std::endl;

    apply_freq_encoder(model, 1, buffers.x_0, buffers.x_1);
    std::cout << "Freq encoder 1" << std::endl;

    buffers.saved_1 = buffers.x_1;
    buffers.savedt_1 = buffers.xt_1;

    apply_time_encoder(model, 2, buffers.xt_1, buffers.xt_2);
    std::cout << "Time encoder 2" << std::endl;

    apply_freq_encoder(model, 2, buffers.x_1, buffers.x_2);
    std::cout << "Freq encoder 2" << std::endl;

    buffers.saved_2 = buffers.x_2;
    buffers.savedt_2 = buffers.xt_2;

    apply_time_encoder(model, 3, buffers.xt_2, buffers.xt_3);
    std::cout << "Time encoder 3" << std::endl;

    apply_freq_encoder(model, 3, buffers.x_2, buffers.x_3);
    std::cout << "Freq encoder 3" << std::endl;

    buffers.saved_3 = buffers.x_3;
    buffers.savedt_3 = buffers.xt_3;

    if (model.is_4sources) {
        auto* ct_4s = static_cast<demucs_crosstransformer_4s*>(model.crosstransformer.get());
        // bottom channels = 512

        /*****************************/
        /*  FREQ CHANNEL UPSAMPLING  */
        /*****************************/
        int n_stft_frames = buffers.x_3.dimension(2);

        // Reshape buffers.x_3 into x_3_reshaped
        // Apply the conv1d function
        // Reshape back to 512x8x336 and store in buffers.x_3_channel_upsampled
        Eigen::Tensor3dXf x_3_reshaped =
            buffers.x_3.reshape(Eigen::array<int, 3>({1, 384, 8 * n_stft_frames}));
        Eigen::Tensor3dXf x_3_reshaped_upsampled =
            demucscpp::conv1d<384, 512, 1, 1, 0, 1>(x_3_reshaped,
                                                    ct_4s->channel_upsampler_weight,
                                                    ct_4s->channel_upsampler_bias);
        buffers.x_3_channel_upsampled = x_3_reshaped_upsampled.reshape(
            Eigen::array<int, 3>({512, 8, n_stft_frames}));

        std::cout << "Freq: channels upsampled" << std::endl;

        /*****************************/
        /*  TIME CHANNEL UPSAMPLING  */
        /*****************************/

        // for time channel upsampling
        // apply upsampler directly to xt_3 no reshaping drama needed
        buffers.xt_3_channel_upsampled = demucscpp::conv1d<384, 512, 1, 1, 0, 1>(
            buffers.xt_3, ct_4s->channel_upsampler_t_weight,
            ct_4s->channel_upsampler_t_bias);

        std::cout << "Time: channels upsampled" << std::endl;

        /*************************/
        /*  CROSS-TRANSFORMER!  */
        /************************/
        demucscpp::apply_crosstransformer(model, buffers.x_3_channel_upsampled,
                                        buffers.xt_3_channel_upsampled);

        std::cout << "Crosstransformer: finished" << std::endl;

        // reshape buffers.x_3_channel_upsampled into 1, 512, 2688
        // when skipping the crosstransformer
        // Eigen::Tensor3dXf x_3_reshaped_upsampled_2 =
        // buffers.x_3_channel_upsampled.reshape(Eigen::array<int, 3>({1, 512,
        // 8*336})); buffers.x_3_channel_upsampled = x_3_reshaped_upsampled_2;

        // then apply the conv1d_2d function

        Eigen::Tensor3dXf x_3_reshaped_downsampled =
            demucscpp::conv1d<512, 384, 1, 1, 0, 0>(
                buffers.x_3_channel_upsampled, ct_4s->channel_downsampler_weight,
                ct_4s->channel_downsampler_bias);
        buffers.x_3 = x_3_reshaped_downsampled.reshape(
            Eigen::array<int, 3>({384, 8, n_stft_frames}));
        std::cout << "Freq: channels downsampled" << std::endl;

        // apply upsampler directly to xt_3
        buffers.xt_3 = demucscpp::conv1d<512, 384, 1, 1, 0, 0>(
            buffers.xt_3_channel_upsampled, ct_4s->channel_downsampler_t_weight,
            ct_4s->channel_downsampler_t_bias);

        std::cout << "Time: channels downsampled" << std::endl;
    } else {
        /*************************/
        /*  CROSS-TRANSFORMER!  */
        /************************/
        demucscpp::apply_crosstransformer(model, buffers.x_3,
                                        buffers.xt_3);
        // we need to swap axis and reshape into 384, 8, 336

        // swap axis
        Eigen::array<int, 3> perm = {1, 0, 2};
        Eigen::Tensor3dXf x_3_swapped = buffers.x_3.shuffle(perm);
        // now unflatten last 2 dims from 1, 2688 to 8, 336

        Eigen::Tensor3dXf x_3_reshaped = x_3_swapped.reshape(
            Eigen::array<int, 3>({384, 8, 336}));

        buffers.x_3 = x_3_reshaped;

        std::cout << "Crosstransformer: finished" << std::endl;
    }

    // now decoder time!

    // skip == saved_3
    demucscpp::apply_freq_decoder(model, 0, buffers.x_3, buffers.x_2,
                                  buffers.saved_3);
    std::cout << "Freq: decoder 0" << std::endl;

    demucscpp::apply_time_decoder(model, 0, buffers.xt_3, buffers.xt_2,
                                  buffers.savedt_3);
    std::cout << "Time: decoder 0" << std::endl;

    demucscpp::apply_freq_decoder(model, 1, buffers.x_2, buffers.x_1,
                                  buffers.saved_2);
    std::cout << "Freq: decoder 1" << std::endl;

    demucscpp::apply_time_decoder(model, 1, buffers.xt_2, buffers.xt_1,
                                  buffers.savedt_2);
    std::cout << "Time: decoder 1" << std::endl;

    demucscpp::apply_freq_decoder(model, 2, buffers.x_1, buffers.x_0,
                                  buffers.saved_1);
    std::cout << "Freq: decoder 2" << std::endl;

    demucscpp::apply_time_decoder(model, 2, buffers.xt_1, buffers.xt_0,
                                  buffers.savedt_1);
    std::cout << "Time: decoder 2" << std::endl;

    demucscpp::apply_freq_decoder(model, 3, buffers.x_0, buffers.x_out,
                                  buffers.saved_0);
    std::cout << "Freq: decoder 3" << std::endl;

    demucscpp::apply_time_decoder(model, 3, buffers.xt_0, buffers.xt_out,
                                  buffers.savedt_0);
    std::cout << "Time: decoder 3" << std::endl;

    std::cout << "Mask + istft" << std::endl;

    // xt dim 1 is a fake dim of 1
    // so we could have symmetry between the tensor3dxf of the freq and time
    // branches

    int nb_out_sources = model.is_4sources ? 4 : 6;

    // 4 sources, 2 channels * 2 complex channels (real+imag), F bins, T frames
    Eigen::Tensor4dXf x_4d =
        Eigen::Tensor4dXf(nb_out_sources, 4, buffers.x.dimension(1), buffers.x.dimension(2));

    // 4 sources, 2 channels, N samples
    std::vector<Eigen::MatrixXf> xt_3d = {
        Eigen::MatrixXf(2, buffers.xt.dimension(2)),
        Eigen::MatrixXf(2, buffers.xt.dimension(2)),
        Eigen::MatrixXf(2, buffers.xt.dimension(2)),
        Eigen::MatrixXf(2, buffers.xt.dimension(2))};

    // add two more sources
    if (!model.is_4sources) {
        xt_3d.push_back(Eigen::MatrixXf(2, buffers.xt.dimension(2)));
        xt_3d.push_back(Eigen::MatrixXf(2, buffers.xt.dimension(2)));
    }

    // distribute the channels of buffers.x into x_4d
    // in pytorch it's (16, 2048, 336) i.e. (chan, freq, time)
    // then apply `.view(4, -1, freq, time)

    // implement above logic in Eigen C++
    // copy buffers.x into x_4d
    // apply opposite of
    // buffers.x(i, j, k) = (buffers.x(i, j, k) - mean) / (epsilon + std_);
    for (int s = 0; s < nb_out_sources; ++s)
    { // loop over 4 sources
        for (int i = 0; i < 4; ++i)
        {
            for (int j = 0; j < buffers.x.dimension(1); ++j)
            {
                for (int k = 0; k < buffers.x.dimension(2); ++k)
                {
                    x_4d(s, i, j, k) =
                        std_ * buffers.x_out(s * 4 + i, j, k) + mean;
                }
            }
        }
    }

    // let's also copy buffers.xt into xt_4d
    for (int s = 0; s < nb_out_sources; ++s)
    { // loop over 4 sources
        for (int i = 0; i < 2; ++i)
        {
            for (int j = 0; j < buffers.xt.dimension(2); ++j)
            {
                xt_3d[s](i, j) = stdt * buffers.xt_out(0, s * 2 + i, j) + meant;
            }
        }
    }

    // If `cac` is True, `m` is actually a full spectrogram and `z` is ignored.
    // undo complex-as-channels by splitting the 2nd dim of x_4d into (2, 2)
    for (int source = 0; source < nb_out_sources; ++source)
    {
        Eigen::Tensor3dXcf x_target = Eigen::Tensor3dXcf(
            2, buffers.x.dimension(1), buffers.x.dimension(2));

        // in the CaC case, we're simply unstacking the complex
        // spectrogram from the channel dimension
        for (int i = 0; i < buffers.z.dimension(0); ++i)
        {
            // limiting to j-1 because we're dropping 2049 to 2048 bins
            for (int j = 0; j < buffers.z.dimension(1) - 1; ++j)
            {
                for (int k = 0; k < buffers.z.dimension(2); ++k)
                {
                    // buffers.x(2*i, j, k) = buffers.z(i, j, k).real();
                    // buffers.x(2*i + 1, j, k) = buffers.z(i, j, k).imag();
                    x_target(i, j, k) =
                        std::complex<float>(x_4d(source, 2 * i, j, k),
                                            x_4d(source, 2 * i + 1, j, k));
                }
            }
        }

        // need to re-pad 2: 2 + le on spectrogram
        // opposite of this
        // buffers.z = stft_buf.spec.slice(Eigen::array<int, 3>{0, 0, 2},
        //         Eigen::array<int, 3>{2, (int)stft_buf.spec.dimension(1),
        //         (int)stft_buf.spec.dimension(2) - 4});
        // Add padding to spectrogram

        Eigen::array<std::pair<int, int>, 3> paddings = {
            std::make_pair(0, 0), std::make_pair(0, 1), std::make_pair(2, 2)};
        Eigen::Tensor3dXcf x_target_padded =
            x_target.pad(paddings, std::complex<float>(0.0f, 0.0f));

        stft_buf.spec = x_target_padded;

        demucscpp::istft(stft_buf);

        // now we have waveform from istft(x), the frequency branch
        // that we need to sum with xt, the time branch
        Eigen::MatrixXf padded_waveform = stft_buf.waveform;

        // undo the reflect pad 1d by copying padded_mix into mix
        // from range buffers.pad:buffers.pad + buffers.segment_samples
        Eigen::MatrixXf unpadded_waveform =
            padded_waveform.block(0, buffers.pad, 2, buffers.segment_samples);

        // sum with xt
        // choose a different source to sum with in case
        // they're in different orders...
        unpadded_waveform += xt_3d[source];

        std::cout << "mix: " << buffers.mix.rows() << ", " << buffers.mix.cols()
                  << std::endl;

        // copy target waveform into all 4 dims of targets_out
        for (int j = 0; j < 2; ++j)
        {
            for (int k = 0; k < buffers.mix.cols(); ++k)
            {
                buffers.targets_out(source, j, k) = unpadded_waveform(j, k);
            }
        }
    }
}
