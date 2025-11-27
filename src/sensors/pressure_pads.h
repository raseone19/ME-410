/**
 * @file pressure_pads.h
 * @brief Pressure pad sensor reading via multiplexer with force calibration
 *
 * Provides functions to read pressure sensor values from 5 pressure pads
 * connected through a CD74HC4067 multiplexer. Supports both raw millivolt
 * readings and calibrated force values in Newtons.
 *
 * Force calibration formula: Force (N) = S × (mV_read - Ro) × 9.81 × 10⁻³
 * where S is the slope and Ro is the offset for each pressure pad.
 */

#ifndef PRESSURE_PADS_H
#define PRESSURE_PADS_H

#include <Arduino.h>
#include "../config/pins.h"

// ============================================================================
// Pressure Pad Calibration Constants
// ============================================================================

/**
 * Calibration parameters for converting millivolt readings to force (Newtons)
 * Formula: Force (N) = S × (mV_read - Ro) × 9.81 × 10⁻³
 *
 * Ro: Zero-force offset (mV) - reading when no force is applied
 * S:  Slope (sensitivity) - conversion factor from mV to grams
 */

// Zero-force offsets (Ro) for each pressure pad (mV)
constexpr float PP_OFFSET_RO[NUM_PRESSURE_PADS] = {
    0.0f,     // Pressure Pad 1
    700.0f,   // Pressure Pad 2
    80.0f,    // Pressure Pad 3
    480.0f,   // Pressure Pad 4
    400.0f    // Pressure Pad 5
};

// Slopes (S) for each pressure pad (mV to grams conversion factor)
constexpr float PP_SLOPE_S[NUM_PRESSURE_PADS] = {
    0.78f,    // Pressure Pad 1
    0.4875f,  // Pressure Pad 2
    0.39f,    // Pressure Pad 3
    0.26f,    // Pressure Pad 4
    0.25f     // Pressure Pad 5
};

// Gravity constant for conversion (m/s²)
constexpr float GRAVITY_MPS2 = 9.81f;

// Conversion factor: grams to Newtons (× 10⁻³)
constexpr float GRAMS_TO_NEWTONS = 0.001f;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * @brief Initialize pressure pad sensors
 *
 * Initializes the multiplexer used for reading pressure pads.
 * Must be called once during setup before reading values.
 */
void initPressurePads();

/**
 * @brief Read all pressure pads in millivolts
 *
 * Sequentially reads each pressure pad through the multiplexer with averaging.
 * The readings are stored in the provided array in order (PP1-PP5).
 *
 * @param dest Pointer to array of NUM_PRESSURE_PADS uint16_t to store readings (in mV)
 * @param samples Number of samples to average per pad (default: 8)
 */
void readAllPadsMilliVolts(uint16_t* dest, int samples = 8);

/**
 * @brief Read a single pressure pad in millivolts
 *
 * Reads one specific pressure pad with averaging.
 *
 * @param pad_index Pressure pad index (0 to NUM_PRESSURE_PADS-1)
 * @param samples Number of samples to average (default: 8)
 * @return Pressure value in millivolts (mV)
 */
uint16_t readSinglePadMilliVolts(uint8_t pad_index, int samples = 8);

/**
 * @brief Convert millivolt reading to force in Newtons
 *
 * Applies calibration formula: Force (N) = S × (mV - Ro) × 9.81 × 10⁻³
 *
 * @param pad_index Pressure pad index (0 to NUM_PRESSURE_PADS-1)
 * @param millivolts Raw millivolt reading
 * @return Force in Newtons (clamped to >= 0)
 */
float millivoltsToNewtons(uint8_t pad_index, uint16_t millivolts);

/**
 * @brief Convert force in Newtons to millivolts
 *
 * Inverse calibration: mV = (Force / (S × 9.81 × 10⁻³)) + Ro
 *
 * @param pad_index Pressure pad index (0 to NUM_PRESSURE_PADS-1)
 * @param newtons Force in Newtons
 * @return Equivalent millivolt value
 */
float newtonsToMillivolts(uint8_t pad_index, float newtons);

/**
 * @brief Read all pressure pads in Newtons
 *
 * Reads all pads and converts to calibrated force values.
 *
 * @param dest Pointer to array of NUM_PRESSURE_PADS floats to store readings (in N)
 * @param samples Number of samples to average per pad (default: 8)
 */
void readAllPadsNewtons(float* dest, int samples = 8);

/**
 * @brief Read a single pressure pad in Newtons
 *
 * @param pad_index Pressure pad index (0 to NUM_PRESSURE_PADS-1)
 * @param samples Number of samples to average (default: 8)
 * @return Force in Newtons
 */
float readSinglePadNewtons(uint8_t pad_index, int samples = 8);

#endif // PRESSURE_PADS_H
