/**
 * @file main.cpp
 * @brief 4-Motor Independent PI Control with Dynamic TOF Setpoint
 *
 * This project implements independent PI control for 4 motors, each with its own
 * pressure pad sensor. A TOF sensor with servo sweep determines the minimum distance,
 * which is used to calculate a dynamic setpoint applied to all motors.
 *
 * Architecture:
 * - Core 0: Servo sweep task (TOF scanning), Serial print task (CSV logging)
 * - Core 1: Main loop (PI control at 50 Hz for 4 motors)
 *
 * Hardware:
 * - 4 DC motors with H-bridge drivers
 * - 4 pressure pads via CD74HC4067 multiplexer
 * - TOF distance sensor with servo sweep mechanism
 * - ESP32 Dev Module
 */

#if !defined(ARDUINO_ARCH_ESP32)
  #error "Select an ESP32 board: Tools → Board → ESP32 Arduino → ESP32 Dev Module"
#endif

#include <Arduino.h>

// Project modules
#include "config/pins.h"
#include "config/system_config.h"
#include "sensors/tof_sensor.h"
#include "sensors/pressure_pads.h"
#include "actuators/motors.h"
#include "control/pi_controller.h"
#include "tasks/core0_tasks.h"

// ============================================================================
// Control Loop Configuration
// ============================================================================

constexpr uint32_t CTRL_FREQ_HZ = 50;         // PI control frequency (Hz)
constexpr uint32_t CTRL_DT_MS = 1000 / CTRL_FREQ_HZ;

// ============================================================================
// State Machine for Out-of-Range Handling (Per Motor)
// ============================================================================

static SystemState current_state[NUM_MOTORS] = {NORMAL_OPERATION, NORMAL_OPERATION, NORMAL_OPERATION, NORMAL_OPERATION};
static uint32_t reverse_start_time[NUM_MOTORS] = {0, 0, 0, 0};

// ============================================================================
// Distance Range Tracking (Per Motor)
// ============================================================================

static DistanceRange current_range[NUM_MOTORS] = {RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN};
static DistanceRange previous_range[NUM_MOTORS] = {RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN};

// Baseline pressure captured when entering FAR range (per motor, for dynamic setpoint calculation)
static float far_range_baseline_mv[NUM_MOTORS] = {0.0f, 0.0f, 0.0f, 0.0f};
static bool far_range_baseline_captured[NUM_MOTORS] = {false, false, false, false};

// ============================================================================
// Local Variables (Core 1)
// ============================================================================

static uint16_t pressure_pads_mv[NUM_MOTORS] = {0};
static float duty_cycles[NUM_MOTORS] = {0.0f};
static float setpoints_mv[NUM_MOTORS] = {0.0f};  // Individual setpoints per motor
static uint32_t last_control_ms = 0;

// ============================================================================
// Setup Function
// ============================================================================

void setup() {
    // Initialize serial communication
    Serial.begin(115200);
    delay(2000);  // Allow time to open serial monitor

    Serial.println("========================================");
    Serial.println("4-Motor Independent PI Control System");
    Serial.println("With Servo Sweep and TOF Distance Sensing");
    Serial.println("========================================");
    Serial.print("Protocol: ");
    Serial.println(PROTOCOL_NAME);
    Serial.print("Logging Rate: ");
    Serial.println(LOGGING_RATE_NAME);
    Serial.print("Sweep Mode: ");
    Serial.println(SWEEP_MODE_NAME);
    Serial.println("========================================");
    Serial.println();

    // Initialize hardware modules
    Serial.println("Initializing hardware...");

    // Initialize TOF sensor and servo
    Serial.print("  - TOF sensor... ");
    initTOFSensor();
    Serial.println("OK");

    // Initialize pressure pads (and multiplexer)
    Serial.print("  - Pressure pads... ");
    initPressurePads();
    Serial.println("OK");

    // Initialize motors
    Serial.print("  - Motors... ");
    initMotorSystem();
    Serial.println("OK");

    // Initialize PI controllers
    Serial.print("  - PI controllers... ");
    initPIController();
    Serial.println("OK");

    Serial.println();
    Serial.println("Starting Core 0 tasks...");

    // Start Core 0 tasks (servo sweep + logger)
    initCore0Tasks();

    Serial.println("  - Servo sweep task started on Core 0");
    Serial.println("  - Serial print task started on Core 0");

    Serial.println();
    Serial.println("Initialization complete!");
    Serial.println("Starting PI control loop on Core 1 at 50 Hz...");
    Serial.println();

    // Small delay before starting control loop
    delay(500);
}

