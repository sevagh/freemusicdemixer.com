#include "model.hpp"
#include <Eigen/Dense>
#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static void my_fprintf(std::FILE* stream, const char* format, ...) {
    char buffer[1024];
    va_list args;
    va_start(args, format);
    vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);
    
    if (stream == stderr) {
        std::cerr << buffer;
    } else {
        std::cout << buffer;
    }
}

// forward declaration
static size_t load_single_tensor1d(FILE *f, std::string &name,
                                   Eigen::Tensor1dXf &matrix, int *ne,
                                   int32_t nelements);

static size_t load_single_vector(FILE *f, std::string &name,
                                 Eigen::VectorXf &matrix, int *ne,
                                 int32_t nelements);

static size_t load_single_matrix(FILE *f, std::string &name,
                                 Eigen::MatrixXf &matrix, int *ne,
                                 int32_t nelements);

static size_t load_single_tensor3d(FILE *f, std::string &name,
                                   Eigen::Tensor3dXf &tensor, int *ne,
                                   int32_t nelements);

static size_t load_single_tensor4d(FILE *f, std::string &name,
                                   Eigen::Tensor4dXf &tensor, int *ne,
                                   int32_t nelements);

// from scripts/convert-pth-to-ggml.py
bool demucscpp::load_demucs_model_4s(const std::string &model_file,
                                     struct demucs_model_4s *model)
{
    my_fprintf(stderr, "%s: loading model\n", __func__);

