/**
 * @file pins.h
 * @brief Pin configuration for 4-motor independent PI control system
 *
 * This file defines all hardware pin assignments for:
 * - 4 DC motors with H-bridge control
 * - TOF distance sensor with servo sweep
 * - 4 pressure pads via multiplexer
 * - Multiplexer control pins
 */

#ifndef PINS_H
#define PINS_H

#include <Arduino.h>

// ============================================================================
// MOTOR PINS (4 Motors with PWM and H-Bridge Control)
// ============================================================================


// Motor 1
constexpr uint8_t M2_PWM  = 13;  // PWM speed control
constexpr uint8_t M2_IN1  = 14;  // H-bridge input 1
constexpr uint8_t M2_IN2  = 12;  // H-bridge input 2

// Motor 2
constexpr uint8_t M1_PWM  = 25;  // PWM speed control
constexpr uint8_t M1_IN1  = 27;  // H-bridge input 1
constexpr uint8_t M1_IN2  = 26;  // H-bridge input 2



// Motor 3
constexpr uint8_t M4_PWM  = 5;   // PWM speed control
constexpr uint8_t M4_IN1  = 16;  // H-bridge input 1
constexpr uint8_t M4_IN2  = 17;  // H-bridge input 2


// Motor 4
constexpr uint8_t M3_PWM  = 15;  // PWM speed control
constexpr uint8_t M3_IN1  = 4;   // H-bridge input 1
constexpr uint8_t M3_IN2  = 2;   // H-bridge input 2


// Motor system configuration
constexpr int NUM_MOTORS = 4;
constexpr uint32_t PWM_FREQ_HZ = 20000;   // 20 kHz PWM frequency
constexpr uint8_t PWM_RES_BITS = 10;      // 10-bit resolution (0-1023)

// ============================================================================
// TOF SENSOR PINS (Serial Communication + Servo)
// ============================================================================

constexpr uint8_t TOF_RX_PIN = 34;        // Serial RX (changed from 16)
constexpr uint8_t TOF_TX_PIN = 18;        // Serial TX (changed from 17)
constexpr uint32_t TOF_BAUDRATE = 921600; // TOF sensor baud rate

// Servo for TOF scanning
constexpr uint8_t SERVO_PIN = 2;          // Servo PWM pin
constexpr int SERVO_MIN_ANGLE = 30;       // Minimum sweep angle (degrees)
constexpr int SERVO_MAX_ANGLE = 90;       // Maximum sweep angle (degrees)
constexpr int SERVO_STEP = 2;             // Angle increment per step
constexpr uint32_t SERVO_SETTLE_MS = 80;  // Settling time per step (ms)

// ============================================================================
// MULTIPLEXER PINS (CD74HC4067 16-Channel Analog Multiplexer)
// ============================================================================

// Multiplexer control pins (channel selection)
constexpr uint8_t MUX_S0 = 23;   // Select bit 0
constexpr uint8_t MUX_S1 = 33;   // Select bit 1
constexpr uint8_t MUX_S2 = 32;   // Select bit 2
constexpr uint8_t MUX_S3 = 3;    // Select bit 3 (RX0)

// Multiplexer signal pin (ADC input)
constexpr uint8_t MUX_SIG = 35;  // ADC1_CH7 (input only)

// Settling time after channel switch
constexpr uint32_t MUX_SETTLE_US = 100;  // Microseconds

// ============================================================================
// PRESSURE PAD CHANNELS (Multiplexer Channel Assignments)
// ============================================================================

constexpr int NUM_PRESSURE_PADS = 4;

// Pressure pad multiplexer channels (non-consecutive as per Multi_5PP)
constexpr uint8_t PP_CHANNELS[NUM_PRESSURE_PADS] = {
    1,  // Pressure Pad 1 -> Channel C1
    2,  // Pressure Pad 2 -> Channel C2
    3,  // Pressure Pad 3 -> Channel C3
    6   // Pressure Pad 4 -> Channel C6
};

// Number of ADC samples to average per reading
constexpr int PP_SAMPLES = 8;

#endif // PINS_H
