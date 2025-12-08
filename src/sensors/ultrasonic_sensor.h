/**
 * @file ultrasonic_sensor.h
 * @brief HRLV-MaxSonar-EZ ultrasonic distance sensor
 *
 * This sensor supports 3 output modes (only one pin needed):
 * - Analog (AN): Voltage output (Vcc/512 per cm)
 * - PWM (PW): Pulse width output (147μs per cm)
 * - Serial (TX): Serial output at 9600 baud
 *
 * Default: ANALOG mode on GPIO 5
 * Range: 30cm - 500cm (HRLV model)
 */

#ifndef ULTRASONIC_SENSOR_H
#define ULTRASONIC_SENSOR_H

#include <Arduino.h>

// ============================================================================
// Configuration
// ============================================================================

// Choose mode: MODE_PWM, MODE_ANALOG, or MODE_SERIAL
#define MODE_PWM 1
#define MODE_ANALOG 2
#define MODE_SERIAL 3

#define ULTRASONIC_MODE MODE_ANALOG  // Change this to switch modes

// Pin configuration
constexpr uint8_t ULTRASONIC_PIN = 5;  // GPIO 5

// Timing
constexpr uint32_t ULTRASONIC_READ_INTERVAL_MS = 100;  // Read every 100ms (MaxSonar updates at ~10Hz)

// Analog mode constants
constexpr float US_ADC_MAX = 4095.0f;         // ESP32 12-bit ADC
constexpr float US_VREF = 3.3f;               // ESP32 reference voltage
constexpr float US_VOLTS_PER_CM = 3.3f/512.0f; // HRLV: 3.3V / 512cm range

// PWM mode constants
constexpr float US_PER_CM = 147.0f;           // HRLV: 147μs per cm
constexpr uint32_t US_PWM_TIMEOUT_US = 100000; // 100ms timeout

// Serial mode
constexpr uint32_t US_SERIAL_BAUD = 9600;

// Sensor range limits
constexpr float ULTRASONIC_MIN_CM = 30.0f;    // Minimum reliable range
constexpr float ULTRASONIC_MAX_CM = 500.0f;   // Maximum range

// ============================================================================
// Shared Variables
// ============================================================================

// Current ultrasonic distance reading (updated by Core 0 task)
extern volatile float shared_ultrasonic_distance;

// ============================================================================
// Public Functions
// ============================================================================

/**
 * @brief Initialize ultrasonic sensor
 *
 * Configures the pin based on selected mode.
 * Must be called once during setup.
 */
void initUltrasonicSensor();

/**
 * @brief Read distance using PWM output
 * @return Distance in centimeters, or -1 if error
 */
float readDistancePWM();

/**
 * @brief Read distance using analog voltage output
 * @return Distance in centimeters, or -1 if error
 */
float readDistanceAnalog();

/**
 * @brief Read distance using serial output
 * @return Distance in centimeters, or -1 if error
 */
float readDistanceSerial();

/**
 * @brief Read distance from ultrasonic sensor (uses configured mode)
 *
 * Reads the sensor based on ULTRASONIC_MODE setting.
 *
 * @return Distance in centimeters, or -1.0 if error/out of range
 */
float ultrasonicGetDistance();

/**
 * @brief Get the current ultrasonic distance (thread-safe)
 *
 * Returns the most recent distance reading from shared variable.
 *
 * @return Distance in centimeters
 */
float getUltrasonicDistance();

/**
 * @brief Ultrasonic sensor reading task (runs on Core 0)
 *
 * FreeRTOS task that continuously reads the ultrasonic sensor
 * and updates the shared_ultrasonic_distance variable.
 *
 * @param parameter Task parameter (unused)
 */
void ultrasonicReadTask(void* parameter);

#endif // ULTRASONIC_SENSOR_H
