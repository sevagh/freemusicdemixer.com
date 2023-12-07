#ifndef ENCDEC_HPP
#define ENCDEC_HPP

#include "model.hpp"
#include <Eigen/Core>
#include <Eigen/Dense>

namespace demucscpp
{
void apply_freq_encoder(struct demucscpp::demucs_model_4s &model,
                        int encoder_idx, const Eigen::Tensor3dXf &x_in,
                        Eigen::Tensor3dXf &x_out);

// forward declaration to apply a frequency decoder
void apply_freq_decoder(struct demucscpp::demucs_model_4s &model,
                        int decoder_idx, const Eigen::Tensor3dXf &x_in,
                        Eigen::Tensor3dXf &x_out,
                        const Eigen::Tensor3dXf &skip);

// forward declaration to apply a time encoder
void apply_time_encoder(struct demucscpp::demucs_model_4s &model,
                        int encoder_idx, const Eigen::Tensor3dXf &xt_in,
                        Eigen::Tensor3dXf &xt_out);

// forward declaration to apply a time decoder
void apply_time_decoder(struct demucscpp::demucs_model_4s &model,
                        int decoder_idx, const Eigen::Tensor3dXf &xt_in,
                        Eigen::Tensor3dXf &xt_out,
                        const Eigen::Tensor3dXf &skip);
} // namespace demucscpp

#endif // ENCDEC_HPP
