find_package(PkgConfig)
pkg_check_modules(EIGEN3 eigen3)

if (NOT EIGEN3_FOUND)
    # Fallback to cmake/Modules/FindEigen3.cmake
    find_package(Eigen3 REQUIRED)
else()
    set(EIGEN3_INCLUDE_DIR ${EIGEN3_INCLUDE_DIRS})
endif()

message(STATUS "Found Eigen3: ${EIGEN3_INCLUDE_DIR}")

if (NOT EIGEN3_INCLUDE_DIR)
    message(FATAL_ERROR "Failed to find Eigen3")
endif()

# Provide the found package to the parent scope
mark_as_advanced(EIGEN3_INCLUDE_DIR)
include_directories(${EIGEN3_INCLUDE_DIR})
