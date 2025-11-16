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

extern volatile float shared_setpoint_mv;
extern volatile uint16_t shared_pressure_pads_mv[4];
extern volatile float shared_duty_cycles[4];
extern volatile float shared_tof_distance;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * @brief Serial print task for CSV data logging (runs on Core 0)
 *
 * FreeRTOS task that periodically prints system data in CSV format.
 * Prints setpoint, 4 pressure pad values, and 4 duty cycles at fixed frequency.
 *
 * CSV Format:
 * time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
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
