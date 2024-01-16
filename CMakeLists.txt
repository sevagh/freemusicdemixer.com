cmake_minimum_required(VERSION 3.0)

project(freemusicdemixer)
enable_testing()

# Set C++ standard globally
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Global compiler options
set(CMAKE_CXX_FLAGS "-Wall -Wextra")
set(CMAKE_CXX_FLAGS_DEBUG "-g")
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -ffast-math -msimd128 -msse4.2 -flto -fno-exceptions -fno-signed-zeros -fassociative-math -freciprocal-math -fno-math-errno -fno-rounding-math -fno-signaling-nans -funsafe-math-optimizations -fno-trapping-math -fno-rtti -DNDEBUG")

# Add Eigen3 and demucs.cpp include directory
include_directories(vendor/eigen vendor/demucs.cpp/src)

# Check if the build is for Emscripten
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Only Emscripten build target is supported")
endif()

set(COMMON_LINK_FLAGS "-flto -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s STACK_SIZE=5MB -s MODULARIZE=1 -s 'EXPORTED_RUNTIME_METHODS=[\"FS\"]'")

# demucs executable
file(GLOB DEMUCS_SOURCES "vendor/demucs.cpp/src/*.cpp" "src/wasm_glue.cpp")
add_executable(demucs ${DEMUCS_SOURCES})
set_target_properties(demucs PROPERTIES
    LINK_FLAGS "${COMMON_LINK_FLAGS} -s EXPORT_NAME='libdemucs' -s EXPORTED_FUNCTIONS=\"['_malloc', '_free', '_modelInit', '_modelLoadProgress', '_modelInferenceProgress', '_modelDemixSegment']\""
)
add_custom_command(TARGET demucs POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/demucs.js ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/demucs.wasm ${CMAKE_SOURCE_DIR}/docs
)
