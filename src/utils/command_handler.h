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

// Configuration mutex for thread-safe access
extern SemaphoreHandle_t configMutex;

// ============================================================================
// Command Processing Functions
// ============================================================================

/**
 * @brief Initialize command handler and runtime configuration
 *
 * Creates mutex and initializes runtime variables with default values
 * from servo_config.h
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
