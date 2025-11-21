/**
 * @file command_handler.h
 * @brief Serial command handler for ESP32 runtime configuration
 *
 * Handles incoming text-based commands from frontend via USB Serial:
 * - SWEEP:ENABLE / SWEEP:DISABLE
 * - SERVO:ANGLE:<n>
 * - SWEEP:MIN:<n> / SWEEP:MAX:<n> / SWEEP:STEP:<n>
 *
 * See docs/command-protocol.md for full command specification
 */

#ifndef COMMAND_HANDLER_H
#define COMMAND_HANDLER_H

#include <Arduino.h>

// ============================================================================
// Runtime Servo Configuration (Replaces compile-time constexpr)
// ============================================================================

// Sweep enable/disable flag (volatile for FreeRTOS cross-core access)
extern volatile bool sweep_enabled;

// Runtime servo configuration (can be modified via commands)
extern volatile int servo_min_angle;
extern volatile int servo_max_angle;
extern volatile int servo_step;
extern volatile int servo_settle_ms;
extern volatile int servo_reading_delay_ms;

// Manual servo angle (used when sweep is disabled)
extern volatile int servo_manual_angle;

// Motor sector assignments
extern volatile int sector_motor_1_min;
extern volatile int sector_motor_1_max;
extern volatile int sector_motor_2_min;
extern volatile int sector_motor_2_max;
extern volatile int sector_motor_3_min;
extern volatile int sector_motor_3_max;
extern volatile int sector_motor_4_min;
extern volatile int sector_motor_4_max;

// Sampling configuration
extern volatile int pp_samples;
extern volatile int mux_settle_us;

// Distance ranges (cm)
extern volatile float distance_close_min;
extern volatile float distance_medium_min;
extern volatile float distance_far_min;
extern volatile float distance_far_max;

// Setpoints (mV)
extern volatile float setpoint_close_mv;
extern volatile float setpoint_medium_mv;
extern volatile float security_offset_mv;

// Safety thresholds
extern volatile float safe_pressure_threshold_mv;
extern volatile int release_time_ms;

// PI gains
extern volatile float pi_kp;
extern volatile float pi_ki;

// Control limits
extern volatile float duty_max;
extern volatile float duty_min;
extern volatile float min_run;

// Configuration mutex for thread-safe access
extern SemaphoreHandle_t configMutex;

// ============================================================================
// Configuration Persistence Functions
// ============================================================================

/**
 * @brief Load configuration from NVS (non-volatile storage)
 *
 * Loads all runtime configuration variables from NVS.
 * Falls back to default values if NVS data not found.
 *
 * @return true if loaded from NVS, false if using defaults
 */
bool loadConfigFromNVS();

/**
 * @brief Save current configuration to NVS (default profile)
 *
 * Persists all runtime configuration variables to NVS default profile.
 * Configuration will auto-load on next ESP32 boot.
 *
 * @return true if saved successfully, false on error
 */
bool saveConfigToNVS();

/**
 * @brief Send current configuration as JSON via Serial
 *
 * Sends complete configuration state to frontend for synchronization.
 * Format: JSON object with all configuration parameters
 */
void sendCurrentConfig();

// ============================================================================
// Command Processing Functions
// ============================================================================

/**
 * @brief Initialize command handler and runtime configuration
 *
 * Creates mutex, loads config from NVS (or defaults), and sets up command processing
 */
void initCommandHandler();

/**
 * @brief Process incoming serial commands
 *
 * Call this function in main loop to check for and process serial commands.
 * Non-blocking - returns immediately if no data available.
 *
 * Supported commands:
 * - SWEEP:ENABLE
 * - SWEEP:DISABLE
 * - SERVO:ANGLE:<n>
 * - SWEEP:MIN:<n>
 * - SWEEP:MAX:<n>
 * - SWEEP:STEP:<n>
 * - CONFIG:GET (sends current config as JSON)
 * - CONFIG:SAVE (saves current config to NVS default profile)
 * - CONFIG:RESET (resets to factory defaults)
 *
 * Note: Profile management (list/save/load named profiles) is handled by the frontend
 */
void processSerialCommand();

/**
 * @brief Send acknowledgment message to frontend
 *
 * @param command The command that was processed
 */
void sendAck(const String& command);

/**
 * @brief Send error message to frontend
 *
 * @param errorType Error category (e.g., "OUT_OF_RANGE", "INVALID_COMMAND")
 * @param detail Error details
 */
void sendError(const String& errorType, const String& detail);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * @brief Validate angle value (0-180 degrees)
 *
 * @param angle Angle to validate
 * @return true if valid, false otherwise
 */
bool validateAngle(int angle);

/**
 * @brief Validate sweep range (min < max, both 0-180)
 *
 * @param min Minimum angle
 * @param max Maximum angle
 * @return true if valid, false otherwise
 */
bool validateSweepRange(int min, int max);

/**
 * @brief Validate step size (1-20 degrees)
 *
 * @param step Step size to validate
 * @return true if valid, false otherwise
 */
bool validateStep(int step);

#endif // COMMAND_HANDLER_H
