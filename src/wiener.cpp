#include "wiener.hpp"
#include "dsp.hpp"
#include <Eigen/Dense>
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

// Function to compute the absolute maximum value from a complex 2D vector
static float find_max_abs(const umxcpp::StereoSpectrogramC &data, float scale_factor) {
    float max_val_im = -1.0f;
    for (int i = 0; i < 2; ++i) {
        for (int j = 0; j < data.left.size(); ++j) {
            for (int k = 0; k < data.left[0].size(); ++k) {
                max_val_im = std::max(max_val_im, std::sqrt(std::norm(
                    i == 0 ? data.left[j][k] : data.right[j][k]
                )));
            }
        }
    }
    return std::max(1.0f, max_val_im/scale_factor);
}

static void invert5D(umxcpp::Tensor5D& M) {
    for (auto& frame : M.data) {
        for (auto& bin : frame) {
            std::complex<float> a(bin[0][0][0], bin[0][0][1]);
            std::complex<float> b(bin[0][1][0], bin[0][1][1]);
            std::complex<float> c(bin[1][0][0], bin[1][0][1]);
            std::complex<float> d(bin[1][1][0], bin[1][1][1]);

            // Compute the determinant
            std::complex<float> det = a * d - b * c;

            // Compute the inverse determinant
            // INEXPLICABLE 4.0 factor!
            std::complex<float> invDet = 4.0f*std::conj(det)/std::norm(det);

            // Compute the inverse matrix
            std::complex<float> tmp00 = invDet * d;
            std::complex<float> tmp01 = -invDet * b;
            std::complex<float> tmp10 = -invDet * c;
            std::complex<float> tmp11 = invDet * a;

            // Update the original tensor
            bin[0][0][0] = tmp00.real();
            bin[0][0][1] = tmp00.imag();

            bin[0][1][0] = tmp01.real();
            bin[0][1][1] = tmp01.imag();

            bin[1][0][0] = tmp10.real();
            bin[1][0][1] = tmp10.imag();

            bin[1][1][0] = tmp11.real();
            bin[1][1][1] = tmp11.imag();
        }
    }
}

// Compute the empirical covariance for a source.
// forward decl
static umxcpp::Tensor5D calculateCovariance(
    const umxcpp::StereoSpectrogramC &y_j,
    const int pos,
    const int t_end
);

static umxcpp::Tensor4D sumAlongFirstDimension(const umxcpp::Tensor5D& tensor5d) {
    int nb_frames = tensor5d.data.size();
    int nb_bins = tensor5d.data[0].size();
    int nb_channels1 = tensor5d.data[0][0].size();
    int nb_channels2 = tensor5d.data[0][0][0].size();
    int nb_reim = tensor5d.data[0][0][0][0].size();

    // Initialize a 4D tensor filled with zeros
    umxcpp::Tensor4D result(nb_bins, nb_channels1, nb_channels2, nb_reim);

    for (int frame = 0; frame < nb_frames; ++frame) {
        for (int bin = 0; bin < nb_bins; ++bin) {
            for (int ch1 = 0; ch1 < nb_channels1; ++ch1) {
                for (int ch2 = 0; ch2 < nb_channels2; ++ch2) {
                    for (int reim = 0; reim < nb_reim; ++reim) {
                        result.data[bin][ch1][ch2][reim] += tensor5d.data[frame][bin][ch1][ch2][reim];
                    }
                }
            }
        }
    }

    return result;
}

