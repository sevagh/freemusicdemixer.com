#include "dsp.hpp"
#include "inference.hpp"
#include "lstm.hpp"
#include "model.hpp"
#include <cstdlib>
#include <emscripten.h>
#include <iostream>
#include <algorithm>
#include <vector>
#include "wiener.hpp"
#include <array>

std::vector<Eigen::MatrixXf> umxcpp::umx_inference(
    struct umxcpp::umx_model &model,
    const Eigen::MatrixXf audio
)
{
        // number of samples per channel
        size_t N = audio.cols();

        std::cout << "Generating spectrograms" << std::endl;

        struct umxcpp::stft_buffers reusable_stft_buf(N);

        // copy audio to reusable stft buffers
        reusable_stft_buf.waveform = audio;

        // in-place stft
        stft(reusable_stft_buf);
        Eigen::Tensor3dXcf spectrogram = reusable_stft_buf.spec;

        Eigen::Tensor3dXf mix_mag = spectrogram.abs();
        std::vector<Eigen::Tensor3dXf> target_mix_mags;

        // apply umx inference to the magnitude spectrogram
        int hidden_size = model.hidden_size;

        int nb_frames = mix_mag.dimension(1);
        int nb_bins = mix_mag.dimension(2);

        // create one struct for lstm data to not blow up memory too much
        int lstm_hidden_size = model.hidden_size / 2;
        const int SUB_SEQ_FRAMES = 1000;

        int seq_len = nb_frames;
        int sub_seq_len = SUB_SEQ_FRAMES;

        // find out how many sub sequences we need
        // taking into account imperfectly divisible seq_len
        int n_sub_seqs = seq_len / sub_seq_len;
        if (seq_len % sub_seq_len != 0)
        {
            n_sub_seqs += 1;
        }

        int nb_bins_stacked_cropped = 2974;

        std::array<struct umxcpp::lstm_data, 4> streaming_lstm_data = {
                umxcpp::create_lstm_data(lstm_hidden_size, SUB_SEQ_FRAMES),
                umxcpp::create_lstm_data(lstm_hidden_size, SUB_SEQ_FRAMES),
                umxcpp::create_lstm_data(lstm_hidden_size, SUB_SEQ_FRAMES),
                umxcpp::create_lstm_data(lstm_hidden_size, SUB_SEQ_FRAMES)};

        // 2974 is related to bandwidth=16000 Hz in open-unmix
        // wherein frequency bins above 16000 Hz, corresponding to
        // 2974/2 = 1487 bins, are discarded
        //
        // left = 2049 fft bins, cropped to 16000 Hz or :1487
        // right = 2049 fft bins, cropped to :1487
        // stack on top of each other for 2974 total input features
        //
        // this will be fed into the first linear encoder into hidden size
        Eigen::MatrixXf x(nb_frames, nb_bins_stacked_cropped);
        Eigen::MatrixXf x_target(nb_frames, 4098);

        int nb_bins_cropped = 2974 / 2;

        std::cout << "populate eigen matrixxf" << std::endl;
        for (int i = 0; i < nb_frames; i++)
        {
            for (int j = 0; j < nb_bins_cropped; j++)
            {
                // interleave fft frames from each channel
                // fill first half of 2974/2 bins from left
                x(i, j) = mix_mag(0, i, j);
                // fill second half of 2974/2 bins from right
                x(i, j + nb_bins_cropped) = mix_mag(1, i, j);
            }
        }

        for (int target = 0; target < 4; ++target) {
            // copy x into x_input as a sub-sequence
            for (int sub_seq = 0; sub_seq < n_sub_seqs; ++sub_seq)
            {
                std::cout << "Sub sequence for streaming LSTM: " << sub_seq << std::endl;
                std::cout << "Input scaling" << std::endl;
                // get the sub sequence
                Eigen::MatrixXf x_input =
                    x
                        .block(sub_seq * sub_seq_len, 0, sub_seq_len,
                            x.cols());

                // apply formula x = x*input_scale + input_mean
                for (int i = 0; i < x_input.rows(); i++)
                {
                    x_input.row(i) =
                        x_input.row(i).array() * model.input_scale[target].array() +
                        model.input_mean[target].array();
                }

                std::cout << "Target " << target << " fc1" << std::endl;
                x_input *= model.fc1_w[target];

                std::cout << "Target " << target << " bn1" << std::endl;
                // batchnorm1d calculation
                // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
                for (int i = 0; i < x_input.rows(); i++)
                {
                    x_input.row(i) =
                        (((x_input.row(i).array() - model.bn1_rm[target].array()) /
                        (model.bn1_rv[target].array() + 1e-5).sqrt()) *
                            model.bn1_w[target].array() +
                        model.bn1_b[target].array())
                            .tanh();
                }

                std::cout << "Target " << target << " lstm" << std::endl;

                // umx_lstm_forward applies bidirectional 3-layer lstm using a
                // LSTMCell-like approach
                // https://pytorch.org/docs/stable/generated/torch.nn.LSTMCell.html

                // apply the lstm
                auto lstm_out = umxcpp::umx_lstm_forward(
                    &model, target, x_input, &streaming_lstm_data[target],
                    lstm_hidden_size);

                // now the concat trick from umx for the skip conn
                //    # apply 3-layers of stacked LSTM
                //    lstm_out = self.lstm(x)
                //    # lstm skip connection
                //    x = torch.cat([x, lstm_out[0]], -1)
                // concat the lstm_out with the input x
                Eigen::MatrixXf x_inputs_target_concat(x_input.rows(),
                                                    x_input.cols() +
                                                        lstm_out.cols());
                x_inputs_target_concat.leftCols(x_input.cols()) =
                    x_input;
                x_inputs_target_concat.rightCols(lstm_out.cols()) = lstm_out;

                x_input = x_inputs_target_concat;

                std::cout << "Target " << target << " fc2" << std::endl;
                // now time for fc2
                x_input *= model.fc2_w[target];

                std::cout << "Target " << target << " bn2" << std::endl;
                // batchnorm1d calculation
                // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
                for (int i = 0; i < x_input.rows(); i++)
                {
                    x_input.row(i) =
                        (((x_input.row(i).array() - model.bn2_rm[target].array()) /
                        (model.bn2_rv[target].array() + 1e-5).sqrt()) *
                            model.bn2_w[target].array() +
                        model.bn2_b[target].array())
                            .cwiseMax(0);
                }

                std::cout << "Target " << target << " fc3" << std::endl;
                x_input *= model.fc3_w[target];

                std::cout << "Target " << target << " bn3" << std::endl;
                // batchnorm1d calculation
                // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
                for (int i = 0; i < x_input.rows(); i++)
                {
                    x_input.row(i) =
                        ((x_input.row(i).array() - model.bn3_rm[target].array()) /
                        (model.bn3_rv[target].array() + 1e-5).sqrt()) *
                            model.bn3_w[target].array() +
                        model.bn3_b[target].array();
                }

                std::cout << "Target " << target << " output scaling" << std::endl;
                // now output scaling
                // apply formula x = x*output_scale + output_mean
                for (int i = 0; i < x_input.rows(); i++)
                {
                    x_input.row(i) = (x_input.row(i).array() *
                                        model.output_scale[target].array() +
                                    model.output_mean[target].array())
                                        .cwiseMax(0);
                }

                // find right limit
                int start = sub_seq * sub_seq_len;
                int right_lim = std::min(sub_seq_len, (int)x_target.rows()-start);

                // store this sequence into x_target
                // if the last chunk is small, use std::min
                x_target.block(sub_seq * sub_seq_len, 0, right_lim,
                            x_input.cols()) = x_input;

            } // end of sub-sequences

            // element-wise multiplication, taking into account the stacked
            // outputs of the neural network
            std::cout << "Multiply mix mag with computed mask" << std::endl;

            // create copy of mix_mag to store the target mix mags
            Eigen::Tensor3dXf mix_mag_copy = mix_mag;

            for (int i = 0; i < mix_mag.dimension(1); i++)
            {
                for (int j = 0; j < mix_mag.dimension(2); j++)
                {
                    mix_mag_copy(0, i, j) = x_target(i, j) * mix_mag(0, i, j);
                    mix_mag_copy(1, i, j) =
                        x_target(i, j + mix_mag.dimension(2)) * mix_mag(1, i, j);
                }
            }

            target_mix_mags.push_back(mix_mag_copy);
        } // end of targets

        // now wiener time
        std::cout << "Getting complex spec from wiener filtering" << std::endl;

        // now let's get a stereo waveform back first with phase
        std::array<Eigen::Tensor3dXcf, 4> mix_complex_targets =
            wiener_filter(spectrogram, target_mix_mags);

        std::cout << "Getting waveforms from istft" << std::endl;

        std::vector<Eigen::MatrixXf> return_waveforms;

        for (int target = 0; target < 4; ++target) {
            reusable_stft_buf.spec = mix_complex_targets[target];
            istft(reusable_stft_buf);
            return_waveforms.push_back(reusable_stft_buf.waveform);
        }

        return return_waveforms;
    }