    // compute t_start_us using C++ std::chrono
    const auto t_start_us =
        std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::system_clock::now().time_since_epoch())
            .count();


    // gzip decompress file that ends with .gz
    std::cout << "Loading model_file... " << model_file << std::endl;

    FILE *f = fopen(model_file.c_str(), "rb");
    if (!f)
    {
        my_fprintf(stderr, "%s: failed to open decompressed file\n", __func__);
        return false;
    }

    // verify magic
    uint32_t magic;

    std::cout << "Checking the magic of model_file " << model_file
                << std::endl;

    // read the size of uint32_t bytes from f into magic
    fread(&magic, sizeof(uint32_t), 1, f);
    if (magic != 0x646d6334) // dmc4
    {
        my_fprintf(stderr, "%s: invalid model data (bad magic)\n", __func__);
        return false;
    }

    std::cout << "Loading demucs model... " << std::endl;

    // we dont need to prepare memory for the weights
    // they come preallocated in the hardcoded model

    size_t total_size = 0;
    uint32_t n_loaded = 0;

    // equivalent of with open(...) as f on each model_file
    std::cout << "Loading weights from model_file " << model_file
                << std::endl;

    // load weights from the file one tensor at a time

    for (;;)
    {
        int32_t n_dims;
        int32_t length;

        fread(&n_dims, sizeof(int32_t), 1, f);
        fread(&length, sizeof(int32_t), 1, f);

        int32_t nelements = 1;

        // we are loading up to 4d tensors, so allocate 4 dims
        int32_t ne[4] = {1, 1, 1, 1};
        for (int i = 0; i < n_dims; ++i)
        {
            fread(&ne[i], sizeof(int32_t), 1, f);
            nelements *= ne[i];
        }

        std::string name;
        std::vector<char> tmp(length);               // create a buffer
        fread(&tmp[0], sizeof(char), tmp.size(), f); // read to buffer
        name.assign(&tmp[0], tmp.size());

        // check if we reached eof of the open file f
        if (feof(f))
        {
            break;
        }

        std::cout << "Loading tensor " << name << " with shape [" << ne[0]
                    << ", " << ne[1] << ", " << ne[2] << ", " << ne[3] << "]"
                    << std::endl;

        // match the tensor name to the correct tensor in the model
        size_t loaded_size = 0;

        // 4 Encoders
        for (int i = 0; i < 4; ++i)
        {
            if (name == "encoder." + std::to_string(i) + ".conv.weight")
            {
                loaded_size = load_single_tensor3d(
                    f, name, model->encoder_conv_weight[i], ne, nelements);
            }
            else if (name == "encoder." + std::to_string(i) + ".conv.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->encoder_conv_bias[i], ne, nelements);
            }
            else if (name ==
                        "encoder." + std::to_string(i) + ".rewrite.weight")
            {
                loaded_size = load_single_tensor3d(
                    f, name, model->encoder_rewrite_weight[i], ne,
                    nelements);
            }
            else if (name ==
                        "encoder." + std::to_string(i) + ".rewrite.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->encoder_rewrite_bias[i], ne, nelements);
            }

            // each sub-dconv is a stack of 2
            for (int j = 0; j < 2; ++j)
            {
                if (name == "encoder." + std::to_string(i) +
                                ".dconv.layers." + std::to_string(j) +
                                ".0.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_0_conv1d_weight[0][0][i][j], ne,
                        nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".0.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_0_conv1d_bias[0][0][i][j], ne,
                        nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_weight[0][0][i][j],
                        ne, nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_bias[0][0][i][j],
                        ne, nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_3_conv1d_weight[0][0][i][j], ne,
                        nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_3_conv1d_bias[0][0][i][j], ne,
                        nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_weight[0][0][i][j],
                        ne, nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_bias[0][0][i][j],
                        ne, nelements);
                }
                else if (name == "encoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".6.scale")
                {
                    loaded_size = load_single_tensor1d(
                        f, name, model->dconv_layers_6_scale[0][0][i][j],
                        ne, nelements);
                }
            }
        }

        // 4 Decoders
        for (int i = 0; i < 4; ++i)
        {
            if (name == "decoder." + std::to_string(i) + ".conv_tr.weight")
            {
                loaded_size = load_single_tensor4d(
                    f, name, model->decoder_conv_tr_weight[i], ne,
                    nelements);
            }
            else if (name ==
                        "decoder." + std::to_string(i) + ".conv_tr.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->decoder_conv_tr_bias[i], ne,
                    nelements);
            }
            else if (name ==
                        "decoder." + std::to_string(i) + ".rewrite.weight")
            {
                loaded_size = load_single_tensor4d(
                    f, name, model->decoder_rewrite_weight[i], ne,
                    nelements);
            }
            else if (name ==
                        "decoder." + std::to_string(i) + ".rewrite.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->decoder_rewrite_bias[i], ne, nelements);
            }

            // each sub-dconv is a stack of 2
            for (int j = 0; j < 2; ++j)
            {
                int reverse_i = 4 - i - 1;
                if (name == "decoder." + std::to_string(i) +
                                ".dconv.layers." + std::to_string(j) +
                                ".0.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_0_conv1d_weight[0][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".0.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_0_conv1d_bias[0][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_weight[0][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_bias[0][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_3_conv1d_weight[0][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_3_conv1d_bias[0][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_weight[0][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_bias[0][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "decoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".6.scale")
                {
                    loaded_size = load_single_tensor1d(
                        f, name, model->dconv_layers_6_scale[0][1][reverse_i][j],
                        ne, nelements);
                }
            }
        }

        // 4 TEncoders
        for (int i = 0; i < 4; ++i)
        {
            if (name == "tencoder." + std::to_string(i) + ".conv.weight")
            {
                loaded_size = load_single_tensor3d(
                    f, name, model->tencoder_conv_weight[i], ne, nelements);
            }
            else if (name == "tencoder." + std::to_string(i) + ".conv.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->tencoder_conv_bias[i], ne, nelements);
            }
            else if (name ==
                        "tencoder." + std::to_string(i) + ".rewrite.weight")
            {
                loaded_size = load_single_tensor3d(
                    f, name, model->tencoder_rewrite_weight[i], ne,
                    nelements);
            }
            else if (name ==
                        "tencoder." + std::to_string(i) + ".rewrite.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->tencoder_rewrite_bias[i], ne,
                    nelements);
            }

            // each sub-dconv is a stack of 2
            for (int j = 0; j < 2; ++j)
            {
                if (name == "tencoder." + std::to_string(i) +
                                ".dconv.layers." + std::to_string(j) +
                                ".0.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_0_conv1d_weight[1][0][i][j], ne,
                        nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".0.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_0_conv1d_bias[1][0][i][j], ne,
                        nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_weight[1][0][i][j],
                        ne, nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_bias[1][0][i][j],
                        ne, nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_3_conv1d_weight[1][0][i][j], ne,
                        nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_3_conv1d_bias[1][0][i][j], ne,
                        nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_weight[1][0][i][j],
                        ne, nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_bias[1][0][i][j],
                        ne, nelements);
                }
                else if (name == "tencoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".6.scale")
                {
                    loaded_size = load_single_tensor1d(
                        f, name, model->dconv_layers_6_scale[1][0][i][j],
                        ne, nelements);
                }
            }
        }

        // 4 TDecoders
        for (int i = 0; i < 4; ++i)
        {
            if (name == "tdecoder." + std::to_string(i) + ".conv_tr.weight")
            {
                loaded_size = load_single_tensor3d(
                    f, name, model->tdecoder_conv_tr_weight[i], ne,
                    nelements);
            }
            else if (name ==
                        "tdecoder." + std::to_string(i) + ".conv_tr.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->tdecoder_conv_tr_bias[i], ne,
                    nelements);
            }
            else if (name ==
                        "tdecoder." + std::to_string(i) + ".rewrite.weight")
            {
                loaded_size = load_single_tensor3d(
                    f, name, model->tdecoder_rewrite_weight[i], ne,
                    nelements);
            }
            else if (name ==
                        "tdecoder." + std::to_string(i) + ".rewrite.bias")
            {
                loaded_size = load_single_tensor1d(
                    f, name, model->tdecoder_rewrite_bias[i], ne,
                    nelements);
            }

            // each sub-dconv is a stack of 2
            for (int j = 0; j < 2; ++j)
            {
                int reverse_i = 4 - i - 1;
                if (name == "tdecoder." + std::to_string(i) +
                                ".dconv.layers." + std::to_string(j) +
                                ".0.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_0_conv1d_weight[1][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".0.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_0_conv1d_bias[1][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_weight[1][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".1.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_1_groupnorm_bias[1][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.weight")
                {
                    loaded_size = load_single_tensor3d(
                        f, name,
                        model->dconv_layers_3_conv1d_weight[1][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".3.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_3_conv1d_bias[1][1][reverse_i][j], ne,
                        nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.weight")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_weight[1][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".4.bias")
                {
                    loaded_size = load_single_tensor1d(
                        f, name,
                        model->dconv_layers_4_groupnorm_bias[1][1][reverse_i][j],
                        ne, nelements);
                }
                else if (name == "tdecoder." + std::to_string(i) +
                                        ".dconv.layers." + std::to_string(j) +
                                        ".6.scale")
                {
                    loaded_size = load_single_tensor1d(
                        f, name, model->dconv_layers_6_scale[1][1][reverse_i][j],
                        ne, nelements);
                }
            }
        }

        if (name == "freq_emb.embedding.weight")
        {
            loaded_size = load_single_matrix(
                f, name, model->freq_emb_embedding_weight, ne, nelements);
        }
        else if (name == "channel_upsampler.weight")
        {
            loaded_size = load_single_tensor3d(
                f, name, model->channel_upsampler_weight, ne, nelements);
        }
        else if (name == "channel_upsampler.bias")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->channel_upsampler_bias, ne, nelements);
        }
        else if (name == "channel_downsampler.weight")
        {
            loaded_size = load_single_tensor3d(
                f, name, model->channel_downsampler_weight, ne, nelements);
        }
        else if (name == "channel_downsampler.bias")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->channel_downsampler_bias, ne, nelements);
        }
        else if (name == "channel_upsampler_t.weight")
        {
            loaded_size = load_single_tensor3d(
                f, name, model->channel_upsampler_t_weight, ne, nelements);
        }
        else if (name == "channel_upsampler_t.bias")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->channel_upsampler_t_bias, ne, nelements);
        }
        else if (name == "channel_downsampler_t.weight")
        {
            loaded_size = load_single_tensor3d(
                f, name, model->channel_downsampler_t_weight, ne,
                nelements);
        }
        else if (name == "channel_downsampler_t.bias")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->channel_downsampler_t_bias, ne, nelements);
        }
        else if (name == "crosstransformer.norm_in.weight")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->crosstransformer_norm_in_weight, ne,
                nelements);
        }
        else if (name == "crosstransformer.norm_in.bias")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->crosstransformer_norm_in_bias, ne,
                nelements);
        }
        else if (name == "crosstransformer.norm_in_t.weight")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->crosstransformer_norm_in_t_weight, ne,
                nelements);
        }
        else if (name == "crosstransformer.norm_in_t.bias")
        {
            loaded_size = load_single_tensor1d(
                f, name, model->crosstransformer_norm_in_t_bias, ne,
                nelements);
        }

        // 5 crosstransformer layers, * 2 for time and frequency
        for (int transformer_layer = 0; transformer_layer < 5;
                ++transformer_layer)
        {
            for (int freq_or_time = 0; freq_or_time < 2; ++freq_or_time)
            {
                std::string suffix = "";
                if (freq_or_time == 1)
                {
                    suffix = "_t";
                }
                suffix += "." + std::to_string(transformer_layer);

                // even indexes are self_attn, odd are cross_attn
                if (transformer_layer % 2 == 0)
                {
                    // even case, 0,2,4 divided by 2 will lead to indexes
                    // 0,1,2 in the Eigen C++ struct member
                    int layer_index = transformer_layer / 2;

                    if (name == "crosstransformer.layers" + suffix +
                                    ".self_attn.in_proj_weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model
                                ->crosstransformer_my_layers_self_attn_in_proj_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".self_attn.in_proj_bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_my_layers_self_attn_in_proj_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".self_attn.out_proj.weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model
                                ->crosstransformer_my_layers_self_attn_out_proj_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".self_attn.out_proj.bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_my_layers_self_attn_out_proj_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }

                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear1.weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model->crosstransformer_my_layers_linear1_weight
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear1.bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model->crosstransformer_my_layers_linear1_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear2.weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model->crosstransformer_my_layers_linear2_weight
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear2.bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model->crosstransformer_my_layers_linear2_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm1.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_my_layers_norm1_weight
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm1.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_my_layers_norm1_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm2.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_my_layers_norm2_weight
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm2.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_my_layers_norm2_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm_out.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model
                                ->crosstransformer_my_layers_norm_out_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm_out.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_my_layers_norm_out_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".gamma_1.scale")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model->crosstransformer_my_layers_gamma_1_scale
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".gamma_2.scale")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model->crosstransformer_my_layers_gamma_2_scale
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                }

                // even indexes are self_attn, odd are cross_attn
                else if (transformer_layer % 2 == 1)
                {
                    // odd case, ({1,3}-1)/2 maps to 0,1 in the Eigen struct
                    int layer_index = (transformer_layer - 1) / 2;

                    if (name == "crosstransformer.layers" + suffix +
                                    ".cross_attn.in_proj_weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_cross_attn_in_proj_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".cross_attn.in_proj_bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_cross_attn_in_proj_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".cross_attn.out_proj.weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_cross_attn_out_proj_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".cross_attn.out_proj.bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_cross_attn_out_proj_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear1.weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_linear1_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear1.bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_linear1_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear2.weight")
                    {
                        loaded_size = load_single_matrix(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_linear2_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".linear2.bias")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_linear2_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm1.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_norm1_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm1.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_cross_layers_norm1_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm2.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_norm2_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm2.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_cross_layers_norm2_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm3.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_norm3_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm3.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model->crosstransformer_cross_layers_norm3_bias
                                [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm_out.weight")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_norm_out_weight
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".norm_out.bias")
                    {
                        loaded_size = load_single_tensor1d(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_norm_out_bias
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".gamma_1.scale")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_gamma_1_scale
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                    else if (name == "crosstransformer.layers" + suffix +
                                            ".gamma_2.scale")
                    {
                        loaded_size = load_single_vector(
                            f, name,
                            model
                                ->crosstransformer_cross_layers_gamma_2_scale
                                    [freq_or_time][layer_index],
                            ne, nelements);
                    }
                }
            }
        }

        if (loaded_size == 0)
        {
            my_fprintf(stderr, "%s: failed to load %s\n", __func__,
                    name.c_str());
            return false;
        }
        total_size += loaded_size;
        n_loaded++;
    }

    fclose(f);

    // compute finish time in microseconds using std::chrono

    const auto t_end_us =
        std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::system_clock::now().time_since_epoch())
            .count();

    // print load time in seconds
    my_fprintf(stdout, "Loaded model (%u tensors, %6.2f MB) in %f s\n", n_loaded,
           total_size / 1024.0 / 1024.0,
           (float)(t_end_us - t_start_us) / 1000000.0f);

    return true;
}

