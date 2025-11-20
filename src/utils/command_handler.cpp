/**
 * @file command_handler.cpp
 * @brief Implementation of serial command handler for ESP32
 */

#include "command_handler.h"
#include "../config/servo_config.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>

// ============================================================================
// Runtime Configuration Variables
// ============================================================================

// Sweep control
volatile bool sweep_enabled = true;  // Start with sweep enabled by default

// Runtime servo parameters (initialized with compile-time defaults)
volatile int servo_min_angle = SERVO_MIN_ANGLE;
volatile int servo_max_angle = SERVO_MAX_ANGLE;
volatile int servo_step = SERVO_STEP;
volatile int servo_settle_ms = SERVO_SETTLE_MS;
volatile int servo_reading_delay_ms = SERVO_READING_DELAY_MS;

// Manual angle control (used when sweep disabled)
volatile int servo_manual_angle = 90;  // Default to center position

// Configuration mutex
SemaphoreHandle_t configMutex = nullptr;

// ============================================================================
// Initialization
// ============================================================================

void initCommandHandler() {
    // Create mutex for config access
    if (configMutex == nullptr) {
        configMutex = xSemaphoreCreateMutex();
        if (configMutex == nullptr) {
            Serial.println("ERR:INIT:Failed to create config mutex");
        } else {
            Serial.println("ACK:INIT:Command handler initialized");
        }
    }
}

// ============================================================================
// Validation Functions
// ============================================================================

bool validateAngle(int angle) {
    return (angle >= 0 && angle <= 180);
}

bool validateSweepRange(int min, int max) {
    return (min >= 0 && max <= 180 && min < max);
}

bool validateStep(int step) {
    return (step >= 1 && step <= 20);
}

// ============================================================================
// Communication Functions
// ============================================================================

void sendAck(const String& command) {
    Serial.print("ACK:");
    Serial.println(command);
}

void sendError(const String& errorType, const String& detail) {
    Serial.print("ERR:");
    Serial.print(errorType);
    Serial.print(":");
    Serial.println(detail);
}

// ============================================================================
// Command Handlers
// ============================================================================

void handleSweepCommand(const String& subCommand) {
    // SWEEP:ENABLE
    if (subCommand == "ENABLE") {
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sweep_enabled = true;
            xSemaphoreGive(configMutex);
            sendAck("SWEEP:ENABLED");
        } else {
            sendError("MUTEX", "SWEEP:ENABLE");
        }
    }
    // SWEEP:DISABLE
    else if (subCommand == "DISABLE") {
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sweep_enabled = false;
            xSemaphoreGive(configMutex);
            sendAck("SWEEP:DISABLED");
        } else {
            sendError("MUTEX", "SWEEP:DISABLE");
        }
    }
    // SWEEP:MIN:<n>
    else if (subCommand.startsWith("MIN:")) {
        int angle = subCommand.substring(4).toInt();
        if (!validateAngle(angle)) {
            sendError("OUT_OF_RANGE", "ANGLE:" + String(angle));
            return;
        }

        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            int max = servo_max_angle;
            if (validateSweepRange(angle, max)) {
                servo_min_angle = angle;
                xSemaphoreGive(configMutex);
                sendAck("SWEEP:MIN:" + String(angle));
            } else {
                xSemaphoreGive(configMutex);
                sendError("INVALID_RANGE", "MIN:" + String(angle) + " >= MAX:" + String(max));
            }
        } else {
            sendError("MUTEX", "SWEEP:MIN");
        }
    }
    // SWEEP:MAX:<n>
    else if (subCommand.startsWith("MAX:")) {
        int angle = subCommand.substring(4).toInt();
        if (!validateAngle(angle)) {
            sendError("OUT_OF_RANGE", "ANGLE:" + String(angle));
            return;
        }

        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            int min = servo_min_angle;
            if (validateSweepRange(min, angle)) {
                servo_max_angle = angle;
                xSemaphoreGive(configMutex);
                sendAck("SWEEP:MAX:" + String(angle));
            } else {
                xSemaphoreGive(configMutex);
                sendError("INVALID_RANGE", "MIN:" + String(min) + " >= MAX:" + String(angle));
            }
        } else {
            sendError("MUTEX", "SWEEP:MAX");
        }
    }
    // SWEEP:STEP:<n>
    else if (subCommand.startsWith("STEP:")) {
        int step = subCommand.substring(5).toInt();
        if (!validateStep(step)) {
            sendError("OUT_OF_RANGE", "STEP:" + String(step));
            return;
        }

        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            servo_step = step;
            xSemaphoreGive(configMutex);
            sendAck("SWEEP:STEP:" + String(step));
        } else {
            sendError("MUTEX", "SWEEP:STEP");
        }
    }
    // SWEEP:STATUS (query current configuration)
    else if (subCommand == "STATUS") {
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            bool enabled = sweep_enabled;
            int min = servo_min_angle;
            int max = servo_max_angle;
            int step = servo_step;
            int manual = servo_manual_angle;
            xSemaphoreGive(configMutex);

            if (enabled) {
                Serial.print("STATUS:SWEEP:ENABLED:");
                Serial.print(min);
                Serial.print(":");
                Serial.print(max);
                Serial.print(":");
                Serial.println(step);
            } else {
                Serial.print("STATUS:SWEEP:DISABLED:");
                Serial.println(manual);
            }
        } else {
            sendError("MUTEX", "SWEEP:STATUS");
        }
    }
    else {
        sendError("INVALID_COMMAND", "SWEEP:" + subCommand);
    }
}

void handleServoCommand(const String& subCommand) {
    // SERVO:ANGLE:<n>
    if (subCommand.startsWith("ANGLE:")) {
        int angle = subCommand.substring(6).toInt();

        // Validate angle range
        if (!validateAngle(angle)) {
            sendError("OUT_OF_RANGE", "ANGLE:" + String(angle));
            return;
        }

        // Only allow manual angle control when sweep is disabled
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            bool enabled = sweep_enabled;

            if (enabled) {
                xSemaphoreGive(configMutex);
                sendError("SWEEP_ACTIVE", "SERVO:ANGLE");
                return;
            }

            // Set manual angle
            servo_manual_angle = angle;
            xSemaphoreGive(configMutex);
            sendAck("SERVO:ANGLE:" + String(angle));
        } else {
            sendError("MUTEX", "SERVO:ANGLE");
        }
    }
    else {
        sendError("INVALID_COMMAND", "SERVO:" + subCommand);
    }
}

// ============================================================================
// Main Command Processing
// ============================================================================

void processSerialCommand() {
    // Check if data available (non-blocking)
    if (Serial.available() > 0) {
        String command = Serial.readStringUntil('\n');
        command.trim();  // Remove whitespace and newline characters

        // Ignore empty commands
        if (command.length() == 0) {
            return;
        }

        // Debug: echo command
        // Serial.println("DBG:RECEIVED:" + command);

        // Parse and route command
        if (command.startsWith("SWEEP:")) {
            handleSweepCommand(command.substring(6));
        }
        else if (command.startsWith("SERVO:")) {
            handleServoCommand(command.substring(6));
        }
        else if (command.startsWith("MODE:")) {
            // MODE command already handled elsewhere (mode_control.h)
            // Just acknowledge to avoid "unknown command" error
            sendAck(command);
        }
        else {
            sendError("INVALID_COMMAND", command);
        }
    }
}
