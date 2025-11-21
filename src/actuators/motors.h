/**
 * @file motors.h
 * @brief DC motor control with H-bridge and PWM
 *
 * Provides functions to control 5 DC motors using H-bridge drivers (L298N, TB6612, etc.)
 * with automatic LEDC PWM channel assignment. Supports forward, reverse, brake, and coast modes.
 */

#ifndef MOTORS_H
#define MOTORS_H

#include <Arduino.h>

/**
 * @brief Initialize the motor control system
 *
 * Configures all 5 motors with PWM channels and direction pins.
 * Must be called once during setup before controlling motors.
 */
void initMotorSystem();

/**
 * @brief Drive a motor forward at specified duty cycle
 *
 * Sets the motor to rotate in the forward direction at the given duty cycle.
 *
 * @param motor_index Motor index (0-4)
 * @param duty_pct Duty cycle percentage (0-100)
 */
void motorForward(uint8_t motor_index, float duty_pct);

/**
 * @brief Drive a motor in reverse at specified duty cycle
 *
 * Sets the motor to rotate in the reverse direction at the given duty cycle.
 *
 * @param motor_index Motor index (0-4)
 * @param duty_pct Duty cycle percentage (0-100)
 */
void motorReverse(uint8_t motor_index, float duty_pct);

/**
 * @brief Apply active braking to a motor
 *
 * Sets both H-bridge inputs LOW to actively brake the motor.
 * PWM is set to maximum for strongest braking effect.
 *
 * @param motor_index Motor index (0-4)
 */
void motorBrake(uint8_t motor_index);

/**
 * @brief Coast a motor to a stop
 *
 * Sets both H-bridge inputs HIGH to coast the motor (free-running).
 * Motor will gradually slow down without active braking.
 *
 * @param motor_index Motor index (0-4)
 */
void motorCoast(uint8_t motor_index);

/**
 * @brief Stop all motors with active braking
 *
 * Applies active braking to all 5 motors simultaneously.
 */
void stopAllMotors();

#endif // MOTORS_H
