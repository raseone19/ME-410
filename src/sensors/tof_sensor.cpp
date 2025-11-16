/**
 * @file tof_sensor.cpp
 * @brief Implementation of TOF sensor and servo sweep functions
 */

#include "tof_sensor.h"
#include "../config/pins.h"
#include "../config/system_config.h"

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

// Reserve PWM channels to avoid motor conflicts
// Motors use channels 0-3, so servo will use channel 8+
static bool servo_channels_allocated = false;

// ============================================================================
// Shared Variables (Extern declarations in header)
// ============================================================================

SemaphoreHandle_t distanceMutex = NULL;
volatile float shared_min_distance[4] = {999.0f, 999.0f, 999.0f, 999.0f};
volatile int shared_best_angle[4] = {SERVO_MIN_ANGLE, SERVO_MIN_ANGLE, SERVO_MIN_ANGLE, SERVO_MIN_ANGLE};
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

    // Allocate timer for servo (motors use default timers)
    // This prevents PWM channel conflicts between motors and servo
    if (!servo_channels_allocated) {
        ESP32PWM::allocateTimer(2);  // Use timer 2 for servo
        servo_channels_allocated = true;
    }

    // Initialize servo using ESP32Servo library
    tofServo.setPeriodHertz(50);    // Standard 50Hz servo
    tofServo.attach(SERVO_PIN);
    tofServo.write(SERVO_MIN_ANGLE);  // Start at minimum sweep angle
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

float calculateSetpoint(DistanceRange range, float baseline_pressure_mv) {
    switch (range) {
        case RANGE_FAR:
            // Dynamic setpoint: baseline pressure (captured when entering FAR range) + security offset
            // This accounts for friction variations between different motors and over time
            return baseline_pressure_mv + SECURITY_OFFSET_MV;

        case RANGE_MEDIUM:
            return SETPOINT_MEDIUM_MV;

        case RANGE_CLOSE:
            return SETPOINT_CLOSE_MV;

        default:
            return -1.0f;  // Invalid setpoint
    }
}

float getMinDistance(int motor_index) {
    float distance = 999.0f;

    if (motor_index < 0 || motor_index >= NUM_MOTORS) {
        return distance;  // Invalid index
    }

    if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        distance = shared_min_distance[motor_index];
        xSemaphoreGive(distanceMutex);
    }

    return distance;
}

int getBestAngle(int motor_index) {
    int angle = SERVO_MIN_ANGLE;

    if (motor_index < 0 || motor_index >= NUM_MOTORS) {
        return angle;  // Invalid index
    }

    if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        angle = shared_best_angle[motor_index];
        xSemaphoreGive(distanceMutex);
    }

    return angle;
}

void servoSweepTask(void* parameter) {
    for (;;) {
        // ====================================================================
        // Servo sweep mode with 4 sectors (one per motor)
        // ====================================================================
        // Motor 1: 0° - 30°
        // Motor 2: 31° - 60°
        // Motor 3: 61° - 90°
        // Motor 4: 91° - 120°
        // ====================================================================
        // Track minimum distance per sector (one per motor)
        float min_distance_sector[4] = {999.0f, 999.0f, 999.0f, 999.0f};
        int angle_of_min_sector[4] = {SECTOR_MOTOR_1_MIN, SECTOR_MOTOR_2_MIN,
                                       SECTOR_MOTOR_3_MIN, SECTOR_MOTOR_4_MIN};

        // Track which sectors have been completed and updated
        bool sector_updated[4] = {false, false, false, false};

        // Sweep from 0° to 120°
        for (int angle = SERVO_MIN_ANGLE; angle <= SERVO_MAX_ANGLE; angle += SERVO_STEP) {
            // Move servo to current angle
            tofServo.write(angle);

            // Update shared servo angle (for live radar display)
            extern volatile int shared_servo_angle;
            extern volatile float shared_tof_current;
            shared_servo_angle = angle;

            // Wait for servo to settle
            vTaskDelay(pdMS_TO_TICKS(SERVO_SETTLE_MS));

            // Read TOF distance at this angle
            float distance = tofGetDistance();

            // Update live TOF reading for radar display
            shared_tof_current = distance;

            // Determine which sector (motor) this angle belongs to
            int sector_index = -1;
            if (angle >= SECTOR_MOTOR_1_MIN && angle <= SECTOR_MOTOR_1_MAX) {
                sector_index = 0;  // Motor 1 sector
            } else if (angle >= SECTOR_MOTOR_2_MIN && angle <= SECTOR_MOTOR_2_MAX) {
                sector_index = 1;  // Motor 2 sector
            } else if (angle >= SECTOR_MOTOR_3_MIN && angle <= SECTOR_MOTOR_3_MAX) {
                sector_index = 2;  // Motor 3 sector
            } else if (angle >= SECTOR_MOTOR_4_MIN && angle <= SECTOR_MOTOR_4_MAX) {
                sector_index = 3;  // Motor 4 sector
            }

            // Update shared TOF distance for the corresponding sector (for live radar display)
            // This shows the current distance at the current angle
            if (sector_index >= 0 && distance > 0) {
                extern volatile float shared_tof_distances[4];
                shared_tof_distances[sector_index] = distance;
            }

            // Update minimum distance for this sector
            if (sector_index >= 0 && distance > 0 && distance < min_distance_sector[sector_index]) {
                min_distance_sector[sector_index] = distance;
                angle_of_min_sector[sector_index] = angle;
            }

            // Check if we just completed a sector (transitioning to next or end of sweep)
            int completed_sector = -1;
            if (angle == SECTOR_MOTOR_1_MAX && !sector_updated[0]) {
                completed_sector = 0;  // Motor 1 sector completed
            } else if (angle == SECTOR_MOTOR_2_MAX && !sector_updated[1]) {
                completed_sector = 1;  // Motor 2 sector completed
            } else if (angle == SECTOR_MOTOR_3_MAX && !sector_updated[2]) {
                completed_sector = 2;  // Motor 3 sector completed
            } else if (angle == SECTOR_MOTOR_4_MAX && !sector_updated[3]) {
                completed_sector = 3;  // Motor 4 sector completed
            }

            // Update shared variable immediately when sector completes
            if (completed_sector >= 0 && min_distance_sector[completed_sector] < 999.0f) {
                if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                    shared_min_distance[completed_sector] = min_distance_sector[completed_sector];
                    shared_best_angle[completed_sector] = angle_of_min_sector[completed_sector];
                    xSemaphoreGive(distanceMutex);
                    sector_updated[completed_sector] = true;
                }
            }

            // Small delay between readings
            vTaskDelay(pdMS_TO_TICKS(20));
        }

        // Position servo at center position (60°) for next sweep
        tofServo.write(60);
        vTaskDelay(pdMS_TO_TICKS(SERVO_SETTLE_MS));

        // Brief pause before starting next sweep
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}
