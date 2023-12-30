#ifndef MODEL_HPP
#define MODEL_HPP

#include "dsp.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>
#include <array>
#include <functional>
#include <iostream>
#include <string>
#include <vector>

namespace demucscpp
{

// Define a type for your callback function
using ProgressCallback = std::function<void(float)>;

const int FREQ_BRANCH_LEN = 336;
const int TIME_BRANCH_LEN_IN = 343980;
const int TIME_BRANCH_LEN_0 = 85995;
const int TIME_BRANCH_LEN_1 = 21499;
const int TIME_BRANCH_LEN_2 = 5375;
const int TIME_BRANCH_LEN_3 = 1344;

struct crosstransformer_base {
    // crosstransformer.norm_in
    Eigen::Tensor1dXf crosstransformer_norm_in_weight;
    Eigen::Tensor1dXf crosstransformer_norm_in_bias;

    // crosstransformer.norm_in_t
    Eigen::Tensor1dXf crosstransformer_norm_in_t_weight;
    Eigen::Tensor1dXf crosstransformer_norm_in_t_bias;

    // MyTransformerEncoderLayer: index 0, 2, 4
    // second index [2] represents the frequency and time weights (same shapes)
    Eigen::MatrixXf crosstransformer_my_layers_self_attn_in_proj_weight[2][3];
    Eigen::VectorXf crosstransformer_my_layers_self_attn_in_proj_bias[2][3];
    Eigen::MatrixXf crosstransformer_my_layers_self_attn_out_proj_weight[2][3];
    Eigen::VectorXf crosstransformer_my_layers_self_attn_out_proj_bias[2][3];
    Eigen::MatrixXf crosstransformer_my_layers_linear1_weight[2][3];
    Eigen::VectorXf crosstransformer_my_layers_linear1_bias[2][3];
    Eigen::MatrixXf crosstransformer_my_layers_linear2_weight[2][3];
    Eigen::VectorXf crosstransformer_my_layers_linear2_bias[2][3];
    Eigen::Tensor1dXf crosstransformer_my_layers_norm1_weight[2][3];
    Eigen::Tensor1dXf crosstransformer_my_layers_norm1_bias[2][3];
    Eigen::Tensor1dXf crosstransformer_my_layers_norm2_weight[2][3];
    Eigen::Tensor1dXf crosstransformer_my_layers_norm2_bias[2][3];
    Eigen::Tensor1dXf crosstransformer_my_layers_norm_out_weight[2][3];
    Eigen::Tensor1dXf crosstransformer_my_layers_norm_out_bias[2][3];
    Eigen::VectorXf crosstransformer_my_layers_gamma_1_scale[2][3];
    Eigen::VectorXf crosstransformer_my_layers_gamma_2_scale[2][3];

