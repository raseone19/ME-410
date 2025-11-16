/**
 * @file core0_tasks.cpp
 * @brief Implementation of FreeRTOS tasks for Core 0
 */

#include "core0_tasks.h"
#include "../sensors/tof_sensor.h"
#include "../config/pins.h"

// ============================================================================
// Shared Variables (Extern declarations in header)
// ============================================================================

volatile float shared_setpoint_mv = 0.0f;
volatile uint16_t shared_pressure_pads_mv[4] = {0};
volatile float shared_duty_cycles[4] = {0.0f};
volatile float shared_tof_distance = 0.0f;

// ============================================================================
// Task Implementations
// ============================================================================

void serialPrintTask(void* parameter) {
    // Print CSV header once at startup
    Serial.println("time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm");

    TickType_t lastWakeTime = xTaskGetTickCount();
    const TickType_t frequency = pdMS_TO_TICKS(PRINT_DT_MS);

    for (;;) {
        // Get current time
        uint32_t time_ms = millis();

        // Read shared variables (volatile reads are atomic on ESP32 for 32-bit values)
        float setpoint = shared_setpoint_mv;
        float tof_dist = shared_tof_distance;

        // Local copies of arrays
        uint16_t pp_mv[NUM_MOTORS];
        float duty[NUM_MOTORS];

        for (int i = 0; i < NUM_MOTORS; ++i) {
            pp_mv[i] = shared_pressure_pads_mv[i];
            duty[i] = shared_duty_cycles[i];
        }

        // Print CSV line
        Serial.print(time_ms);
        Serial.print(",");
        Serial.print(setpoint, 1);
        Serial.print(",");

        // Print all 4 pressure pad values
        for (int i = 0; i < NUM_MOTORS; ++i) {
            Serial.print(pp_mv[i]);
            Serial.print(",");
        }

        // Print all 4 duty cycles
        for (int i = 0; i < NUM_MOTORS; ++i) {
            Serial.print(duty[i], 2);
            if (i < NUM_MOTORS - 1) {
                Serial.print(",");
            }
        }

        Serial.print(",");
        Serial.println(tof_dist, 2);

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
