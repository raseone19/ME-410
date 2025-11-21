/**
 * @file command_handler.cpp
 * @brief Implementation of serial command handler for ESP32
 */

#include "command_handler.h"
#include "../config/servo_config.h"
#include "../config/pins.h"
#include "../sensors/tof_sensor.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <Preferences.h>

// NVS namespace for configuration storage
Preferences preferences;

// ============================================================================
// Default Configuration Constants (from default.json)
// ============================================================================

// PI gains defaults (not defined in headers)
constexpr float PI_KP = 0.15f;
constexpr float PI_KI = 0.60f;

// Control limits defaults (not defined in headers)
constexpr float DUTY_MAX = 100.0f;
constexpr float DUTY_MIN = -100.0f;

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

// Motor sector assignments
volatile int sector_motor_1_min = SECTOR_MOTOR_1_MIN;
volatile int sector_motor_1_max = SECTOR_MOTOR_1_MAX;
volatile int sector_motor_2_min = SECTOR_MOTOR_2_MIN;
volatile int sector_motor_2_max = SECTOR_MOTOR_2_MAX;
volatile int sector_motor_3_min = SECTOR_MOTOR_3_MIN;
volatile int sector_motor_3_max = SECTOR_MOTOR_3_MAX;
volatile int sector_motor_4_min = SECTOR_MOTOR_4_MIN;
volatile int sector_motor_4_max = SECTOR_MOTOR_4_MAX;

// Sampling configuration
volatile int pp_samples = PP_SAMPLES;
volatile int mux_settle_us = MUX_SETTLE_US;

// Distance ranges (cm)
volatile float distance_close_min = DISTANCE_CLOSE_MIN;
volatile float distance_medium_min = DISTANCE_MEDIUM_MIN;
volatile float distance_far_min = DISTANCE_FAR_MIN;
volatile float distance_far_max = DISTANCE_FAR_MAX;

// Setpoints (mV)
volatile float setpoint_close_mv = SETPOINT_CLOSE_MV;
volatile float setpoint_medium_mv = SETPOINT_MEDIUM_MV;
volatile float security_offset_mv = SECURITY_OFFSET_MV;

// Safety thresholds
volatile float safe_pressure_threshold_mv = SAFE_PRESSURE_THRESHOLD_MV;
volatile int release_time_ms = RELEASE_TIME_MS;

// PI gains (default values - will be overridden by actual values from pi_controller)
volatile float pi_kp = 0.15f;
volatile float pi_ki = 0.60f;

// Control limits
volatile float duty_max = 100.0f;
volatile float duty_min = -100.0f;
volatile float min_run = 40.0f;

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
            return;
        }
    }

    // Load configuration from NVS (or use defaults)
    if (loadConfigFromNVS()) {
        Serial.println("ACK:INIT:Configuration loaded from NVS");
    } else {
        Serial.println("ACK:INIT:Using default configuration");
    }
}

// ============================================================================
// Configuration Persistence Functions
// ============================================================================