static size_t load_single_matrix(FILE *f, std::string &name,
                                 Eigen::MatrixXf &matrix, int *ne,
                                 int32_t nelements)
{
    if (matrix.size() != nelements)
    {
        my_fprintf(stderr, "%s: tensor '%s' has wrong size in model file\n",
                __func__, name.data());
        my_fprintf(stderr,
                "%s: model file shape: [%d, %d], demucs.cpp shape: [%d, %d]\n",
                __func__, ne[0], ne[1], (int)matrix.rows(),
                (int)matrix.cols());
        return 0;
    }

    // loading quantized weights
    const size_t bpe_half = sizeof(Eigen::half);
    auto nbytes_tensor = matrix.size() * bpe_half;

    // create a Eigen::half Eigen::Matrix to hold the quantized weights
    // of the same shape as the float matrix
    Eigen::Matrix<Eigen::half, Eigen::Dynamic, Eigen::Dynamic, Eigen::RowMajor> matrix_half =
        Eigen::Matrix<Eigen::half, Eigen::Dynamic, Eigen::Dynamic, Eigen::RowMajor>::Zero(
            matrix.rows(), matrix.cols());

    fread(matrix_half.data(), bpe_half, nelements, f);

    my_fprintf(stdout, "%16s: [%5d, %5d], type = float, %6.2f MB\n", name.data(), ne[0],
           ne[1], nbytes_tensor / 1024.0 / 1024.0);

    // and copy them into the float matrix
    for (int i = 0; i < ne[0]; i++)
    {
        for (int j = 0; j < ne[1]; j++)
        {
            matrix(i, j) = static_cast<float>(matrix_half(i, j));
        }
    }

    return nbytes_tensor;
}

