/**
 * @file multiplexer.cpp
 * @brief Implementation of CD74HC4067 multiplexer control functions
 */

#include "multiplexer.h"
#include "../config/pins.h"

void initMultiplexer() {
    // Configure control pins as outputs
    pinMode(MUX_S0, OUTPUT);
    pinMode(MUX_S1, OUTPUT);
    pinMode(MUX_S2, OUTPUT);
    pinMode(MUX_S3, OUTPUT);

    // Configure signal pin for analog input
    pinMode(MUX_SIG, INPUT);

    // Set ADC resolution to 12 bits (0-4095)
    analogReadResolution(12);

    // Set ADC attenuation for signal pin (0-3.3V range with ~11dB attenuation)
    analogSetPinAttenuation(MUX_SIG, ADC_11db);

    // Initialize to channel 0
    setMuxChannel(0);
}

void setMuxChannel(uint8_t channel) {
    // Set S0-S3 based on channel bits (0-15)
    digitalWrite(MUX_S0, (channel & 0x01) ? HIGH : LOW);  // Bit 0
    digitalWrite(MUX_S1, (channel & 0x02) ? HIGH : LOW);  // Bit 1
    digitalWrite(MUX_S2, (channel & 0x04) ? HIGH : LOW);  // Bit 2
    digitalWrite(MUX_S3, (channel & 0x08) ? HIGH : LOW);  // Bit 3
}

uint16_t readMuxRaw(uint8_t channel) {
    setMuxChannel(channel);
    delayMicroseconds(MUX_SETTLE_US);  // Wait for multiplexer to settle
    return analogRead(MUX_SIG);
}

uint16_t readMuxRawAveraged(uint8_t channel, int samples) {
    setMuxChannel(channel);
    delayMicroseconds(MUX_SETTLE_US);  // Wait for multiplexer to settle

    uint32_t accumulator = 0;
    for (int i = 0; i < samples; ++i) {
        accumulator += analogRead(MUX_SIG);
        delayMicroseconds(50);  // Small delay between samples
    }

    return static_cast<uint16_t>(accumulator / samples);
}

uint16_t readMuxMilliVolts(uint8_t channel) {
    setMuxChannel(channel);
    delayMicroseconds(MUX_SETTLE_US);  // Wait for multiplexer to settle
    return analogReadMilliVolts(MUX_SIG);
}

uint16_t readMuxMilliVoltsAveraged(uint8_t channel, int samples) {
    setMuxChannel(channel);
    delayMicroseconds(MUX_SETTLE_US);  // Wait for multiplexer to settle

    uint32_t accumulator = 0;
    for (int i = 0; i < samples; ++i) {
        accumulator += analogReadMilliVolts(MUX_SIG);
        delayMicroseconds(50);  // Small delay between samples
    }

    return static_cast<uint16_t>(accumulator / samples);
}