bool loadConfigFromNVS() {
    Serial.println("[NVS] Loading configuration from default profile...");

    preferences.begin("cfg_default", true); // Read-only mode

    if (!preferences.isKey("config_valid")) {
        preferences.end();
        Serial.println("[NVS] No saved configuration found, using factory defaults");
        return false; // No saved config, use defaults
    }

    Serial.println("[NVS] Saved configuration found, loading...");

    // Acquire mutex for thread-safe config update
    if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        // Load sweep configuration
        sweep_enabled = preferences.getBool("sweep_en", true);
        servo_min_angle = preferences.getInt("servo_min", SERVO_MIN_ANGLE);
        servo_max_angle = preferences.getInt("servo_max", SERVO_MAX_ANGLE);
        servo_step = preferences.getInt("servo_step", SERVO_STEP);
        servo_settle_ms = preferences.getInt("servo_settle", SERVO_SETTLE_MS);
        servo_reading_delay_ms = preferences.getInt("servo_delay", SERVO_READING_DELAY_MS);

        // Load motor sectors
        sector_motor_1_min = preferences.getInt("m1_min", SECTOR_MOTOR_1_MIN);
        sector_motor_1_max = preferences.getInt("m1_max", SECTOR_MOTOR_1_MAX);
        sector_motor_2_min = preferences.getInt("m2_min", SECTOR_MOTOR_2_MIN);
        sector_motor_2_max = preferences.getInt("m2_max", SECTOR_MOTOR_2_MAX);
        sector_motor_3_min = preferences.getInt("m3_min", SECTOR_MOTOR_3_MIN);
        sector_motor_3_max = preferences.getInt("m3_max", SECTOR_MOTOR_3_MAX);
        sector_motor_4_min = preferences.getInt("m4_min", SECTOR_MOTOR_4_MIN);
        sector_motor_4_max = preferences.getInt("m4_max", SECTOR_MOTOR_4_MAX);

        // Load sampling
        pp_samples = preferences.getInt("pp_samples", PP_SAMPLES);
        mux_settle_us = preferences.getInt("mux_settle", MUX_SETTLE_US);

        // Load distance ranges
        distance_close_min = preferences.getFloat("dist_close", DISTANCE_CLOSE_MIN);
        distance_medium_min = preferences.getFloat("dist_med", DISTANCE_MEDIUM_MIN);
        distance_far_min = preferences.getFloat("dist_far_min", DISTANCE_FAR_MIN);
        distance_far_max = preferences.getFloat("dist_far_max", DISTANCE_FAR_MAX);

        // Load setpoints
        setpoint_close_mv = preferences.getFloat("sp_close", SETPOINT_CLOSE_MV);
        setpoint_medium_mv = preferences.getFloat("sp_medium", SETPOINT_MEDIUM_MV);
        security_offset_mv = preferences.getFloat("sp_offset", SECURITY_OFFSET_MV);

        // Load safety
        safe_pressure_threshold_mv = preferences.getFloat("safe_thresh", SAFE_PRESSURE_THRESHOLD_MV);
        release_time_ms = preferences.getInt("release_time", RELEASE_TIME_MS);

        // Load PI gains
        pi_kp = preferences.getFloat("pi_kp", PI_KP);
        pi_ki = preferences.getFloat("pi_ki", PI_KI);

        // Load control limits
        duty_max = preferences.getFloat("duty_max", DUTY_MAX);
        duty_min = preferences.getFloat("duty_min", DUTY_MIN);
        min_run = preferences.getFloat("min_run", 40.0f);

        xSemaphoreGive(configMutex);
    }

    preferences.end();
    return true;
}

