/**
 * @file servo_config.h
 * @brief Servo and TOF sweep configuration
 *
 * This file contains all configurable parameters for the servo sweep mechanism
 * and TOF distance sensing. Adjust these values to tune the sweep behavior.
 */

#ifndef SERVO_CONFIG_H
#define SERVO_CONFIG_H

#include <Arduino.h>

// ============================================================================
// SERVO SWEEP ANGLES
// ============================================================================

/**
 * Minimum servo angle (degrees)
 * - Defines the starting position of the sweep
 * - Typically 0° for standard servo range
 */
constexpr int SERVO_MIN_ANGLE = 5;

/**
 * Maximum servo angle (degrees)
 * - Defines the ending position of the sweep
 * - Must be > SERVO_MIN_ANGLE
 * - Typical range: 0° to 180° (check your servo datasheet)
 */
constexpr int SERVO_MAX_ANGLE = 175;

/**
 * Angle increment per sweep step (degrees)
 * - Smaller values = more data points = slower sweep = higher resolution
 * - Larger values = fewer data points = faster sweep = lower resolution
 * - Recommended range: 1° to 5°
 * - Must be > 0
 */
constexpr int SERVO_STEP = 5;

// ============================================================================
// SERVO TIMING PARAMETERS
// ============================================================================

/**
 * Settling time after servo movement (milliseconds)
 * - Time to wait for servo to physically reach target angle
 * - Smaller values = faster sweep but may cause vibration/inaccuracy
 * - Larger values = slower sweep but more stable readings
 * - Recommended range: 5 ms to 20 ms depending on servo quality
 */
constexpr uint32_t SERVO_SETTLE_MS = 5;

/**
 * Delay between TOF readings during sweep (milliseconds)
 * - Additional delay after taking a TOF measurement
 * - Smaller values = faster sweep but may stress sensor
 * - Larger values = slower sweep but more reliable readings
 * - Recommended range: 5 ms to 50 ms
 *
 * IMPORTANT: This affects sweep speed in BOTH directions (forward/backward)
 */
constexpr uint32_t SERVO_READING_DELAY_MS = 5;

// ============================================================================
// MOTOR SECTOR ASSIGNMENTS
// ============================================================================
//
// Each motor is assigned a sector (angular range) of the total sweep.
// The TOF sensor scans the full range (SERVO_MIN_ANGLE to SERVO_MAX_ANGLE),
// and the minimum distance within each sector is used for that motor's control.
//
// IMPORTANT RULES:
// - Sectors must be continuous and non-overlapping
// - Sector MIN must be >= SERVO_MIN_ANGLE
// - Sector MAX must be <= SERVO_MAX_ANGLE
// - Sector boundaries should align: MOTOR_N_MAX should equal MOTOR_(N+1)_MIN
// - Total coverage: MOTOR_1_MIN to MOTOR_4_MAX should span SERVO_MIN_ANGLE to SERVO_MAX_ANGLE
// ============================================================================

/**
 * Motor 1 Sector (degrees)
 * - Leftmost sector in the sweep
 * - Default: 0° to 30° (30° range)
 */
constexpr int SECTOR_MOTOR_1_MIN = 5;
constexpr int SECTOR_MOTOR_1_MAX = 45;

/**
 * Motor 2 Sector (degrees)
 * - Center-left sector in the sweep
 * - Default: 30° to 60° (30° range)
 */
constexpr int SECTOR_MOTOR_2_MIN = 45;
constexpr int SECTOR_MOTOR_2_MAX = 90;

/**
 * Motor 3 Sector (degrees)
 * - Center-right sector in the sweep
 * - Default: 60° to 90° (30° range)
 */
constexpr int SECTOR_MOTOR_3_MIN = 90;
constexpr int SECTOR_MOTOR_3_MAX = 135;

/**
 * Motor 4 Sector (degrees)
 * - Rightmost sector in the sweep
 * - Default: 90° to 120° (30° range)
 */
constexpr int SECTOR_MOTOR_4_MIN = 135;
constexpr int SECTOR_MOTOR_4_MAX = 175;

// ============================================================================
// SWEEP PERFORMANCE CALCULATOR (Read-only - DO NOT MODIFY)
// ============================================================================

/**
 * Total number of angle steps in one full sweep
 * Calculated from: (MAX - MIN) / STEP
 */
constexpr int SWEEP_TOTAL_STEPS = (SERVO_MAX_ANGLE - SERVO_MIN_ANGLE) / SERVO_STEP + 1;

/**
 * Estimated time for one complete sweep (milliseconds)
 * Calculated from: steps × (settle_time + reading_delay)
 *
 * Note: This is approximate. Actual time includes TOF communication overhead.
 */
constexpr uint32_t SWEEP_ESTIMATED_TIME_MS = SWEEP_TOTAL_STEPS * (SERVO_SETTLE_MS + SERVO_READING_DELAY_MS);

/**
 * Estimated sweep frequency (Hz)
 * How many complete sweeps per second
 *
 * Note: In bidirectional mode, divide by 2 (forward + backward)
 */
constexpr float SWEEP_ESTIMATED_FREQ_HZ = 1000.0f / SWEEP_ESTIMATED_TIME_MS;

// ============================================================================
// CONFIGURATION VALIDATION (Compile-time checks)
// ============================================================================
//
// These static_assert checks will cause compilation to fail if you configure
// invalid values, helping catch errors early.
// ============================================================================

// Check servo angle range
static_assert(SERVO_MIN_ANGLE < SERVO_MAX_ANGLE,
    "ERROR: SERVO_MIN_ANGLE must be < SERVO_MAX_ANGLE");

static_assert(SERVO_STEP > 0,
    "ERROR: SERVO_STEP must be > 0");

// Check sector continuity and coverage
static_assert(SECTOR_MOTOR_1_MIN == SERVO_MIN_ANGLE,
    "WARNING: SECTOR_MOTOR_1_MIN should start at SERVO_MIN_ANGLE to avoid gaps");

static_assert(SECTOR_MOTOR_4_MAX == SERVO_MAX_ANGLE,
    "WARNING: SECTOR_MOTOR_4_MAX should end at SERVO_MAX_ANGLE to avoid gaps");

static_assert(SECTOR_MOTOR_1_MAX == SECTOR_MOTOR_2_MIN,
    "ERROR: Gap between Motor 1 and Motor 2 sectors");

static_assert(SECTOR_MOTOR_2_MAX == SECTOR_MOTOR_3_MIN,
    "ERROR: Gap between Motor 2 and Motor 3 sectors");

static_assert(SECTOR_MOTOR_3_MAX == SECTOR_MOTOR_4_MIN,
    "ERROR: Gap between Motor 3 and Motor 4 sectors");

// Check sector order
static_assert(SECTOR_MOTOR_1_MIN < SECTOR_MOTOR_1_MAX,
    "ERROR: Motor 1 sector MIN must be < MAX");

static_assert(SECTOR_MOTOR_2_MIN < SECTOR_MOTOR_2_MAX,
    "ERROR: Motor 2 sector MIN must be < MAX");

static_assert(SECTOR_MOTOR_3_MIN < SECTOR_MOTOR_3_MAX,
    "ERROR: Motor 3 sector MIN must be < MAX");

static_assert(SECTOR_MOTOR_4_MIN < SECTOR_MOTOR_4_MAX,
    "ERROR: Motor 4 sector MIN must be < MAX");

#endif // SERVO_CONFIG_H
