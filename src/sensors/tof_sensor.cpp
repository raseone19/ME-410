/**
 * @file tof_sensor.cpp
 * @brief Implementation of TOF sensor and servo sweep functions
 */

#include "tof_sensor.h"
#include "../config/pins.h"

// ============================================================================
// Internal Variables
// ============================================================================

// TOF Serial communication
static HardwareSerial tofSerial(1);  // Use Serial1 (UART1)

// TOF sensor data
static uint8_t tof_id = 0;
static uint32_t tof_systemTime = 0;
static float tof_distance = 0.0f;
static uint8_t tof_distanceStatus = 0;
static uint16_t tof_signalStrength = 0;
static uint8_t tof_rangePrecision = 0;

// Servo object
static Servo tofServo;

// Dynamic setpoint for FAR range
static float setpoint_far_dynamic = 0.0f;

// ============================================================================
// Shared Variables (Extern declarations in header)
// ============================================================================

SemaphoreHandle_t distanceMutex = NULL;
volatile float shared_min_distance = 999.0f;
volatile int shared_best_angle = SERVO_MIN_ANGLE;
volatile bool sweep_active = false;

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * @brief Read N bytes from TOF serial with timeout
 *
 * @param buf Buffer to store received bytes
 * @param len Number of bytes to read
 * @param timeout Timeout in milliseconds (default: 1500)
 * @return Number of bytes actually read
 */
static size_t tof_readN(uint8_t* buf, size_t len, uint16_t timeout = 1500) {
    size_t offset = 0;
    unsigned long startTime = millis();

    while (offset < len) {
        if (tofSerial.available()) {
            buf[offset++] = tofSerial.read();
        }
        if (millis() - startTime > timeout) {
            break;
        }
    }

    return offset;
}

// ============================================================================
// Public Function Implementations
// ============================================================================

void initTOFSensor() {
    // Initialize TOF serial communication
    tofSerial.begin(TOF_BAUDRATE, SERIAL_8N1, TOF_RX_PIN, TOF_TX_PIN);
    delay(100);

    // Initialize servo
    tofServo.attach(SERVO_PIN);
    tofServo.write(SERVO_MIN_ANGLE);  // Start at minimum angle
    delay(500);

    // Create mutex for thread-safe access to shared variables
    distanceMutex = xSemaphoreCreateMutex();
    if (distanceMutex == NULL) {
        Serial.println("ERROR: Failed to create distance mutex!");
    }
}

float tofGetDistance() {
    uint8_t rx_buf[16];
    uint8_t ch;
    uint8_t checksum = 0;
    const uint16_t timeout = 1000;
    bool success = false;

    // Clear any old data from serial buffer
    while (tofSerial.available() > 0) {
        tofSerial.read();
    }

    unsigned long startTime = millis();

    // Try to read a valid frame within timeout period
    while (millis() - startTime < timeout) {
        // Look for frame start byte (0x57)
        if (tof_readN(&ch, 1, 100) == 1 && ch == 0x57) {
            rx_buf[0] = ch;

            // Check second byte (0x00)
            if (tof_readN(&ch, 1, 100) == 1 && ch == 0x00) {
                rx_buf[1] = ch;

                // Read remaining 14 bytes
                if (tof_readN(&rx_buf[2], 14, 100) == 14) {
                    // Verify checksum
                    checksum = 0;
                    for (int i = 0; i < 15; i++) {
                        checksum += rx_buf[i];
                    }

                    if (checksum == rx_buf[15]) {
                        // Parse valid frame
                        tof_id = rx_buf[3];

                        tof_systemTime = ((uint32_t)rx_buf[7] << 24) |
                                       ((uint32_t)rx_buf[6] << 16) |
                                       ((uint32_t)rx_buf[5] << 8) |
                                       (uint32_t)rx_buf[4];

                        // Parse distance (24-bit signed integer in mm, divided by 1000 for meters)
                        tof_distance = ((float)(((int32_t)((uint32_t)rx_buf[10] << 24 |
                                                          (uint32_t)rx_buf[9] << 16 |
                                                          (uint32_t)rx_buf[8] << 8)) / 256)) / 1000.0f;

                        tof_distanceStatus = rx_buf[11];
                        tof_signalStrength = ((uint16_t)rx_buf[13] << 8) | rx_buf[12];
                        tof_rangePrecision = rx_buf[14];

                        success = true;
                        break;
                    }
                }
            }
        }
    }

    if (success) {
        return tof_distance * 100.0f;  // Convert meters to centimeters
    } else {
        return -1.0f;  // Return error value
    }
}

DistanceRange getDistanceRange(float distance) {
    if (distance < 0.0f) {
        return RANGE_UNKNOWN;  // Sensor error
    }
    else if (distance >= DISTANCE_FAR_MIN && distance <= DISTANCE_FAR_MAX) {
        return RANGE_FAR;  // Far range: 200-300 cm
    }
    else if (distance >= DISTANCE_MEDIUM_MIN && distance < DISTANCE_FAR_MIN) {
        return RANGE_MEDIUM;  // Medium range: 100-200 cm
    }
    else if (distance >= DISTANCE_CLOSE_MIN && distance < DISTANCE_MEDIUM_MIN) {
        return RANGE_CLOSE;  // Close range: 50-100 cm
    }
    else {
        return RANGE_OUT_OF_BOUNDS;  // Outside valid ranges
    }
}

float calculateSetpoint(DistanceRange range, float current_pressure_mv) {
    switch (range) {
        case RANGE_FAR:
            // Dynamic setpoint: current pressure + security offset
            setpoint_far_dynamic = current_pressure_mv + SECURITY_OFFSET_MV;
            return setpoint_far_dynamic;

        case RANGE_MEDIUM:
            return SETPOINT_MEDIUM_MV;

        case RANGE_CLOSE:
            return SETPOINT_CLOSE_MV;

        default:
            return -1.0f;  // Invalid setpoint
    }
}

float getMinDistance() {
    float distance = 999.0f;

    if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        distance = shared_min_distance;
        xSemaphoreGive(distanceMutex);
    }

    return distance;
}

int getBestAngle() {
    int angle = SERVO_MIN_ANGLE;

    if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        angle = shared_best_angle;
        xSemaphoreGive(distanceMutex);
    }

    return angle;
}

void servoSweepTask(void* parameter) {
    for (;;) {
        float min_distance_this_sweep = 999.0f;
        int angle_of_min = SERVO_MIN_ANGLE;

        // Sweep from minimum to maximum angle
        for (int angle = SERVO_MIN_ANGLE; angle <= SERVO_MAX_ANGLE; angle += SERVO_STEP) {
            // Move servo to current angle
            tofServo.write(angle);

            // Wait for servo to settle
            vTaskDelay(pdMS_TO_TICKS(SERVO_SETTLE_MS));

            // Read TOF distance at this angle
            float distance = tofGetDistance();

            // Track minimum distance in this sweep
            if (distance > 0 && distance < min_distance_this_sweep) {
                min_distance_this_sweep = distance;
                angle_of_min = angle;
            }

            // Small delay between readings
            vTaskDelay(pdMS_TO_TICKS(20));
        }

        // Sweep completed - update shared variables if valid minimum was found
        if (min_distance_this_sweep < 999.0f) {
            if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                shared_min_distance = min_distance_this_sweep;
                shared_best_angle = angle_of_min;
                xSemaphoreGive(distanceMutex);
            }
        }

        // Position servo at optimal angle (where minimum distance was found)
        tofServo.write(angle_of_min);
        vTaskDelay(pdMS_TO_TICKS(SERVO_SETTLE_MS));

        // Brief pause before starting next sweep
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
