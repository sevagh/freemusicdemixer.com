#include "model.hpp"
#include "dsp.hpp"
#include <Eigen/Dense>
#include <cassert>
#include <filesystem>
#include <iostream>
#include <sstream>
#include <string>
#include <unsupported/Eigen/FFT>
#include <vector>
#include "lstm.hpp"
#include <zlib.h>

// forward declaration
static size_t load_single_matrix(FILE *f, std::string &name,
                                 Eigen::MatrixXf &matrix, int ne[2],
                                 int32_t nelements, float scale, float offset);

static size_t load_single_matrix_uint16(FILE *f, std::string &name,
                                 Eigen::MatrixXf &matrix, int ne[2],
                                 int32_t nelements, float scale, float offset);

// from scripts/convert-pth-to-ggml.py
bool umxcpp::load_umx_model(const std::string &model_file,
                            struct umx_model *model)
{
    fprintf(stderr, "%s: loading model\n", __func__);

    // compute t_start_us using C++ std::chrono
    const auto t_start_us =
        std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::system_clock::now().time_since_epoch())
            .count();

    // gzip decompress file that ends with .gz
    std::cout << "Decompressing model_file... " << model_file
                << std::endl;

    std::string tempFilename = "temp.decompressed";

    gzFile gzFile = gzopen(model_file.c_str(), "rb");
    if (!gzFile)
    {
        fprintf(stderr, "%s: failed to open %s\n", __func__, model_file.c_str());
        return false;
    }

    model->load_progress += 0.1f;

    FILE* tempFile = fopen(tempFilename.c_str(), "wb");
    if (!tempFile)
    {
        fprintf(stderr, "%s: failed to create temporary file\n", __func__);
        gzclose(gzFile);
        return false;
    }

    char buffer[128];
    int numRead = 0;
    while ((numRead = gzread(gzFile, buffer, sizeof(buffer))) > 0) {
        fwrite(buffer, 1, numRead, tempFile);
    }

    fclose(tempFile);
    gzclose(gzFile);

    FILE* f = fopen(tempFilename.c_str(), "rb");
    if (!f)
    {
        fprintf(stderr, "%s: failed to open decompressed file\n", __func__);
        return false;
    }

    // verify magic and hidden size
    uint32_t hidden_size = 0;
    uint32_t magic;

    // equivalent of with open(...) as f on each model_file
    std::cout << "Checking the magic of model_file " << model_file
                << std::endl;

    // read the size of uint32_t bytes from f into magic
    fread(&magic, sizeof(uint32_t), 1, f);
    if (magic != 0x756d7867)
    {
        fprintf(stderr, "%s: invalid model data (bad magic)\n",
                __func__);
        return false;
    }

    // read the size of uint32_t bytes from f into hidden_size
    fread(&hidden_size, sizeof(uint32_t), 1, f);

    std::cout << "Loaded umx model with hidden size " << hidden_size
              << std::endl;

    model->hidden_size = hidden_size;

    // loaded tensor shapes
    //    Processing variable:  fc1.weight  with shape:  (HIDDEN, 2974)
    //    Processing variable:  bn1.{weight, bias}  with shape:  (HIDDEN,)
    //    Processing variable:  lstm.weight_ih_l{0,1,2}  with shape:  (2*HIDDEN,
    //    HIDDEN) Processing variable:  lstm.weight_hh_l{0,1,2}  with shape:
    //    (2*HIDDEN, HIDDEN/2) Processing variable:  lstm.bias_ih_l{0,1,2}  with
    //    shape:  (2*HIDDEN,) Processing variable:  lstm.bias_hh_l{0,1,2}  with
    //    shape:  (2*HIDDEN,) Processing variable:
    //    lstm.weight_ih_l{0,1,2}_reverse  with shape:  (2*HIDDEN, HIDDEN)
    //    Processing variable:  lstm.weight_hh_l{0,1,2}_reverse  with shape:
    //    (2*HIDDEN, HIDDEN/2) Processing variable:
    //    lstm.bias_ih_l{0,1,2}_reverse  with shape:  (2*HIDDEN,) Processing
    //    variable:  lstm.bias_hh_l{0,1,2}_reverse  with shape:  (2*HIDDEN,)
    //    Processing variable:  fc2.weight  with shape:  (HIDDEN, 2*HIDDEN)
    //    Processing variable:  bn2.weight  with shape:  (HIDDEN,)
    //    Processing variable:  bn2.bias  with shape:  (HIDDEN,)
    //    Processing variable:  fc3.weight  with shape:  (4098, HIDDEN)
    //    Processing variable:  bn3.weight  with shape:  (4098,)
    //    Processing variable:  bn3.bias  with shape:  (4098,)

    auto lstm_size_1 = 2 * hidden_size;
    auto lstm_size_2 = hidden_size / 2;

    // prepare memory for the weights
    {
        for (int target = 0; target < 4; ++target)
        {
            model->input_mean[target] = Eigen::MatrixXf(2 * 1487, 1);
            model->input_scale[target] = Eigen::MatrixXf(2 * 1487, 1);
            model->output_mean[target] = Eigen::MatrixXf(2 * 2049, 1);
            model->output_scale[target] = Eigen::MatrixXf(2 * 2049, 1);

            // fc1, fc2, fc3
            model->fc1_w[target] = Eigen::MatrixXf(2974, hidden_size);
            model->fc2_w[target] = Eigen::MatrixXf(lstm_size_1, hidden_size);
            model->fc3_w[target] = Eigen::MatrixXf(hidden_size, 4098);

            // bn1, bn2, bn3
            model->bn1_w[target] = Eigen::MatrixXf(hidden_size, 1);
            model->bn1_b[target] = Eigen::MatrixXf(hidden_size, 1);
            model->bn1_rm[target] = Eigen::MatrixXf(hidden_size, 1);
            model->bn1_rv[target] = Eigen::MatrixXf(hidden_size, 1);

            model->bn2_w[target] = Eigen::MatrixXf(hidden_size, 1);
            model->bn2_b[target] = Eigen::MatrixXf(hidden_size, 1);
            model->bn2_rm[target] = Eigen::MatrixXf(hidden_size, 1);
            model->bn2_rv[target] = Eigen::MatrixXf(hidden_size, 1);

            model->bn3_w[target] = Eigen::MatrixXf(4098, 1);
            model->bn3_b[target] = Eigen::MatrixXf(4098, 1);
            model->bn3_rm[target] = Eigen::MatrixXf(4098, 1);
            model->bn3_rv[target] = Eigen::MatrixXf(4098, 1);

            // 3 layers of lstm
            for (int lstm_layer = 0; lstm_layer < 3; ++lstm_layer)
            {
                for (int direction = 0; direction < 2; ++direction)
                {
                    model->lstm_ih_w[target][lstm_layer][direction] =
                        Eigen::MatrixXf(hidden_size, lstm_size_1);
                    model->lstm_hh_w[target][lstm_layer][direction] =
                        Eigen::MatrixXf(lstm_size_2, lstm_size_1);
                    model->lstm_ih_b[target][lstm_layer][direction] =
                        Eigen::MatrixXf(lstm_size_1, 1);
                    model->lstm_hh_b[target][lstm_layer][direction] =
                        Eigen::MatrixXf(lstm_size_1, 1);
                }
            }
            model->load_progress += 0.05f;
        }
    }

    // 0.1 + 4*0.05 = 0.3

    size_t total_size = 0;
    uint32_t n_loaded = 0;

    // load weights
    {
        std::cout << "Loading weights from model_file " << model_file << std::endl;

        // continue reading from file after magic, hidden_size
        int target_counter = 0;

        for (;;)
        {
            std::cout << "Loading target " << target_counter << std::endl;
            // load all the weights from the file
            float scale;
            float offset;
            int32_t n_dims;
            int32_t length;

            fread(&scale, sizeof(float), 1, f);
            fread(&offset, sizeof(float), 1, f);
            fread(&n_dims, sizeof(int32_t), 1, f);
            fread(&length, sizeof(int32_t), 1, f);

            int32_t nelements = 1;
            int32_t ne[2] = {1, 1};
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

            std::cout << "Loading tensor " << name << " with shape ["
                        << ne[0] << ", " << ne[1] << "]" << std::endl;

            // match the tensor name to the correct tensor in the model
            size_t loaded_size = 0;

            if (name == "input_mean")
            {
                Eigen::MatrixXf mean_tmp = Eigen::MatrixXf(1487, 1);
                loaded_size =
                    load_single_matrix(f, name, mean_tmp, ne, nelements, scale, offset);
                // duplicate mean_tmp into model->input_mean[target_counter]
                model->input_mean[target_counter].block(0, 0, 1487, 1) =
                    mean_tmp;
                model->input_mean[target_counter].block(1487, 0, 1487, 1) =
                    mean_tmp;
                model->input_mean[target_counter].transposeInPlace();
            }
            if (name == "input_scale")
            {
                Eigen::MatrixXf scale_tmp = Eigen::MatrixXf(1487, 1);
                loaded_size =
                    load_single_matrix(f, name, scale_tmp, ne, nelements, scale, offset);
                // duplicate scale_tmp into
                // model->input_scale[target_counter]
                model->input_scale[target_counter].block(0, 0, 1487, 1) =
                    scale_tmp;
                model->input_scale[target_counter].block(1487, 0, 1487, 1) =
                    scale_tmp;
                model->input_scale[target_counter].transposeInPlace();
            }
            if (name == "output_mean")
            {
                Eigen::MatrixXf mean_tmp = Eigen::MatrixXf(2049, 1);
                loaded_size =
                    load_single_matrix(f, name, mean_tmp, ne, nelements, scale, offset);
                // duplicate mean_tmp into
                // model->output_mean[target_counter]
                model->output_mean[target_counter].block(0, 0, 2049, 1) =
                    mean_tmp;
                model->output_mean[target_counter].block(2049, 0, 2049, 1) =
                    mean_tmp;
                model->output_mean[target_counter].transposeInPlace();
            }
            if (name == "output_scale")
            {
                Eigen::MatrixXf scale_tmp = Eigen::MatrixXf(2049, 1);
                loaded_size =
                    load_single_matrix(f, name, scale_tmp, ne, nelements, scale, offset);
                // duplicate scale_tmp into
                // model->output_scale[target_counter]
                model->output_scale[target_counter].block(0, 0, 2049, 1) =
                    scale_tmp;
                model->output_scale[target_counter].block(2049, 0, 2049,
                                                            1) = scale_tmp;
                model->output_scale[target_counter].transposeInPlace();
            }
            if (name == "fc1.weight")
            {
                loaded_size = load_single_matrix(
                    f, name, model->fc1_w[target_counter], ne, nelements, scale, offset);
            }
            if (name == "bn1.weight")
            {
                loaded_size = load_single_matrix(
                    f, name, model->bn1_w[target_counter], ne, nelements, scale, offset);
                model->bn1_w[target_counter].transposeInPlace();
            }
            if (name == "bn1.bias")
            {
                loaded_size = load_single_matrix(
                    f, name, model->bn1_b[target_counter], ne, nelements, scale, offset);
                model->bn1_b[target_counter].transposeInPlace();
            }
            if (name == "bn1.running_mean")
            {
                loaded_size = load_single_matrix(
                    f, name, model->bn1_rm[target_counter], ne, nelements, scale, offset);
                model->bn1_rm[target_counter].transposeInPlace();
            }
            if (name == "bn1.running_var")
            {
                loaded_size = load_single_matrix(
                    f, name, model->bn1_rv[target_counter], ne, nelements, scale, offset);
                model->bn1_rv[target_counter].transposeInPlace();
            }
            if (name == "lstm.weight_ih_l0")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_w[target_counter][0][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_hh_l0")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_w[target_counter][0][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_ih_l0")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_b[target_counter][0][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_hh_l0")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_b[target_counter][0][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_ih_l0_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_w[target_counter][0][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_hh_l0_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_w[target_counter][0][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_ih_l0_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_b[target_counter][0][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_hh_l0_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_b[target_counter][0][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_ih_l1")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_w[target_counter][1][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_hh_l1")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_w[target_counter][1][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_ih_l1")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_b[target_counter][1][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_hh_l1")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_b[target_counter][1][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_ih_l1_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_w[target_counter][1][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_hh_l1_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_w[target_counter][1][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_ih_l1_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_b[target_counter][1][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_hh_l1_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_b[target_counter][1][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_ih_l2")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_w[target_counter][2][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_hh_l2")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_w[target_counter][2][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_ih_l2")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_b[target_counter][2][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_hh_l2")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_b[target_counter][2][0], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_ih_l2_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_w[target_counter][2][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.weight_hh_l2_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_w[target_counter][2][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_ih_l2_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_ih_b[target_counter][2][1], ne,
                    nelements, scale, offset);
            }
            if (name == "lstm.bias_hh_l2_reverse")
            {
                loaded_size = load_single_matrix(
                    f, name, model->lstm_hh_b[target_counter][2][1], ne,
                    nelements, scale, offset);
            }
            if (name == "fc2.weight")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->fc2_w[target_counter], ne, nelements, scale, offset);
            }
            if (name == "bn2.weight")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn2_w[target_counter], ne, nelements, scale, offset);
                model->bn2_w[target_counter].transposeInPlace();
            }
            if (name == "bn2.bias")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn2_b[target_counter], ne, nelements, scale, offset);
                model->bn2_b[target_counter].transposeInPlace();
            }
            if (name == "bn2.running_mean")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn2_rm[target_counter], ne, nelements, scale, offset);
                model->bn2_rm[target_counter].transposeInPlace();
            }
            if (name == "bn2.running_var")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn2_rv[target_counter], ne, nelements, scale, offset);
                model->bn2_rv[target_counter].transposeInPlace();
            }
            if (name == "fc3.weight")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->fc3_w[target_counter], ne, nelements, scale, offset);
            }
            if (name == "bn3.weight")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn3_w[target_counter], ne, nelements, scale, offset);
                model->bn3_w[target_counter].transposeInPlace();
            }
            if (name == "bn3.bias")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn3_b[target_counter], ne, nelements, scale, offset);
                model->bn3_b[target_counter].transposeInPlace();
            }
            if (name == "bn3.running_mean")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn3_rm[target_counter], ne, nelements, scale, offset);
                model->bn3_rm[target_counter].transposeInPlace();
            }
            if (name == "bn3.running_var")
            {
                loaded_size = load_single_matrix_uint16(
                    f, name, model->bn3_rv[target_counter], ne, nelements, scale, offset);
                model->bn3_rv[target_counter].transposeInPlace();

                // this marks the end of the current target
                target_counter += 1;
            }

            if (loaded_size == 0)
            {
                printf("name is: '%s'\n", name.c_str());
                fprintf(stderr, "%s: failed to load %s\n", __func__,
                        name.c_str());
                return false;
            }
            total_size += loaded_size;
            n_loaded++;

            // n_loaded = 172 total, 70%/172 = 0.4069767441860465
            model->load_progress += 0.004f;
        }
    }

    if (model->load_progress != 1.0f)
    {
        model->load_progress = 1.0f;
    }

    // finally, close the file
    fclose(f);

    // compute finish time in microseconds using std::chrono

    const auto t_end_us =
        std::chrono::duration_cast<std::chrono::microseconds>(
            std::chrono::system_clock::now().time_since_epoch())
            .count();

    // print load time in seconds
    printf("Loaded model (%u tensors, %6.2f MB) in %f s\n", n_loaded,
           total_size / 1024.0 / 1024.0,
           (float)(t_end_us - t_start_us) / 1000000.0f);

    model->is_initialized = true;
    return true;
}

