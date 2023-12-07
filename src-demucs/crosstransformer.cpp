#include "crosstransformer.hpp"
#include "layers.hpp"
#include "model.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>
#include <filesystem>
#include <fstream>
#include <iostream>

static Eigen::Tensor3dXf create_2d_sin_embedding(int d_model, int height,
                                                 int width,
                                                 float max_period = 10000.0)
{
    if (d_model % 4 != 0)
    {
        std::cerr <<  "Cannot use sin/cos positional encoding with odd dimension" << std::endl;
        std::exit(1);
    }

    Eigen::Tensor3dXf pe(d_model, height, width);
    d_model /= 2;
    Eigen::ArrayXf div_term =
        Eigen::exp(Eigen::ArrayXf::LinSpaced(d_model / 2, 0, d_model - 2) *
                   (-std::log(max_period) / d_model));

    for (int i = 0; i < width; ++i)
    {
        for (int j = 0; j < d_model / 2; ++j)
        {
            float val_w = i * div_term(j);
            pe.slice(Eigen::array<int, 3>({j * 2, 0, i}),
                     Eigen::array<int, 3>({1, height, 1}))
                .setConstant(std::sin(val_w));
            pe.slice(Eigen::array<int, 3>({j * 2 + 1, 0, i}),
                     Eigen::array<int, 3>({1, height, 1}))
                .setConstant(std::cos(val_w));
        }
    }

    for (int i = 0; i < height; ++i)
    {
        for (int j = 0; j < d_model / 2; ++j)
        {
            float val_h = i * div_term(j);
            pe.slice(Eigen::array<int, 3>({d_model + j * 2, i, 0}),
                     Eigen::array<int, 3>({1, 1, width}))
                .setConstant(std::sin(val_h));
            pe.slice(Eigen::array<int, 3>({d_model + j * 2 + 1, i, 0}),
                     Eigen::array<int, 3>({1, 1, width}))
                .setConstant(std::cos(val_h));
        }
    }

    return pe;
}

static Eigen::Tensor3dXf create_sin_embedding(int length, int dim,
                                              int shift = 0,
                                              float max_period = 10000.0f)
{
    Eigen::Tensor3dXf pos_emb(1, length, dim);
    int half_dim = dim / 2;
    Eigen::ArrayXf div_term =
        Eigen::ArrayXf::LinSpaced(half_dim, 0, half_dim - 1) / (half_dim - 1);

    for (int t = 0; t < length; ++t)
    {
        float position = static_cast<float>(t) + shift;
        for (int i = 0; i < half_dim; ++i)
        {
            float phase = position / std::pow(max_period, div_term(i));
            pos_emb(0, t, i) = std::cos(phase); // assign to first half
            pos_emb(0, t, i + half_dim) =
                std::sin(phase); // assign to second half
        }
    }

    return pos_emb;
}