    // CrossTransformerEncoderLayer: index 1, 3
    // second index [2] represents the frequency and time weights (same shapes)
    Eigen::MatrixXf
        crosstransformer_cross_layers_cross_attn_in_proj_weight[2][2];
    Eigen::VectorXf crosstransformer_cross_layers_cross_attn_in_proj_bias[2][2];
    Eigen::MatrixXf
        crosstransformer_cross_layers_cross_attn_out_proj_weight[2][2];
    Eigen::VectorXf
        crosstransformer_cross_layers_cross_attn_out_proj_bias[2][2];
    Eigen::MatrixXf crosstransformer_cross_layers_linear1_weight[2][2];
    Eigen::VectorXf crosstransformer_cross_layers_linear1_bias[2][2];
    Eigen::MatrixXf crosstransformer_cross_layers_linear2_weight[2][2];
    Eigen::VectorXf crosstransformer_cross_layers_linear2_bias[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm1_weight[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm1_bias[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm2_weight[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm2_bias[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm3_weight[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm3_bias[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm_out_weight[2][2];
    Eigen::Tensor1dXf crosstransformer_cross_layers_norm_out_bias[2][2];
    Eigen::VectorXf crosstransformer_cross_layers_gamma_1_scale[2][2];
    Eigen::VectorXf crosstransformer_cross_layers_gamma_2_scale[2][2];

    crosstransformer_base(int size1, int size2, int size3) :
        crosstransformer_norm_in_weight(Eigen::Tensor1dXf(size1)),
        crosstransformer_norm_in_bias(Eigen::Tensor1dXf(size1)),
        crosstransformer_norm_in_t_weight(Eigen::Tensor1dXf(size1)),
        crosstransformer_norm_in_t_bias(Eigen::Tensor1dXf(size1)),
        // second index [2] represents the frequency and time weights (same shapes)
        crosstransformer_my_layers_self_attn_in_proj_weight{
            {{Eigen::MatrixXf(size2, size1)},
            {Eigen::MatrixXf(size2, size1)},
            {Eigen::MatrixXf(size2, size1)}},
            {{Eigen::MatrixXf(size2, size1)},
            {Eigen::MatrixXf(size2, size1)},
            {Eigen::MatrixXf(size2, size1)}}},
        crosstransformer_my_layers_self_attn_in_proj_bias{
            {{Eigen::VectorXf(size2)},
            {Eigen::VectorXf(size2)},
            {Eigen::VectorXf(size2)}},
            {{Eigen::VectorXf(size2)},
            {Eigen::VectorXf(size2)},
            {Eigen::VectorXf(size2)}}},
        crosstransformer_my_layers_self_attn_out_proj_weight{
            {{Eigen::MatrixXf(size1, size1)},
            {Eigen::MatrixXf(size1, size1)},
            {Eigen::MatrixXf(size1, size1)}},
            {{Eigen::MatrixXf(size1, size1)},
            {Eigen::MatrixXf(size1, size1)},
            {Eigen::MatrixXf(size1, size1)}}},
        crosstransformer_my_layers_self_attn_out_proj_bias{
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}}},
        crosstransformer_my_layers_linear1_weight{
            {{Eigen::MatrixXf(size3, size1)},
            {Eigen::MatrixXf(size3, size1)},
            {Eigen::MatrixXf(size3, size1)}},
            {{Eigen::MatrixXf(size3, size1)},
            {Eigen::MatrixXf(size3, size1)},
            {Eigen::MatrixXf(size3, size1)}}},
        crosstransformer_my_layers_linear1_bias{
            {{Eigen::VectorXf(size3)},
            {Eigen::VectorXf(size3)},
            {Eigen::VectorXf(size3)}},
            {{Eigen::VectorXf(size3)},
            {Eigen::VectorXf(size3)},
            {Eigen::VectorXf(size3)}}},
        crosstransformer_my_layers_linear2_weight{
            {{Eigen::MatrixXf(size1, size3)},
            {Eigen::MatrixXf(size1, size3)},
            {Eigen::MatrixXf(size1, size3)}},
            {{Eigen::MatrixXf(size1, size3)},
            {Eigen::MatrixXf(size1, size3)},
            {Eigen::MatrixXf(size1, size3)}}},
        crosstransformer_my_layers_linear2_bias{
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}}},
        crosstransformer_my_layers_norm1_weight{
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_my_layers_norm1_bias{
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_my_layers_norm2_weight{
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_my_layers_norm2_bias{
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_my_layers_norm_out_weight{
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_my_layers_norm_out_bias{
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)},
            {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_my_layers_gamma_1_scale{
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}}},
        crosstransformer_my_layers_gamma_2_scale{
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)},
            {Eigen::VectorXf(size1)}}},
        crosstransformer_cross_layers_cross_attn_in_proj_weight{
                {{Eigen::MatrixXf(size2, size1)}, {Eigen::MatrixXf(size2, size1)}},
                {{Eigen::MatrixXf(size2, size1)}, {Eigen::MatrixXf(size2, size1)}}},
        crosstransformer_cross_layers_cross_attn_in_proj_bias{
            {{Eigen::VectorXf(size2)}, {Eigen::VectorXf(size2)}},
            {{Eigen::VectorXf(size2)}, {Eigen::VectorXf(size2)}}},
        crosstransformer_cross_layers_cross_attn_out_proj_weight{
                {{Eigen::MatrixXf(size1, size1)}, {Eigen::MatrixXf(size1, size1)}},
                {{Eigen::MatrixXf(size1, size1)}, {Eigen::MatrixXf(size1, size1)}}},
        crosstransformer_cross_layers_cross_attn_out_proj_bias{
                {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}},
                {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}}},
        crosstransformer_cross_layers_linear1_weight{
            {{Eigen::MatrixXf(size3, size1)}, {Eigen::MatrixXf(size3, size1)}},
            {{Eigen::MatrixXf(size3, size1)}, {Eigen::MatrixXf(size3, size1)}}},
        crosstransformer_cross_layers_linear1_bias{
            {{Eigen::VectorXf(size3)}, {Eigen::VectorXf(size3)}},
            {{Eigen::VectorXf(size3)}, {Eigen::VectorXf(size3)}}},
        crosstransformer_cross_layers_linear2_weight{
            {{Eigen::MatrixXf(size1, size3)}, {Eigen::MatrixXf(size1, size3)}},
            {{Eigen::MatrixXf(size1, size3)}, {Eigen::MatrixXf(size1, size3)}}},
        crosstransformer_cross_layers_linear2_bias{
            {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}}},
        crosstransformer_cross_layers_norm1_weight{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm1_bias{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm2_weight{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm2_bias{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm3_weight{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm3_bias{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm_out_weight{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_norm_out_bias{
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}},
            {{Eigen::Tensor1dXf(size1)}, {Eigen::Tensor1dXf(size1)}}},
        crosstransformer_cross_layers_gamma_1_scale{
            {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}}},
        crosstransformer_cross_layers_gamma_2_scale{
            {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}},
            {{Eigen::VectorXf(size1)}, {Eigen::VectorXf(size1)}}}
    {}

    // Common members and methods...
    virtual ~crosstransformer_base() = default;
};

struct demucs_crosstransformer_4s : crosstransformer_base {
    demucs_crosstransformer_4s() : crosstransformer_base(512, 1536, 2048) {};

    // channel_upsampler
    Eigen::Tensor3dXf channel_upsampler_weight{Eigen::Tensor3dXf(512, 384, 1)};
    Eigen::Tensor1dXf channel_upsampler_bias{Eigen::Tensor1dXf(512)};
    // channel_downsampler
    Eigen::Tensor3dXf channel_downsampler_weight{
        Eigen::Tensor3dXf(384, 512, 1)};
    Eigen::Tensor1dXf channel_downsampler_bias{Eigen::Tensor1dXf(384)};
    // channel_upsampler_t
    Eigen::Tensor3dXf channel_upsampler_t_weight{
        Eigen::Tensor3dXf(512, 384, 1)};
    Eigen::Tensor1dXf channel_upsampler_t_bias{Eigen::Tensor1dXf(512)};
    // channel_downsampler_t
    Eigen::Tensor3dXf channel_downsampler_t_weight{
        Eigen::Tensor3dXf(384, 512, 1)};
    Eigen::Tensor1dXf channel_downsampler_t_bias{Eigen::Tensor1dXf(384)};
};

struct demucs_crosstransformer_6s : crosstransformer_base  {
        demucs_crosstransformer_6s() : crosstransformer_base(384, 1152, 1536) {};
};

struct demucs_model
{
    bool is_4sources;

    // Encoders 0-3
    Eigen::Tensor3dXf encoder_conv_weight[4]{
        Eigen::Tensor3dXf(48, 4, 8),
        Eigen::Tensor3dXf(96, 48, 8),
        Eigen::Tensor3dXf(192, 96, 8),
        Eigen::Tensor3dXf(384, 192, 8),
    };

    Eigen::Tensor1dXf encoder_conv_bias[4]{
        Eigen::Tensor1dXf(48),
        Eigen::Tensor1dXf(96),
        Eigen::Tensor1dXf(192),
        Eigen::Tensor1dXf(384),
    };

    Eigen::Tensor3dXf encoder_rewrite_weight[4]{
        Eigen::Tensor3dXf(96, 48, 1),
        Eigen::Tensor3dXf(192, 96, 1),
        Eigen::Tensor3dXf(384, 192, 1),
        Eigen::Tensor3dXf(768, 384, 1),
    };

    Eigen::Tensor1dXf encoder_rewrite_bias[4]{
        Eigen::Tensor1dXf(96),
        Eigen::Tensor1dXf(192),
        Eigen::Tensor1dXf(384),
        Eigen::Tensor1dXf(768),
    };

    // TEncoder 0-3
    Eigen::Tensor3dXf tencoder_conv_weight[4] = {
        Eigen::Tensor3dXf(48, 2, 8), Eigen::Tensor3dXf(96, 48, 8),
        Eigen::Tensor3dXf(192, 96, 8), Eigen::Tensor3dXf(384, 192, 8)};

    Eigen::Tensor1dXf tencoder_conv_bias[4] = {
        Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(192),
        Eigen::Tensor1dXf(384)};

    Eigen::Tensor3dXf tencoder_rewrite_weight[4] = {
        Eigen::Tensor3dXf(96, 48, 1), Eigen::Tensor3dXf(192, 96, 1),
        Eigen::Tensor3dXf(384, 192, 1), Eigen::Tensor3dXf(768, 384, 1)};

    Eigen::Tensor1dXf tencoder_rewrite_bias[4] = {
        Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(384),
        Eigen::Tensor1dXf(768)};

    // Decoders 0-3
    Eigen::Tensor4dXf decoder_conv_tr_weight[4] = {
        Eigen::Tensor4dXf(384, 192, 8, 1), Eigen::Tensor4dXf(192, 96, 8, 1),
        Eigen::Tensor4dXf(96, 48, 8, 1),
        Eigen::Tensor4dXf(48, 16, 8, 1)};

    Eigen::Tensor1dXf decoder_conv_tr_bias[4] = {
        Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(48),
        Eigen::Tensor1dXf(16)};

    Eigen::Tensor4dXf decoder_rewrite_weight[4] = {
        Eigen::Tensor4dXf(768, 384, 3, 3), Eigen::Tensor4dXf(384, 192, 3, 3),
        Eigen::Tensor4dXf(192, 96, 3, 3), Eigen::Tensor4dXf(96, 48, 3, 3)};

    Eigen::Tensor1dXf decoder_rewrite_bias[4] = {
        Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(192),
        Eigen::Tensor1dXf(96)};

    // TDecoder 0-3
    Eigen::Tensor3dXf tdecoder_conv_tr_weight[4] = {
        Eigen::Tensor3dXf(384, 192, 8), Eigen::Tensor3dXf(192, 96, 8),
        Eigen::Tensor3dXf(96, 48, 8),
        Eigen::Tensor3dXf(48, 8, 8)};

    Eigen::Tensor1dXf tdecoder_conv_tr_bias[4] = {
        Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(48),
        Eigen::Tensor1dXf(8)};

    Eigen::Tensor3dXf tdecoder_rewrite_weight[4] = {
        Eigen::Tensor3dXf(768, 384, 3), Eigen::Tensor3dXf(384, 192, 3),
        Eigen::Tensor3dXf(192, 96, 3), Eigen::Tensor3dXf(96, 48, 3)};

    Eigen::Tensor1dXf tdecoder_rewrite_bias[4] = {
        Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(192),
        Eigen::Tensor1dXf(96)};

    // DConv layers
    // first index: time or frequency
    // second index: encoder or decoder
    // third index: enc/dec layer number
    // fourth index: dconv 0 or 1
    Eigen::Tensor3dXf dconv_layers_0_conv1d_weight[2][2][4][2]{
        {
            {{Eigen::Tensor3dXf(6, 48, 3), Eigen::Tensor3dXf(6, 48, 3)},
             {Eigen::Tensor3dXf(12, 96, 3), Eigen::Tensor3dXf(12, 96, 3)},
             {Eigen::Tensor3dXf(24, 192, 3), Eigen::Tensor3dXf(24, 192, 3)},
             {Eigen::Tensor3dXf(48, 384, 3), Eigen::Tensor3dXf(48, 384, 3)}},
            {{Eigen::Tensor3dXf(6, 48, 3), Eigen::Tensor3dXf(6, 48, 3)},
             {Eigen::Tensor3dXf(12, 96, 3), Eigen::Tensor3dXf(12, 96, 3)},
             {Eigen::Tensor3dXf(24, 192, 3), Eigen::Tensor3dXf(24, 192, 3)},
             {Eigen::Tensor3dXf(48, 384, 3), Eigen::Tensor3dXf(48, 384, 3)}},
        },
        {
            {{Eigen::Tensor3dXf(6, 48, 3), Eigen::Tensor3dXf(6, 48, 3)},
             {Eigen::Tensor3dXf(12, 96, 3), Eigen::Tensor3dXf(12, 96, 3)},
             {Eigen::Tensor3dXf(24, 192, 3), Eigen::Tensor3dXf(24, 192, 3)},
             {Eigen::Tensor3dXf(48, 384, 3), Eigen::Tensor3dXf(48, 384, 3)}},
            {{Eigen::Tensor3dXf(6, 48, 3), Eigen::Tensor3dXf(6, 48, 3)},
             {Eigen::Tensor3dXf(12, 96, 3), Eigen::Tensor3dXf(12, 96, 3)},
             {Eigen::Tensor3dXf(24, 192, 3), Eigen::Tensor3dXf(24, 192, 3)},
             {Eigen::Tensor3dXf(48, 384, 3), Eigen::Tensor3dXf(48, 384, 3)}},
        }};

    Eigen::Tensor1dXf dconv_layers_0_conv1d_bias[2][2][4][2]{
        {{{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}},
         {{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}}},
        {{{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}},
         {{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}}}};

    Eigen::Tensor1dXf dconv_layers_1_groupnorm_weight[2][2][4][2]{
        {{{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}},
         {{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}}},
        {{{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}},
         {{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}}}};

    Eigen::Tensor1dXf dconv_layers_1_groupnorm_bias[2][2][4][2]{
        {{{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}},
         {{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}}},
        {{{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}},
         {{Eigen::Tensor1dXf(6), Eigen::Tensor1dXf(6)},
          {Eigen::Tensor1dXf(12), Eigen::Tensor1dXf(12)},
          {Eigen::Tensor1dXf(24), Eigen::Tensor1dXf(24)},
          {Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)}}}};

    Eigen::Tensor3dXf dconv_layers_3_conv1d_weight[2][2][4][2]{
        {{{Eigen::Tensor3dXf(96, 6, 1), Eigen::Tensor3dXf(96, 6, 1)},
          {Eigen::Tensor3dXf(192, 12, 1), Eigen::Tensor3dXf(192, 12, 1)},
          {Eigen::Tensor3dXf(384, 24, 1), Eigen::Tensor3dXf(384, 24, 1)},
          {Eigen::Tensor3dXf(768, 48, 1), Eigen::Tensor3dXf(768, 48, 1)}},
         {{Eigen::Tensor3dXf(96, 6, 1), Eigen::Tensor3dXf(96, 6, 1)},
          {Eigen::Tensor3dXf(192, 12, 1), Eigen::Tensor3dXf(192, 12, 1)},
          {Eigen::Tensor3dXf(384, 24, 1), Eigen::Tensor3dXf(384, 24, 1)},
          {Eigen::Tensor3dXf(768, 48, 1), Eigen::Tensor3dXf(768, 48, 1)}}},
        {{{Eigen::Tensor3dXf(96, 6, 1), Eigen::Tensor3dXf(96, 6, 1)},
          {Eigen::Tensor3dXf(192, 12, 1), Eigen::Tensor3dXf(192, 12, 1)},
          {Eigen::Tensor3dXf(384, 24, 1), Eigen::Tensor3dXf(384, 24, 1)},
          {Eigen::Tensor3dXf(768, 48, 1), Eigen::Tensor3dXf(768, 48, 1)}},
         {{Eigen::Tensor3dXf(96, 6, 1), Eigen::Tensor3dXf(96, 6, 1)},
          {Eigen::Tensor3dXf(192, 12, 1), Eigen::Tensor3dXf(192, 12, 1)},
          {Eigen::Tensor3dXf(384, 24, 1), Eigen::Tensor3dXf(384, 24, 1)},
          {Eigen::Tensor3dXf(768, 48, 1), Eigen::Tensor3dXf(768, 48, 1)}}}};

    Eigen::Tensor1dXf dconv_layers_3_conv1d_bias[2][2][4][2]{
        {
            {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
             {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
            {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
             {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
        },
        {{{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
          {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
          {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
          {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
         {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
          {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
          {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
          {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}}}};

    Eigen::Tensor1dXf dconv_layers_4_groupnorm_weight[2][2][4][2]{
        {
            {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
             {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
            {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
             {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
        },
        {{{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
          {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
          {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
          {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
         {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
          {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
          {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
          {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}}}};

    Eigen::Tensor1dXf dconv_layers_4_groupnorm_bias[2][2][4][2]{
        {
            {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
             {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
            {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
             {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
        },
        {{{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
          {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
          {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
          {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}},
         {{Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
          {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
          {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)},
          {Eigen::Tensor1dXf(768), Eigen::Tensor1dXf(768)}}}};

    Eigen::Tensor1dXf dconv_layers_6_scale[2][2][4][2]{
        {
            {{Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)},
             {Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)}},
            {{Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)},
             {Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)}},
        },
        {
            {{Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)},
             {Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)}},
            {{Eigen::Tensor1dXf(48), Eigen::Tensor1dXf(48)},
             {Eigen::Tensor1dXf(96), Eigen::Tensor1dXf(96)},
             {Eigen::Tensor1dXf(192), Eigen::Tensor1dXf(192)},
             {Eigen::Tensor1dXf(384), Eigen::Tensor1dXf(384)}},
        }};

    // freq_emb
    Eigen::MatrixXf freq_emb_embedding_weight{Eigen::MatrixXf(512, 48)};

    std::unique_ptr<crosstransformer_base> crosstransformer;

    float inference_progress;
    float load_progress;
};

inline std::unique_ptr<crosstransformer_base> initialize_crosstransformer(bool is_4sources) {
    if (is_4sources) {
        return std::make_unique<struct demucs_crosstransformer_4s>();
    } else {
        return std::make_unique<struct demucs_crosstransformer_6s>();
    }
}

struct demucs_segment_buffers
{
    int segment_samples;
    int le;
    int pad;
    int pad_end;
    int padded_segment_samples;
    int nb_stft_frames;
    int nb_stft_bins;

    Eigen::MatrixXf mix;
    Eigen::Tensor3dXf targets_out;
    Eigen::MatrixXf padded_mix;
    Eigen::Tensor3dXcf z;

    // freq branch, one for each encoded representation
    Eigen::Tensor3dXf x;     // input
    Eigen::Tensor3dXf x_out; // input
    Eigen::Tensor3dXf x_0;
    Eigen::Tensor3dXf x_1;
    Eigen::Tensor3dXf x_2;
    Eigen::Tensor3dXf x_3;
    Eigen::Tensor3dXf x_3_channel_upsampled;

    // time branch
    Eigen::Tensor3dXf xt;             // input
    Eigen::Tensor3dXf xt_out;         // output
    Eigen::Tensor3dXf xt_decoded_out; // hold time decoder output
    Eigen::Tensor3dXf xt_0;
    Eigen::Tensor3dXf xt_1;
    Eigen::Tensor3dXf xt_2;
    Eigen::Tensor3dXf xt_3;
    Eigen::Tensor3dXf xt_3_channel_upsampled;

    // skip conns for frequency and time
    // easier as hardcoded matrix sizes
    Eigen::Tensor3dXf saved_0;
    Eigen::Tensor3dXf saved_1;
    Eigen::Tensor3dXf saved_2;
    Eigen::Tensor3dXf saved_3;

    Eigen::Tensor3dXf savedt_0;
    Eigen::Tensor3dXf savedt_1;
    Eigen::Tensor3dXf savedt_2;
    Eigen::Tensor3dXf savedt_3;

    // constructor for demucs_segment_buffers that takes int parameters

    // let's do pesky precomputing of the signal repadding to 1/4 hop
    // for time and frequency alignment
    demucs_segment_buffers(int nb_channels, int segment_samples, int nb_sources)
        : segment_samples(segment_samples),
          le(int(std::ceil((float)segment_samples / (float)FFT_HOP_SIZE))),
          pad(std::floor((float)FFT_HOP_SIZE / 2.0f) * 3),
          pad_end(pad + le * FFT_HOP_SIZE - segment_samples),
          padded_segment_samples(segment_samples + pad + pad_end),
          nb_stft_frames(segment_samples / demucscpp::FFT_HOP_SIZE + 1),
          nb_stft_bins(demucscpp::FFT_WINDOW_SIZE / 2 + 1),
          mix(nb_channels, segment_samples),
          targets_out(nb_sources, nb_channels, segment_samples),
          padded_mix(nb_channels, padded_segment_samples),
          z(nb_channels, nb_stft_bins, nb_stft_frames),
          // complex-as-channels implies 2*nb_channels for real+imag
          x(2 * nb_channels, nb_stft_bins - 1, nb_stft_frames),
          x_out(nb_sources * 2 * nb_channels, nb_stft_bins - 1, nb_stft_frames),
          x_0(48, 512, FREQ_BRANCH_LEN), x_1(96, 128, FREQ_BRANCH_LEN),
          x_2(192, 32, FREQ_BRANCH_LEN), x_3(384, 8, FREQ_BRANCH_LEN),
          x_3_channel_upsampled(512, 8, FREQ_BRANCH_LEN),
          xt(1, nb_channels, segment_samples),
          xt_out(1, nb_sources * nb_channels, segment_samples),
          xt_decoded_out(1, 8, segment_samples), xt_0(1, 48, TIME_BRANCH_LEN_0),
          xt_1(1, 96, TIME_BRANCH_LEN_1), xt_2(1, 192, TIME_BRANCH_LEN_2),
          xt_3(1, 384, TIME_BRANCH_LEN_3),
          xt_3_channel_upsampled(1, 512, TIME_BRANCH_LEN_3),
          saved_0(48, 512, FREQ_BRANCH_LEN), saved_1(96, 128, FREQ_BRANCH_LEN),
          saved_2(192, 32, FREQ_BRANCH_LEN), saved_3(384, 8, FREQ_BRANCH_LEN),
          savedt_0(1, 48, TIME_BRANCH_LEN_0),
          savedt_1(1, 96, TIME_BRANCH_LEN_1),
          savedt_2(1, 192, TIME_BRANCH_LEN_2),
          savedt_3(1, 384, TIME_BRANCH_LEN_3)
    {
        std::cout << "segment_samples: " << segment_samples << std::endl;
        std::cout << "padded segment_samples: " << padded_segment_samples
                  << std::endl;
        std::cout << "pad_begin: " << pad << std::endl;
        std::cout << "pad_end: " << pad_end << std::endl;
        std::cout << "le: " << le << std::endl;

        std::cout << "pad: " << pad
                  << " plus le * FFT_HOP_SIZE: " << le * FFT_HOP_SIZE
                  << " minus segment_samples: " << segment_samples << std::endl;
    };
};

bool load_demucs_model(const std::string &model_dir,
                          struct demucs_model *model);

const float SEGMENT_LEN_SECS = 7.8;      // 8 seconds, the demucs chunk size
const float SEGMENT_OVERLAP_SECS = 0.25; // 0.25 overlap
const float MAX_SHIFT_SECS = 0.5;        // max shift
const float OVERLAP = 0.25;              // overlap between segments
const float TRANSITION_POWER = 1.0;      // transition between segments

Eigen::Tensor3dXf demucs_inference(struct demucs_model &model,
                                      Eigen::MatrixXf &full_audio, ProgressCallback cb);

void model_inference(struct demucs_model &model,
                        struct demucscpp::demucs_segment_buffers &buffers,
                        struct demucscpp::stft_buffers &stft_buf);
} // namespace demucscpp

#endif // MODEL_HPP