bool saveConfigToNVS() {
    Serial.println("[NVS] Saving configuration to default profile...");

    preferences.begin("cfg_default", false); // Read-write mode

    // Clear existing data to ensure clean save
    preferences.clear();

    bool success = true;

    // Acquire mutex for thread-safe config read
    if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        // Save sweep configuration
        Serial.println("[NVS] Saving sweep configuration...");
        Serial.printf("[NVS]   sweep_en=%d, servo_min=%d, servo_max=%d, servo_step=%d\n",
                      sweep_enabled, servo_min_angle, servo_max_angle, servo_step);

        if (!preferences.putBool("sweep_en", sweep_enabled)) {
            Serial.printf("[NVS] ERROR: Failed to save sweep_en (value=%d)\n", sweep_enabled);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("servo_min", servo_min_angle)) {
            Serial.println("[NVS] ERROR: Failed to save servo_min");
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("servo_max", servo_max_angle)) {
            Serial.println("[NVS] ERROR: Failed to save servo_max");
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("servo_step", servo_step)) {
            Serial.println("[NVS] ERROR: Failed to save servo_step");
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("servo_settle", servo_settle_ms)) {
            Serial.println("[NVS] ERROR: Failed to save servo_settle");
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("servo_delay", servo_reading_delay_ms)) {
            Serial.println("[NVS] ERROR: Failed to save servo_delay");
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        Serial.println("[NVS] Sweep config saved successfully");

        // Save motor sectors
        Serial.println("[NVS] Saving motor sectors...");

        if (!preferences.putInt("m1_min", sector_motor_1_min)) {
            Serial.printf("[NVS] ERROR: Failed to save m1_min (value=%d)\n", sector_motor_1_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m1_max", sector_motor_1_max)) {
            Serial.printf("[NVS] ERROR: Failed to save m1_max (value=%d)\n", sector_motor_1_max);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m2_min", sector_motor_2_min)) {
            Serial.printf("[NVS] ERROR: Failed to save m2_min (value=%d)\n", sector_motor_2_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m2_max", sector_motor_2_max)) {
            Serial.printf("[NVS] ERROR: Failed to save m2_max (value=%d)\n", sector_motor_2_max);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m3_min", sector_motor_3_min)) {
            Serial.printf("[NVS] ERROR: Failed to save m3_min (value=%d)\n", sector_motor_3_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m3_max", sector_motor_3_max)) {
            Serial.printf("[NVS] ERROR: Failed to save m3_max (value=%d)\n", sector_motor_3_max);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m4_min", sector_motor_4_min)) {
            Serial.printf("[NVS] ERROR: Failed to save m4_min (value=%d)\n", sector_motor_4_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        if (!preferences.putInt("m4_max", sector_motor_4_max)) {
            Serial.printf("[NVS] ERROR: Failed to save m4_max (value=%d)\n", sector_motor_4_max);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        Serial.println("[NVS] Motor sectors saved successfully");

        // Save sampling
        Serial.println("[NVS] Saving sampling...");
        if (!preferences.putInt("pp_samples", pp_samples)) {
            Serial.printf("[NVS] ERROR: Failed to save pp_samples (value=%d)\n", pp_samples);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putInt("mux_settle", mux_settle_us)) {
            Serial.printf("[NVS] ERROR: Failed to save mux_settle (value=%d)\n", mux_settle_us);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        // Save distance ranges
        Serial.println("[NVS] Saving distance ranges...");
        if (!preferences.putFloat("dist_close", distance_close_min)) {
            Serial.printf("[NVS] ERROR: Failed to save dist_close (value=%f)\n", distance_close_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("dist_med", distance_medium_min)) {
            Serial.printf("[NVS] ERROR: Failed to save dist_med (value=%f)\n", distance_medium_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("dist_far_min", distance_far_min)) {
            Serial.printf("[NVS] ERROR: Failed to save dist_far_min (value=%f)\n", distance_far_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("dist_far_max", distance_far_max)) {
            Serial.printf("[NVS] ERROR: Failed to save dist_far_max (value=%f)\n", distance_far_max);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        // Save setpoints
        Serial.println("[NVS] Saving setpoints...");
        if (!preferences.putFloat("sp_close", setpoint_close_mv)) {
            Serial.printf("[NVS] ERROR: Failed to save sp_close (value=%f)\n", setpoint_close_mv);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("sp_medium", setpoint_medium_mv)) {
            Serial.printf("[NVS] ERROR: Failed to save sp_medium (value=%f)\n", setpoint_medium_mv);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("sp_offset", security_offset_mv)) {
            Serial.printf("[NVS] ERROR: Failed to save sp_offset (value=%f)\n", security_offset_mv);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        // Save safety
        Serial.println("[NVS] Saving safety...");
        if (!preferences.putFloat("safe_thresh", safe_pressure_threshold_mv)) {
            Serial.printf("[NVS] ERROR: Failed to save safe_thresh (value=%f)\n", safe_pressure_threshold_mv);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putInt("release_time", release_time_ms)) {
            Serial.printf("[NVS] ERROR: Failed to save release_time (value=%d)\n", release_time_ms);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        // Save PI gains
        Serial.println("[NVS] Saving PI gains...");
        if (!preferences.putFloat("pi_kp", pi_kp)) {
            Serial.printf("[NVS] ERROR: Failed to save pi_kp (value=%f)\n", pi_kp);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("pi_ki", pi_ki)) {
            Serial.printf("[NVS] ERROR: Failed to save pi_ki (value=%f)\n", pi_ki);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        // Save control limits
        Serial.println("[NVS] Saving control limits...");
        if (!preferences.putFloat("duty_max", duty_max)) {
            Serial.printf("[NVS] ERROR: Failed to save duty_max (value=%f)\n", duty_max);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("duty_min", duty_min)) {
            Serial.printf("[NVS] ERROR: Failed to save duty_min (value=%f)\n", duty_min);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }
        if (!preferences.putFloat("min_run", min_run)) {
            Serial.printf("[NVS] ERROR: Failed to save min_run (value=%f)\n", min_run);
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        // Mark config as valid
        Serial.println("[NVS] Marking config as valid...");
        if (!preferences.putBool("config_valid", true)) {
            Serial.println("[NVS] ERROR: Failed to save config_valid");
            preferences.end();
            xSemaphoreGive(configMutex);
            return false;
        }

        xSemaphoreGive(configMutex);
    } else {
        Serial.println("[NVS] ERROR: Failed to acquire config mutex");
        success = false;
    }

    preferences.end();

    if (!success) {
        Serial.println("[NVS] ERROR: Failed to save configuration parameters");
        return false;
    }

    Serial.println("[NVS] Configuration saved successfully to default profile!");
    return success;
}

void sendCurrentConfig() {
    Serial.println("CONFIG:{");

    // Acquire mutex for thread-safe config read
    if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        // Send sweep configuration
        Serial.printf("  \"sweep\": {\"enabled\": %s, \"min_angle\": %d, \"max_angle\": %d, \"step\": %d, \"settle_ms\": %d, \"reading_delay_ms\": %d},\n",
                      sweep_enabled ? "true" : "false",
                      servo_min_angle, servo_max_angle, servo_step, servo_settle_ms, servo_reading_delay_ms);

        // Send motor sectors
        Serial.printf("  \"sectors\": {\"motor_1\": {\"min\": %d, \"max\": %d}, \"motor_2\": {\"min\": %d, \"max\": %d}, \"motor_3\": {\"min\": %d, \"max\": %d}, \"motor_4\": {\"min\": %d, \"max\": %d}},\n",
                      sector_motor_1_min, sector_motor_1_max,
                      sector_motor_2_min, sector_motor_2_max,
                      sector_motor_3_min, sector_motor_3_max,
                      sector_motor_4_min, sector_motor_4_max);

        // Send sampling
        Serial.printf("  \"sampling\": {\"pp_samples\": %d, \"mux_settle_us\": %d},\n",
                      pp_samples, mux_settle_us);

        // Send distance ranges
        Serial.printf("  \"distance\": {\"close_min_cm\": %.1f, \"medium_min_cm\": %.1f, \"far_min_cm\": %.1f, \"far_max_cm\": %.1f},\n",
                      distance_close_min, distance_medium_min, distance_far_min, distance_far_max);

        // Send setpoints
        Serial.printf("  \"setpoints\": {\"close_mv\": %.1f, \"medium_mv\": %.1f, \"security_offset_mv\": %.1f},\n",
                      setpoint_close_mv, setpoint_medium_mv, security_offset_mv);

        // Send safety
        Serial.printf("  \"safety\": {\"threshold_mv\": %.1f, \"release_time_ms\": %d},\n",
                      safe_pressure_threshold_mv, release_time_ms);

        // Send PI gains
        Serial.printf("  \"pi_gains\": {\"kp\": %.3f, \"ki\": %.3f},\n",
                      pi_kp, pi_ki);

        // Send control limits (no trailing comma on last item)
        Serial.printf("  \"control_limits\": {\"duty_max_pct\": %.1f, \"duty_min_pct\": %.1f, \"min_run_pct\": %.1f}\n",
                      duty_max, duty_min, min_run);

        xSemaphoreGive(configMutex);
    }

    Serial.println("}");
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

void handleSectorCommand(const String& subCommand) {
    // SECTOR:M1:MIN:<n>, SECTOR:M1:MAX:<n>, etc.
    if (subCommand.startsWith("M1:MIN:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value)) {
            if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                sector_motor_1_min = value;
                xSemaphoreGive(configMutex);
                sendAck("SECTOR:M1:MIN:" + String(value));
            } else sendError("MUTEX", "SECTOR:M1:MIN");
        } else sendError("OUT_OF_RANGE", "ANGLE:" + String(value));
    }
    else if (subCommand.startsWith("M1:MAX:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value)) {
            if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                sector_motor_1_max = value;
                xSemaphoreGive(configMutex);
                sendAck("SECTOR:M1:MAX:" + String(value));
            } else sendError("MUTEX", "SECTOR:M1:MAX");
        } else sendError("OUT_OF_RANGE", "ANGLE:" + String(value));
    }
    // Repeat for M2, M3, M4...
    else if (subCommand.startsWith("M2:MIN:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sector_motor_2_min = value;
            xSemaphoreGive(configMutex);
            sendAck("SECTOR:M2:MIN:" + String(value));
        }
    }
    else if (subCommand.startsWith("M2:MAX:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sector_motor_2_max = value;
            xSemaphoreGive(configMutex);
            sendAck("SECTOR:M2:MAX:" + String(value));
        }
    }
    else if (subCommand.startsWith("M3:MIN:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sector_motor_3_min = value;
            xSemaphoreGive(configMutex);
            sendAck("SECTOR:M3:MIN:" + String(value));
        }
    }
    else if (subCommand.startsWith("M3:MAX:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sector_motor_3_max = value;
            xSemaphoreGive(configMutex);
            sendAck("SECTOR:M3:MAX:" + String(value));
        }
    }
    else if (subCommand.startsWith("M4:MIN:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sector_motor_4_min = value;
            xSemaphoreGive(configMutex);
            sendAck("SECTOR:M4:MIN:" + String(value));
        }
    }
    else if (subCommand.startsWith("M4:MAX:")) {
        int value = subCommand.substring(7).toInt();
        if (validateAngle(value) && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            sector_motor_4_max = value;
            xSemaphoreGive(configMutex);
            sendAck("SECTOR:M4:MAX:" + String(value));
        }
    }
    else {
        sendError("INVALID_COMMAND", "SECTOR:" + subCommand);
    }
}

void handleSamplingCommand(const String& subCommand) {
    // SAMPLING:PP_SAMPLES:<n>, SAMPLING:MUX_SETTLE:<n>
    if (subCommand.startsWith("PP_SAMPLES:")) {
        int value = subCommand.substring(11).toInt();
        if (value >= 1 && value <= 32 && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            pp_samples = value;
            xSemaphoreGive(configMutex);
            sendAck("SAMPLING:PP_SAMPLES:" + String(value));
        } else sendError("OUT_OF_RANGE", "PP_SAMPLES:" + String(value));
    }
    else if (subCommand.startsWith("MUX_SETTLE:")) {
        int value = subCommand.substring(11).toInt();
        if (value >= 0 && value <= 10000 && xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            mux_settle_us = value;
            xSemaphoreGive(configMutex);
            sendAck("SAMPLING:MUX_SETTLE:" + String(value));
        } else sendError("OUT_OF_RANGE", "MUX_SETTLE:" + String(value));
    }
    else {
        sendError("INVALID_COMMAND", "SAMPLING:" + subCommand);
    }
}

void handleDistanceCommand(const String& subCommand) {
    // DISTANCE:CLOSE_MIN:<n>, DISTANCE:MEDIUM_MIN:<n>, etc.
    if (subCommand.startsWith("CLOSE_MIN:")) {
        float value = subCommand.substring(10).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            distance_close_min = value;
            xSemaphoreGive(configMutex);
            sendAck("DISTANCE:CLOSE_MIN:" + String(value));
        }
    }
    else if (subCommand.startsWith("MEDIUM_MIN:")) {
        float value = subCommand.substring(11).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            distance_medium_min = value;
            xSemaphoreGive(configMutex);
            sendAck("DISTANCE:MEDIUM_MIN:" + String(value));
        }
    }
    else if (subCommand.startsWith("FAR_MIN:")) {
        float value = subCommand.substring(8).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            distance_far_min = value;
            xSemaphoreGive(configMutex);
            sendAck("DISTANCE:FAR_MIN:" + String(value));
        }
    }
    else if (subCommand.startsWith("FAR_MAX:")) {
        float value = subCommand.substring(8).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            distance_far_max = value;
            xSemaphoreGive(configMutex);
            sendAck("DISTANCE:FAR_MAX:" + String(value));
        }
    }
    else {
        sendError("INVALID_COMMAND", "DISTANCE:" + subCommand);
    }
}

void handleSetpointCommand(const String& subCommand) {
    // SETPOINT:CLOSE:<n>, SETPOINT:MEDIUM:<n>, SETPOINT:OFFSET:<n>
    if (subCommand.startsWith("CLOSE:")) {
        float value = subCommand.substring(6).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            setpoint_close_mv = value;
            xSemaphoreGive(configMutex);
            sendAck("SETPOINT:CLOSE:" + String(value));
        }
    }
    else if (subCommand.startsWith("MEDIUM:")) {
        float value = subCommand.substring(7).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            setpoint_medium_mv = value;
            xSemaphoreGive(configMutex);
            sendAck("SETPOINT:MEDIUM:" + String(value));
        }
    }
    else if (subCommand.startsWith("OFFSET:")) {
        float value = subCommand.substring(7).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            security_offset_mv = value;
            xSemaphoreGive(configMutex);
            sendAck("SETPOINT:OFFSET:" + String(value));
        }
    }
    else {
        sendError("INVALID_COMMAND", "SETPOINT:" + subCommand);
    }
}

void handleSafetyCommand(const String& subCommand) {
    // SAFETY:THRESHOLD:<n>, SAFETY:RELEASE_TIME:<n>
    if (subCommand.startsWith("THRESHOLD:")) {
        float value = subCommand.substring(10).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            safe_pressure_threshold_mv = value;
            xSemaphoreGive(configMutex);
            sendAck("SAFETY:THRESHOLD:" + String(value));
        }
    }
    else if (subCommand.startsWith("RELEASE_TIME:")) {
        int value = subCommand.substring(13).toInt();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            release_time_ms = value;
            xSemaphoreGive(configMutex);
            sendAck("SAFETY:RELEASE_TIME:" + String(value));
        }
    }
    else {
        sendError("INVALID_COMMAND", "SAFETY:" + subCommand);
    }
}

void handlePICommand(const String& subCommand) {
    // PI:KP:<n>, PI:KI:<n>
    if (subCommand.startsWith("KP:")) {
        float value = subCommand.substring(3).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            pi_kp = value;
            xSemaphoreGive(configMutex);
            sendAck("PI:KP:" + String(value));
        }
    }
    else if (subCommand.startsWith("KI:")) {
        float value = subCommand.substring(3).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            pi_ki = value;
            xSemaphoreGive(configMutex);
            sendAck("PI:KI:" + String(value));
        }
    }
    else {
        sendError("INVALID_COMMAND", "PI:" + subCommand);
    }
}

void handleControlCommand(const String& subCommand) {
    // CONTROL:MAX_DUTY:<n>, CONTROL:MIN_DUTY:<n>, CONTROL:MIN_RUN:<n>
    if (subCommand.startsWith("MAX_DUTY:")) {
        float value = subCommand.substring(9).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            duty_max = value;
            xSemaphoreGive(configMutex);
            sendAck("CONTROL:MAX_DUTY:" + String(value));
        }
    }
    else if (subCommand.startsWith("MIN_DUTY:")) {
        float value = subCommand.substring(9).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            duty_min = value;
            xSemaphoreGive(configMutex);
            sendAck("CONTROL:MIN_DUTY:" + String(value));
        }
    }
    else if (subCommand.startsWith("MIN_RUN:")) {
        float value = subCommand.substring(8).toFloat();
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            min_run = value;
            xSemaphoreGive(configMutex);
            sendAck("CONTROL:MIN_RUN:" + String(value));
        }
    }
    else {
        sendError("INVALID_COMMAND", "CONTROL:" + subCommand);
    }
}

