/**
 * @file ultrasonic_sensor.cpp
 * @brief Implementation of HRLV-MaxSonar-EZ ultrasonic sensor
 */

#include "ultrasonic_sensor.h"
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

// ============================================================================
// Shared Variables
// ============================================================================

volatile float shared_ultrasonic_distance = 999.0f;

// ============================================================================
// Sensor Reading Functions
// ============================================================================

float readDistancePWM() {
    // Read pulse width (HIGH time)
    unsigned long pulseWidth = pulseIn(ULTRASONIC_PIN, HIGH, US_PWM_TIMEOUT_US);

    if (pulseWidth == 0) {
        return -1.0f; // Timeout
    }

    // Convert pulse width to distance
    // HRLV: 147μs per cm
    float distance_cm = pulseWidth / US_PER_CM;

    return distance_cm;
}

float readDistanceAnalog() {
    // Read ADC value
    int adcValue = analogRead(ULTRASONIC_PIN);

    // Convert to voltage
    float voltage = (adcValue / US_ADC_MAX) * US_VREF;

    // Convert voltage to distance
    // HRLV: Vcc/512 per cm, with Vcc = 3.3V
    float distance_cm = voltage / US_VOLTS_PER_CM;

    return distance_cm;
}

float readDistanceSerial() {
    // Check if data available
    if (Serial2.available() < 1) {
        return -1.0f;
    }

    // Read until 'R' character (start of range data)
    while (Serial2.available()) {
        char c = Serial2.read();
        if (c == 'R') {
            // Read 3-digit range (e.g., "R123\r")
            String rangeStr = "";
            for (int i = 0; i < 3; i++) {
                if (Serial2.available()) {
                    rangeStr += (char)Serial2.read();
                }
            }

            // Convert to integer (range in cm)
            int distance_cm = rangeStr.toInt();
            return (float)distance_cm;
        }
    }

    return -1.0f;
}

// ============================================================================
// Public Function Implementations
// ============================================================================

void initUltrasonicSensor() {
#if ULTRASONIC_MODE == MODE_PWM
    // Configure pin as input for PWM reading
    pinMode(ULTRASONIC_PIN, INPUT);
    Serial.println("    Ultrasonic sensor initialized (PWM mode)");

#elif ULTRASONIC_MODE == MODE_ANALOG
    // Configure pin as analog input
    pinMode(ULTRASONIC_PIN, INPUT);
    analogReadResolution(12); // 12-bit resolution
    Serial.println("    Ultrasonic sensor initialized (Analog mode)");

#elif ULTRASONIC_MODE == MODE_SERIAL
    // Configure Serial2 for MaxSonar communication
    Serial2.begin(US_SERIAL_BAUD, SERIAL_8N1, ULTRASONIC_PIN, -1); // RX only
    Serial.println("    Ultrasonic sensor initialized (Serial mode)");

#else
    #error "Invalid ULTRASONIC_MODE. Use: MODE_PWM, MODE_ANALOG, or MODE_SERIAL"
#endif

    Serial.printf("    Pin: GPIO %d, Range: 30-500cm\n", ULTRASONIC_PIN);
    delay(250); // Give sensor time to stabilize
}

float ultrasonicGetDistance() {
    float distance = -1.0f;

#if ULTRASONIC_MODE == MODE_PWM
    distance = readDistancePWM();
#elif ULTRASONIC_MODE == MODE_ANALOG
    distance = readDistanceAnalog();
#elif ULTRASONIC_MODE == MODE_SERIAL
    distance = readDistanceSerial();
#endif

    // Validate range
    if (distance < ULTRASONIC_MIN_CM || distance > ULTRASONIC_MAX_CM) {
        return -1.0f;  // Out of valid range
    }

    return distance;
}

float getUltrasonicDistance() {
    return shared_ultrasonic_distance;
}

void ultrasonicReadTask(void* parameter) {
    for (;;) {
        // Read ultrasonic distance
        float distance = ultrasonicGetDistance();

        // Update shared variable (single writer, no mutex needed)
        if (distance > 0) {
            shared_ultrasonic_distance = distance;
        }

        // Wait before next reading
        vTaskDelay(pdMS_TO_TICKS(ULTRASONIC_READ_INTERVAL_MS));
    }
}