static size_t load_single_tensor3d(FILE *f, std::string &name,
                                   Eigen::Tensor3dXf &tensor, int *ne,
                                   int32_t nelements)
{
    if (tensor.size() != nelements)
    {
        my_fprintf(stderr, "%s: tensor '%s' has wrong size in model file\n",
                __func__, name.data());
        my_fprintf(stderr,
                "%s: model file shape: [%d, %d, %d], demucs.cpp shape: [%d, "
                "%d, %d]\n",
                __func__, ne[0], ne[1], ne[2], (int)tensor.dimension(0),
                (int)tensor.dimension(1), (int)tensor.dimension(2));
        return 0;
    }

    // loading weights
    const size_t bpe_half = sizeof(Eigen::half);
    auto nbytes_tensor = tensor.size() * bpe_half;

    // create a Eigen::half Eigen::Matrix to hold the quantized weights
    // of the same shape as the float matrix
    Eigen::Tensor<Eigen::half, 3, Eigen::RowMajor> tensor_half(ne[0], ne[1], ne[2]);
    fread(tensor_half.data(), bpe_half, nelements, f);

    my_fprintf(stdout, "%16s: [%5d, %5d, %5d], type = float, %6.2f MB\n", name.data(),
           ne[0], ne[1], ne[2], nbytes_tensor / 1024.0 / 1024.0);

    // Manually copy the data from tensor_half to tensor
    for (int i = 0; i < ne[0]; ++i)
    {
        for (int j = 0; j < ne[1]; ++j)
        {
            for (int k = 0; k < ne[2]; ++k)
            {
                tensor(i, j, k) = static_cast<float>(tensor_half(i, j, k));
            }
        }
    }

    return nbytes_tensor;
}

