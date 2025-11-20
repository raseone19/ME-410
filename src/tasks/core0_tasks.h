/**
 * @file core0_tasks.h
 * @brief FreeRTOS tasks running on Core 0
 *
 * Defines tasks that run on Core 0 of the ESP32:
 * - Servo sweep task (TOF scanning)
 * - Serial print task (CSV data logging)
 */

#ifndef CORE0_TASKS_H
#define CORE0_TASKS_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// Task priorities
constexpr uint8_t SERVO_SWEEP_PRIORITY = 2;  // Higher priority for servo sweep
constexpr uint8_t SERIAL_PRINT_PRIORITY = 1; // Lower priority for logging

// Print frequency
constexpr uint32_t PRINT_FREQ_HZ = 50;       // CSV logging frequency (Hz)
constexpr uint32_t PRINT_DT_MS = 1000 / PRINT_FREQ_HZ;

// ============================================================================
// Shared Variables for Logging (Written by Core 1, Read by Core 0)
// ============================================================================

extern volatile float shared_setpoints_mv[5];  // 5 independent setpoints (one per motor)
extern volatile uint16_t shared_pressure_pads_mv[5];
extern volatile float shared_duty_cycles[5];
extern volatile float shared_tof_distances[5];  // 5 independent distances (one per motor/sector)
extern volatile int shared_servo_angle;  // Current servo position in degrees (5-175)
extern volatile float shared_tof_current;  // Live TOF distance at current servo angle

// ============================================================================
// Public Functions
// ============================================================================

/**
 * @brief Serial print task for CSV data logging (runs on Core 0)
 *
 * FreeRTOS task that periodically prints system data in CSV format.
 * Prints setpoint, 5 pressure pad values, and 5 duty cycles at fixed frequency.
 *
 * CSV Format:
 * time_ms,sp1_mv,sp2_mv,sp3_mv,sp4_mv,sp5_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,pp5_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,duty5_pct,tof1_cm,tof2_cm,tof3_cm,tof4_cm,tof5_cm,servo_angle
 *
 * @param parameter Task parameter (unused)
 */
void serialPrintTask(void* parameter);

/**
 * @brief Initialize Core 0 tasks
 *
 * Creates and starts all FreeRTOS tasks that run on Core 0.
 * Must be called once during setup.
 */
void initCore0Tasks();

#endif // CORE0_TASKS_H
