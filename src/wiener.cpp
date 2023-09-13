#include "wiener.hpp"
#include "dsp.hpp"
#include <Eigen/Dense>
#include <Eigen/Core>
#include <algorithm>
#include <cmath>
#include <complex>
#include <iostream>
#include <unsupported/Eigen/CXX11/Tensor>
#include <unsupported/Eigen/CXX11/src/Tensor/TensorChipping.h>
#include <vector>
#include <array>
#include <cassert>
#include <tuple>
#include "tensor.hpp"

void fill_diagonal(Eigen::Tensor2dXcf& tensor, float value) {
    // Get the dimensions of the tensor
    int dim1 = tensor.dimension(0);
    int dim2 = tensor.dimension(1);

    // Loop over each 2D slice (matrix) and fill its diagonal
    for (int i = 0; i < dim1; ++i) {
        for (int j = 0; j < dim2; ++j) {
            if (i == j) {
                tensor(i, j) = std::complex<float>{value, 0.0f};
            }
        }
    }
}

// Function to compute the absolute maximum value from a complex 2D vector
static float find_max_abs(const Eigen::Tensor3dXcf &data, float scale_factor) {
    float max_val_im = -1.0f;
    for (int i = 0; i < 2; ++i) {
        for (int j = 0; j < data.dimension(1); ++j) {
            for (int k = 0; k < data.dimension(2); ++k) {
                max_val_im = std::max(max_val_im, std::sqrt(std::norm(
                    data(i, j, k)
                )));
            }
        }
    }
    return std::max(1.0f, max_val_im/scale_factor);
}

static void invert4D(Eigen::Tensor4dXcf &M) {
    for (int frame = 0; frame < M.dimension(0); ++frame) {
        for (int bin = 0; bin < M.dimension(1); ++bin) {
            std::complex<float> a = M(frame, bin, 0, 0);
            std::complex<float> b = M(frame, bin, 0, 1);
            std::complex<float> c = M(frame, bin, 1, 0);
            std::complex<float> d = M(frame, bin, 1, 1);

            // Compute the determinant
            std::complex<float> det = a * d - b * c;

            // Compute the inverse determinant
            std::complex<float> invDet = std::conj(det)/std::norm(det);

            // Compute the inverse matrix
            std::complex<float> tmp00 = invDet * d;
            std::complex<float> tmp01 = -invDet * b;
            std::complex<float> tmp10 = -invDet * c;
            std::complex<float> tmp11 = invDet * a;

            // Update the original tensor
            M(frame, bin, 0, 0) = tmp00;
            M(frame, bin, 0, 1) = tmp01;
            M(frame, bin, 1, 0) = tmp10;
            M(frame, bin, 1, 1) = tmp11;
        }
    }
}

// Compute the empirical covariance for a source.
// forward decl
static Eigen::Tensor4dXcf calculateCovariance(
    const Eigen::Tensor3dXcf &y_j,
    const int pos,
    const int t_end
);

