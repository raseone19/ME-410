/**
 * @file pi_controller.h
 * @brief PI (Proportional-Integral) controller for 4 independent motors
 *
 * Implements 4 parallel PI controllers with anti-windup, saturation, and deadband.
 * Each motor has its own integrator state for independent control.
 */

#ifndef PI_CONTROLLER_H
#define PI_CONTROLLER_H

#include <Arduino.h>
#include "../config/pins.h"

/**
 * @brief Initialize the PI controller system
 *
 * Resets all integrator states and initializes controller parameters.
 * Must be called once during setup before running control loops.
 */
void initPIController();

/**
 * @brief Execute one PI control step for all 4 motors
 *
 * Reads the current setpoint and pressure pad values, computes PI control
 * for each motor independently, and applies the calculated duty cycles.
 *
 * This function should be called at a fixed frequency (default: 50 Hz).
 *
 * @param setpoint_mv Target pressure setpoint in millivolts (same for all motors)
 * @param pressure_pads_mv Array of 4 current pressure pad readings in millivolts
 * @param duty_out Output array of 4 duty cycles (will be updated, range: -100 to 100)
 */
void controlStep(float setpoint_mv, const uint16_t pressure_pads_mv[NUM_MOTORS], float duty_out[NUM_MOTORS]);

/**
 * @brief Reset all integrators to zero
 *
 * Clears the integrator state for all 4 motors. Useful when changing
 * setpoints dramatically or after system restart.
 */
void resetIntegrators();

/**
 * @brief Set PI gains for all motors
 *
 * Updates the proportional and integral gains. Changes take effect
 * immediately on the next control step.
 *
 * @param kp Proportional gain
 * @param ki Integral gain
 */
void setPIGains(float kp, float ki);

/**
 * @brief Get current PI gains
 *
 * @param kp Pointer to store proportional gain
 * @param ki Pointer to store integral gain
 */
void getPIGains(float* kp, float* ki);

#endif // PI_CONTROLLER_H
