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
#include "sensors/ultrasonic_sensor.h"
#include "sensors/pressure_pads.h"
#include "actuators/motors.h"
#include "control/pi_controller.h"
#include "tasks/core0_tasks.h"
#include "utils/command_handler.h"
#include "utils/multiplexer.h"

// ============================================================================
// Control Loop Configuration
// ============================================================================

constexpr uint32_t CTRL_FREQ_HZ = 20;         // PI control frequency (Hz)
constexpr uint32_t CTRL_DT_MS = 1000 / CTRL_FREQ_HZ;  // 50 ms period

// ============================================================================
// State Machine for Out-of-Range Handling (Per Motor)
// ============================================================================

static SystemState current_state[NUM_MOTORS] = {NORMAL_OPERATION, NORMAL_OPERATION, NORMAL_OPERATION, NORMAL_OPERATION, NORMAL_OPERATION};
static uint32_t reverse_start_time[NUM_MOTORS] = {0, 0, 0, 0, 0};

// ============================================================================
// Distance Range Tracking (Per Motor)
// ============================================================================

static DistanceRange current_range[NUM_MOTORS] = {RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN};
static DistanceRange previous_range[NUM_MOTORS] = {RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN, RANGE_UNKNOWN};

// ============================================================================
// Local Variables (Core 1)
// ============================================================================

static uint16_t pressure_pads_mv[NUM_MOTORS] = {0};  // Raw mV readings (for logging)
static uint16_t prestress_mv[NUM_MOTORS] = {0};       // Pre-stress values captured at init (mV)
static uint16_t maxstress_mv[NUM_MOTORS] = {0};       // Max stress values at 100% PWM (mV)
static float pressure_normalized[NUM_MOTORS] = {0.0f}; // Normalized pressure 0-100 per motor
static float duty_cycles[NUM_MOTORS] = {0.0f};
static float setpoints[NUM_MOTORS] = {0.0f};         // Individual setpoints per motor (0-100%)
static uint32_t last_control_ms = 0;

// Potentiometer readings (0-3300 mV range for 10K pots with 3.3V reference)
static uint16_t potentiometer_mv[NUM_POTENTIOMETERS] = {0};  // Raw mV readings

// Force scaling from potentiometer 1
// Pot at min (0 mV)    → CLOSE=60%, scaled proportionally for MEDIUM and FAR
// Pot at max (3300 mV) → CLOSE=100%, scaled proportionally for MEDIUM and FAR
constexpr float FORCE_SCALE_MIN = 0.60f;   // Minimum scale (pot at 0%)
constexpr float FORCE_SCALE_MAX = 1.00f;   // Maximum scale (pot at 100%)
constexpr float POT_MV_MIN = 0.0f;         // Potentiometer minimum voltage (mV)
constexpr float POT_MV_MAX = 3300.0f;      // Potentiometer maximum voltage (mV)

// Current force scale factor (updated from potentiometer 1)
static float force_scale = 1.0f;

// ============================================================================
// Distance Threshold Scaling from Potentiometer 2
// ============================================================================
// Pot at 0%   → scale = 0.5 (FAR out at 150 cm)
// Pot at 50%  → scale = 1.0 (FAR out at 300 cm - reference)
// Pot at 100% → scale = 1.5 (FAR out at 450 cm)
constexpr float DIST_SCALE_MIN = 0.50f;    // Minimum scale (pot at 0%)
constexpr float DIST_SCALE_MAX = 1.50f;    // Maximum scale (pot at 100%)

// Current distance scale factor (updated from potentiometer 2)
static float distance_scale = 1.0f;

/**
 * @brief Calculate distance scale factor from potentiometer 2 reading
 * @param pot_mv Potentiometer reading in millivolts (0-3300)
 * @return Scale factor (DIST_SCALE_MIN to DIST_SCALE_MAX)
 *
 * Maps potentiometer position to distance threshold scaling:
 * - Pot at 0 mV    → scale = 0.5 (closer detection, FAR out at 150cm)
 * - Pot at 1650 mV → scale = 1.0 (reference values)
 * - Pot at 3300 mV → scale = 1.5 (farther detection, FAR out at 450cm)
 */
