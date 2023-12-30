#ifndef CONV_HPP
#define CONV_HPP

#include "model.hpp"
#include "tensor.hpp"
#include <Eigen/Dense>
#include <iostream>
#include <unsupported/Eigen/CXX11/Tensor>

namespace demucscpp
{

template <int kernel_height, int kernel_width, int stride_height,
          int stride_width, int pad_height, int pad_width, int dilation_height,
          int dilation_width>
inline Eigen::MatrixXf im2col(const Eigen::Tensor3dXf &input)
{
    // Adjust the calculation of height_col and width_col for dilation
    int in_channels = input.dimension(0);
    int height_col = (input.dimension(1) + 2 * pad_height -
                      dilation_height * (kernel_height - 1) - 1) /
                         stride_height +
                     1;
    int width_col = (input.dimension(2) + 2 * pad_width -
                     dilation_width * (kernel_width - 1) - 1) /
                        stride_width +
                    1;

    int in_height = input.dimension(1);
    int in_width = input.dimension(2);

    Eigen::MatrixXf output(height_col * width_col,
                           in_channels * kernel_height * kernel_width);
    output.setZero();

    for (int c = 0; c < in_channels; c++)
    {
        for (int kh = 0; kh < kernel_height; kh++)
        {
            for (int kw = 0; kw < kernel_width; kw++)
            {
                for (int h = 0; h < height_col; h++)
                {
                    for (int w = 0; w < width_col; w++)
                    {
                        int h_pad = h * stride_height + kh * dilation_height -
                                    pad_height;
                        int w_pad =
                            w * stride_width + kw * dilation_width - pad_width;
                        if (h_pad >= 0 && h_pad < in_height && w_pad >= 0 &&
                            w_pad < in_width)
                        {
                            output(h * width_col + w,
                                   c * kernel_height * kernel_width +
                                       kh * kernel_width + kw) =
                                input(c, h_pad, w_pad);
                        }
                    }
                }
            }
        }
    }

    return output;
}

template <int in_channels, int out_channels, int kernel_height,
          int kernel_width, int stride_height, int stride_width, int pad_height,
          int pad_width, int dilation_height, int dilation_width>
Eigen::Tensor3dXf conv2d_gemm(const Eigen::Tensor3dXf &x,
                              const Eigen::Tensor4dXf &w,
                              const Eigen::Tensor1dXf &b)
{
    int in_height = x.dimension(1);
    int in_width = x.dimension(2);

    // Calculate output dimensions
    int out_height = static_cast<int>(std::floor(in_height + 2 * pad_height -
                                                 kernel_height) /
                                      stride_height) +
                     1;
    int out_width =
        static_cast<int>(std::floor(in_width + 2 * pad_width - kernel_width) /
                         stride_width) +
        1;

    // Apply im2col
    Eigen::MatrixXf im2col_matrix =
        im2col<kernel_height, kernel_width, stride_height, stride_width,
               pad_height, pad_width, dilation_height, dilation_width>(x);

    // Reshape weights
    // reverse last 3 axes (out chanel x in chan x kernel height x kernel width
    // -> out chan x (kernel width x kernel height x in chan))
    Eigen::Tensor4dXf w_swapped = w.shuffle(Eigen::array<int, 4>({0, 3, 2, 1}));
    // then flatten to the last axis
    Eigen::Tensor2dXf reshaped_weights_tensor =
        w_swapped.reshape(Eigen::array<int, 2>{
            out_channels, in_channels * kernel_width * kernel_height});
    Eigen::MatrixXf reshaped_weights = Eigen::Map<Eigen::MatrixXf>(
        reshaped_weights_tensor.data(), reshaped_weights_tensor.dimension(0),
        reshaped_weights_tensor.dimension(1));

    // Perform matrix multiplication with GEMM
    Eigen::MatrixXf result = im2col_matrix * reshaped_weights.transpose();

    // Add bias to each column of the result matrix
    for (int chout = 0; chout < out_channels; ++chout)
    {
        result.col(chout).array() += b(chout);
    }

    // Reshape result to 3D output tensor
    Eigen::Tensor3dXf y_out(out_channels, out_height, out_width);
    y_out.setZero();

    for (int chout = 0; chout < out_channels; ++chout)
    {
        for (int h = 0; h < out_height; ++h)
        {
            for (int w = 0; w < out_width; ++w)
            {
                int row_idx = h * out_width + w;
                // Assign the value from the GEMM output to the output tensor
                if (row_idx < result.rows()) {
                    y_out(chout, h, w) = result(row_idx, chout);
                }
            }
        }
    }

    return y_out;
}

template <int in_channels, int out_channels, int kernel_height,
          int kernel_width, int stride_height, int stride_width, int pad_height,
          int pad_width, int dilation_height, int dilation_width>
Eigen::Tensor3dXf conv2d_gemm_fused_gelu(const Eigen::Tensor3dXf &x,
                              const Eigen::Tensor4dXf &w,
                              const Eigen::Tensor1dXf &b)
{
    int in_height = x.dimension(1);
    int in_width = x.dimension(2);

    // Calculate output dimensions
    int out_height = static_cast<int>(std::floor(in_height + 2 * pad_height -
                                                 kernel_height) /
                                      stride_height) +
                     1;
    int out_width =
        static_cast<int>(std::floor(in_width + 2 * pad_width - kernel_width) /
                         stride_width) +
        1;

    // Apply im2col
    Eigen::MatrixXf im2col_matrix =
        im2col<kernel_height, kernel_width, stride_height, stride_width,
               pad_height, pad_width, dilation_height, dilation_width>(x);

    // Reshape weights
    // reverse last 3 axes (out chanel x in chan x kernel height x kernel width
    // -> out chan x (kernel width x kernel height x in chan))
    Eigen::Tensor4dXf w_swapped = w.shuffle(Eigen::array<int, 4>({0, 3, 2, 1}));
    // then flatten to the last axis
    Eigen::Tensor2dXf reshaped_weights_tensor =
        w_swapped.reshape(Eigen::array<int, 2>{
            out_channels, in_channels * kernel_width * kernel_height});
    Eigen::MatrixXf reshaped_weights = Eigen::Map<Eigen::MatrixXf>(
        reshaped_weights_tensor.data(), reshaped_weights_tensor.dimension(0),
        reshaped_weights_tensor.dimension(1));

    // Perform matrix multiplication with GEMM
    Eigen::MatrixXf result = im2col_matrix * reshaped_weights.transpose();

    // Add bias to each column of the result matrix
    for (int chout = 0; chout < out_channels; ++chout)
    {
        result.col(chout).array() += b(chout);
    }

    // Reshape result to 3D output tensor
    Eigen::Tensor3dXf y_out(out_channels, out_height, out_width);
    y_out.setZero();

    for (int chout = 0; chout < out_channels; ++chout)
    {
        for (int h = 0; h < out_height; ++h)
        {
            for (int w = 0; w < out_width; ++w)
            {
                int row_idx = h * out_width + w;
                // Assign the value from the GEMM output to the output tensor
                // with gelu
                float value = result(row_idx, chout);
                float activated_value = 0.5f * value * (1.0f + std::erf(value / std::sqrt(2.0f)));
                // Assign the activated value to the output tensor
                y_out(chout, h, w) = activated_value;
            }
        }
    }

    return y_out;
}

template <int in_channels, int out_channels, int kernel_height,
          int kernel_width, int stride_height, int stride_width, int pad_height,
          int pad_width, int dilation_height, int dilation_width>
Eigen::Tensor3dXf conv2d(const Eigen::Tensor3dXf &x, const Eigen::Tensor4dXf &w,
                         const Eigen::Tensor1dXf &b)
{
    return conv2d_gemm<in_channels, out_channels, kernel_height, kernel_width,
                       stride_height, stride_width, pad_height, pad_width,
                       dilation_height, dilation_width>(x, w, b);
}

template <int in_channels, int out_channels, int kernel_size, int stride,
          int pad, int dilation>
Eigen::Tensor3dXf conv1d(const Eigen::Tensor3dXf &x, const Eigen::Tensor3dXf &w,
                         const Eigen::Tensor1dXf &b)
{
    // copy w into a 4d tensor with trailing (,1) dimension
    Eigen::Tensor4dXf w_4d = w.reshape(Eigen::array<int, 4>{
        {(int)w.dimension(0), (int)w.dimension(1), (int)w.dimension(2), 1}});

    // move 0 axis to the end
    Eigen::Tensor3dXf x_shuff = x.shuffle(Eigen::array<int, 3>({1, 2, 0}));

    // do 2d convolution inference here
    // treating the in_freq dimension as a width dimension with a no-op kernel
    Eigen::Tensor3dXf y_out =
        demucscpp::conv2d<in_channels, out_channels, kernel_size, 1, stride, 1,
                          pad, 0, dilation, 1>(x_shuff, w_4d, b);

    // move end axis to the front
    Eigen::Tensor3dXf y_out_shuf =
        y_out.shuffle(Eigen::array<int, 3>({2, 0, 1}));
    return y_out_shuf;
}

template <int in_channels, int out_channels, int kernel_size, int stride,
          int pad, int dilation>
Eigen::Tensor3dXf conv1d_fused_gelu(const Eigen::Tensor3dXf &x, const Eigen::Tensor3dXf &w,
                         const Eigen::Tensor1dXf &b)
{
    // copy w into a 4d tensor with trailing (,1) dimension
    Eigen::Tensor4dXf w_4d = w.reshape(Eigen::array<int, 4>{
        {(int)w.dimension(0), (int)w.dimension(1), (int)w.dimension(2), 1}});

    // move 0 axis to the end
    Eigen::Tensor3dXf x_shuff = x.shuffle(Eigen::array<int, 3>({1, 2, 0}));

    // do 2d convolution inference here
    // treating the in_freq dimension as a width dimension with a no-op kernel
    Eigen::Tensor3dXf y_out =
        demucscpp::conv2d_gemm_fused_gelu<in_channels, out_channels, kernel_size, 1, stride, 1,
                          pad, 0, dilation, 1>(x_shuff, w_4d, b);

    // move end axis to the front
    Eigen::Tensor3dXf y_out_shuf =
        y_out.shuffle(Eigen::array<int, 3>({2, 0, 1}));
    return y_out_shuf;
}

template <int kernel_height, int kernel_width, int stride_height,
          int stride_width, int pad_height, int pad_width, int dilation_height,
          int dilation_width>
Eigen::MatrixXf im2col_transposed(const Eigen::Tensor3dXf &input)
{
    int channels = input.dimension(0);
    int input_height = input.dimension(1);
    int input_width = input.dimension(2);

    // Calculate the expanded output height and width
    int expanded_height = (input_height - 1) * stride_height + kernel_height;
    int expanded_width = (input_width - 1) * stride_width + kernel_width;

    // Initialize the output matrix
    Eigen::MatrixXf output =
        Eigen::MatrixXf::Zero(expanded_height * expanded_width,
                              channels * kernel_height * kernel_width);

    // Populate the output matrix
    for (int c = 0; c < channels; ++c)
    {
        for (int kh = 0; kh < kernel_height; ++kh)
        {
            for (int kw = 0; kw < kernel_width; ++kw)
            {
                for (int h = 0; h < input_height; ++h)
                {
                    for (int w = 0; w < input_width; ++w)
                    {
                        // Calculate the position in the expanded output
                        int expanded_h = h * stride_height + kh - pad_height;
                        int expanded_w = w * stride_width + kw - pad_width;

                        // Check if the indices are within the bounds of the
                        // expanded output
                        if (expanded_h >= 0 && expanded_h < expanded_height &&
                            expanded_w >= 0 && expanded_w < expanded_width)
                        {
                            int col_index =
                                expanded_h * expanded_width + expanded_w;
                            int row_index = c * kernel_height * kernel_width +
                                            kh * kernel_width + kw;
                            output(col_index, row_index) = input(c, h, w);
                        }
                    }
                }
            }
        }
    }

    return output;
}

template <int in_channels, int out_channels, int kernel_height,
          int kernel_width, int stride_height, int stride_width, int pad_height,
          int pad_width, int dilation_height, int dilation_width>
Eigen::Tensor3dXf conv2d_tr_gemm(const Eigen::Tensor3dXf &x,
                                 const Eigen::Tensor4dXf &w,
                                 const Eigen::Tensor1dXf &b)
{
    int in_height = x.dimension(1);
    int in_width = x.dimension(2);

    // Calculate the output dimensions
    int out_height =
        (in_height - 1) * stride_height - 2 * pad_height + kernel_height;
    int out_width =
        (in_width - 1) * stride_width - 2 * pad_width + kernel_width;

    // demucscppdebug::debug_tensor_3dxf(x, "x input");
    //  Apply an adapted im2col for transposed convolution
    Eigen::MatrixXf im2col_matrix =
        im2col_transposed<kernel_height, kernel_width, stride_height,
                          stride_width, pad_height, pad_width, dilation_height,
                          dilation_width>(x);
    // demucscppdebug::debug_matrix_xf(im2col_matrix, "x post-im2col");

    // demucscppdebug::debug_tensor_4dxf(w, "weights");
    //  Reshape and prepare the weights as in conv2d_gemm
    //  keeping in mind transpose weights are stored as (Cin, Cout, Kh, Kw) (not
    //  Cout, Cin, Kh, Kw)
    Eigen::Tensor4dXf w_swapped = w.shuffle(Eigen::array<int, 4>(
        {1, 3, 2, 0})); // Note the change in the shuffle order
    Eigen::Tensor2dXf reshaped_weights_tensor =
        w_swapped.reshape(Eigen::array<int, 2>{
            out_channels, in_channels * kernel_height * kernel_width});
    Eigen::MatrixXf reshaped_weights = Eigen::Map<Eigen::MatrixXf>(
        reshaped_weights_tensor.data(), reshaped_weights_tensor.dimension(0),
        reshaped_weights_tensor.dimension(1));

    // demucscppdebug::debug_matrix_xf(reshaped_weights, "reshaped weights");

    // Perform matrix multiplication with GEMM
    Eigen::MatrixXf result = im2col_matrix * reshaped_weights.transpose();
    // demucscppdebug::debug_matrix_xf(result, "result of gemm-conv-tr");

    // Add bias to result
    for (int chout = 0; chout < out_channels; ++chout)
    {
        result.col(chout).array() += b(chout);
    }

    // demucscppdebug::debug_matrix_xf(result, "result conv2d-tr-gemm
    // post-bias!");

    Eigen::Tensor3dXf y_out(out_channels, out_height, out_width);
    y_out.setZero();

    // Reshape and sum up the contributions to the output
    for (int ch = 0; ch < out_channels; ++ch)
    {
        for (int h = 0; h < out_height; ++h)
        {
            for (int w = 0; w < out_width; ++w)
            {
                // Calculate the linear index in the GEMM result corresponding
                // to this output location
                int gemm_row = h * out_width + w;
                int gemm_col = ch;

                // Assign the value from the GEMM result to the output tensor
                y_out(ch, h, w) += result(gemm_row, gemm_col);
            }
        }
    }

    // demucscppdebug::debug_tensor_3dxf(y_out, "y_out");
    return y_out;
}

template <int in_channels, int out_channels, int kernel_height,
          int kernel_width, int stride_height, int stride_width, int pad_height,
          int pad_width, int dilation_height, int dilation_width>
Eigen::Tensor3dXf conv2d_tr_gemm_fused_gelu(const Eigen::Tensor3dXf &x,
                                 const Eigen::Tensor4dXf &w,
                                 const Eigen::Tensor1dXf &b)
{
    int in_height = x.dimension(1);
    int in_width = x.dimension(2);

    // Calculate the output dimensions
    int out_height =
        (in_height - 1) * stride_height - 2 * pad_height + kernel_height;
    int out_width =
        (in_width - 1) * stride_width - 2 * pad_width + kernel_width;

    // demucscppdebug::debug_tensor_3dxf(x, "x input");
    //  Apply an adapted im2col for transposed convolution
    Eigen::MatrixXf im2col_matrix =
        im2col_transposed<kernel_height, kernel_width, stride_height,
                          stride_width, pad_height, pad_width, dilation_height,
                          dilation_width>(x);
    // demucscppdebug::debug_matrix_xf(im2col_matrix, "x post-im2col");

    // demucscppdebug::debug_tensor_4dxf(w, "weights");
    //  Reshape and prepare the weights as in conv2d_gemm
    //  keeping in mind transpose weights are stored as (Cin, Cout, Kh, Kw) (not
    //  Cout, Cin, Kh, Kw)
    Eigen::Tensor4dXf w_swapped = w.shuffle(Eigen::array<int, 4>(
        {1, 3, 2, 0})); // Note the change in the shuffle order
    Eigen::Tensor2dXf reshaped_weights_tensor =
        w_swapped.reshape(Eigen::array<int, 2>{
            out_channels, in_channels * kernel_height * kernel_width});
    Eigen::MatrixXf reshaped_weights = Eigen::Map<Eigen::MatrixXf>(
        reshaped_weights_tensor.data(), reshaped_weights_tensor.dimension(0),
        reshaped_weights_tensor.dimension(1));

    // demucscppdebug::debug_matrix_xf(reshaped_weights, "reshaped weights");

    // Perform matrix multiplication with GEMM
    Eigen::MatrixXf result = im2col_matrix * reshaped_weights.transpose();
    // demucscppdebug::debug_matrix_xf(result, "result of gemm-conv-tr");

    // Add bias to result
    for (int chout = 0; chout < out_channels; ++chout)
    {
        result.col(chout).array() += b(chout);
    }

    // demucscppdebug::debug_matrix_xf(result, "result conv2d-tr-gemm
    // post-bias!");

    Eigen::Tensor3dXf y_out(out_channels, out_height, out_width);
    y_out.setZero();

    // Reshape and sum up the contributions to the output
    for (int ch = 0; ch < out_channels; ++ch)
    {
        for (int h = 0; h < out_height; ++h)
        {
            for (int w = 0; w < out_width; ++w)
            {
                // Calculate the linear index in the GEMM result corresponding
                // to this output location
                int gemm_row = h * out_width + w;
                int gemm_col = ch;

                // Compute the value from the GEMM result
                float value = result(gemm_row, gemm_col);

                // Apply GeLU activation
                float activated_value = 0.5f * value * (1.0f + std::erf(value / std::sqrt(2.0f)));

                // Assign the activated value to the output tensor
                y_out(ch, h, w) += activated_value;
            }
        }
    }

    // demucscppdebug::debug_tensor_3dxf(y_out, "y_out");
    return y_out;
}

template <int in_channels, int out_channels, int kernel_height,
          int kernel_width, int stride_height, int stride_width, int pad_height,
          int pad_width, int dilation_height, int dilation_width>
Eigen::Tensor3dXf conv2d_tr(const Eigen::Tensor3dXf &x,
                            const Eigen::Tensor4dXf &w,
                            const Eigen::Tensor1dXf &b)
{
    return conv2d_tr_gemm<in_channels, out_channels, kernel_height,
                          kernel_width, stride_height, stride_width, pad_height,
                          pad_width, dilation_height, dilation_width>(x, w, b);
}

template <int in_channels, int out_channels, int kernel_size, int stride,
          int pad, int dilation>
Eigen::Tensor3dXf conv1d_tr(const Eigen::Tensor3dXf &x,
                            const Eigen::Tensor3dXf &w,
                            const Eigen::Tensor1dXf &b)
{
    // Convert 1D convolution to 2D convolution by adding an extra dimension
    Eigen::Tensor4dXf w_4d = w.reshape(Eigen::array<int, 4>{
        {(int)w.dimension(0), (int)w.dimension(1), (int)w.dimension(2), 1}});

    // Move 0 axis to the end
    Eigen::Tensor3dXf x_shuff = x.shuffle(Eigen::array<int, 3>({1, 2, 0}));

    // Call the 2D transposed convolution function
    Eigen::Tensor3dXf y_out =
        conv2d_tr_gemm<in_channels, out_channels, kernel_size, 1, stride, 1,
                       pad, 0, dilation, 1>(x_shuff, w_4d, b);

    // Move end axis to the front
    Eigen::Tensor3dXf y_out_shuf =
        y_out.shuffle(Eigen::array<int, 3>({2, 0, 1}));

    return y_out_shuf;
}

template <int in_channels, int out_channels, int kernel_size, int stride,
          int pad, int dilation>
Eigen::Tensor3dXf conv1d_tr_fused_gelu(const Eigen::Tensor3dXf &x,
                            const Eigen::Tensor3dXf &w,
                            const Eigen::Tensor1dXf &b)
{
    // Convert 1D convolution to 2D convolution by adding an extra dimension
    Eigen::Tensor4dXf w_4d = w.reshape(Eigen::array<int, 4>{
        {(int)w.dimension(0), (int)w.dimension(1), (int)w.dimension(2), 1}});

    // Move 0 axis to the end
    Eigen::Tensor3dXf x_shuff = x.shuffle(Eigen::array<int, 3>({1, 2, 0}));

    // Call the 2D transposed convolution function
    Eigen::Tensor3dXf y_out =
        conv2d_tr_gemm_fused_gelu<in_channels, out_channels, kernel_size, 1, stride, 1,
                       pad, 0, dilation, 1>(x_shuff, w_4d, b);

    // Move end axis to the front
    Eigen::Tensor3dXf y_out_shuf =
        y_out.shuffle(Eigen::array<int, 3>({2, 0, 1}));

    return y_out_shuf;
}



} // namespace demucscpp

#endif // CONV_HPP
