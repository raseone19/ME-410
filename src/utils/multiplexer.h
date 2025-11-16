/**
 * @file multiplexer.h
 * @brief CD74HC4067 16-channel analog multiplexer control
 *
 * Provides functions to select channels and read analog values through
 * a CD74HC4067 multiplexer using 4 control pins (S0-S3) and 1 signal pin.
 */

#ifndef MULTIPLEXER_H
#define MULTIPLEXER_H

#include <Arduino.h>

/**
 * @brief Initialize the multiplexer control pins
 *
 * Configures S0-S3 as outputs and sets the signal pin for analog input.
 * Must be called once during setup before using other functions.
 */
void initMultiplexer();

/**
 * @brief Select a specific multiplexer channel
 *
 * Sets the S0-S3 control pins to select the specified channel (0-15).
 * The channel remains selected until changed by another call.
 *
 * @param channel Channel number to select (0-15)
 */
void setMuxChannel(uint8_t channel);

/**
 * @brief Read raw ADC value from a multiplexer channel
 *
 * Selects the channel, waits for settling, then reads the ADC value.
 * Single sample read without averaging.
 *
 * @param channel Multiplexer channel to read (0-15)
 * @return Raw ADC value (0-4095 for 12-bit ADC)
 */
uint16_t readMuxRaw(uint8_t channel);

/**
 * @brief Read averaged raw ADC value from a multiplexer channel
 *
 * Selects the channel, waits for settling, then averages multiple ADC samples.
 * Reduces noise through oversampling.
 *
 * @param channel Multiplexer channel to read (0-15)
 * @param samples Number of samples to average
 * @return Averaged raw ADC value (0-4095 for 12-bit ADC)
 */
uint16_t readMuxRawAveraged(uint8_t channel, int samples);

/**
 * @brief Read voltage in millivolts from a multiplexer channel
 *
 * Selects the channel, waits for settling, then reads the voltage.
 * Single sample read without averaging.
 *
 * @param channel Multiplexer channel to read (0-15)
 * @return Voltage in millivolts (mV)
 */
uint16_t readMuxMilliVolts(uint8_t channel);

/**
 * @brief Read averaged voltage in millivolts from a multiplexer channel
 *
 * Selects the channel, waits for settling, then averages multiple voltage readings.
 * Recommended for pressure pad readings to reduce noise.
 *
 * @param channel Multiplexer channel to read (0-15)
 * @param samples Number of samples to average
 * @return Averaged voltage in millivolts (mV)
 */
uint16_t readMuxMilliVoltsAveraged(uint8_t channel, int samples);

#endif // MULTIPLEXER_H
