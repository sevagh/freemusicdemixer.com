#ifndef TENSOR_HPP
#define TENSOR_HPP

#include <Eigen/Dense>
#include <complex>
#include <iostream>
#include <string>
#include <unsupported/Eigen/CXX11/Tensor>
#include <vector>

namespace Eigen
{
// half/float16 typedefs for weights
typedef Tensor<Eigen::half, 3, Eigen::RowMajor> Tensor3dXh;
typedef Tensor<std::complex<Eigen::half>, 3, Eigen::RowMajor> Tensor3dXch;
typedef Tensor<Eigen::half, 1, Eigen::RowMajor> Tensor1dXh;
typedef Tensor<Eigen::half, 4, Eigen::RowMajor> Tensor4dXh;
typedef Vector<Eigen::half, Dynamic> VectorXh;

// define MatrixXh for some layers in demucs
typedef Matrix<Eigen::half, Dynamic, Dynamic, Eigen::RowMajor> MatrixXh;

// define Tensor3dXf, Tensor3dXcf for spectrograms etc.
typedef Tensor<float, 4> Tensor4dXf;
typedef Tensor<float, 3> Tensor3dXf;
typedef Tensor<float, 2> Tensor2dXf;
typedef Tensor<float, 1> Tensor1dXf;
typedef Tensor<std::complex<float>, 3> Tensor3dXcf;
} // namespace Eigen

#endif // TENSOR_HPP