// write a variant of load_single_tensor called load_single_matrix
// that takes an Eigen::MatrixXf &matrix and populates it from a file
static size_t load_single_matrix(FILE *f, std::string &name,
                                 Eigen::MatrixXf &matrix, int ne[2],
                                 int32_t nelements, float scale, float offset)
{
    if (matrix.size() != nelements ||
        (matrix.rows() != ne[0] || matrix.cols() != ne[1]))
    {
        fprintf(stderr, "%s: tensor '%s' has wrong size in model file\n",
                __func__, name.data());
        fprintf(stderr,
                "%s: model file shape: [%d, %d], umx.cpp shape: [%d, %d]\n",
                __func__, ne[0], ne[1], (int)matrix.rows(), (int)matrix.cols());
        return 0;
    }

    // loading quantized weights
    const size_t bpe_quantized = sizeof(uint8_t);
    auto nbytes_tensor = matrix.size() * bpe_quantized;

    // create a uint8_t Eigen::Matrix to hold the quantized weights
    // of the same shape as the float matrix
    Eigen::Matrix<uint8_t, Eigen::Dynamic, Eigen::Dynamic> matrix_uint8 =
        Eigen::Matrix<uint8_t, Eigen::Dynamic, Eigen::Dynamic>::Zero(
            matrix.rows(), matrix.cols());

    fread(matrix_uint8.data(), bpe_quantized, nelements, f);

    printf("%16s: [%5d, %5d], type = float, %6.2f MB\n", name.data(), ne[0],
           ne[1], nbytes_tensor / 1024.0 / 1024.0);

    // now dequantize the weights using scale and offset
    // and copy them into the float matrix
    for (int i = 0; i < ne[0]; i++)
    {
        for (int j = 0; j < ne[1]; j++)
        {
            matrix(i, j) = (matrix_uint8(i, j) * scale + offset);
        }
    }

    return nbytes_tensor;
}


