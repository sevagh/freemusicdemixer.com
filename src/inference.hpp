#ifndef INFERENCE_HPP
#define INFERENCE_HPP

#include "dsp.hpp"
#include "lstm.hpp"
#include "model.hpp"
#include <Eigen/Dense>
#include <Eigen/Core>

namespace umxcpp {

const float SEGMENT_LEN_SECS = 60.0f;
const float MAX_SHIFT_SECS = 0.5; // max shift
const float OVERLAP = 0.25; // overlap between segments
const float TRANSITION_POWER = 1.0; // transition between segments

// return 4 target waveforms from 1 target mix
// do wiener-filtering and everything per-chunk
std::vector<Eigen::MatrixXf> umx_inference(
    struct umx_model &model,
    const Eigen::MatrixXf audio,
    struct umxcpp::stft_buffers reusable_stft_buf,
    std::array<struct umxcpp::lstm_data, 4> &streaming_lstm_data
);

}; // namespace umxcpp

#endif // INFERENCE_HPP
