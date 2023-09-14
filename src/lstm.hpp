#ifndef LSTM_HPP
#define LSTM_HPP

#include "model.hpp"
#include <Eigen/Dense>

namespace umxcpp
{

struct lstm_data
{
    Eigen::MatrixXf output_per_direction[3][2];
    Eigen::MatrixXf output[3];
    Eigen::MatrixXf h[3][2];
    Eigen::MatrixXf c[3][2];
};

struct lstm_data create_lstm_data(int hidden_size, int seq_len);

void umx_lstm_set_zero(struct lstm_data *data);

Eigen::MatrixXf umx_lstm_forward(struct umx_model *model, int target,
                                 const Eigen::MatrixXf &input,
                                 struct lstm_data *data, int hidden_size);

}; // namespace umxcpp

#endif // LSTM_HPP