void handleConfigCommand(const String& subCommand) {
    // CONFIG:GET - Send current configuration as JSON
    // CONFIG:SAVE - Save current configuration to NVS (auto-loads on boot)
    // CONFIG:RESET - Reset to default configuration

    Serial.printf("[DEBUG] handleConfigCommand called with subCommand: '%s'\n", subCommand.c_str());

    if (subCommand == "GET") {
        sendCurrentConfig();
    }
    else if (subCommand == "SAVE") {
        if (saveConfigToNVS()) {
            sendAck("CONFIG:SAVE:SUCCESS");
        } else {
            sendError("CONFIG_SAVE_FAILED", "Failed to save configuration to NVS");
        }
    }
    else if (subCommand == "RESET") {
        // Reset to defaults (from header files)
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            sweep_enabled = true;
            servo_min_angle = SERVO_MIN_ANGLE;
            servo_max_angle = SERVO_MAX_ANGLE;
            servo_step = SERVO_STEP;
            servo_settle_ms = SERVO_SETTLE_MS;
            servo_reading_delay_ms = SERVO_READING_DELAY_MS;

            sector_motor_1_min = SECTOR_MOTOR_1_MIN;
            sector_motor_1_max = SECTOR_MOTOR_1_MAX;
            sector_motor_2_min = SECTOR_MOTOR_2_MIN;
            sector_motor_2_max = SECTOR_MOTOR_2_MAX;
            sector_motor_3_min = SECTOR_MOTOR_3_MIN;
            sector_motor_3_max = SECTOR_MOTOR_3_MAX;
            sector_motor_4_min = SECTOR_MOTOR_4_MIN;
            sector_motor_4_max = SECTOR_MOTOR_4_MAX;

            pp_samples = PP_SAMPLES;
            mux_settle_us = MUX_SETTLE_US;

            distance_close_min = DISTANCE_CLOSE_MIN;
            distance_medium_min = DISTANCE_MEDIUM_MIN;
            distance_far_min = DISTANCE_FAR_MIN;
            distance_far_max = DISTANCE_FAR_MAX;

            setpoint_close_mv = SETPOINT_CLOSE_MV;
            setpoint_medium_mv = SETPOINT_MEDIUM_MV;
            security_offset_mv = SECURITY_OFFSET_MV;

            safe_pressure_threshold_mv = SAFE_PRESSURE_THRESHOLD_MV;
            release_time_ms = RELEASE_TIME_MS;

            pi_kp = PI_KP;
            pi_ki = PI_KI;

            duty_max = DUTY_MAX;
            duty_min = DUTY_MIN;
            min_run = 40.0f;

            xSemaphoreGive(configMutex);
            sendAck("CONFIG:RESET:SUCCESS");
        } else {
            sendError("CONFIG_RESET_FAILED", "Failed to acquire mutex");
        }
    }
    else {
        sendError("INVALID_COMMAND", "CONFIG:" + subCommand);
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
        Serial.println("DBG:RECEIVED:" + command);

        // Parse and route command
        if (command.startsWith("SWEEP:")) {
            handleSweepCommand(command.substring(6));
        }
        else if (command.startsWith("SERVO:")) {
            handleServoCommand(command.substring(6));
        }
        else if (command.startsWith("SECTOR:")) {
            handleSectorCommand(command.substring(7));
        }
        else if (command.startsWith("SAMPLING:")) {
            handleSamplingCommand(command.substring(9));
        }
        else if (command.startsWith("DISTANCE:")) {
            handleDistanceCommand(command.substring(9));
        }
        else if (command.startsWith("SETPOINT:")) {
            handleSetpointCommand(command.substring(9));
        }
        else if (command.startsWith("SAFETY:")) {
            handleSafetyCommand(command.substring(7));
        }
        else if (command.startsWith("PI:")) {
            handlePICommand(command.substring(3));
        }
        else if (command.startsWith("CONTROL:")) {
            handleControlCommand(command.substring(8));
        }
        else if (command.startsWith("CONFIG:")) {
            Serial.printf("[DEBUG] Routing CONFIG command: '%s'\n", command.c_str());
            handleConfigCommand(command.substring(7));
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
