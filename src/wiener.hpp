#ifndef WIENER_HPP
#define WIENER_HPP

#include "dsp.hpp"
#include <string>
#include <vector>
#include <complex>
#include <cmath>

namespace umxcpp {
const float WIENER_EPS = 1e-10f;
const float WIENER_SCALE_FACTOR = 10.0f;

// try a smaller batch for memory issues
const int WIENER_EM_BATCH_SIZE = 200;
const int WIENER_ITERATIONS = 1;

const int WIENER_PSD_WINDOW = 100;

std::array<umxcpp::StereoSpectrogramC, 4>
wiener_filter(umxcpp::StereoSpectrogramC &mix_spectrogram,
              const std::vector<umxcpp::StereoSpectrogramR> &targets_mag_spectrograms);

struct Tensor5D {
    std::vector<std::vector<std::vector<std::vector<std::vector<float>>>>> data;

    Tensor5D(int dim1, int dim2, int dim3, int dim4, int dim5) {
        data.resize(dim1);
        for (int i = 0; i < dim1; ++i) {
            data[i].resize(dim2);
            for (int j = 0; j < dim2; ++j) {
                data[i][j].resize(dim3);
                for (int k = 0; k < dim3; ++k) {
                    data[i][j][k].resize(dim4);
                    for (int l = 0; l < dim4; ++l) {
                        data[i][j][k][l].resize(dim5, 0.0f);  // Initializing with 0
                    }
                }
            }
        }
    }

    // Method to fill diagonal with 1s for a specific 3D slice
    void fill_diagonal(int dim1, int dim2, float param = 1.0f) {
        for (std::size_t i = 0; i < data[0][0].size(); ++i) {
            for (std::size_t j = 0; j < data[0][0][0].size(); ++j) {
                if (i == j) {
                    data[dim1][dim2][i][j][0] = param;
                }
            }
        }
    }

    // Method to scale the tensor by a scalar
    void scale_by(float scalar) {
        for (std::size_t i = 0; i < data.size(); ++i) {
            for (std::size_t j = 0; j < data[0].size(); ++j) {
                for (std::size_t k = 0; k < data[0][0].size(); ++k) {
                    for (std::size_t l = 0; l < data[0][0][0].size(); ++l) {
                        for (std::size_t m = 0; m < data[0][0][0][0].size(); ++m) {
                            data[i][j][k][l][m] *= scalar;
                        }
                    }
                }
            }
        }
    }

    void setZero() {
        for (std::size_t i = 0; i < data.size(); ++i) {
            for (std::size_t j = 0; j < data[0].size(); ++j) {
                for (std::size_t k = 0; k < data[0][0].size(); ++k) {
                    for (std::size_t l = 0; l < data[0][0][0].size(); ++l) {
                        for (std::size_t m = 0; m < data[0][0][0][0].size(); ++m) {
                            data[i][j][k][l][m] = 0.0f;
                        }
                    }
                }
            }
        }
    }
};

struct Tensor4D {
    std::vector<std::vector<std::vector<std::vector<float>>>> data;

    Tensor4D(int dim1, int dim2, int dim3, int dim4) {
        resize(dim1, dim2, dim3, dim4);
    }

    void resize(int dim1, int dim2, int dim3, int dim4) {
        data.resize(dim1);
        for (int i = 0; i < dim1; ++i) {
            data[i].resize(dim2);
            for (int j = 0; j < dim2; ++j) {
                data[i][j].resize(dim3);
                for (int k = 0; k < dim3; ++k) {
                    data[i][j][k].resize(dim4, 0.0f);  // Initializing with 0
                }
            }
        }
    }

    void setZero() {
        for (std::size_t i = 0; i < data.size(); ++i) {
            for (std::size_t j = 0; j < data[0].size(); ++j) {
                for (std::size_t k = 0; k < data[0][0].size(); ++k) {
                    for (std::size_t l = 0; l < data[0][0][0].size(); ++l) {
                        data[i][j][k][l] = 0.0f;
                    }
                }
            }
        }
    }
};

// Tensor3D
struct Tensor3D {
    std::vector<std::vector<std::vector<float>>> data;

    Tensor3D(int dim1, int dim2, int dim3) {
        resize(dim1, dim2, dim3);
    }

    void resize(int dim1, int dim2, int dim3) {
        data.resize(dim1);
        for (int i = 0; i < dim1; ++i) {
            data[i].resize(dim2);
            for (int j = 0; j < dim2; ++j) {
                data[i][j].resize(dim3, 0.0f);  // Initializing with 0
            }
        }
    }

    // Method to fill diagonal with param
    void fill_diagonal(float param) {
        for (std::size_t i = 0; i < data[0].size(); ++i) {
            for (std::size_t j = 0; j < data[0][0].size(); ++j) {
                if (i == j) {
                    data[i][j][0] = param;
                }
            }
        }
    }

};

// Tensor1D
struct Tensor1D {
    std::vector<float> data;

    Tensor1D(int dim1) {
        resize(dim1);
    }

    void resize(int dim1) {
        data.resize(dim1, 0.0f);  // Initializing with 0
    }

    void fill(float value) {
        for (std::size_t i = 0; i < data.size(); ++i) {
            data[i] = value;
        }
    }
};
} // namespace umxcpp

#endif // WIENER_HPP