static size_t load_single_tensor4d(FILE *f, std::string &name,
                                   Eigen::Tensor4dXf &tensor, int *ne,
                                   int32_t nelements)
{
    if (tensor.size() != nelements)
    {
        my_fprintf(stderr, "%s: tensor '%s' has wrong size in model file\n",
                __func__, name.data());
        my_fprintf(stderr,
                "%s: model file shape: [%d, %d, %d, %d], demucs.cpp shape: [%d, "
                "%d, %d, %d]\n",
                __func__, ne[0], ne[1], ne[2], ne[3], (int)tensor.dimension(0),
                (int)tensor.dimension(1), (int)tensor.dimension(2), (int)tensor.dimension(3));
        return 0;
    }

    // loading weights
    const size_t bpe_half = sizeof(Eigen::half);
    auto nbytes_tensor = tensor.size() * bpe_half;

    // create a Eigen::half Eigen::Tensor to hold the quantized weights
    // of the same shape as the float tensor
    Eigen::Tensor<Eigen::half, 4, Eigen::RowMajor> tensor_half(ne[0], ne[1], ne[2], ne[3]);
    fread(tensor_half.data(), bpe_half, nelements, f);

    my_fprintf(stdout, "%16s: [%5d, %5d, %5d, %5d], type = float, %6.2f MB\n", name.data(),
           ne[0], ne[1], ne[2], ne[3], nbytes_tensor / 1024.0 / 1024.0);

    // Manually copy the data from tensor_half to tensor
    for (int i = 0; i < ne[0]; ++i)
    {
        for (int j = 0; j < ne[1]; ++j)
        {
            for (int k = 0; k < ne[2]; ++k)
            {
                for (int l = 0; l < ne[3]; ++l)
                {
                    tensor(i, j, k, l) = static_cast<float>(tensor_half(i, j, k, l));
                }
            }
        }
    }

    return nbytes_tensor;
}