static void
my_transformer_encoder_layer(struct demucscpp::demucs_model_4s &model,
                             Eigen::Tensor3dXf &x, int freq_or_time,
                             int weight_idx, float eps = 1e-5)
{
    demucscpp::common_encoder_layer(
        x, // pass x as q
        x, // pass x as k
        model.crosstransformer_my_layers_norm1_weight[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_norm1_bias[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_norm1_weight[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_norm1_bias[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_self_attn_in_proj_weight[freq_or_time]
                                                                 [weight_idx],
        model.crosstransformer_my_layers_self_attn_in_proj_bias[freq_or_time]
                                                               [weight_idx],
        model.crosstransformer_my_layers_self_attn_out_proj_weight[freq_or_time]
                                                                  [weight_idx],
        model.crosstransformer_my_layers_self_attn_out_proj_bias[freq_or_time]
                                                                [weight_idx],
        model
            .crosstransformer_my_layers_gamma_1_scale[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_norm2_weight[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_norm2_bias[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_linear1_weight[freq_or_time]
                                                       [weight_idx],
        model.crosstransformer_my_layers_linear1_bias[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_linear2_weight[freq_or_time]
                                                       [weight_idx],
        model.crosstransformer_my_layers_linear2_bias[freq_or_time][weight_idx],
        model
            .crosstransformer_my_layers_gamma_2_scale[freq_or_time][weight_idx],
        model.crosstransformer_my_layers_norm_out_weight[freq_or_time]
                                                        [weight_idx],
        model
            .crosstransformer_my_layers_norm_out_bias[freq_or_time][weight_idx],
        8, // num_heads
        eps,
        true); // define self_attention = true to skip norm2 recalculation
}

static void
cross_transformer_encoder_layer(struct demucscpp::demucs_model_4s &model,
                                Eigen::Tensor3dXf &q,       // q = x = frequency
                                const Eigen::Tensor3dXf &k, // k = xt = time
                                int freq_or_time, int weight_idx,
                                float eps = 1e-5)
{
    demucscpp::common_encoder_layer(
        q, k,
        model.crosstransformer_cross_layers_norm1_weight[freq_or_time]
                                                        [weight_idx],
        model
            .crosstransformer_cross_layers_norm1_bias[freq_or_time][weight_idx],
        model.crosstransformer_cross_layers_norm2_weight[freq_or_time]
                                                        [weight_idx],
        model
            .crosstransformer_cross_layers_norm2_bias[freq_or_time][weight_idx],
        model.crosstransformer_cross_layers_cross_attn_in_proj_weight
            [freq_or_time][weight_idx],
        model
            .crosstransformer_cross_layers_cross_attn_in_proj_bias[freq_or_time]
                                                                  [weight_idx],
        model.crosstransformer_cross_layers_cross_attn_out_proj_weight
            [freq_or_time][weight_idx],
        model.crosstransformer_cross_layers_cross_attn_out_proj_bias
            [freq_or_time][weight_idx],
        model.crosstransformer_cross_layers_gamma_1_scale[freq_or_time]
                                                         [weight_idx],
        model.crosstransformer_cross_layers_norm3_weight[freq_or_time]
                                                        [weight_idx],
        model
            .crosstransformer_cross_layers_norm3_bias[freq_or_time][weight_idx],
        model.crosstransformer_cross_layers_linear1_weight[freq_or_time]
                                                          [weight_idx],
        model.crosstransformer_cross_layers_linear1_bias[freq_or_time]
                                                        [weight_idx],
        model.crosstransformer_cross_layers_linear2_weight[freq_or_time]
                                                          [weight_idx],
        model.crosstransformer_cross_layers_linear2_bias[freq_or_time]
                                                        [weight_idx],
        model.crosstransformer_cross_layers_gamma_2_scale[freq_or_time]
                                                         [weight_idx],
        model.crosstransformer_cross_layers_norm_out_weight[freq_or_time]
                                                           [weight_idx],
        model.crosstransformer_cross_layers_norm_out_bias[freq_or_time]
                                                         [weight_idx],
        8, // num_heads
        eps);
}

void demucscpp::apply_crosstransformer(struct demucscpp::demucs_model_4s &model,
                                       Eigen::Tensor3dXf &x, // frequency branch
                                       Eigen::Tensor3dXf &xt // time branch
)
{
    std::cout << "apply_crosstransformer" << std::endl;

    Eigen::Tensor3dXf pos_embed_2d_pre_reshape =
        create_2d_sin_embedding(x.dimension(0), x.dimension(1), x.dimension(2));

    Eigen::Tensor3dXf pos_embed_2d(1, x.dimension(1) * x.dimension(2),
                                   x.dimension(0));
    Eigen::Tensor3dXf x_reshape(1, x.dimension(1) * x.dimension(2),
                                x.dimension(0));

    // x = rearrange(x, "b c fr t1 -> b (t1 fr) c")

    // implement above with eigen for loops
    // rearrange x too
    for (int i = 0; i < x.dimension(1); ++i)
    {
        for (int j = 0; j < x.dimension(2); ++j)
        {
            for (int k = 0; k < x.dimension(0); ++k)
            {
                pos_embed_2d(0, j * x.dimension(1) + i, k) =
                    pos_embed_2d_pre_reshape(k, i, j);
                x_reshape(0, j * x.dimension(1) + i, k) = x(k, i, j);
            }
        }
    }

    x = x_reshape;

    float eps = 1e-5;

    x = demucscpp::layer_norm(x, model.crosstransformer_norm_in_weight,
                              model.crosstransformer_norm_in_bias, eps) +
        pos_embed_2d;

    std::cout << "Freq (crosstransformer): norm + pos_embed" << std::endl;

    // (B, C, T2) = xt.shape
    int C = xt.dimension(1);
    int T2 = xt.dimension(2);

    Eigen::Tensor3dXf pos_embed_1d = create_sin_embedding(T2, C);

    // shuffle axes of xt from 0,1,2 to 0,2,1
    Eigen::Tensor3dXf xt_shuf = xt.shuffle(Eigen::array<int, 3>{0, 2, 1});

    xt = demucscpp::layer_norm(xt_shuf, model.crosstransformer_norm_in_t_weight,
                               model.crosstransformer_norm_in_t_bias, eps) +
         pos_embed_1d;

    std::cout << "Time (crosstransformer): norm + pos_embed" << std::endl;

    // actual crosstransformer layers here

    // layer 0 for freq and time is the first MyTransformerEncoderLayer
    // the argument 0 passed in the function call is the weight index
    // 0,2,4 -> 0,1,3 in my C++ code because i store the 3 mytransformer layers
    // in a single array and the 2 crosstransformer layers in another array

    // x = self.layers[0](x)
    // xt = self.layers_t[0](xt)
    my_transformer_encoder_layer(model, x, 0, 0);
    std::cout << "Freq (crosstransformer): layer 0" << std::endl;

    my_transformer_encoder_layer(model, xt, 1, 0);
    std::cout << "Time (crosstransformer): layer 0" << std::endl;

    // make a copy of x
    Eigen::Tensor3dXf old_x = x;

    // x is modified in-place and is the final value of x
    // xt is not modified (const)
    cross_transformer_encoder_layer(model, x, xt, 0, 0);
    std::cout << "Freq (crosstransformer): layer 1" << std::endl;

    // xt is modified in-place and is the final value of xt
    cross_transformer_encoder_layer(model, xt, old_x, 1, 0);
    std::cout << "Time (crosstransformer): layer 1" << std::endl;

    my_transformer_encoder_layer(model, x, 0, 1);
    std::cout << "Freq (crosstransformer): layer 2" << std::endl;

    my_transformer_encoder_layer(model, xt, 1, 1);
    std::cout << "Time (crosstransformer): layer 2" << std::endl;

    // make a copy of x
    old_x = x;

    // x is modified in-place and is the final value of x
    cross_transformer_encoder_layer(model, x, xt, 0, 1);
    std::cout << "Freq (crosstransformer): layer 3" << std::endl;

    // old_xt is modified in-place and is the final value of xt
    cross_transformer_encoder_layer(model, xt, old_x, 1, 1);
    std::cout << "Time (crosstransformer): layer 3" << std::endl;

    my_transformer_encoder_layer(model, x, 0, 2);
    std::cout << "Freq (crosstransformer): layer 4" << std::endl;

    my_transformer_encoder_layer(model, xt, 1, 2);
    std::cout << "Time (crosstransformer): layer 4" << std::endl;

    // permute last two dims of xt
    Eigen::array<int, 3> permute_dims = {0, 2, 1};
    Eigen::Tensor3dXf xt_ret = xt.shuffle(permute_dims);
    xt = xt_ret;

    // for x, transform from shape (1, 2688, 512) to
    // (512, 8, 336)

    // first also permute x
    Eigen::Tensor3dXf x_shuf = x.shuffle(permute_dims);
    x = x_shuf;
}
