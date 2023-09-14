cmake_minimum_required(VERSION 3.0)

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

set(CMAKE_CXX_FLAGS "-Wall -Wextra")
set(CMAKE_CXX_FLAGS_DEBUG "-g")
#set(CMAKE_CXX_FLAGS_RELEASE "-O3")

# improve CMAKE_CXX_FLAGS_RELEASE to every possible optimization considering Eigen3, target arch (my CPU is a Ryzen 5950X), and compiler
# also linux kernel features and whatnot
# aside from "-O3"
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -ffast-math -fno-signed-zeros -fno-trapping-math -fassociative-math -freciprocal-math -fno-math-errno -fno-rounding-math -fno-signaling-nans -fno-unsafe-math-optimizations -fno-trapping-math -fno-math-errno -msimd128")

# define a macro NDEBUG for Eigen3 release builds
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -DNDEBUG")

project(umx.cpp)
enable_testing()

# set C++ standard to C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# add library Eigen3
include_directories(vendor/eigen)

# include src/ as include directory
include_directories(src)

# include src/*.cpp and src/*.c as source files
file(GLOB SOURCES "src/*.cpp")

# Create the Emscripten target
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "Only emscripten build target is supported")
endif()

# add subdirectory for zlib in vendor
include_directories(${CMAKE_BINARY_DIR}/vendor/zlib)
include_directories(vendor/zlib)
add_definitions(-D_NO_LARGEFILE64_SOURCE -D_LARGEFILE_SOURCE)
add_subdirectory(vendor/zlib)

# add new file to SOURCES
list(APPEND SOURCES "src/wasm_glue.cpp")

# compile library
add_executable(umx ${SOURCES})

target_link_libraries(umx zlibstatic)

# copy ${CMAKE_SOURCE_DIR}/models to ${CMAKE_BINARY_DIR}/models
file(COPY ${CMAKE_SOURCE_DIR}/models/ggml-model-umxl-u8.bin.gz DESTINATION ${CMAKE_BINARY_DIR})

set_target_properties(umx PROPERTIES
    LINK_FLAGS "-s WASM=1 -s ASSERTIONS=1 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s MODULARIZE=1 -s EXPORT_NAME=libumx --preload-file ${CMAKE_BINARY_DIR}/ggml-model-umxl-u8.bin.gz -s EXPORTED_FUNCTIONS=\"['_malloc', '_free', '_umxInit', '_umxLoadProgress', '_umxInferenceProgress', '_umxDemixSegment']\""
)

# copy umx.js, umx.wasm to ${CMAKE_SOURCE_DIR}/docs
add_custom_command(TARGET umx POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx.js ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx.wasm ${CMAKE_SOURCE_DIR}/docs
    COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx.data ${CMAKE_SOURCE_DIR}/docs
)
