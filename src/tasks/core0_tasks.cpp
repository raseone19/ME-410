/**
 * @file core0_tasks.cpp
 * @brief Implementation of FreeRTOS tasks for Core 0
 */

#include "core0_tasks.h"
#include "../sensors/tof_sensor.h"
#include "../config/pins.h"
#include "../config/system_config.h"

#ifdef PROTOCOL_BINARY
#include "../utils/binary_protocol.h"
#endif

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
#ifdef PROTOCOL_CSV
    // Print CSV header once at startup
    Serial.println("time_ms,sp1_mv,sp2_mv,sp3_mv,sp4_mv,sp5_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,pp5_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,duty5_pct,tof1_cm,tof2_cm,tof3_cm,tof4_cm,tof5_cm,servo_angle");
#endif

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

#ifdef PROTOCOL_CSV
        // ====================================================================
        // CSV Protocol Output
        // ====================================================================
        Serial.print(time_ms);
        Serial.print(",");

        // Print all 4 setpoints
        for (int i = 0; i < NUM_MOTORS; ++i) {
            Serial.print(setpoints[i], CSV_DECIMAL_PLACES);
            Serial.print(",");
        }

        // Print all 4 pressure pad values
        for (int i = 0; i < NUM_MOTORS; ++i) {
            Serial.print(pp_mv[i]);
            Serial.print(",");
        }

        // Print all 4 duty cycles
        for (int i = 0; i < NUM_MOTORS; ++i) {
            Serial.print(duty[i], CSV_DECIMAL_PLACES);
            Serial.print(",");
        }

        // Print all 4 TOF distances
        for (int i = 0; i < NUM_MOTORS; ++i) {
            Serial.print(tof_dist[i], CSV_DECIMAL_PLACES);
            Serial.print(",");
        }

        // Print servo angle
        Serial.print(servo_angle);

        Serial.println();

#else
        // ====================================================================
        // Binary Protocol Output
        // ====================================================================
        DataPacket packet;
        // Mode is always 1 (sweep mode)
        uint8_t mode_byte = 1;
        buildDataPacket(&packet, time_ms, setpoints, pp_mv, duty, tof_dist, (uint8_t)servo_angle, tof_current, mode_byte);
        sendBinaryPacket(&packet);
#endif

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
