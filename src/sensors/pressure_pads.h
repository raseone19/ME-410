/**
 * @file pressure_pads.h
 * @brief Pressure pad sensor reading via multiplexer
 *
 * Provides functions to read pressure sensor values from 5 pressure pads
 * connected through a CD74HC4067 multiplexer. Readings are in millivolts.
 */

#ifndef PRESSURE_PADS_H
#define PRESSURE_PADS_H

#include <Arduino.h>

/**
 * @brief Initialize pressure pad sensors
 *
 * Initializes the multiplexer used for reading pressure pads.
 * Must be called once during setup before reading values.
 */
void initPressurePads();

/**
 * @brief Read all 5 pressure pads in millivolts
 *
 * Sequentially reads each pressure pad through the multiplexer with averaging.
 * The readings are stored in the provided array in order (PP1, PP2, PP3, PP4, PP5).
 *
 * @param dest Pointer to array of 5 uint16_t to store readings (in mV)
 * @param samples Number of samples to average per pad (default: 8)
 */
void readAllPadsMilliVolts(uint16_t* dest, int samples = 8);

/**
 * @brief Read a single pressure pad in millivolts
 *
 * Reads one specific pressure pad with averaging.
 *
 * @param pad_index Pressure pad index (0-4)
 * @param samples Number of samples to average (default: 8)
 * @return Pressure value in millivolts (mV)
 */
uint16_t readSinglePadMilliVolts(uint8_t pad_index, int samples = 8);

#endif // PRESSURE_PADS_H