static size_t load_single_tensor1d(FILE *f, std::string &name,
                                   Eigen::Tensor1dXf &tensor, int *ne,
                                   int32_t nelements)
{
    if (tensor.size() != nelements)
    {
        my_fprintf(stderr, "%s: tensor '%s' has wrong size in model file\n",
                __func__, name.data());
        my_fprintf(stderr,
                "%s: model file shape: [%d], demucs.cpp shape: [%d]\n",
                __func__, ne[0], (int)tensor.dimension(0));
        return 0;
    }

    // loading weights
    const size_t bpe_half = sizeof(Eigen::half);
    auto nbytes_tensor = tensor.size() * bpe_half;

    // create a Eigen::half Eigen::Tensor to hold the quantized weights
    // of the same shape as the float tensor
    Eigen::Tensor<Eigen::half, 1, Eigen::RowMajor> tensor_half(ne[0]);
    fread(tensor_half.data(), bpe_half, nelements, f);

    my_fprintf(stdout, "%16s: [%5d], type = float, %6.2f MB\n", name.data(),
           ne[0], nbytes_tensor / 1024.0 / 1024.0);

    // Manually copy the data from tensor_half to tensor
    for (int i = 0; i < ne[0]; ++i)
    {
        tensor(i) = static_cast<float>(tensor_half(i));
    }

    return nbytes_tensor;
}

static size_t load_single_vector(FILE *f, std::string &name,
                                 Eigen::VectorXf &vector, int *ne,
                                 int32_t nelements)
{
    if (vector.size() != nelements)
    {
        my_fprintf(stderr, "%s: vector '%s' has wrong size in model file\n",
                __func__, name.data());
        my_fprintf(stderr,
                "%s: model file shape: [%d], demucs.cpp shape: [%d]\n",
                __func__, ne[0], (int)vector.size());
        return 0;
    }

    // loading weights
    const size_t bpe_half = sizeof(Eigen::half);
    auto nbytes_vector = vector.size() * bpe_half;

    // create a Eigen::half Eigen::Vector to hold the quantized weights
    // of the same shape as the float vector
    Eigen::Matrix<Eigen::half, Eigen::Dynamic, 1> vector_half(ne[0]);
    fread(vector_half.data(), bpe_half, nelements, f);

    my_fprintf(stdout, "%16s: [%5d], type = float, %6.2f MB\n", name.data(),
           ne[0], nbytes_vector / 1024.0 / 1024.0);

    // Manually copy the data from vector_half to vector
    for (int i = 0; i < ne[0]; ++i)
    {
        vector(i) = static_cast<float>(vector_half(i));
    }

    return nbytes_vector;
}
