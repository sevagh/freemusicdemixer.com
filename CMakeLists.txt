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
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -mfma -ffast-math -fno-signed-zeros -fno-trapping-math -fassociative-math -freciprocal-math -fno-math-errno -fno-rounding-math -fno-signaling-nans -fno-unsafe-math-optimizations -fno-trapping-math -fno-math-errno")

# define a macro NDEBUG for Eigen3 release builds
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} -DNDEBUG")

project(umx.cpp)
enable_testing()

# set C++ standard to C++17
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# add library Eigen3
include_directories(file_demixer vendor/eigen/)

# include src/ as include directory
include_directories(src)

# include src/*.cpp and src/*.c as source files
file(GLOB SOURCES "src/*.cpp")

# Create the Emscripten target
if(EMSCRIPTEN)
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
        LINK_FLAGS "-s WASM=1 -s ASSERTIONS=1 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=4GB -s MODULARIZE=1 -s EXPORT_NAME=libumx --preload-file ${CMAKE_BINARY_DIR}/ggml-model-umxl-u8.bin.gz -s EXPORTED_FUNCTIONS=\"['_malloc', '_free', '_umxInit', '_umxLoadProgress', '_umxInferenceProgress', '_umxDemix']\""
    )

    # copy umx.js, umx.wasm to ${CMAKE_SOURCE_DIR}/docs
    add_custom_command(TARGET umx POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx.js ${CMAKE_SOURCE_DIR}/docs
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx.wasm ${CMAKE_SOURCE_DIR}/docs
        COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_BINARY_DIR}/umx.data ${CMAKE_SOURCE_DIR}/docs
    )
# if not emscripten, build file_demixer, lint targets, etc.
else()
    # remove wasm_glue.cpp from SOURCES
    foreach(source ${SOURCES})
        get_filename_component(filename ${source} NAME)
        if(filename MATCHES "wasm_glue.cpp$")
            list(REMOVE_ITEM SOURCES ${source})
        endif()
    endforeach()

    # add subdirectory for zlib in vendor
    include_directories(${CMAKE_BINARY_DIR}/vendor/zlib)
    include_directories(vendor/zlib)
    add_definitions(-D_NO_LARGEFILE64_SOURCE -D_LARGEFILE_SOURCE)
    add_subdirectory(vendor/zlib)

    add_library(umx STATIC ${SOURCES})

    # compile library with zlibstatic
    target_link_libraries(umx zlibstatic)

    file(GLOB SOURCES_TO_LINT "src/*.cpp" "src/*.hpp" "examples/file_demixer/file_demixer.cpp" "test/*.cpp")

    # add target to run standard lints and formatters
    add_custom_target(lint
        COMMAND clang-format -i ${SOURCES_TO_LINT} --style=file
        # add clang-tidy command
        # add include dirs to clang-tidy
        COMMAND cppcheck --enable=all --suppress=missingIncludeSystem ${SOURCES_TO_LINT} --std=c++17
        COMMAND scan-build -o ${CMAKE_BINARY_DIR}/scan-build-report make -C ${CMAKE_BINARY_DIR}
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    )

    # compile vendored submodule libnyquist
    set(LIBNYQUIST_BUILD_EXAMPLE OFF CACHE BOOL "Disable libnyquist example")
    add_subdirectory(vendor/libnyquist)

    # include vendor submodules libnyquist
    include_directories(vendor/libnyquist/include)

    # add target to compile umx.cpp, the main driver program for umx.cpp
    add_executable(file_demixer examples/file_demixer/file_demixer.cpp)
    # link it against umx.cpp.lib
    target_link_libraries(file_demixer umx libnyquist)
endif()