// Wiener filter function
std::array<Eigen::Tensor3dXcf, 4>
umxcpp::wiener_filter(Eigen::Tensor3dXcf &mix_stft,
              const std::vector<Eigen::Tensor3dXf> &targets_mag_spectrograms)
{
    // first just do naive mix-phase
    std::array<Eigen::Tensor3dXcf, 4> y;

    Eigen::Tensor3dXf mix_phase = mix_stft.unaryExpr(
        [](const std::complex<float> &c) { return std::arg(c); });

    std::cout << "Wiener-EM: Getting first estimates from naive mix-phase" << std::endl;

    for (int target = 0; target < 4; ++target) {
        y[target] = umxcpp::polar_to_complex(targets_mag_spectrograms[target], mix_phase);
    }

    std::cout << "Wiener-EM: Scaling down by max_abs" << std::endl;

    // we need to refine the estimates. Scales down the estimates for
    // numerical stability
    float max_abs = find_max_abs(mix_stft, WIENER_SCALE_FACTOR);

    // Dividing mix_stft by max_abs
    for (int i = 0; i < mix_stft.dimension(1); ++i) {
        for (int j = 0; j < mix_stft.dimension(2); ++j) {
            mix_stft(0, i, j) = std::complex<float>{
                    mix_stft(0, i, j).real()/max_abs,
                    mix_stft(0, i, j).imag()/max_abs};
            mix_stft(1, i, j) = std::complex<float>{
                    mix_stft(1, i, j).real()/max_abs,
                    mix_stft(1, i, j).imag()/max_abs};
        }
    }

    // Dividing y by max_abs
    for (int source = 0; source < 4; ++source) {
        for (int i = 0; i < mix_stft.dimension(1); ++i) {
            for (int j = 0; j < mix_stft.dimension(2); ++j) {
                y[source](0, i, j) = std::complex<float>{
                        y[source](0, i, j).real()/max_abs,
                        y[source](0, i, j).imag()/max_abs};
                y[source](1, i, j) = std::complex<float>{
                        y[source](1, i, j).real()/max_abs,
                        y[source](1, i, j).imag()/max_abs};
            }
        }
    }

    // call expectation maximization
    // y = expectation_maximization(y, mix_stft, iterations, eps=eps)[0]

    const int nb_channels = 2;
    const int nb_frames = mix_stft.dimension(1);
    const int nb_bins = mix_stft.dimension(2);
    const int nb_sources = 4;
    const float eps = WIENER_EPS;

    std::cout << "Wiener-EM: Initialize tensors" << std::endl;

    Eigen::Tensor2dXcf regularization(nb_channels, nb_channels);
    // Fill the diagonal with sqrt(eps)
    fill_diagonal(regularization, std::sqrt(eps));

    std::vector<Eigen::Tensor3dXcf> R; // A vector to hold each source's covariance matrix
    for (int j = 0; j < nb_sources; ++j) {
        R.emplace_back(Eigen::Tensor3dXcf(nb_bins, nb_channels, nb_channels));
    }

    Eigen::ArrayXf weight(nb_bins);  // A 1D tensor (vector) of zeros
    Eigen::Tensor3dXf v(nb_frames, nb_bins, nb_sources);  // A 3D tensor of zeros

    for (int it = 0; it < WIENER_ITERATIONS; ++it) {
        std::cout << "Wiener-EM: iteration: " << it << std::endl;
        // update the PSD as the average spectrogram over channels
        // PSD container is v
        std::cout << "\tUpdate PSD `v`" << std::endl;
        for (int frame = 0; frame < nb_frames; ++frame) {
            for (int bin = 0; bin < nb_bins; ++bin) {
                for (int source = 0; source < nb_sources; ++source) {
                    float sumSquare = 0.0f;
                    for (int channel = 0; channel < nb_channels; ++channel) {
                        float realPart = 0.0f;
                        float imagPart = 0.0f;

                        realPart += y[source](channel, frame, bin).real();
                        realPart += y[source](channel, frame, bin).imag();

                        sumSquare += (realPart * realPart) + (imagPart * imagPart);
                    }
                    // Divide by the number of channels to get the average
                    // statistical summation, distributing v values for all frames
                    v(frame, bin, source) = sumSquare / nb_channels;
                }
            }
        }

        for (int source = 0; source < nb_sources; ++source) {
            R[source].setZero();
            weight.setConstant(WIENER_EPS); // Initialize with small epsilon

            int pos = 0;
            int batchSize = WIENER_EM_BATCH_SIZE > 0 ? WIENER_EM_BATCH_SIZE : nb_frames;

            while (pos < nb_frames) {
                std::cout << "\tCovariance loop for source: " << source << ", pos: " << pos << std::endl;
                int t_end = std::min(nb_frames, pos + batchSize);

                Eigen::Tensor4dXcf tempR = calculateCovariance(y[source], pos, t_end);

                Eigen::Tensor3dXcf tempR3D(
                    tempR.dimension(1),
                    tempR.dimension(2),
                    tempR.dimension(3)
                );
                tempR3D.setZero();

                // Sum across the first dimension
                for (int i = 0; i < tempR.dimension(0); ++i) {
                    for (int j = 0; j < tempR.dimension(1); ++j) {
                        for (int k = 0; k < tempR.dimension(2); ++k) {
                            for (int l = 0; l < tempR.dimension(3); ++l) {
                                tempR3D(j, k, l) += tempR(i, j, k, l);
                            }
                        }
                    }
                }

                // Sum the calculated covariance into R[j]
                R[source] += tempR3D;

                // Update the weight summed v values across the frames for this batch
                for (int t = pos; t < t_end; ++t) {
                    for (int bin = 0; bin < nb_bins; ++bin) {
                        weight(bin) += v(t, bin, source);
                    }
                }

                pos = t_end;
            }

            // Normalize R[j] by weight
            for (int bin = 0; bin < nb_bins; ++bin) {
                for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                    for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                        R[source](bin, ch1, ch2) /= weight(bin);
                    }
                }
            }

            // Reset the weight for the next iteration
            weight.setConstant(0.0f);
        }

        int pos = 0;
        int batchSize = WIENER_EM_BATCH_SIZE > 0 ? WIENER_EM_BATCH_SIZE : nb_frames;
        while (pos < nb_frames) {
            int t_end = std::min(nb_frames, pos + batchSize);

            std::cout << "\tMix covariance loop for pos: " << pos << std::endl;
            // Reset y values to zero for this batch
            // Assuming you have a way to set all elements of y between frames pos and t_end to 0.0
            for (int source = 0; source < 4; ++source) {
                for (int i = pos; i < t_end; ++i) {
                     for (int j = 0; j < nb_bins; ++j) {
                         y[source](0, i, j) = std::complex<float>{0.0f, 0.0f};
                         y[source](1, i, j) = std::complex<float>{0.0f, 0.0f};
                     }
                }
            }
            int nb_frames_chunk = t_end-pos;

            // Compute mix covariance matrix Cxx
            Eigen::Tensor4dXcf Cxx(nb_frames_chunk, nb_bins, nb_channels, nb_channels);
            Cxx.setZero();

            // copy regularization into expanded form in middle of broadcast loop
            for (int frame = 0; frame < nb_frames_chunk; ++frame) {
                for (int bin = 0; bin < nb_bins; ++bin) {
                    for (int source = 0; source < nb_sources; ++source) {
                        float multiplier = v(frame+pos, bin, source);
                        for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                            for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                                Cxx(frame, bin, ch1, ch2) += regularization(ch1, ch2) + multiplier * R[source](bin, ch1, ch2);
                            }
                        }
                    }
                }
            }

            // Invert Cxx
            std::cout << "\tInvert Cxx and Wiener gain calculation" << std::endl;
            invert4D(Cxx);  // Assuming invertMatrix performs element-wise inversion
            // Cxx is now inv_Cxx

            // Separate the sources
            for (int source = 0; source < nb_sources; ++source) {
                // Initialize with zeros
                // create gain with broadcast size of inv_Cxx
                Eigen::Tensor4dXcf gain(nb_frames_chunk, nb_bins, nb_channels, nb_channels);
                gain.setZero();

                for (int frame = 0; frame < nb_frames_chunk; ++frame) {
                    for (int bin = 0; bin < nb_bins; ++bin) {
                        for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                            for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                                for (int ch3 = 0; ch3 < nb_channels; ++ch3) {
                                    gain(frame, bin, ch1, ch2) += R[source](bin, ch1, ch3)*Cxx(frame, bin, ch3, ch2);
                                }
                            }
                        }
                    }
                }

                // Element-wise multiplication with v
                for (int frame = 0; frame < nb_frames_chunk; ++frame) {
                    for (int bin = 0; bin < nb_bins; ++bin) {
                        for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                            for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                                gain(frame, bin, ch1, ch2) *= v(frame+pos, bin, source);
                            }
                        }
                    }
                }

                std::cout << "\tApply gain to y, source: " << source << ", pos: " << pos << std::endl;
                // apply it to the mixture
                for (int frame = 0; frame < nb_frames_chunk; ++frame) {
                    for (int bin = 0; bin < nb_bins; ++bin) {
                        for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                            for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                                std::complex<float> sample_cpx = y[source](ch2, frame+pos, bin);
                                std::complex<float> a = gain(frame, bin, ch2, ch1);
                                std::complex<float> b = mix_stft(ch1, frame+pos, bin);
                                y[source](ch2, frame+pos, bin) = sample_cpx + a*b;
                            }
                        }
                    }
                }
            }

            pos = t_end;
        }
    }

    // scale y by max_abs again
    for (int source = 0; source < 4; ++source) {
        for (int i = 0; i < mix_stft.dimension(1); ++i) {
            for (int j = 0; j < mix_stft.dimension(2); ++j) {
                y[source](0, i, j) = std::complex<float>{
                    y[source](0, i, j).real()*max_abs,
                    y[source](0, i, j).imag()*max_abs};
                y[source](1, i, j) = std::complex<float>{
                    y[source](1, i, j).real()*max_abs,
                    y[source](1, i, j).imag()*max_abs};
            }
        }
    }

    return y;
}