// Wiener filter function
std::array<umxcpp::StereoSpectrogramC, 4>
umxcpp::wiener_filter(umxcpp::StereoSpectrogramC &mix_stft,
              const std::vector<umxcpp::StereoSpectrogramR> &targets_mag_spectrograms)
{
    // first just do naive mix-phase
    std::array<umxcpp::StereoSpectrogramC, 4> y;

    umxcpp::StereoSpectrogramR mix_phase = umxcpp::phase(mix_stft);

    std::cout << "Wiener-EM: Getting first estimates from naive mix-phase" << std::endl;

    for (int target = 0; target < 4; ++target) {
        y[target] = umxcpp::combine(targets_mag_spectrograms[target], mix_phase);
    }

    std::cout << "Wiener-EM: Scaling down by max_abs" << std::endl;

    // we need to refine the estimates. Scales down the estimates for
    // numerical stability
    float max_abs = find_max_abs(mix_stft, WIENER_SCALE_FACTOR);

    // Dividing mix_stft by max_abs
    for (int i = 0; i < mix_stft.left.size(); ++i) {
        for (int j = 0; j < mix_stft.left[0].size(); ++j) {
            mix_stft.left[i][j] = std::complex<float>{
                    mix_stft.left[i][j].real()/max_abs,
                    mix_stft.left[i][j].imag()/max_abs};
            mix_stft.right[i][j] = std::complex<float>{
                    mix_stft.right[i][j].real()/max_abs,
                    mix_stft.right[i][j].imag()/max_abs};
        }
    }

    // Dividing y by max_abs
    for (int source = 0; source < 4; ++source) {
        for (int i = 0; i < mix_stft.left.size(); ++i) {
            for (int j = 0; j < mix_stft.left[0].size(); ++j) {
                y[source].left[i][j] = std::complex<float>{
                        y[source].left[i][j].real()/max_abs,
                        y[source].left[i][j].imag()/max_abs};
                y[source].right[i][j] = std::complex<float>{
                        y[source].right[i][j].real()/max_abs,
                        y[source].right[i][j].imag()/max_abs};
            }
        }
    }

    // call expectation maximization
    // y = expectation_maximization(y, mix_stft, iterations, eps=eps)[0]

    const int nb_channels = 2;
    const int nb_frames = mix_stft.left.size();
    const int nb_bins = mix_stft.left[0].size();
    const int nb_sources = 4;
    const float eps = WIENER_EPS;

    std::cout << "Wiener-EM: Initialize tensors" << std::endl;

    // Create and initialize the 5D tensor
    umxcpp::Tensor3D regularization(nb_channels, nb_channels, 2); // The 3D tensor
    // Fill the diagonal with sqrt(eps) for all 3D slices in dimensions 0 and 1
    regularization.fill_diagonal(std::sqrt(eps));

    std::vector<Tensor4D> R; // A vector to hold each source's covariance matrix
    for (int j = 0; j < nb_sources; ++j) {
        R.emplace_back(Tensor4D(nb_bins, nb_channels, nb_channels, 2));
    }

    Tensor1D weight(nb_bins);  // A 1D tensor (vector) of zeros
    Tensor3D v(nb_frames, nb_bins, nb_sources);  // A 3D tensor of zeros

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

                        realPart += channel == 0 ? y[source].left[frame][bin].real() : y[source].right[frame][bin].real();
                        realPart += channel == 0 ? y[source].left[frame][bin].imag() : y[source].right[frame][bin].imag();

                        sumSquare += (realPart * realPart) + (imagPart * imagPart);
                    }
                    // Divide by the number of channels to get the average
                    v.data[frame][bin][source] = sumSquare / nb_channels;
                }
            }
        }

        for (int source = 0; source < nb_sources; ++source) {
            R[source].setZero();  // Assume Tensor4d has a method to set all its elements to zero
            weight.fill(WIENER_EPS); // Initialize with small epsilon (assume Tensor1d has a fill method)

            int pos = 0;
            int batchSize = WIENER_EM_BATCH_SIZE > 0 ? WIENER_EM_BATCH_SIZE : nb_frames;

            while (pos < nb_frames) {
                std::cout << "\tCovariance loop for source: " << source << ", pos: " << pos << std::endl;
                int t_end = std::min(nb_frames, pos + batchSize);

                umxcpp::Tensor5D tempR = calculateCovariance(y[source], pos, t_end);

                // Sum the calculated covariance into R[j]
                // Sum along the first (time/frame) dimension to get a 4D tensor
                umxcpp::Tensor4D tempR4D = sumAlongFirstDimension(tempR);

                // Add to existing R[j]; (R[j], tempR4D have the same dimensions)
                for (std::size_t bin = 0; bin < R[source].data.size(); ++bin) {
                    for (std::size_t ch1 = 0; ch1 < R[source].data[0].size(); ++ch1) {
                        for (std::size_t ch2 = 0; ch2 < R[source].data[0][0].size(); ++ch2) {
                            for (std::size_t reim = 0; reim < R[source].data[0][0][0].size(); ++reim) {
                                R[source].data[bin][ch1][ch2][reim] += tempR4D.data[bin][ch1][ch2][reim];
                            }
                        }
                    }
                }

                // Update the weight summed v values across the frames for this batch
                for (int t = pos; t < t_end; ++t) {
                    for (int bin = 0; bin < nb_bins; ++bin) {
                        weight.data[bin] += v.data[t][bin][source];
                    }
                }

                pos = t_end;
            }

            // Normalize R[j] by weight
            for (int bin = 0; bin < nb_bins; ++bin) {
                for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                    for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                        for (int k = 0; k < 2; ++k) {
                            R[source].data[bin][ch1][ch2][k] /= weight.data[bin];
                        }
                    }
                }
            }

            // Reset the weight for the next iteration
            weight.fill(0.0f);
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
                         y[source].left[i][j] = std::complex<float>{0.0f, 0.0f};
                         y[source].right[i][j] = std::complex<float>{0.0f, 0.0f};
                     }
                }
            }
            int nb_frames_chunk = t_end-pos;

            // Compute mix covariance matrix Cxx
            //Tensor3D Cxx = regularization;
            Tensor5D Cxx(nb_frames_chunk, nb_bins, nb_channels, nb_channels, 2);

            // copy regularization into expanded form in middle of broadcast loop
            for (int frame = 0; frame < nb_frames_chunk; ++frame) {
                for (int bin = 0; bin < nb_bins; ++bin) {
                    for (int source = 0; source < nb_sources; ++source) {
                        float multiplier = v.data[frame+pos][bin][source];
                        for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                            for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                                for (int re_im = 0; re_im < 2; ++re_im) {
                                    Cxx.data[frame][bin][ch1][ch2][re_im] += regularization.data[ch1][ch2][re_im] + multiplier * R[source].data[bin][ch1][ch2][re_im];
                                }
                            }
                        }
                    }
                }
            }

            // Invert Cxx
            std::cout << "\tInvert Cxx and Wiener gain calculation" << std::endl;
            invert5D(Cxx);  // Assuming invertMatrix performs element-wise inversion
            Tensor5D inv_Cxx = Cxx;  // Assuming copy constructor or assignment operator performs deep copy

            // Separate the sources
            for (int source = 0; source < nb_sources; ++source) {
                // Initialize with zeros
                // create gain with broadcast size of inv_Cxx
                Tensor5D gain(nb_frames_chunk, nb_bins, nb_channels, nb_channels, 2);
                gain.setZero();

                for (int frame = 0; frame < nb_frames_chunk; ++frame) {
                    for (int bin = 0; bin < nb_bins; ++bin) {
                        for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                            for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                                for (int ch3 = 0; ch3 < nb_channels; ++ch3) {
                                    auto a = R[source].data[bin][ch1][ch3];
                                    auto b = inv_Cxx.data[frame][bin][ch3][ch2];

                                    gain.data[frame][bin][ch1][ch2][0] += a[0]*b[0] - a[1]*b[1];
                                    gain.data[frame][bin][ch1][ch2][1] += a[0]*b[1] + a[1]*b[0];
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
                                for (int re_im = 0; re_im < 2; ++re_im) { // Assuming last dimension has size 2 (real/imaginary)
                                    // undoing the inv_Cxx factor of 4.0f
                                    gain.data[frame][bin][ch1][ch2][re_im] *= v.data[frame+pos][bin][source]/4.0f;
                                }
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
                                float sample_real = ch2 == 0 ? y[source].left[frame+pos][bin].real() : y[source].right[frame+pos][bin].real();
                                float sample_imag = ch2 == 0 ? y[source].left[frame+pos][bin].imag() : y[source].right[frame+pos][bin].imag();

                                float a_real = gain.data[frame][bin][ch2][ch1][0];
                                float a_imag = gain.data[frame][bin][ch2][ch1][1];

                                float b_real = ch1 == 0 ? mix_stft.left[frame+pos][bin].real() : mix_stft.right[frame+pos][bin].real();
                                float b_imag = ch1 == 0 ? mix_stft.left[frame+pos][bin].imag() : mix_stft.right[frame+pos][bin].imag();

                                if (ch2 == 0) {
                                    y[source].left[frame+pos][bin] = std::complex<float>{
                                        sample_real + (a_real*b_real - a_imag*b_imag),
                                        sample_imag + (a_real*b_imag + a_imag*b_real)};
                                } else {
                                    y[source].right[frame+pos][bin] = std::complex<float>{
                                        sample_real + (a_real*b_real - a_imag*b_imag),
                                        sample_imag + (a_real*b_imag + a_imag*b_real)};
                                }
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
        for (int i = 0; i < mix_stft.left.size(); ++i) {
            for (int j = 0; j < mix_stft.left[0].size(); ++j) {
                y[source].left[i][j] = std::complex<float>{
                    y[source].left[i][j].real()*max_abs,
                    y[source].left[i][j].imag()*max_abs};
                y[source].right[i][j] = std::complex<float>{
                    y[source].right[i][j].real()*max_abs,
                    y[source].right[i][j].imag()*max_abs};
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
static umxcpp::Tensor5D calculateCovariance(
    const umxcpp::StereoSpectrogramC &y_j,
    const int pos,
    const int t_end
) {
    //int nb_frames = y_j.dimension(1);
    int nb_frames = t_end-pos;
    int nb_bins = y_j.left[0].size();
    int nb_channels = 2;

    // Initialize Cj tensor with zeros
    umxcpp::Tensor5D Cj(nb_frames, nb_bins, nb_channels, nb_channels, 2);
    Cj.setZero();

    for (int frame = 0; frame < nb_frames; ++frame) {
        for (int bin = 0; bin < nb_bins; ++bin) {
            for (int ch1 = 0; ch1 < nb_channels; ++ch1) {
                for (int ch2 = 0; ch2 < nb_channels; ++ch2) {
                    // assign real
                    std::complex<float> a = ch1 == 0 ? y_j.left[frame+pos][bin] : y_j.right[frame+pos][bin];
                    std::complex<float> b = ch2 == 0 ? std::conj(y_j.left[frame+pos][bin]) : std::conj(y_j.right[frame+pos][bin]);

                    float a_real = a.real();
                    float a_imag = a.imag();

                    float b_real = b.real();
                    float b_imag = b.imag();

                    // Update the tensor
                    // _mul_add y_j, conj(y_j) -> y_j = a, conj = b
                    Cj.data[frame][bin][ch1][ch2][0] += (a_real*b_real - a_imag*b_imag);
                    Cj.data[frame][bin][ch1][ch2][1] += (a_real*b_imag + a_imag*b_real);
                }
            }
        }
    }

    return Cj;
}
