/**
 * @file tof_sensor.h
 * @brief TOF (Time-of-Flight) distance sensor with servo sweep
 *
 * Provides TOF sensor reading functionality with servo sweep to find
 * minimum distance. Includes dynamic setpoint calculation based on
 * distance ranges and state machine for out-of-range handling.
 */

#ifndef TOF_SENSOR_H
#define TOF_SENSOR_H

#include <Arduino.h>
#include <ESP32Servo.h>
#include <ESP32PWM.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "../config/system_config.h"

// ============================================================================
// Distance Ranges and Setpoints
// ============================================================================

// Distance range definitions - BASE values (at scale = 1.0, pot at 50%)
// These are the reference values, actual thresholds are scaled by potentiometer 2
constexpr float DISTANCE_CLOSE_MIN_BASE = 50.0f;    // Fixed - sensor limitation
constexpr float DISTANCE_CLOSE_MAX_BASE = 100.0f;   // Base: 50 + 50*scale
constexpr float DISTANCE_MEDIUM_MAX_BASE = 200.0f;  // Base: 50 + 150*scale
constexpr float DISTANCE_FAR_MAX_BASE = 300.0f;     // Base: 50 + 250*scale

// Dynamic distance thresholds (updated by potentiometer 2)
// Formula: threshold = 50 + (base - 50) * scale
// Scale ranges from 0.5 (pot at 0%) to 1.5 (pot at 100%)
extern float distance_close_max;   // CLOSE/MEDIUM boundary (75-125 cm)
extern float distance_medium_max;  // MEDIUM/FAR boundary (125-275 cm)
extern float distance_far_max;     // FAR/OUT boundary (150-450 cm)

// Fixed threshold (sensor limitation)
constexpr float DISTANCE_CLOSE_MIN = 50.0f;  // Always 50 cm (sensor minimum)

// ============================================================================
// Setpoint Values - Mode-specific
// ============================================================================
// Conversion factor: ~80-100 mV per Newton (varies by sensor)
// Example: 1N ≈ 80mV, 2N ≈ 160mV, 4N ≈ 320mV
// ============================================================================

// ============================================================================
// Setpoint Values - Normalized (0-100%)
// ============================================================================
// All setpoints are now in percentage (0-100) based on calibrated min/max
// 0% = prestress (no pressure), 100% = 95% of maxstress
// ============================================================================

// Maximum force output when potentiometer is at 100%
// Adjust these values to change the ratio between ranges
// The potentiometer scales all of them proportionally (master volume)
constexpr float SETPOINT_FAR = 50.0f;           // Setpoint for FAR range (200-300cm) - 50%
constexpr float SETPOINT_MEDIUM = 75.0f;        // Setpoint for MEDIUM range (100-200cm) - 75%
constexpr float SETPOINT_CLOSE = 100.0f;        // Setpoint for CLOSE range (50-100cm) - 100%

// Security offset (percentage points to add/subtract)
constexpr float SECURITY_OFFSET = 5.0f;         // Offset in percentage points

// Safety threshold for out-of-range deflation (percentage)
constexpr float SAFE_PRESSURE_THRESHOLD = 10.0f; // Pressure must drop below 10% before release

// Legacy aliases for backward compatibility (deprecated - use generic names above)
constexpr float SECURITY_OFFSET_N = SECURITY_OFFSET;
constexpr float SETPOINT_FAR_N = SETPOINT_FAR;
constexpr float SETPOINT_MEDIUM_N = SETPOINT_MEDIUM;
constexpr float SETPOINT_CLOSE_N = SETPOINT_CLOSE;
constexpr float SAFE_PRESSURE_THRESHOLD_N = SAFE_PRESSURE_THRESHOLD;

// Out-of-range safety parameters (mode-independent)
constexpr uint32_t RELEASE_TIME_MS = 600;          // Additional reverse time after reaching threshold (ms)
constexpr float REVERSE_DUTY_PCT = 60.0f;           // Reverse duty cycle for deflation (%)

// ============================================================================
// Enumerations
// ============================================================================

/**
 * @brief Distance range classification
 */
