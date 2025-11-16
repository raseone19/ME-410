/**
 * @file pressure_pads.cpp
 * @brief Implementation of pressure pad sensor reading functions
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