// write a variant of load_single_tensor called load_single_matrix
// that takes an Eigen::MatrixXf &matrix and populates it from a file
static size_t load_single_matrix_uint16(FILE *f, std::string &name,
                                 Eigen::MatrixXf &matrix, int ne[2],
                                 int32_t nelements, float scale, float offset)
{
    if (matrix.size() != nelements ||
        (matrix.rows() != ne[0] || matrix.cols() != ne[1]))
    {
        fprintf(stderr, "%s: tensor '%s' has wrong size in model file\n",
                __func__, name.data());
        fprintf(stderr,
                "%s: model file shape: [%d, %d], umx.cpp shape: [%d, %d]\n",
                __func__, ne[0], ne[1], (int)matrix.rows(), (int)matrix.cols());
        return 0;
    }

    // loading quantized weights
    const size_t bpe_quantized = sizeof(uint16_t);
    auto nbytes_tensor = matrix.size() * bpe_quantized;

    // create a uint16_t Eigen::Matrix to hold the quantized weights
    // of the same shape as the float matrix
    Eigen::Matrix<uint16_t, Eigen::Dynamic, Eigen::Dynamic> matrix_uint16 =
        Eigen::Matrix<uint16_t, Eigen::Dynamic, Eigen::Dynamic>::Zero(
            matrix.rows(), matrix.cols());

    fread(matrix_uint16.data(), bpe_quantized, nelements, f);

    printf("%16s: [%5d, %5d], type = float, %6.2f MB\n", name.data(), ne[0],
           ne[1], nbytes_tensor / 1024.0 / 1024.0);

    // now dequantize the weights using scale and offset
    // and copy them into the float matrix
    for (int i = 0; i < ne[0]; i++)
    {
        for (int j = 0; j < ne[1]; j++)
        {
            matrix(i, j) = (matrix_uint16(i, j) * scale + offset);
        }
    }

    return nbytes_tensor;
}

