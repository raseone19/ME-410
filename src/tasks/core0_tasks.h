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

extern volatile float shared_setpoints_pct[5];  // 5 independent setpoints in % (0-100)
extern volatile float shared_pressure_pct[5];   // 5 normalized pressure readings (0-100%)
extern volatile float shared_duty_cycles[5];
extern volatile float shared_tof_distances[5];  // 5 independent distances (one per motor/sector)
extern volatile int shared_servo_angle;  // Current servo position in degrees (0-175)
extern volatile float shared_tof_current;  // Live TOF distance at current servo angle

// Potentiometer scale values (Written by Core 1, Read by Core 0)
extern volatile float shared_force_scale;       // Force scale from pot 1 (0.6-1.0)
extern volatile float shared_distance_scale;    // Distance scale from pot 2 (0.5-1.5)

// Dynamic distance thresholds (Written by Core 1, Read by Core 0)
extern volatile float shared_dist_close_max;    // CLOSE/MEDIUM boundary (75-125 cm)
extern volatile float shared_dist_medium_max;   // MEDIUM/FAR boundary (125-275 cm)
extern volatile float shared_dist_far_max;      // FAR/OUT boundary (150-450 cm)

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
 * time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,pp5_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,duty5_pct,tof_dist_cm
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