enum DistanceRange {
    RANGE_UNKNOWN,           // Invalid or error reading
    RANGE_FAR,               // 200-300 cm
    RANGE_MEDIUM,            // 100-200 cm
    RANGE_CLOSE,             // 50-100 cm
    RANGE_OUT_OF_BOUNDS      // Outside valid ranges
};

/**
 * @brief System state for out-of-range handling
 */
enum SystemState {
    NORMAL_OPERATION,          // Normal PI control active
    OUT_OF_RANGE_DEFLATING,    // Actively deflating (reverse until pressure <= threshold)
    OUT_OF_RANGE_RELEASING,    // Continue reversing for 500ms after reaching threshold
    WAITING_FOR_VALID_READING  // Motors stopped, waiting for sensor to return to valid range
};

/**
 * @brief Active sensor type for distance detection
 */
enum ActiveSensor {
    SENSOR_NONE,       // No valid reading from either sensor
    SENSOR_TOF,        // TOF sensor is providing the minimum distance
    SENSOR_ULTRASONIC, // Ultrasonic sensor is providing the minimum distance
    SENSOR_BOTH_EQUAL  // Both sensors have equal readings
};

// ============================================================================
// Shared Variables (Protected by Mutex)
// ============================================================================

extern SemaphoreHandle_t distanceMutex;

// MODE_A: Single distance/angle for fixed servo
// MODE_B: Array of 5 distances/angles (one per motor sector)
extern volatile float shared_min_distance[5];  // Minimum distance per motor sector
extern volatile int shared_best_angle[5];      // Angle of minimum distance per motor sector
extern volatile bool sweep_active;

// Active sensor tracking (which sensor provided the minimum distance)
extern volatile ActiveSensor shared_active_sensor;  // Current sensor providing min distance

// ============================================================================
// Public Functions
// ============================================================================

/**
 * @brief Initialize TOF sensor and servo system
 *
 * Configures serial communication with TOF sensor and initializes servo.
 * Creates mutex for thread-safe access to shared variables.
 * Must be called once during setup.
 */
void initTOFSensor();

/**
 * @brief Read distance from TOF sensor
 *
 * Reads a single distance measurement from the TOF sensor.
 * Handles serial communication protocol and checksum verification.
 *
 * @return Distance in centimeters, or -1.0 on error
 */
float tofGetDistance();

/**
 * @brief Classify distance into range category
 *
 * @param distance Distance in centimeters
 * @return DistanceRange category
 */
DistanceRange getDistanceRange(float distance);

/**
 * @brief Calculate setpoint based on distance range (in Newtons)
 *
 * Computes the target force setpoint based on the current distance range.
 * For FAR range, uses baseline force captured when entering FAR range.
 *
 * @param range Current distance range
 * @param baseline_force_n Baseline force captured when entering FAR range (N)
 * @return Setpoint in Newtons, or -1.0 if invalid
 */
float calculateSetpoint(DistanceRange range, float baseline_force_n);

/**
 * @brief Get minimum distance for a specific motor (thread-safe)
 *
 * MODE_A: All motors use index 0 (fixed servo, single distance)
 * MODE_B: Each motor gets distance from its sector (0-4)
 *
 * @param motor_index Motor index (0-4)
 * @return Minimum distance in centimeters for that motor's sector
 */
float getMinDistance(int motor_index);

/**
 * @brief Get optimal angle for a specific motor (thread-safe)
 *
 * MODE_A: All motors use index 0 (fixed servo angle)
 * MODE_B: Each motor gets angle from its sector (0-4)
 *
 * @param motor_index Motor index (0-4)
 * @return Optimal servo angle in degrees for that motor's sector
 */
int getBestAngle(int motor_index);

/**
 * @brief Servo sweep task (runs on Core 0)
 *
 * FreeRTOS task that continuously sweeps the servo from min to max angle,
 * reading TOF distance at each step. Updates shared_min_distance and
 * shared_best_angle variables with mutex protection.
 *
 * @param parameter Task parameter (unused)
 */
void servoSweepTask(void* parameter);

#endif // TOF_SENSOR_H