float calculateDistanceScale(uint16_t pot_mv) {
    float pot_normalized = (float)pot_mv / POT_MV_MAX;

    // Clamp to 0-1 range
    if (pot_normalized < 0.0f) pot_normalized = 0.0f;
    if (pot_normalized > 1.0f) pot_normalized = 1.0f;

    // Linear interpolation between min and max scale
    return DIST_SCALE_MIN + pot_normalized * (DIST_SCALE_MAX - DIST_SCALE_MIN);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * @brief Map pressure pad mV reading to 0-100 range for a specific motor
 * @param motor_index Motor index (0 to NUM_MOTORS-1)
 * @param mv_reading Current millivolt reading
 * @return Normalized value 0-100 (clamped)
 *
 * Uses prestress_mv as min (0%) and maxstress_mv * 0.95 as max (100%)
 * Each motor has its own calibration based on captured values
 */
float mapPressureToPercent(int motor_index, uint16_t mv_reading) {
    float min_val = (float)prestress_mv[motor_index];
    float max_val = (float)maxstress_mv[motor_index] * 0.95f;  // 95% of max for margin

    // Avoid division by zero
    if (max_val <= min_val) {
        return 0.0f;
    }

    float normalized = ((float)mv_reading - min_val) / (max_val - min_val) * 100.0f;

    // Clamp to 0-100 range
    if (normalized < 0.0f) normalized = 0.0f;
    if (normalized > 100.0f) normalized = 100.0f;

    return normalized;
}

/**
 * @brief Calculate force scale factor from potentiometer 1 reading
 * @param pot_mv Potentiometer reading in millivolts (0-3300)
 * @return Scale factor (FORCE_SCALE_MIN to FORCE_SCALE_MAX)
 *
 * Maps potentiometer position to force scaling:
 * - Pot at 0 mV    → scale = 0.60 (60% of base setpoints)
 * - Pot at 3300 mV → scale = 1.00 (100% of base setpoints)
 */
float calculateForceScale(uint16_t pot_mv) {
    float pot_normalized = (float)pot_mv / POT_MV_MAX;

    // Clamp to 0-1 range
    if (pot_normalized < 0.0f) pot_normalized = 0.0f;
    if (pot_normalized > 1.0f) pot_normalized = 1.0f;

    // Linear interpolation between min and max scale
    return FORCE_SCALE_MIN + pot_normalized * (FORCE_SCALE_MAX - FORCE_SCALE_MIN);
}

// ============================================================================
// Setup Function
// ============================================================================

void setup() {
    // Initialize serial communication
    Serial.begin(115200);
    delay(3000);  // Allow time to open serial monitor

    Serial.println();
    Serial.println();
    Serial.println("==================================================");
    Serial.println("ESP32-S3 BOOT SEQUENCE STARTED");
    Serial.println("==================================================");
    Serial.flush();
    delay(100);

    Serial.println("4-Motor Independent PI Control System");
    Serial.println("With Servo Sweep and TOF Distance Sensing");
    Serial.println("========================================");
    Serial.print("Control Mode: ");
    Serial.println(CONTROL_MODE_NAME);
    Serial.print("Protocol: ");
    Serial.println(PROTOCOL_NAME);
    Serial.print("Logging Rate: ");
    Serial.println(LOGGING_RATE_NAME);
    Serial.print("Sweep Mode: ");
    Serial.println(SWEEP_MODE_NAME);
    Serial.println("========================================");
    Serial.println();
    Serial.flush();

    // Initialize command handler for runtime configuration
    Serial.println("Initializing command handler...");
    initCommandHandler();
    Serial.flush();
    delay(100);

    // ========================================================================
    // HARDWARE INITIALIZATION - DIAGNOSTIC MODE
    // ========================================================================
    // Enable/disable components one by one to find the issue
    // Set to true to enable, false to skip
    // ========================================================================

    const bool ENABLE_TOF = true;           // Test 1: TOF sensor and servo
    const bool ENABLE_ULTRASONIC = true;    // Test 2: Ultrasonic sensor
    const bool ENABLE_PRESSURE_PADS = true; // Test 3: Pressure pads
    const bool ENABLE_MOTORS = true;        // Test 4: Motors
    const bool ENABLE_PI = true;            // Test 5: PI controllers
    const bool ENABLE_CORE0_TASKS = true;   // Test 6: Core 0 tasks

    Serial.println("\n========================================");
    Serial.println("DIAGNOSTIC MODE - Hardware Test");
    Serial.println("========================================");
    Serial.print("TOF Sensor:     "); Serial.println(ENABLE_TOF ? "ENABLED" : "DISABLED");
    Serial.print("Ultrasonic:     "); Serial.println(ENABLE_ULTRASONIC ? "ENABLED" : "DISABLED");
    Serial.print("Pressure Pads:  "); Serial.println(ENABLE_PRESSURE_PADS ? "ENABLED" : "DISABLED");
    Serial.print("Motors:         "); Serial.println(ENABLE_MOTORS ? "ENABLED" : "DISABLED");
    Serial.print("PI Controllers: "); Serial.println(ENABLE_PI ? "ENABLED" : "DISABLED");
    Serial.print("Core 0 Tasks:   "); Serial.println(ENABLE_CORE0_TASKS ? "ENABLED" : "DISABLED");
    Serial.println("========================================\n");
    Serial.flush();
    delay(1000);

    // Initialize hardware modules
    Serial.println("Initializing hardware...\n");
    Serial.flush();
    delay(100);

    // Test 1: TOF sensor and servo
    if (ENABLE_TOF) {
        Serial.print("  [1/6] TOF sensor and servo... ");
        Serial.flush();
        initTOFSensor();
        Serial.println("OK");
        Serial.flush();
        delay(500);
    } else {
        Serial.println("  [1/6] TOF sensor: SKIPPED");
        Serial.flush();
        delay(100);
    }

    // Test 2: Ultrasonic sensor
    if (ENABLE_ULTRASONIC) {
        Serial.print("  [2/6] Ultrasonic sensor... ");
        Serial.flush();
        initUltrasonicSensor();
        Serial.println("OK");
        Serial.flush();
        delay(500);
    } else {
        Serial.println("  [2/6] Ultrasonic sensor: SKIPPED");
        Serial.flush();
        delay(100);
    }

    // Test 3: Pressure pads (and multiplexer)
    if (ENABLE_PRESSURE_PADS) {
        Serial.print("  [3/6] Pressure pads... ");
        Serial.flush();
        initPressurePads();
        Serial.println("OK");

        // Capture pre-stress values at initialization
        Serial.print("       Capturing pre-stress values... ");
        Serial.flush();
        readAllPadsMilliVolts(prestress_mv, PP_SAMPLES);
        Serial.println("OK");

        // Print captured pre-stress values
        Serial.print("       Pre-stress (mV): ");
        for (int i = 0; i < NUM_MOTORS; i++) {
            Serial.print(prestress_mv[i]);
            if (i < NUM_MOTORS - 1) Serial.print(", ");
        }
        Serial.println();

        Serial.flush();
        delay(500);
    } else {
        Serial.println("  [3/6] Pressure pads: SKIPPED");
        Serial.flush();
        delay(100);
    }

    // Test 4: Motors
    if (ENABLE_MOTORS) {
        Serial.print("  [4/6] Motors... ");
        Serial.flush();
        initMotorSystem();
        Serial.println("OK");
        Serial.flush();
        delay(500);
    } else {
        Serial.println("  [4/6] Motors: SKIPPED");
        Serial.flush();
        delay(100);
    }

    // Test 5: PI controllers
    if (ENABLE_PI) {
        Serial.print("  [5/6] PI controllers... ");
        Serial.flush();
        initPIController();
        Serial.println("OK");
        Serial.flush();
        delay(500);
    } else {
        Serial.println("  [5/6] PI controllers: SKIPPED");
        Serial.flush();
        delay(100);
    }

    // Test 6: Core 0 tasks
    if (ENABLE_CORE0_TASKS) {
        Serial.println("\n  [6/6] Starting Core 0 tasks...");
        Serial.flush();
        initCore0Tasks();
        Serial.println("       Core 0 tasks: OK");
        Serial.flush();
        delay(500);
    } else {
        Serial.println("  [6/6] Core 0 tasks: SKIPPED");
        Serial.flush();
        delay(100);
    }

    Serial.println();
    Serial.println("Initialization complete!");
    Serial.println("Starting PI control loop on Core 1 at 50 Hz...");
    Serial.println();
    Serial.flush();
        Serial.println("Put all motors in contact with the head");
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorForward(i,60);
    }
    delay(3000);
    Serial.println("Release the pressure");
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
        motorReverse(i,60);
    }
    delay(500);
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
    }
    Serial.println("Store pretension value");
    readAllPadsMilliVolts(prestress_mv, PP_SAMPLES);

    // Print prestress values
    Serial.print("Prestress (mV): ");
    for (int i = 0; i < NUM_MOTORS; i++) {
        Serial.print("M");
        Serial.print(i + 1);
        Serial.print("=");
        Serial.print(prestress_mv[i]);
        if (i < NUM_MOTORS - 1) Serial.print(", ");
    }
    Serial.println();

    // ========================================================================
    // Capture max stress at 100% PWM (2 measurements averaged)
    // ========================================================================
    uint16_t maxstress_measure1[NUM_MOTORS] = {0};
    uint16_t maxstress_measure2[NUM_MOTORS] = {0};

    // First measurement
    Serial.println("\n[1/2] Applying 100% PWM to capture max stress...");
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorForward(i, 100);  // 100% PWM
    }
    delay(3000);  // Wait for pressure to stabilize

    // Read first max stress values
    readAllPadsMilliVolts(maxstress_measure1, PP_SAMPLES);

    // Print first measurement
    Serial.print("Maxstress #1 (mV): ");
    for (int i = 0; i < NUM_MOTORS; i++) {
        Serial.print("M");
        Serial.print(i + 1);
        Serial.print("=");
        Serial.print(maxstress_measure1[i]);
        if (i < NUM_MOTORS - 1) Serial.print(", ");
    }
    Serial.println();

    // Release pressure
    Serial.println("Releasing pressure...");
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
        motorReverse(i, 60);
    }
    delay(500);
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
    }
    delay(1000);  // Wait before second measurement

    // Second measurement
    Serial.println("\n[2/2] Applying 100% PWM to capture max stress...");
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorForward(i, 100);  // 100% PWM
    }
    delay(3000);  // Wait for pressure to stabilize

    // Read second max stress values
    readAllPadsMilliVolts(maxstress_measure2, PP_SAMPLES);

    // Print second measurement
    Serial.print("Maxstress #2 (mV): ");
    for (int i = 0; i < NUM_MOTORS; i++) {
        Serial.print("M");
        Serial.print(i + 1);
        Serial.print("=");
        Serial.print(maxstress_measure2[i]);
        if (i < NUM_MOTORS - 1) Serial.print(", ");
    }
    Serial.println();

    // Stop all motors
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
    }

    // Calculate average of both measurements
    for (int i = 0; i < NUM_MOTORS; i++) {
        maxstress_mv[i] = (maxstress_measure1[i] + maxstress_measure2[i]) / 2;
    }

    // Print averaged maxstress values
    Serial.print("Maxstress AVG (mV): ");
    for (int i = 0; i < NUM_MOTORS; i++) {
        Serial.print("M");
        Serial.print(i + 1);
        Serial.print("=");
        Serial.print(maxstress_mv[i]);
        if (i < NUM_MOTORS - 1) Serial.print(", ");
    }
    Serial.println();

    // Release pressure after max stress capture
    Serial.println("Releasing pressure...");
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorReverse(i, 60);
    }
    delay(500);
    for (int i = 0; i < NUM_MOTORS; ++i) {
        motorBrake(i);
    }

    // Small delay before starting control loop
    delay(3000);
}