std::array<Eigen::MatrixXf, 4> umxcpp::umx_inference(
    struct umx_model *model, const Eigen::MatrixXf &x, int hidden_size)
{
    // clone input mix mag x to operate on targets x_{0,1,2,3}
    std::array<Eigen::MatrixXf, 4> x_inputs;

    std::cout << "Input scaling" << std::endl;

    for (int target = 0; target < 4; ++target)
    {
        x_inputs[target] = x;
        // opportunistically apply input scaling and mean

        // apply formula x = x*input_scale + input_mean
        for (int i = 0; i < x_inputs[target].rows(); i++)
        {
            x_inputs[target].row(i) = x_inputs[target].row(i).array() *
                                          model->input_scale[target].array() +
                                      model->input_mean[target].array();
        }
    }

    // create pointer to a Eigen::MatrixXf to modify in the for loop
    // there are classes in Eigen for this

    for (int target = 0; target < 4; ++target)
    {
        // y = x A^T + b
        // A = weights = (out_features, in_features)
        // A^T = A transpose = (in_features, out_features)
        std::cout << "Target " << target << " fc1" << std::endl;
        x_inputs[target] = x_inputs[target] * model->fc1_w[target];

        std::cout << "Target " << target << " bn1" << std::endl;
        // batchnorm1d calculation
        // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
        for (int i = 0; i < x_inputs[target].rows(); i++)
        {
            x_inputs[target].row(i) =
                (((x_inputs[target].row(i).array() -
                   model->bn1_rm[target].array()) /
                  (model->bn1_rv[target].array() + 1e-5).sqrt()) *
                     model->bn1_w[target].array() +
                 model->bn1_b[target].array())
                    .tanh();
        }

        // now lstm time
        int lstm_hidden_size = hidden_size / 2;

        // umx_lstm_forward applies bidirectional 3-layer lstm using a
        // LSTMCell-like approach
        // https://pytorch.org/docs/stable/generated/torch.nn.LSTMCell.html

        auto lstm_data = umxcpp::create_lstm_data(
            lstm_hidden_size, x_inputs[target].rows()
        );

        std::cout << "Target " << target << " lstm" << std::endl;
        auto lstm_out_0 = umxcpp::umx_lstm_forward(
            model, target, x_inputs[target], &lstm_data, lstm_hidden_size);

        // now the concat trick from umx for the skip conn
        //    # apply 3-layers of stacked LSTM
        //    lstm_out = self.lstm(x)
        //    # lstm skip connection
        //    x = torch.cat([x, lstm_out[0]], -1)
        // concat the lstm_out with the input x
        Eigen::MatrixXf x_inputs_target_concat(x_inputs[target].rows(),
                                               x_inputs[target].cols() +
                                                   lstm_out_0.cols());
        x_inputs_target_concat.leftCols(x_inputs[target].cols()) =
            x_inputs[target];
        x_inputs_target_concat.rightCols(lstm_out_0.cols()) = lstm_out_0;

        x_inputs[target] = x_inputs_target_concat;

        std::cout << "Target " << target << " fc2" << std::endl;
        // now time for fc2
        x_inputs[target] = x_inputs[target] * model->fc2_w[target];

        std::cout << "Target " << target << " bn2" << std::endl;
        // batchnorm1d calculation
        // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
        for (int i = 0; i < x_inputs[target].rows(); i++)
        {
            x_inputs[target].row(i) =
                (((x_inputs[target].row(i).array() -
                   model->bn2_rm[target].array()) /
                  (model->bn2_rv[target].array() + 1e-5).sqrt()) *
                     model->bn2_w[target].array() +
                 model->bn2_b[target].array())
                    .cwiseMax(0);
        }

        std::cout << "Target " << target << " fc3" << std::endl;
        x_inputs[target] = x_inputs[target] * model->fc3_w[target];

        std::cout << "Target " << target << " bn3" << std::endl;
        // batchnorm1d calculation
        // y=(x-E[x])/(sqrt(Var[x]+ϵ) * gamma + Beta
        for (int i = 0; i < x_inputs[target].rows(); i++)
        {
            x_inputs[target].row(i) =
                ((x_inputs[target].row(i).array() -
                  model->bn3_rm[target].array()) /
                 (model->bn3_rv[target].array() + 1e-5).sqrt()) *
                    model->bn3_w[target].array() +
                model->bn3_b[target].array();
        }

        std::cout << "Target " << target << " output scaling" << std::endl;
        // now output scaling
        // apply formula x = x*output_scale + output_mean
        for (int i = 0; i < x_inputs[target].rows(); i++)
        {
            x_inputs[target].row(i) = (x_inputs[target].row(i).array() *
                                           model->output_scale[target].array() +
                                       model->output_mean[target].array())
                                          .cwiseMax(0);
        }
    }

    return x_inputs;
}
