#include "layers.hpp"
#include "model.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>
#include <unsupported/Eigen/CXX11/Tensor>

Eigen::Tensor3dXf demucscpp::group_norm(const Eigen::Tensor3dXf &x,
                                        const Eigen::Tensor1dXf &weight,
                                        const Eigen::Tensor1dXf &b,
                                        int num_groups, float eps)
{
    int freq = x.dimension(0);
    int channels = x.dimension(1);
    int width = x.dimension(2);

    Eigen::Tensor3dXf y_out(freq, channels, width);
    y_out.setZero();

    int group_size = channels / num_groups;

    for (int i = 0; i < freq; ++i)
    {
        for (int g = 0; g < num_groups; ++g)
        {
            int start = g * group_size;
            int end = (g + 1) * group_size;

            Eigen::Tensor3dXf slice =
                x.slice(Eigen::array<int, 3>{i, start, 0},
                        Eigen::array<int, 3>{1, group_size, width});
            Eigen::Tensor<float, 0> mean_tensor = slice.mean();
            float mean = mean_tensor(0);
            float var = demucscpp::calculate_variance(slice, mean);

            for (int c = start; c < end; ++c)
            {
                for (int w = 0; w < width; ++w)
                {
                    float norm_val = (x(i, c, w) - mean) / std::sqrt(var + eps);
                    y_out(i, c, w) = norm_val * weight(c) + b(c);
                }
            }
        }
    }

    return y_out;
}

Eigen::Tensor3dXf demucscpp::group_norm_fused_gelu(const Eigen::Tensor3dXf &x,
                                                   const Eigen::Tensor1dXf &weight,
                                                   const Eigen::Tensor1dXf &bias,
                                                   float eps)
{
    int freq = x.dimension(0);
    int channels = x.dimension(1);
    int width = x.dimension(2);

    Eigen::Tensor3dXf y_out(freq, channels, width);
    y_out.setZero();

    // Normalizing over the entire channel since num_groups is always 1
    for (int i = 0; i < freq; ++i)
    {
        // Calculate mean and variance for the entire channel
        Eigen::Tensor2dXf slice = x.chip<0>(i);
        Eigen::Tensor<float, 0> mean_tensor = slice.mean();
        float mean = mean_tensor(0);
        float var = demucscpp::calculate_variance(slice, mean);

        for (int c = 0; c < channels; ++c)
        {
            for (int w = 0; w < width; ++w)
            {
                // Normalize
                float norm_val = (x(i, c, w) - mean) / std::sqrt(var + eps);

                // Apply GroupNorm weight and bias
                norm_val = norm_val * weight(c) + bias(c);

                // Apply GeLU activation
                float activated_val = 0.5f * norm_val * (1.0f + std::erf(norm_val / std::sqrt(2.0f)));

                // Assign the activated value back to the tensor
                y_out(i, c, w) = activated_val;
            }
        }
    }

    return y_out;
}

Eigen::Tensor3dXf demucscpp::glu(const Eigen::Tensor3dXf &x, const int dim)
{
    if (x.dimension(dim) % 2 != 0)
    {
        std::cerr << "Dimension size must be evenly divisible by 2"
                  << std::endl;
        std::exit(1);
    }

    int split_size = x.dimension(dim) / 2;

    Eigen::array<int, 3> start_indices = {0, 0, 0};
    Eigen::array<int, 3> sizes = {(int)x.dimension(0), (int)x.dimension(1),
                                  (int)x.dimension(2)};
    start_indices[dim] = split_size;
    sizes[dim] = split_size;

    auto first_half = x.slice(Eigen::array<int, 3>({0, 0, 0}), sizes);
    auto second_half = x.slice(start_indices, sizes);
    auto sigmoid_second_half = second_half.unaryExpr(
        [](float v) { return 1.0f / (1.0f + std::exp(-v)); });

    return first_half * sigmoid_second_half;
}

Eigen::Tensor3dXf demucscpp::layer_norm(const Eigen::Tensor3dXf &x,
                                        const Eigen::Tensor1dXf &weight,
                                        const Eigen::Tensor1dXf &bias,
                                        float eps)
{
    int freq = x.dimension(0);
    int channels = x.dimension(1);
    int width = x.dimension(2);

    Eigen::Tensor3dXf y_out(freq, channels, width);

    for (int i = 0; i < freq; ++i)
    {
        for (int c = 0; c < channels; ++c)
        {
            Eigen::Tensor1dXf slice = x.chip(i, 0).chip(c, 0);
            Eigen::Tensor<float, 0> mean_tensor = slice.mean();
            float mean = mean_tensor(0);
            float var = demucscpp::calculate_variance(slice, mean);

            for (int w = 0; w < width; ++w)
            {
                float norm_val = (x(i, c, w) - mean) / std::sqrt(var + eps);
                y_out(i, c, w) = norm_val * weight(w) + bias(w);
            }
        }
    }

    return y_out;
}

