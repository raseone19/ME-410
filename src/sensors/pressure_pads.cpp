/**
 * @file pressure_pads.cpp
 * @brief Implementation of pressure pad sensor reading functions with force calibration
 */

#include "pressure_pads.h"
#include "../utils/multiplexer.h"
#include "../config/pins.h"

void initPressurePads() {
    // Initialize the multiplexer (handles all ADC configuration)
    initMultiplexer();
}

void readAllPadsMilliVolts(uint16_t* dest, int samples) {
    // Read each pressure pad sequentially through multiplexer
    for (int i = 0; i < NUM_PRESSURE_PADS; ++i) {
        uint8_t channel = PP_CHANNELS[i];
        dest[i] = readMuxMilliVoltsAveraged(channel, samples);
    }
}

uint16_t readSinglePadMilliVolts(uint8_t pad_index, int samples) {
    // Validate index
    if (pad_index >= NUM_PRESSURE_PADS) {
        return 0;
    }

    // Read the specified pressure pad
    uint8_t channel = PP_CHANNELS[pad_index];
    return readMuxMilliVoltsAveraged(channel, samples);
}

float millivoltsToNewtons(uint8_t pad_index, uint16_t millivolts) {
    // Validate index
    if (pad_index >= NUM_PRESSURE_PADS) {
        return 0.0f;
    }

    // Get calibration constants for this pad
    float Ro = PP_OFFSET_RO[pad_index];
    float S = PP_SLOPE_S[pad_index];

    // Apply calibration formula: Force (N) = S × (mV - Ro) × 9.81 × 10⁻³
    float force = S * ((float)millivolts - Ro) * GRAVITY_MPS2 * GRAMS_TO_NEWTONS;

    // Clamp to non-negative (can't have negative force)
    return (force > 0.0f) ? force : 0.0f;
}

float newtonsToMillivolts(uint8_t pad_index, float newtons) {
    // Validate index
    if (pad_index >= NUM_PRESSURE_PADS) {
        return 0.0f;
    }

    // Get calibration constants for this pad
    float Ro = PP_OFFSET_RO[pad_index];
    float S = PP_SLOPE_S[pad_index];

    // Avoid division by zero
    if (S < 0.0001f) {
        return Ro;
    }

    // Inverse calibration: mV = (Force / (S × 9.81 × 10⁻³)) + Ro
    float millivolts = (newtons / (S * GRAVITY_MPS2 * GRAMS_TO_NEWTONS)) + Ro;

    return millivolts;
}

void readAllPadsNewtons(float* dest, int samples) {
    // First read all pads in millivolts
    uint16_t mv_readings[NUM_PRESSURE_PADS];
    readAllPadsMilliVolts(mv_readings, samples);

    // Convert each to Newtons
    for (int i = 0; i < NUM_PRESSURE_PADS; ++i) {
        dest[i] = millivoltsToNewtons(i, mv_readings[i]);
    }
}

float readSinglePadNewtons(uint8_t pad_index, int samples) {
    uint16_t mv = readSinglePadMilliVolts(pad_index, samples);
    return millivoltsToNewtons(pad_index, mv);
}
