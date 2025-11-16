/**
 * @file motors.cpp
 * @brief Implementation of DC motor control functions
 */

#include "motors.h"
#include "../config/pins.h"

// Motor pin configuration arrays
static const uint8_t MOTOR_PWM_PINS[NUM_MOTORS] = {M1_PWM, M2_PWM, M3_PWM, M4_PWM};
static const uint8_t MOTOR_IN1_PINS[NUM_MOTORS] = {M1_IN1, M2_IN1, M3_IN1, M4_IN1};
static const uint8_t MOTOR_IN2_PINS[NUM_MOTORS] = {M1_IN2, M2_IN2, M3_IN2, M4_IN2};

// PWM channel tracking for automatic assignment
struct PwmChannelMap {
    uint8_t pin;
    uint8_t channel;
};

static PwmChannelMap pwmChannels[NUM_MOTORS];
static uint8_t nextChannel = 0;

/**
 * @brief Get or assign a PWM channel for a given pin
 *
 * Automatically assigns LEDC channels to PWM pins. Reuses existing
 * channel if the pin was already configured.
 *
 * @param pin PWM pin number
 * @return LEDC channel number (0-15)
 */
static uint8_t getPwmChannel(uint8_t pin) {
    // Check if pin already has a channel assigned
    for (int i = 0; i < NUM_MOTORS; ++i) {
        if (pwmChannels[i].pin == pin && pwmChannels[i].channel != 255) {
            return pwmChannels[i].channel;
        }
    }

    // Assign new channel
    uint8_t channel = nextChannel++;
    for (int i = 0; i < NUM_MOTORS; ++i) {
        if (pwmChannels[i].channel == 255) {
            pwmChannels[i].pin = pin;
            pwmChannels[i].channel = channel;
            break;
        }
    }

    return channel;
}

/**
 * @brief Set motor PWM duty cycle
 *
 * Internal helper to set PWM duty cycle for a motor.
 *
 * @param motor_index Motor index (0-3)
 * @param duty_pct Duty cycle percentage (0-100)
 */
static void setMotorPwm(uint8_t motor_index, float duty_pct) {
    if (motor_index >= NUM_MOTORS) return;

    // Clamp duty cycle to valid range
    if (duty_pct < 0.0f) duty_pct = 0.0f;
    if (duty_pct > 100.0f) duty_pct = 100.0f;

    // Convert percentage to duty value (0-1023 for 10-bit resolution)
    uint32_t duty_value = (uint32_t)((duty_pct / 100.0f) * ((1 << PWM_RES_BITS) - 1));

    // Get PWM channel for this motor
    uint8_t channel = getPwmChannel(MOTOR_PWM_PINS[motor_index]);

    // Set duty cycle
    ledcWrite(channel, duty_value);
}

void initMotorSystem() {
    // Initialize PWM channel map
    for (int i = 0; i < NUM_MOTORS; ++i) {
        pwmChannels[i].pin = 0;
        pwmChannels[i].channel = 255;  // Invalid channel marker
    }

    // Configure each motor
    for (int i = 0; i < NUM_MOTORS; ++i) {
        uint8_t pwm_pin = MOTOR_PWM_PINS[i];
        uint8_t in1_pin = MOTOR_IN1_PINS[i];
        uint8_t in2_pin = MOTOR_IN2_PINS[i];

        // Get PWM channel for this motor
        uint8_t channel = getPwmChannel(pwm_pin);

        // Configure PWM (LEDC)
        ledcSetup(channel, PWM_FREQ_HZ, PWM_RES_BITS);
        ledcAttachPin(pwm_pin, channel);
        ledcWrite(channel, 0);  // Start with 0% duty

        // Configure direction pins
        pinMode(in1_pin, OUTPUT);
        pinMode(in2_pin, OUTPUT);
        digitalWrite(in1_pin, LOW);
        digitalWrite(in2_pin, LOW);
    }
}

void motorForward(uint8_t motor_index, float duty_pct) {
    if (motor_index >= NUM_MOTORS) return;

    // Set direction: IN1=HIGH, IN2=LOW
    digitalWrite(MOTOR_IN1_PINS[motor_index], HIGH);
    digitalWrite(MOTOR_IN2_PINS[motor_index], LOW);

    // Set PWM duty cycle
    setMotorPwm(motor_index, duty_pct);
}

void motorReverse(uint8_t motor_index, float duty_pct) {
    if (motor_index >= NUM_MOTORS) return;

    // Set direction: IN1=LOW, IN2=HIGH
    digitalWrite(MOTOR_IN1_PINS[motor_index], LOW);
    digitalWrite(MOTOR_IN2_PINS[motor_index], HIGH);

    // Set PWM duty cycle
    setMotorPwm(motor_index, duty_pct);
}

void motorBrake(uint8_t motor_index) {
    if (motor_index >= NUM_MOTORS) return;

    // Active brake: both pins LOW, max PWM
    digitalWrite(MOTOR_IN1_PINS[motor_index], LOW);
    digitalWrite(MOTOR_IN2_PINS[motor_index], LOW);
    setMotorPwm(motor_index, 100.0f);
}

void motorCoast(uint8_t motor_index) {
    if (motor_index >= NUM_MOTORS) return;

    // Coast: both pins HIGH, PWM doesn't matter
    digitalWrite(MOTOR_IN1_PINS[motor_index], HIGH);
    digitalWrite(MOTOR_IN2_PINS[motor_index], HIGH);
    setMotorPwm(motor_index, 0.0f);
}

void stopAllMotors() {
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
    }
}