void demucscpp::apply_dconv(struct demucscpp::demucs_model &model,
                            Eigen::Tensor3dXf &y, int freq_idx, int encdec_idx,
                            int layer_idx, int mid_crop)
{
    // store another copy of y to sum back later
    Eigen::Tensor3dXf y_copy = y;

    // now dconv time

    switch (layer_idx)
    {
    case 0:
        y = demucscpp::conv1d<48, 6, 3, 1, 1, 1>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    case 1:
        y = demucscpp::conv1d<96, 12, 3, 1, 1, 1>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    case 2:
        y = demucscpp::conv1d<192, 24, 3, 1, 1, 1>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    case 3:
        y = demucscpp::conv1d<384, 48, 3, 1, 1, 1>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    };

    y = demucscpp::group_norm_fused_gelu(
        y,
        model.dconv_layers_1_groupnorm_weight[freq_idx][encdec_idx][layer_idx]
                                             [0],
        model.dconv_layers_1_groupnorm_bias[freq_idx][encdec_idx][layer_idx][0],
        1e-05);

    switch (layer_idx)
    {
    case 0:
        y = demucscpp::conv1d<6, 96, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    case 1:
        y = demucscpp::conv1d<12, 192, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    case 2:
        y = demucscpp::conv1d<24, 384, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    case 3:
        y = demucscpp::conv1d<48, 768, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [0],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [0]);
        break;
    };

    y = demucscpp::group_norm(
        y,
        model.dconv_layers_4_groupnorm_weight[freq_idx][encdec_idx][layer_idx]
                                             [0],
        model.dconv_layers_4_groupnorm_bias[freq_idx][encdec_idx][layer_idx][0],
        1, 1e-05);

    y = demucscpp::glu(y, 1);

    y = demucscpp::layer_scale(
        y, model.dconv_layers_6_scale[freq_idx][encdec_idx][layer_idx][0]);

    // now we add y to itself
    y = y + y_copy;

    // store another copy of y to sum back later
    y_copy = y;

    // NEXT ENTIRE SUBSEQUENCE OF DCONV WITH SLIGHTLY DIFFERENT PARAMS

    // Conv1d(48, 6, kernel_size=(3,), stride=(1,), padding=(2,), dilation=(2,))
    switch (layer_idx)
    {
    case 0:
        y = demucscpp::conv1d<48, 6, 3, 1, 2, 2>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    case 1:
        y = demucscpp::conv1d<96, 12, 3, 1, 2, 2>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    case 2:
        y = demucscpp::conv1d<192, 24, 3, 1, 2, 2>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    case 3:
        y = demucscpp::conv1d<384, 48, 3, 1, 2, 2>(
            y,
            model.dconv_layers_0_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_0_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    };

    Eigen::Tensor3dXf y_cropped =
        y.slice(Eigen::array<Eigen::Index, 3>({0, 0, 0}),
                Eigen::array<Eigen::Index, 3>(
                    {y.dimension(0), y.dimension(1), mid_crop}));

    y = y_cropped;

    y = demucscpp::group_norm_fused_gelu(
        y,
        model.dconv_layers_1_groupnorm_weight[freq_idx][encdec_idx][layer_idx]
                                             [1],
        model.dconv_layers_1_groupnorm_bias[freq_idx][encdec_idx][layer_idx][1],
        1e-05);

    // Conv1d(6, 96, kernel_size=(1,), stride=(1,))
    switch (layer_idx)
    {
    case 0:
        y = demucscpp::conv1d<6, 96, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    case 1:
        y = demucscpp::conv1d<12, 192, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    case 2:
        y = demucscpp::conv1d<24, 384, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    case 3:
        y = demucscpp::conv1d<48, 768, 1, 1, 0, 1>(
            y,
            model.dconv_layers_3_conv1d_weight[freq_idx][encdec_idx][layer_idx]
                                              [1],
            model.dconv_layers_3_conv1d_bias[freq_idx][encdec_idx][layer_idx]
                                            [1]);
        break;
    };

    y = demucscpp::group_norm(
        y,
        model.dconv_layers_4_groupnorm_weight[freq_idx][encdec_idx][layer_idx]
                                             [1],
        model.dconv_layers_4_groupnorm_bias[freq_idx][encdec_idx][layer_idx][1],
        1, 1e-05);

    y = demucscpp::glu(y, 1);
    y = demucscpp::layer_scale(
        y, model.dconv_layers_6_scale[freq_idx][encdec_idx][layer_idx][1]);

    // if y_copy is shorter than y in the last dim
    // pad the last dim with zeros to match

    if (y_copy.dimension(2) < y.dimension(2))
    {
        // pad the last dim with zeros to match
        Eigen::Tensor3dXf padded_tensor_copy(
            y_copy.dimension(0), y_copy.dimension(1), y.dimension(2));
        padded_tensor_copy.setZero();
        padded_tensor_copy.slice(Eigen::array<Eigen::Index, 3>({0, 0, 0}),
                                 y_copy.dimensions()) = y_copy;
        y_copy = padded_tensor_copy;
    }

    // now sum with itself
    y = y + y_copy;
}

