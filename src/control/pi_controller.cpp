/**
 * @file pi_controller.cpp
 * @brief Implementation of PI controller for 5 independent motors
 */

#include "pi_controller.h"
#include "../actuators/motors.h"
#include "../config/system_config.h"
#include <algorithm>

// ============================================================================
// PI Controller Parameters
// ============================================================================

// Timing
constexpr float CTRL_FREQ_HZ = 50.0f;                    // Control loop frequency
constexpr float CTRL_DT_S = 1.0f / CTRL_FREQ_HZ;         // Time step (seconds)

// Output limits
constexpr float DUTY_MIN = -100.0f;                      // Minimum duty cycle (%)
constexpr float DUTY_MAX = 100.0f;                       // Maximum duty cycle (%)

// Deadband threshold
constexpr float MIN_RUN = 40.0f;                         // Minimum duty to overcome friction (%)

// ============================================================================
// PI Gains - Mode-specific defaults
// ============================================================================
// Scale factor between modes: ~80x (1N ≈ 80mV typical for these sensors)
//
// NEWTONS mode:     Kp=12.0,  Ki=48.0  (larger values, smaller error range)
// MILLIVOLTS mode:  Kp=0.15,  Ki=0.60  (smaller values, larger error range)
// ============================================================================

#ifdef CONTROL_MODE_NEWTONS
    static float Kp = 12.0f;                             // Proportional gain (for Newtons)
    static float Ki = 48.0f;                             // Integral gain (for Newtons)
#else // CONTROL_MODE_MILLIVOLTS
    static float Kp = 0.15f;                             // Proportional gain (for millivolts)
    static float Ki = 0.60f;                             // Integral gain (for millivolts)
#endif

// ============================================================================
// Controller State (5 Independent Controllers)
// ============================================================================

static float integrators[NUM_MOTORS] = {0};             // Integral terms for each motor
static float last_duty[NUM_MOTORS] = {0};               // Last duty cycle outputs

// ============================================================================
// Public Functions
// ============================================================================

void initPIController() {
    resetIntegrators();
}

void resetIntegrators() {
    for (int i = 0; i < NUM_MOTORS; ++i) {
        integrators[i] = 0.0f;
        last_duty[i] = 0.0f;
    }
}

void setPIGains(float kp, float ki) {
    Kp = kp;
    Ki = ki;
}

void getPIGains(float* kp, float* ki) {
    if (kp) *kp = Kp;
    if (ki) *ki = Ki;
}

void controlStep(const float setpoints_mv[NUM_MOTORS], const uint16_t pressure_pads_mv[NUM_MOTORS], float duty_out[NUM_MOTORS]) {
    // Process each motor independently
    for (int i = 0; i < NUM_MOTORS; ++i) {
        // Get current pressure reading
        float current_pressure_mv = (float)pressure_pads_mv[i];

        // Calculate error (positive error means pressure too low, need to push harder)
        float error = setpoints_mv[i] - current_pressure_mv;

        // Update integrator
        integrators[i] += error * CTRL_DT_S;

        // Anti-windup: clamp integrator based on output saturation
        float integrator_max = (DUTY_MAX / std::max(Ki, 0.0001f));
        if (integrators[i] > integrator_max) {
            integrators[i] = integrator_max;
        }
        if (integrators[i] < -integrator_max) {
            integrators[i] = -integrator_max;
        }

        // Compute PI output
        float duty = Kp * error + Ki * integrators[i];

        // Apply output saturation
        if (duty > DUTY_MAX) duty = DUTY_MAX;
        if (duty < DUTY_MIN) duty = DUTY_MIN;

        // Apply deadband to overcome static friction
        float command = 0.0f;
        if (duty >= MIN_RUN) {
            // Forward direction
            command = duty;
        } else if (duty <= -MIN_RUN) {
            // Reverse direction
            command = duty;
        } else {
            // Within deadband - stop motor
            command = 0.0f;
        }

        // Store duty cycle
        duty_out[i] = command;
        last_duty[i] = command;

        // Apply to motor
        if (command > 0.0f) {
            motorForward(i, command);
        } else if (command < 0.0f) {
            motorReverse(i, -command);  // Make duty positive
        } else {
            motorBrake(i);
        }
    }
}

void controlStepNewtons(const float setpoints_n[NUM_MOTORS], const float pressure_pads_n[NUM_MOTORS], float duty_out[NUM_MOTORS]) {
    // Process each motor independently (using Newtons instead of mV)
    for (int i = 0; i < NUM_MOTORS; ++i) {
        // Get current force reading (already in Newtons)
        float current_force_n = pressure_pads_n[i];

        // Calculate error (positive error means force too low, need to push harder)
        float error = setpoints_n[i] - current_force_n;

        // Update integrator
        integrators[i] += error * CTRL_DT_S;

        // Anti-windup: clamp integrator based on output saturation
        float integrator_max = (DUTY_MAX / std::max(Ki, 0.0001f));
        if (integrators[i] > integrator_max) {
            integrators[i] = integrator_max;
        }
        if (integrators[i] < -integrator_max) {
            integrators[i] = -integrator_max;
        }

        // Compute PI output
        float duty = Kp * error + Ki * integrators[i];

        // Apply output saturation
        if (duty > DUTY_MAX) duty = DUTY_MAX;
        if (duty < DUTY_MIN) duty = DUTY_MIN;

        // Apply deadband to overcome static friction
        float command = 0.0f;
        if (duty >= MIN_RUN) {
            // Forward direction
            command = duty;
        } else if (duty <= -MIN_RUN) {
            // Reverse direction
            command = duty;
        } else {
            // Within deadband - stop motor
            command = 0.0f;
        }

        // Store duty cycle
        duty_out[i] = command;
        last_duty[i] = command;

        // Apply to motor
        if (command > 0.0f) {
            motorForward(i, command);
        } else if (command < 0.0f) {
            motorReverse(i, -command);  // Make duty positive
        } else {
            motorBrake(i);
        }
    }
}
