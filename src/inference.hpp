#ifndef INFERENCE_HPP
#define INFERENCE_HPP

#include "dsp.hpp"
#include "model.hpp"
#include <Eigen/Dense>
#include <Eigen/Core>

namespace umxcpp {

// return 4 target waveforms from 1 target mix
// do wiener-filtering and everything per-chunk
std::vector<StereoWaveform> umx_inference(
     struct umx_model &model,
     StereoWaveform audio
);

}; // namespace umxcpp

#endif // INFERENCE_HPP
