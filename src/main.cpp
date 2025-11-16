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
// State Machine for Out-of-Range Handling
// ============================================================================

static SystemState current_state = NORMAL_OPERATION;
static uint32_t reverse_start_time = 0;

// ============================================================================
// Distance Range Tracking
// ============================================================================

static DistanceRange current_range = RANGE_UNKNOWN;
static DistanceRange previous_range = RANGE_UNKNOWN;

// ============================================================================
// Local Variables (Core 1)
// ============================================================================

static uint16_t pressure_pads_mv[NUM_MOTORS] = {0};
static float duty_cycles[NUM_MOTORS] = {0.0f};
static float current_setpoint_mv = 0.0f;
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
    Serial.println("With Dynamic TOF Setpoint");
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
        // Step 1: Get minimum distance from TOF sweep (thread-safe)
        // ====================================================================

        float min_distance_cm = getMinDistance();
        shared_tof_distance = min_distance_cm;  // For logging

        // ====================================================================
        // Step 2: Classify distance into range
        // ====================================================================

        current_range = getDistanceRange(min_distance_cm);

        // ====================================================================
        // Step 3: Read all 4 pressure pads
        // ====================================================================

        readAllPadsMilliVolts(pressure_pads_mv, PP_SAMPLES);

        // Calculate average pressure for setpoint calculation (FAR range)
        float avg_pressure_mv = 0.0f;
        for (int i = 0; i < NUM_MOTORS; ++i) {
            avg_pressure_mv += pressure_pads_mv[i];
        }
        avg_pressure_mv /= NUM_MOTORS;

        // ====================================================================
        // Step 4: Calculate dynamic setpoint based on distance range
        // ====================================================================

        current_setpoint_mv = calculateSetpoint(current_range, avg_pressure_mv);

        // ====================================================================
        // Step 5: State machine for out-of-range handling
        // ====================================================================

        switch (current_state) {
            case NORMAL_OPERATION:
                // Check if distance is out of bounds
                if (current_range == RANGE_OUT_OF_BOUNDS || current_setpoint_mv < 0.0f) {
                    // Transition to reversing state
                    current_state = OUT_OF_RANGE_REVERSING;
                    reverse_start_time = current_time;

                    // Stop all motors and reverse
                    for (int i = 0; i < NUM_MOTORS; ++i) {
                        motorReverse(i, REVERSE_DUTY_PCT);
                    }

                    // Reset integrators to avoid windup
                    resetIntegrators();

                    Serial.println("WARNING: Out of range detected! Reversing motors...");
                }
                else {
                    // Normal PI control for all 4 motors
                    controlStep(current_setpoint_mv, pressure_pads_mv, duty_cycles);
                }
                break;

            case OUT_OF_RANGE_REVERSING:
                // Check if reverse time has elapsed
                if (current_time - reverse_start_time >= REVERSE_TIME_MS) {
                    // Stop reversing
                    stopAllMotors();

                    // Transition to waiting state
                    current_state = WAITING_FOR_VALID_READING;

                    Serial.println("Reverse complete. Waiting for valid distance reading...");
                }
                break;

            case WAITING_FOR_VALID_READING:
                // Wait for distance to return to valid range
                if (current_range != RANGE_OUT_OF_BOUNDS &&
                    current_range != RANGE_UNKNOWN &&
                    current_setpoint_mv > 0.0f) {

                    // Return to normal operation
                    current_state = NORMAL_OPERATION;
                    resetIntegrators();

                    Serial.println("Valid distance detected. Resuming normal operation.");
                }
                break;
        }

        // ====================================================================
        // Step 6: Update shared variables for logging (Core 0 task)
        // ====================================================================

        shared_setpoint_mv = current_setpoint_mv;

        for (int i = 0; i < NUM_MOTORS; ++i) {
            shared_pressure_pads_mv[i] = pressure_pads_mv[i];
            shared_duty_cycles[i] = duty_cycles[i];
        }

        // Track range transitions (for debugging)
        if (current_range != previous_range) {
            previous_range = current_range;
        }
    }

    // Small delay to prevent watchdog triggers
    delay(1);
}
