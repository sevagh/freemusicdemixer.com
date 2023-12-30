#ifndef CROSSTRANSFORMER_HPP
#define CROSSTRANSFORMER_HPP

#include "model.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>

namespace demucscpp
{
void apply_crosstransformer(
    struct demucscpp::demucs_model &model,
    Eigen::Tensor3dXf &x, // frequency branch
    Eigen::Tensor3dXf &xt // time branch with leading dim (1, ...)
);
} // namespace demucscpp

#endif // CROSSTRANSFORMER_HPP
