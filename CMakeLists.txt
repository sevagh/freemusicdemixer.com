cmake_minimum_required(VERSION 3.0)

project(freemusicdemixer)
enable_testing()

# Set C++ standard globally
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Global compiler options
set(CMAKE_CXX_FLAGS "-Wall -Wextra")
set(CMAKE_CXX_FLAGS_DEBUG "-g")
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -ffast-math -flto -msimd128 -fno-exceptions -fno-signed-zeros -fassociative-math -freciprocal-math -fno-math-errno -fno-rounding-math -fno-signaling-nans -funsafe-math-optimizations -fno-trapping-math -fno-rtti -DNDEBUG")

# Add Eigen3 include directory
include_directories(vendor/eigen)

# Check if the build is for Emscripten
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Only Emscripten build target is supported")
endif()

# Common settings for preloading files
set(COMMON_LINK_FLAGS "-flto -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s MODULARIZE=1")

# Add subdirectory for zlib in vendor (required for umx)
include_directories(${CMAKE_BINARY_DIR}/vendor/zlib)
include_directories(vendor/zlib)
add_definitions(-D_NO_LARGEFILE64_SOURCE -D_LARGEFILE_SOURCE)
add_subdirectory(vendor/zlib)

# demucs executable
file(GLOB DEMUCS_SOURCES "src-demucs/*.cpp" "src-demucs/wasm_glue.cpp")
add_executable(demucs ${DEMUCS_SOURCES})
target_include_directories(demucs PRIVATE src-demucs) # Include src-demucs only for demucs target
set_target_properties(demucs PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS} -s EXPORT_NAME='libdemucs' --preload-file ${CMAKE_BINARY_DIR}/ggml-model-htdemucs-4s-f16.bin -s EXPORTED_FUNCTIONS=\"['_malloc', '_free', '_modelInit', '_modelLoadProgress', '_modelInferenceProgress', '_modelDemixSegment']\""
)
add_custom_command(TARGET demucs POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/demucs.js ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/demucs.wasm ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/demucs.data ${CMAKE_SOURCE_DIR}/docs
)

# umx executable
file(GLOB UMX_SOURCES "src-umx/*.cpp" "src-umx/wasm_glue.cpp")
add_executable(umx_v1 ${UMX_SOURCES})
target_include_directories(umx_v1 PRIVATE src-umx) # Include src-umx only for umx target
target_link_libraries(umx_v1 zlibstatic)
set_target_properties(umx_v1 PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS} -s EXPORT_NAME='libumx'  --preload-file ${CMAKE_BINARY_DIR}/ggml-model-umxl-u8.bin.gz -s EXPORTED_FUNCTIONS=\"['_malloc', '_free', '_modelInit', '_modelLoadProgress', '_modelInferenceProgress', '_modelDemixSegment']\""
)
add_custom_command(TARGET umx_v1 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx_v1.js ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx_v1.wasm ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx_v1.data ${CMAKE_SOURCE_DIR}/docs
)

# Copy models to the build directory
file(COPY ${CMAKE_SOURCE_DIR}/models/ggml-model-htdemucs-4s-f16.bin DESTINATION ${CMAKE_BINARY_DIR})
file(COPY ${CMAKE_SOURCE_DIR}/models/ggml-model-umxl-u8.bin.gz DESTINATION ${CMAKE_BINARY_DIR})
