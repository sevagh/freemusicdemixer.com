#ifndef MODEL_HPP
#define MODEL_HPP

#include <Eigen/Dense>
#include <array>
#include <string>
#include <vector>

namespace umxcpp
{

struct umx_model
{
    // input_mean, input_scale which are learned for whatever reason
    // despite data whitening not being used in inference?
    Eigen::MatrixXf input_mean[4];
    Eigen::MatrixXf input_scale[4];
    Eigen::MatrixXf output_mean[4];
    Eigen::MatrixXf output_scale[4];

    // umx.fc1, fc2, fc3 with no bias
    Eigen::MatrixXf fc1_w[4];
    Eigen::MatrixXf fc2_w[4];
    Eigen::MatrixXf fc3_w[4];

    // umx.bn1, bn2, bn3
    Eigen::MatrixXf bn1_w[4];
    Eigen::MatrixXf bn1_b[4];
    Eigen::MatrixXf bn1_rm[4];
    Eigen::MatrixXf bn1_rv[4];

    Eigen::MatrixXf bn2_w[4];
    Eigen::MatrixXf bn2_b[4];
    Eigen::MatrixXf bn2_rm[4];
    Eigen::MatrixXf bn2_rv[4];

    Eigen::MatrixXf bn3_w[4];
    Eigen::MatrixXf bn3_b[4];
    Eigen::MatrixXf bn3_rm[4];
    Eigen::MatrixXf bn3_rv[4];

    // umx.lstm: 3 lstm layers: 4 targets 3 layers 2 directions
    // (forward/reverse) input gates (ih) weight + bias hidden gates (hh) weight
    // + bias reverse input gates (ih) weight + bias reverse hidden gates (hh)
    // weight + bias
    Eigen::MatrixXf lstm_ih_w[4][3][2];
    Eigen::MatrixXf lstm_ih_b[4][3][2];
    Eigen::MatrixXf lstm_hh_w[4][3][2];
    Eigen::MatrixXf lstm_hh_b[4][3][2];

    int hidden_size;

    bool is_initialized = false;
    float load_progress = 0.0f;
    float inference_progress = 0.0f;
};

bool load_umx_model(const std::string &model_dir, struct umx_model *model);
} // namespace umxcpp

#endif // MODEL_HPP
