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

// ============================================================================
// Distance Ranges and Setpoints
// ============================================================================

// Distance range definitions (in cm)
constexpr float DISTANCE_FAR_MIN = 200.0f;      // Far range start (cm)
constexpr float DISTANCE_FAR_MAX = 300.0f;      // Far range end (cm)
constexpr float DISTANCE_MEDIUM_MIN = 100.0f;   // Medium range start (cm)
constexpr float DISTANCE_MEDIUM_MAX = 200.0f;   // Medium range end (cm)
constexpr float DISTANCE_CLOSE_MIN = 50.0f;     // Close range start (cm)
constexpr float DISTANCE_CLOSE_MAX = 100.0f;    // Close range end (cm)

// Setpoint values for each range (in Newtons)
// Note: FAR range setpoint is calculated dynamically (baseline + offset)
// where baseline is captured when entering FAR range to account for friction variations
constexpr float SECURITY_OFFSET_N = 0.5f;       // Offset added to baseline in FAR range (N)
constexpr float SETPOINT_FAR_N = 1.0f;          // Setpoint for far range (200-300cm)
constexpr float SETPOINT_MEDIUM_N = 2.0f;       // Setpoint for medium range (100-200cm)
constexpr float SETPOINT_CLOSE_N = 4.0f;       // Setpoint for close range (50-100cm)

// Out-of-range safety parameters (in Newtons)
constexpr float SAFE_PRESSURE_THRESHOLD_N = 5.0f;     // Pressure must drop below this before release (N)
constexpr uint32_t RELEASE_TIME_MS = 1300;             // Additional reverse time after reaching threshold (ms)
constexpr float REVERSE_DUTY_PCT = 60.0f;             // Reverse duty cycle for deflation (%)

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

// ============================================================================
// Shared Variables (Protected by Mutex)
// ============================================================================

extern SemaphoreHandle_t distanceMutex;

// MODE_A: Single distance/angle for fixed servo
// MODE_B: Array of 5 distances/angles (one per motor sector)
extern volatile float shared_min_distance[5];  // Minimum distance per motor sector
extern volatile int shared_best_angle[5];      // Angle of minimum distance per motor sector
extern volatile bool sweep_active;

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
