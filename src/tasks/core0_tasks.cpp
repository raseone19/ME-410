/**
 * @file core0_tasks.cpp
 * @brief Implementation of FreeRTOS tasks for Core 0
 */

#include "core0_tasks.h"
#include "../sensors/tof_sensor.h"
#include "../config/pins.h"
#include "../config/system_config.h"
#include "../utils/binary_protocol.h"

// ============================================================================
// Shared Variables (Extern declarations in header)
// ============================================================================

volatile float shared_setpoints_pct[5] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};  // Setpoints in % (0-100)
volatile float shared_pressure_pct[5] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};   // Normalized pressure (0-100%)
volatile float shared_duty_cycles[5] = {0.0f};
volatile float shared_tof_distances[5] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
volatile int shared_servo_angle = 0;
volatile float shared_tof_current = 0.0f;

// Potentiometer scale values
volatile float shared_force_scale = 1.0f;       // Force scale from pot 1 (0.6-1.0)
volatile float shared_distance_scale = 1.0f;    // Distance scale from pot 2 (0.5-1.5)

// Dynamic distance thresholds (initialized to base values)
volatile float shared_dist_close_max = 100.0f;  // CLOSE/MEDIUM boundary
volatile float shared_dist_medium_max = 200.0f; // MEDIUM/FAR boundary
volatile float shared_dist_far_max = 300.0f;    // FAR/OUT boundary

// ============================================================================
// Task Implementations
// ============================================================================

void serialPrintTask(void* parameter) {
    TickType_t lastWakeTime = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(LOGGING_PERIOD_MS);

    for (;;) {
        // Get current time
        uint32_t time_ms = millis();

        // Local copies of arrays (all values now in percentage 0-100%)
        float setpoints[NUM_MOTORS];
        float pp_pct[NUM_MOTORS];
        float duty[NUM_MOTORS];
        float tof_dist[NUM_MOTORS];
        int servo_angle;
        float tof_current;

        for (int i = 0; i < NUM_MOTORS; ++i) {
            setpoints[i] = shared_setpoints_pct[i];
            pp_pct[i] = shared_pressure_pct[i];
            duty[i] = shared_duty_cycles[i];
            tof_dist[i] = shared_tof_distances[i];
        }
        servo_angle = shared_servo_angle;
        tof_current = shared_tof_current;

        // Read potentiometer scales and distance thresholds
        float force_scale = shared_force_scale;
        float distance_scale = shared_distance_scale;
        float dist_close_max = shared_dist_close_max;
        float dist_medium_max = shared_dist_medium_max;
        float dist_far_max = shared_dist_far_max;

#ifdef PROTOCOL_BINARY
        // ====================================================================
        // Binary Protocol Output (for frontend)
        // ====================================================================
        DataPacket packet;
        // Mode is always 1 (sweep mode)
        uint8_t mode_byte = 1;
        uint8_t active_sensor = (uint8_t)shared_active_sensor;
        buildDataPacket(&packet, time_ms, setpoints, pp_pct, duty, tof_dist,
                        (uint8_t)servo_angle, tof_current, mode_byte, active_sensor,
                        force_scale, distance_scale,
                        dist_close_max, dist_medium_max, dist_far_max);
        sendBinaryPacket(&packet);
#endif
        // When PROTOCOL_BINARY is not defined, this task does nothing
        // allowing Serial.println() debug messages to be visible

        // Wait for next period
        vTaskDelayUntil(&lastWakeTime, frequency);
    }
}

void initCore0Tasks() {
    // Create servo sweep task on Core 0 (higher priority)
    xTaskCreatePinnedToCore(
        servoSweepTask,           // Task function (from tof_sensor.cpp)
        "ServoSweep",             // Task name
        4096,                     // Stack size (bytes)
        NULL,                     // Task parameter
        SERVO_SWEEP_PRIORITY,     // Priority
        NULL,                     // Task handle
        0                         // Core 0
    );

    // Create serial print task on Core 0 (lower priority)
    xTaskCreatePinnedToCore(
        serialPrintTask,          // Task function
        "SerialPrint",            // Task name
        4096,                     // Stack size (bytes)
        NULL,                     // Task parameter
        SERIAL_PRINT_PRIORITY,    // Priority
        NULL,                     // Task handle
        0                         // Core 0
    );
}
