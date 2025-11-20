/**
 * @file pins.h
 * @brief Pin configuration for 5-motor independent PI control system
 *
 * This file defines all hardware pin assignments for:
 * - 5 DC motors with H-bridge control
 * - TOF distance sensor with servo sweep
 * - 5 pressure pads via multiplexer
 * - Multiplexer control pins
 */

#ifndef PINS_H
#define PINS_H

#include <Arduino.h>

// ============================================================================
// MOTOR PINS (5 Motors with PWM and H-Bridge Control)
// ============================================================================


// Motor 1
constexpr uint8_t M1_PWM  = 19;  // PWM speed control
constexpr uint8_t M1_IN1  = 21;  // H-bridge input 1
constexpr uint8_t M1_IN2  = 20;  // H-bridge input 2

// Motor 2
constexpr uint8_t M2_PWM  = 35;  // PWM speed control
constexpr uint8_t M2_IN1  = 47;  // H-bridge input 1
constexpr uint8_t M2_IN2  = 48;  // H-bridge input 2

// Motor 3
constexpr uint8_t M3_PWM  = 36;   // PWM speed control
constexpr uint8_t M3_IN1  = 38;  // H-bridge input 1
constexpr uint8_t M3_IN2  = 37;  // H-bridge input 2

// Motor 4
constexpr uint8_t M4_PWM  = 41;  // PWM speed control
constexpr uint8_t M4_IN1  = 39;   // H-bridge input 1
constexpr uint8_t M4_IN2  = 40;   // H-bridge input 2

// Motor 5
constexpr uint8_t M5_PWM  = 42;  // PWM speed control
constexpr uint8_t M5_IN1  =1;   // H-bridge input 1
constexpr uint8_t M5_IN2  = 2;   // H-bridge input 2


// Motor system configuration
constexpr int NUM_MOTORS = 5;
constexpr uint32_t PWM_FREQ_HZ = 20000;   // 20 kHz PWM frequency
constexpr uint8_t PWM_RES_BITS = 10;      // 10-bit resolution (0-1023)

// ============================================================================
// TOF SENSOR PINS (Serial Communication + Servo)
// ============================================================================

constexpr uint8_t TOF_RX_PIN = 44;        // Serial RX (changed from 16)
constexpr uint8_t TOF_TX_PIN = 43;        // Serial TX (changed from 17)
constexpr uint32_t TOF_BAUDRATE = 921600; // TOF sensor baud rate

// Servo for TOF scanning
constexpr uint8_t SERVO_PIN = 6;          // Servo PWM pin

// Servo configuration (angles, sectors, timing) moved to servo_config.h
// See src/config/servo_config.h to adjust sweep parameters

// ============================================================================
// MULTIPLEXER PINS (CD74HC4067 16-Channel Analog Multiplexer)
// ============================================================================

// Multiplexer control pins (channel selection)
constexpr uint8_t MUX_S0 = 18;   // Select bit 0
constexpr uint8_t MUX_S1 = 17;   // Select bit 1
constexpr uint8_t MUX_S2 = 16;   // Select bit 2
constexpr uint8_t MUX_S3 = 15;    // Select bit 3 (RX0)

// Multiplexer signal pin (ADC input)
constexpr uint8_t MUX_SIG = 4;  // ADC1_CH7 (input only)

// Settling time after channel switch
constexpr uint32_t MUX_SETTLE_US = 100;  // Microseconds

// ============================================================================
// PRESSURE PAD CHANNELS (Multiplexer Channel Assignments)
// ============================================================================

constexpr int NUM_PRESSURE_PADS = 5;

// Pressure pad multiplexer channels (non-consecutive as per Multi_5PP)
constexpr uint8_t PP_CHANNELS[NUM_PRESSURE_PADS] = {
    0,  // Pressure Pad 1 -> Channel C1
    2,  // Pressure Pad 2 -> Channel C2
    4,  // Pressure Pad 3 -> Channel C3
    6,   // Pressure Pad 4 -> Channel C6
    8   // Pressure Pad 5 -> Channel C8
};

// Number of ADC samples to average per reading
constexpr int PP_SAMPLES = 8;

#endif // PINS_H
