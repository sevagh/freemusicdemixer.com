#ifndef WIENER_HPP
#define WIENER_HPP

#include "dsp.hpp"
#include <string>
#include <vector>
#include <complex>
#include <cmath>

namespace umxcpp {
const float WIENER_EPS = 1e-10f;
const float WIENER_SCALE_FACTOR = 10.0f;

// try a smaller batch for memory issues
const int WIENER_EM_BATCH_SIZE = 200;
const int WIENER_ITERATIONS = 1;

std::array<Eigen::Tensor3dXcf, 4>
wiener_filter(Eigen::Tensor3dXcf &mix_spectrogram,
              const std::vector<Eigen::Tensor3dXf> &targets_mag_spectrograms);
} // namespace umxcpp

#endif // WIENER_HPP