// ============================================================================
// Main Loop (Core 1 - PI Control)
// ============================================================================

void loop() {
    // Process incoming serial commands (non-blocking)
    processSerialCommand();

    uint32_t current_time = millis();

    // Run control loop at fixed frequency (50 Hz)
    if (current_time - last_control_ms >= CTRL_DT_MS) {
        last_control_ms = current_time;

        // ====================================================================
        // Step 1: Read all pressure pads
        // ====================================================================

        readAllPadsMilliVolts(pressure_pads_mv, PP_SAMPLES);

        // Map each pressure pad to normalized 0-100 range
        for (int i = 0; i < NUM_MOTORS; ++i) {
            pressure_normalized[i] = mapPressureToPercent(i, pressure_pads_mv[i]);
        }

        // Print normalized pressure values (0-100%)
        Serial.print("Pressure (%): ");
        for (int i = 0; i < NUM_MOTORS; i++) {
            Serial.print("M");
            Serial.print(i + 1);
            Serial.print("=");
            Serial.print(pressure_normalized[i], 1);  // 1 decimal place
            if (i < NUM_MOTORS - 1) Serial.print(", ");
        }
        Serial.println();

        // ====================================================================
        // Step 1b: Read potentiometers and calculate force scale
        // ====================================================================

        for (int i = 0; i < NUM_POTENTIOMETERS; ++i) {
            potentiometer_mv[i] = readMuxMilliVoltsAveraged(POT_CHANNELS[i], POT_SAMPLES);
        }

        // DEBUG: Print potentiometer raw values
        Serial.print("POT mV: P1=");
        Serial.print(potentiometer_mv[0]);
        Serial.print(" (ch");
        Serial.print(POT_CHANNELS[0]);
        Serial.print("), P2=");
        Serial.print(potentiometer_mv[1]);
        Serial.print(" (ch");
        Serial.print(POT_CHANNELS[1]);
        Serial.println(")");

        // Calculate force scale from potentiometer 1 (index 0)
        // Scale ranges from 0.60 (pot at min) to 1.00 (pot at max)
        force_scale = calculateForceScale(potentiometer_mv[0]);

        // Calculate distance scale from potentiometer 2 (index 1)
        // Scale ranges from 0.50 (pot at min) to 1.50 (pot at max)
        distance_scale = calculateDistanceScale(potentiometer_mv[1]);

        // Update dynamic distance thresholds based on potentiometer 2
        // Formula: threshold = 50 + (base - 50) * scale
        // This keeps 50 cm fixed while scaling everything above it
        distance_close_max = DISTANCE_CLOSE_MIN + (DISTANCE_CLOSE_MAX_BASE - DISTANCE_CLOSE_MIN) * distance_scale;
        distance_medium_max = DISTANCE_CLOSE_MIN + (DISTANCE_MEDIUM_MAX_BASE - DISTANCE_CLOSE_MIN) * distance_scale;
        distance_far_max = DISTANCE_CLOSE_MIN + (DISTANCE_FAR_MAX_BASE - DISTANCE_CLOSE_MIN) * distance_scale;

        // ====================================================================
        // Step 2-5: Process each motor independently (different sectors)
        // ====================================================================

        // Each motor uses its own sector's minimum distance
        for (int i = 0; i < NUM_MOTORS; ++i) {
            // Step 2: Get minimum distance for this motor's sector
            // (already includes comparison with ultrasonic in sweep task)
            float min_distance_cm = getMinDistance(i);

            // Update shared distance for this motor (for logging)
            shared_tof_distances[i] = min_distance_cm;

            // Step 3: Classify distance into range for this motor
            current_range[i] = getDistanceRange(min_distance_cm);

            // Skip this motor if distance hasn't been initialized yet (999.0f = no valid reading)
            if (min_distance_cm >= 999.0f) {
                setpoints[i] = -1.0f;  // Invalid setpoint, motor will stop
                previous_range[i] = current_range[i];  // Update previous range
                continue;
            }

            // ================================================================
            // NORMALIZED MODE: Setpoints scaled by potentiometer 1
            // ================================================================
            // Base setpoints (at pot max / scale=1.0):
            //   FAR (200-300cm)    → 50%
            //   MEDIUM (100-200cm) → 75%
            //   CLOSE (50-100cm)   → 100%
            // At pot min (scale=0.6): FAR→30%, MEDIUM→45%, CLOSE→60%
            // At pot max (scale=1.0): FAR→50%, MEDIUM→75%, CLOSE→100%
            // ================================================================

            // Get base setpoint and apply force scale from potentiometer
            float base_setpoint = calculateSetpoint(current_range[i], 0.0f);
            if (base_setpoint > 0.0f) {
                setpoints[i] = base_setpoint * force_scale;
            } else {
                setpoints[i] = base_setpoint;  // Keep invalid setpoint as-is
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
        float temp_pressures[NUM_MOTORS];
        float temp_duties[NUM_MOTORS] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};

        // Track state transitions for each motor
        // Simplified: OUT_OF_BOUNDS -> reverse for RELEASE_TIME_MS -> wait for valid
        for (int i = 0; i < NUM_MOTORS; ++i) {
            int state_index = i;  // Each motor uses own state

            // Check if this motor is out of bounds or has invalid setpoint
            bool is_out_of_bounds = (current_range[i] == RANGE_OUT_OF_BOUNDS ||
                                     setpoints[i] < 0.0f);
            bool is_valid = !(current_range[i] == RANGE_OUT_OF_BOUNDS ||
                             current_range[i] == RANGE_UNKNOWN ||
                             setpoints[i] < 0.0f);

            switch (current_state[state_index]) {
                case NORMAL_OPERATION:
                    if (is_out_of_bounds) {
                        // Transition to deflating state and start timer immediately
                        current_state[state_index] = OUT_OF_RANGE_DEFLATING;
                        reverse_start_time[state_index] = current_time;
                        duty_cycles[i] = -REVERSE_DUTY_PCT;
                    }
                    else {
                        // Prepare for PI control (using normalized values 0-100%)
                        temp_setpoints[i] = setpoints[i];
                        temp_pressures[i] = pressure_normalized[i];
                    }
                    break;

                case OUT_OF_RANGE_DEFLATING:
                    // Priority 1: If distance is now valid, return to normal operation
                    if (is_valid) {
                        current_state[state_index] = NORMAL_OPERATION;
                        duty_cycles[i] = 0.0f;
                    }
                    // Priority 2: Reverse for fixed time, then wait
                    else if (current_time - reverse_start_time[state_index] >= RELEASE_TIME_MS) {
                        current_state[state_index] = WAITING_FOR_VALID_READING;
                        duty_cycles[i] = 0.0f;
                    }
                    // Still deflating
                    else {
                        duty_cycles[i] = -REVERSE_DUTY_PCT;
                    }
                    break;

                case OUT_OF_RANGE_RELEASING:
                    // State no longer used, but kept for compatibility
                    // Immediately transition to waiting
                    current_state[state_index] = WAITING_FOR_VALID_READING;
                    duty_cycles[i] = 0.0f;
                    break;

                case WAITING_FOR_VALID_READING:
                    // Return to normal when distance is valid
                    if (is_valid) {
                        current_state[state_index] = NORMAL_OPERATION;
                    }
                    else {
                        // Still waiting - motor stopped
                        duty_cycles[i] = 0.0f;
                    }
                    break;
            }
        }

        // Run PI control only for motors in NORMAL_OPERATION state
        // Using normalized values (0-100%) for both setpoints and pressure readings
        controlStepNormalized(temp_setpoints, temp_pressures, temp_duties);

        // Apply motor commands based on state (AFTER PI control to override for non-NORMAL motors)
        for (int i = 0; i < NUM_MOTORS; ++i) {
            if (current_state[i] == NORMAL_OPERATION) {
                // Use PI controller output
                duty_cycles[i] = temp_duties[i];
                // PI controller already applied motor commands in controlStep
            }
            else if (current_state[i] == OUT_OF_RANGE_DEFLATING ||
                     current_state[i] == OUT_OF_RANGE_RELEASING) {
                // Override with deflation/release command (all reverse)
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
            shared_setpoints_pct[i] = setpoints[i];        // Setpoint in % (0-100)
            shared_pressure_pct[i] = pressure_normalized[i];  // Normalized pressure (0-100%)
            shared_duty_cycles[i] = duty_cycles[i];
        }

        // Update potentiometer scales and distance thresholds for logging
        shared_force_scale = force_scale;
        shared_distance_scale = distance_scale;
        shared_dist_close_max = distance_close_max;
        shared_dist_medium_max = distance_medium_max;
        shared_dist_far_max = distance_far_max;
    }

    // Small delay to prevent watchdog triggers
    delay(1);
}