// Compute the empirical covariance for a source.
/*
 *   y_j shape: 2, nb_frames_total, 2049
 *   pos-t_end = nb_frames (i.e. a chunk of y_j)
 *
 *   returns Cj:
 *       shape: nb_frames, nb_bins, nb_channels, nb_channels, realim
 */
static Eigen::Tensor4dXcf calculateCovariance(
    const Eigen::Tensor3dXcf &y_j,
    const int pos,
    const int t_end
) {
    //int nb_frames = y_j.dimension(1);
    int nb_frames = t_end-pos;
    int nb_bins = y_j.dimension(2);
    int nb_channels = 2;

    // Initialize Cj tensor with zeros
    Eigen::Tensor4dXcf Cj(nb_frames, nb_bins, nb_channels, nb_channels);
    Cj.setZero();

    for (int frame = 0; frame < nb_frames; ++frame) {
        for (int bin = 0; bin < nb_bins; ++bin) {
            for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                    // assign real
                    std::complex<float> a = y_j(ch1, frame+pos, bin);
                    std::complex<float> b = std::conj(y_j(ch2, frame+pos, bin));

                    //float a_real = a.real();
                    //float a_imag = a.imag();

                    //float b_real = b.real();
                    //float b_imag = b.imag();

                    // Update the tensor
                    // _mul_add y_j, conj(y_j) -> y_j = a, conj = b
                    //Cj(frame, bin, ch1, ch2, 0) += (a_real*b_real - a_imag*b_imag);
                    //Cj(frame, bin, ch1, ch2, 1) += (a_real*b_imag + a_imag*b_real);
                    Cj(frame, bin, ch1, ch2) += a*b;
                }
            }
        }
    }

    return Cj;
}
