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

volatile float shared_setpoints_mv[5] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
volatile uint16_t shared_pressure_pads_mv[5] = {0};
volatile float shared_duty_cycles[5] = {0.0f};
volatile float shared_tof_distances[5] = {0.0f, 0.0f, 0.0f, 0.0f, 0.0f};
volatile int shared_servo_angle = 0;
volatile float shared_tof_current = 0.0f;

// ============================================================================
// Task Implementations
// ============================================================================

void serialPrintTask(void* parameter) {
    TickType_t lastWakeTime = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(LOGGING_PERIOD_MS);

    for (;;) {
        // Get current time
        uint32_t time_ms = millis();

        // Local copies of arrays
        float setpoints[NUM_MOTORS];
        uint16_t pp_mv[NUM_MOTORS];
        float duty[NUM_MOTORS];
        float tof_dist[NUM_MOTORS];
        int servo_angle;
        float tof_current;

        for (int i = 0; i < NUM_MOTORS; ++i) {
            setpoints[i] = shared_setpoints_mv[i];
            pp_mv[i] = shared_pressure_pads_mv[i];
            duty[i] = shared_duty_cycles[i];
            tof_dist[i] = shared_tof_distances[i];
        }
        servo_angle = shared_servo_angle;
        tof_current = shared_tof_current;

        // ====================================================================
        // Binary Protocol Output
        // ====================================================================
        DataPacket packet;
        // Mode is always 1 (sweep mode)
        uint8_t mode_byte = 1;
        buildDataPacket(&packet, time_ms, setpoints, pp_mv, duty, tof_dist, (uint8_t)servo_angle, tof_current, mode_byte);
        sendBinaryPacket(&packet);

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