// ============================================================================
// Main Loop (Core 1 - PI Control)
// ============================================================================

void loop() {
    uint32_t current_time = millis();

    // Run control loop at fixed frequency (50 Hz)
    if (current_time - last_control_ms >= CTRL_DT_MS) {
        last_control_ms = current_time;

        // ====================================================================
        // Step 1: Read all 4 pressure pads
        // ====================================================================

        readAllPadsMilliVolts(pressure_pads_mv, PP_SAMPLES);

        // ====================================================================
        // Step 2-5: Process each motor independently (different sectors)
        // ====================================================================

        // Each motor uses its own sector's minimum distance
        for (int i = 0; i < NUM_MOTORS; ++i) {
            // Step 2: Get minimum distance for this motor's sector
            float min_distance_cm = getMinDistance(i);

            // Update shared distance for this motor (for logging)
            shared_tof_distances[i] = min_distance_cm;

            // Step 3: Classify distance into range for this motor
            current_range[i] = getDistanceRange(min_distance_cm);

            // Skip this motor if distance hasn't been initialized yet (999.0f = no valid reading)
            if (min_distance_cm >= 999.0f) {
                setpoints_mv[i] = -1.0f;  // Invalid setpoint, motor will stop
                previous_range[i] = current_range[i];  // Update previous range
                continue;
            }

            // Step 4: Detect range transitions and capture baseline for FAR range
            if (current_range[i] != previous_range[i] && current_range[i] == RANGE_FAR) {
                far_range_baseline_mv[i] = pressure_pads_mv[i];
                far_range_baseline_captured[i] = true;
            }

            // Step 5: Calculate setpoint for this motor
            if (current_range[i] == RANGE_FAR && far_range_baseline_captured[i]) {
                // FAR range: Individual setpoint (baseline + offset)
                setpoints_mv[i] = calculateSetpoint(current_range[i], far_range_baseline_mv[i]);
            } else {
                // MEDIUM/CLOSE/UNKNOWN: Fixed setpoint
                setpoints_mv[i] = calculateSetpoint(current_range[i], 0.0f);
            }

            // Update previous range for next iteration
            previous_range[i] = current_range[i];
        }

        // ====================================================================
        // Step 6: State machine for out-of-range handling (per motor)
        // ====================================================================

        // Independent state machine per motor
        // Prepare arrays for PI control (only motors in NORMAL_OPERATION)
        float temp_setpoints[NUM_MOTORS];
        uint16_t temp_pressures[NUM_MOTORS];
        float temp_duties[NUM_MOTORS] = {0.0f, 0.0f, 0.0f, 0.0f};

        // Track state transitions for each motor
        for (int i = 0; i < NUM_MOTORS; ++i) {
            int state_index = i;  // Each motor uses own state

            // Check if this motor is out of bounds or has invalid setpoint
            bool is_out_of_bounds = (current_range[i] == RANGE_OUT_OF_BOUNDS || setpoints_mv[i] < 0.0f);
            bool is_valid = !(current_range[i] == RANGE_OUT_OF_BOUNDS || current_range[i] == RANGE_UNKNOWN || setpoints_mv[i] < 0.0f);

            switch (current_state[state_index]) {
                case NORMAL_OPERATION:
                    if (is_out_of_bounds) {
                        // Transition this motor to deflating state
                        current_state[state_index] = OUT_OF_RANGE_DEFLATING;
                        duty_cycles[i] = -REVERSE_DUTY_PCT;  // Set duty for logging
                    }
                    else {
                        // Prepare for PI control
                        temp_setpoints[i] = setpoints_mv[i];
                        temp_pressures[i] = pressure_pads_mv[i];
                    }
                    break;

                case OUT_OF_RANGE_DEFLATING:
                    // Check if pressure has dropped below safe threshold
                    if (pressure_pads_mv[i] <= SAFE_PRESSURE_THRESHOLD_MV) {
                        // Pressure is safe - check if we can return to normal or need release period
                        duty_cycles[i] = 0.0f;

                        if (is_valid) {
                            // Distance valid AND pressure safe - resume PI control
                            current_state[state_index] = NORMAL_OPERATION;
                        }
                        else {
                            // Pressure safe but distance still invalid - release period
                            current_state[state_index] = OUT_OF_RANGE_RELEASING;
                            reverse_start_time[state_index] = current_time;
                        }
                    }
                    else {
                        // Pressure still too high - keep reversing to deflate
                        duty_cycles[i] = -REVERSE_DUTY_PCT;
                    }
                    break;

                case OUT_OF_RANGE_RELEASING:
                    // Check if motor has returned to valid range AND pressure is safe
                    if (is_valid && pressure_pads_mv[i] <= SAFE_PRESSURE_THRESHOLD_MV) {
                        // Motor valid and pressure safe - resume PI control
                        current_state[state_index] = NORMAL_OPERATION;
                        // Will start PI control on next iteration
                    }
                    // Otherwise, continue reversing for release period
                    else if (current_time - reverse_start_time[state_index] >= RELEASE_TIME_MS) {
                        current_state[state_index] = WAITING_FOR_VALID_READING;
                    }
                    duty_cycles[i] = -REVERSE_DUTY_PCT;  // Continue reversing during release
                    break;

                case WAITING_FOR_VALID_READING:
                    // Only return to normal if distance is valid AND pressure is safe
                    if (is_valid && pressure_pads_mv[i] <= SAFE_PRESSURE_THRESHOLD_MV) {
                        current_state[state_index] = NORMAL_OPERATION;
                        // Motor will start PI control on next iteration
                    }
                    else if (is_valid && pressure_pads_mv[i] > SAFE_PRESSURE_THRESHOLD_MV) {
                        // Distance valid but pressure still high - go back to deflating
                        current_state[state_index] = OUT_OF_RANGE_DEFLATING;
                        duty_cycles[i] = -REVERSE_DUTY_PCT;
                    }
                    else {
                        // Still waiting - motor stopped
                        duty_cycles[i] = 0.0f;
                    }
                    break;
            }
        }

        // Run PI control only for motors in NORMAL_OPERATION state
        controlStep(temp_setpoints, temp_pressures, temp_duties);

        // Apply motor commands based on state (AFTER PI control to override for non-NORMAL motors)
        for (int i = 0; i < NUM_MOTORS; ++i) {
            if (current_state[i] == NORMAL_OPERATION) {
                // Use PI controller output
                duty_cycles[i] = temp_duties[i];
                // PI controller already applied motor commands in controlStep
            }
            else if (current_state[i] == OUT_OF_RANGE_DEFLATING || current_state[i] == OUT_OF_RANGE_RELEASING) {
                // Override with deflation/release command (both reverse)
                motorReverse(i, REVERSE_DUTY_PCT);
            }
            else {
                // WAITING_FOR_VALID_READING - motor stopped
                motorBrake(i);
            }
        }

        // ====================================================================
        // Step 7: Update shared variables for logging (Core 0 task)
        // ====================================================================

        for (int i = 0; i < NUM_MOTORS; ++i) {
            shared_setpoints_mv[i] = setpoints_mv[i];
            shared_pressure_pads_mv[i] = pressure_pads_mv[i];
            shared_duty_cycles[i] = duty_cycles[i];
        }
    }

    // Small delay to prevent watchdog triggers
    delay(1);
}