void demucscpp::common_encoder_layer(
    Eigen::Tensor3dXf &q,       // q = x = frequency
    const Eigen::Tensor3dXf &k, // k = xt = time
    const Eigen::Tensor1dXf &norm1_weight, const Eigen::Tensor1dXf &norm1_bias,
    const Eigen::Tensor1dXf &norm2_weight, const Eigen::Tensor1dXf &norm2_bias,
    const Eigen::MatrixXf &in_proj_weight, const Eigen::VectorXf &in_proj_bias,
    const Eigen::MatrixXf &out_proj_weight,
    const Eigen::VectorXf &out_proj_bias, const Eigen::VectorXf &gamma1_scale,
    const Eigen::Tensor1dXf &norm3_weight, const Eigen::Tensor1dXf &norm3_bias,
    const Eigen::MatrixXf &linear1_weight, const Eigen::VectorXf &linear1_bias,
    const Eigen::MatrixXf &linear2_weight, const Eigen::VectorXf &linear2_bias,
    const Eigen::VectorXf &gamma2_scale,
    const Eigen::Tensor1dXf &norm_out_weight,
    const Eigen::Tensor1dXf &norm_out_bias, const int num_heads,
    // optional params
    float eps, const bool self_attention)
{
    // Normalize x using the norm1 weights and biases
    Eigen::Tensor3dXf q_norm =
        demucscpp::layer_norm(q, norm1_weight, norm1_bias, eps);

    Eigen::Tensor3dXf k_norm;
    if (self_attention)
    {
        k_norm = q_norm;
    }
    else
    {
        k_norm = demucscpp::layer_norm(k, norm2_weight, norm2_bias, eps);
    }

    // Cross-attention block
    // Compute Q, K, V matrices

    int B = q.dimension(0);
    int T = q.dimension(1);
    int C = q.dimension(2);

    int B_k = k.dimension(0);
    int S = k.dimension(1);
    int C_k = k.dimension(2);

    // Reshape q, k to 2D matrix of dimensions (T*B, C)

    // Use Eigen::Map to avoid manual loops for reshaping
    Eigen::MatrixXf q_norm_2d =
        Eigen::Map<const Eigen::MatrixXf>(q_norm.data(), T, C);
    Eigen::MatrixXf k_norm_2d =
        Eigen::Map<const Eigen::MatrixXf>(k_norm.data(), S, C);

    // Compute Q, K, V matrices
    Eigen::MatrixXf Q =
        q_norm_2d * in_proj_weight.block(0, 0, C, C).transpose();
    Eigen::MatrixXf K =
        k_norm_2d * in_proj_weight.block(C, 0, C, C).transpose();
    Eigen::MatrixXf V =
        k_norm_2d * in_proj_weight.block(2 * C, 0, C, C).transpose();

    Eigen::VectorXf q_bias = in_proj_bias.segment(0, C);
    Eigen::VectorXf k_bias = in_proj_bias.segment(C, C);
    Eigen::VectorXf v_bias = in_proj_bias.segment(2 * C, C);

    // copied from linear layer: ff1.rowwise() += linear1_bias.transpose();
    Q.rowwise() += q_bias.transpose();
    K.rowwise() += k_bias.transpose();
    V.rowwise() += v_bias.transpose();

    int head_split = C / num_heads;

    // map matrices to tensors
    Eigen::Tensor3dXf Q_heads =
        Eigen::TensorMap<Eigen::Tensor3dXf>(Q.data(), T, head_split, num_heads);
    Eigen::Tensor3dXf K_heads =
        Eigen::TensorMap<Eigen::Tensor3dXf>(K.data(), S, head_split, num_heads);
    Eigen::Tensor3dXf V_heads =
        Eigen::TensorMap<Eigen::Tensor3dXf>(V.data(), S, head_split, num_heads);

    Eigen::MatrixXf cross_attn_out(T, C);

    for (int h = 0; h < num_heads; ++h)
    {
        // Extract the h-th head from Q_heads and K_heads
        Eigen::Tensor2dXf Q_head_tensor = Q_heads.chip(h, 2);
        Eigen::Tensor2dXf K_head_tensor = K_heads.chip(h, 2);
        Eigen::Tensor2dXf V_head_tensor = V_heads.chip(h, 2);

        // Reshape the tensors to matrices
        Eigen::Map<Eigen::MatrixXf> Q_head(Q_head_tensor.data(), T, head_split);
        Eigen::Map<Eigen::MatrixXf> K_head(K_head_tensor.data(), S, head_split);
        Eigen::Map<Eigen::MatrixXf> V_head(V_head_tensor.data(), S, head_split);

        // Compute the dot product of Q_head and K_head
        Eigen::MatrixXf dot_product =
            Q_head * K_head.transpose() / std::sqrt((float)head_split);

        // Apply softmax to the dot product
        Eigen::ArrayXf max_vals = dot_product.rowwise().maxCoeff();
        Eigen::MatrixXf max_vals_expanded = max_vals.replicate(1, S);
        Eigen::MatrixXf softmax_scores =
            (dot_product - max_vals_expanded).array().exp().matrix();
        Eigen::VectorXf row_sums = softmax_scores.rowwise().sum();
        Eigen::MatrixXf divisor = row_sums.replicate(1, S);
        softmax_scores = (softmax_scores.array() / divisor.array()).matrix();

        Eigen::MatrixXf cross_attn_head = softmax_scores * V_head;
        cross_attn_out.block(0, h * head_split, T, head_split) =
            cross_attn_head;
    }

    // Copy q into q_2d (Map q to 2D matrix)
    Eigen::Map<Eigen::MatrixXf> q_2d(q.data(), T, C);

    // Apply output projection with gamma1_scale
    Eigen::MatrixXf out_proj = cross_attn_out * out_proj_weight.transpose();
    out_proj.array().rowwise() += out_proj_bias.transpose().array();
    out_proj = out_proj.array().rowwise() * gamma1_scale.transpose().array();

    // Add to q
    q_2d += out_proj;

    // before feedforward, apply norm3 to x i.e. q
    q_norm = demucscpp::layer_norm(q, norm3_weight, norm3_bias, eps);
    q_norm_2d = Eigen::Map<const Eigen::MatrixXf>(q_norm.data(), T, C);

    // Feedforward block
    // Linear layer 1
    Eigen::MatrixXf ff1 = q_norm_2d * linear1_weight.transpose();
    ff1.rowwise() += linear1_bias.transpose();

    ff1 = demucscpp::gelu(ff1);

    // Linear layer 2
    Eigen::MatrixXf ff2 = ff1 * linear2_weight.transpose();
    ff2.rowwise() += linear2_bias.transpose();

    // Apply gamma_2 scale directly on 2D matrix
    ff2 = ff2.array().rowwise() * gamma2_scale.transpose().array();

    // now x = x + self.gamma_2(self._ff_block(self.norm3(q))))
    q_2d += ff2;

    // Map the 2D data back into a 3D tensor with dimensions (T, B, C)
    q = Eigen::TensorMap<Eigen::Tensor3dXf>(q_2d.data(), T, B, C);

    // Swap the first and last dimensions to get a tensor with dimensions (B, C,
    // T)
    Eigen::array<int, 3> permute_dims_3 = {1, 2, 0};
    Eigen::Tensor3dXf q_shuf = q.shuffle(permute_dims_3);

    // Normalize the output with norm_out/MyGroupNorm
    q = demucscpp::group_norm(q_shuf, norm_out_weight, norm_out_bias, 1, eps);

    Eigen::array<int, 3> permute_dims_4 = {0, 2, 1};
    q_shuf = q.shuffle(permute_dims_4);

    q = q_shuf;
}
