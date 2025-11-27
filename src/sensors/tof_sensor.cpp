/**
 * @file tof_sensor.cpp
 * @brief Implementation of TOF sensor and servo sweep functions
 */

#include "tof_sensor.h"
#include "../config/pins.h"
#include "../config/system_config.h"
#include "../config/servo_config.h"
#include "../utils/command_handler.h"

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
volatile float shared_min_distance[5] = {999.0f, 999.0f, 999.0f, 999.0f, 999.0f};
volatile int shared_best_angle[5] = {SERVO_MIN_ANGLE, SERVO_MIN_ANGLE, SERVO_MIN_ANGLE, SERVO_MIN_ANGLE, SERVO_MIN_ANGLE};
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
    Serial.println("    [Step 1/5] Starting TOF Serial...");
    Serial.flush();

    // Initialize TOF serial communication
    tofSerial.begin(TOF_BAUDRATE, SERIAL_8N1, TOF_RX_PIN, TOF_TX_PIN);
    delay(100);
    Serial.println("    [Step 1/5] TOF Serial: OK");
    Serial.flush();

    Serial.println("    [Step 2/5] Allocating PWM timer...");
    Serial.flush();

    // Allocate timer for servo (motors use timers 0-2 for channels 0-4)
    // Use timer 3 to avoid conflicts with motor PWM channels
    // ESP32-S3 has 4 timers (0-3), each with 2 channels (8 LEDC channels total)
    if (!servo_channels_allocated) {
        ESP32PWM::allocateTimer(3);  // Use timer 3 for servo (free timer)
        servo_channels_allocated = true;
    }
    Serial.println("    [Step 2/5] PWM Timer: OK");
    Serial.flush();

    Serial.println("    [Step 3/5] Setting servo frequency...");
    Serial.flush();

    // Initialize servo using ESP32Servo library
    tofServo.setPeriodHertz(50);    // Standard 50Hz servo
    Serial.println("    [Step 3/5] Servo frequency: OK");
    Serial.flush();

    Serial.println("    [Step 4/5] Attaching servo to pin...");
    Serial.flush();

    tofServo.attach(SERVO_PIN);
    Serial.println("    [Step 4/5] Servo attached: OK");
    Serial.flush();

    Serial.println("    [Step 5/5] Writing servo position...");
    Serial.flush();

    tofServo.write(SERVO_MIN_ANGLE);  // Start at minimum sweep angle
    delay(500);
    Serial.println("    [Step 5/5] Servo position: OK");
    Serial.flush();

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

float calculateSetpoint(DistanceRange range, float baseline_force_n) {
    switch (range) {
        case RANGE_FAR:
            // Dynamic setpoint: baseline force (captured when entering FAR range) + security offset
            // This accounts for friction variations between different motors and over time
            // If no baseline captured, use fixed FAR setpoint
            if (baseline_force_n > 0.0f) {
                return baseline_force_n + SECURITY_OFFSET_N;
            }
            return SETPOINT_FAR_N;

        case RANGE_MEDIUM:
            return SETPOINT_MEDIUM_N;

        case RANGE_CLOSE:
            return SETPOINT_CLOSE_N;

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
        // Check if sweep is enabled (runtime configuration)
        // ====================================================================
        bool is_sweep_enabled = false;
        int manual_angle = 90;
        int min_angle = SERVO_MIN_ANGLE;
        int max_angle = SERVO_MAX_ANGLE;
        int step_size = SERVO_STEP;
        int settle_time = SERVO_SETTLE_MS;
        int reading_delay = SERVO_READING_DELAY_MS;

        // Read runtime configuration with mutex protection
        if (xSemaphoreTake(configMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            is_sweep_enabled = sweep_enabled;
            manual_angle = servo_manual_angle;
            min_angle = servo_min_angle;
            max_angle = servo_max_angle;
            step_size = servo_step;
            settle_time = servo_settle_ms;
            reading_delay = servo_reading_delay_ms;
            xSemaphoreGive(configMutex);
        }

        // ====================================================================
        // Manual servo control mode (when sweep disabled)
        // ====================================================================
        if (!is_sweep_enabled) {
            // Move servo to manual position
            tofServo.write(manual_angle);

            // Update shared servo angle
            extern volatile int shared_servo_angle;
            extern volatile float shared_tof_current;
            shared_servo_angle = manual_angle;

            // Read TOF distance at manual position
            vTaskDelay(pdMS_TO_TICKS(settle_time));
            float distance = tofGetDistance();
            shared_tof_current = distance;

            // Determine sector for this angle
            int sector_index = -1;
            if (manual_angle >= SECTOR_MOTOR_1_MIN && manual_angle < SECTOR_MOTOR_1_MAX) {
                sector_index = 0;
            } else if (manual_angle >= SECTOR_MOTOR_2_MIN && manual_angle < SECTOR_MOTOR_2_MAX) {
                sector_index = 1;
            } else if (manual_angle >= SECTOR_MOTOR_3_MIN && manual_angle < SECTOR_MOTOR_3_MAX) {
                sector_index = 2;
            } else if (manual_angle >= SECTOR_MOTOR_4_MIN && manual_angle < SECTOR_MOTOR_4_MAX) {
                sector_index = 3;
            } else if (manual_angle >= SECTOR_MOTOR_5_MIN && manual_angle <= SECTOR_MOTOR_5_MAX) {
                sector_index = 4;
            }

            // Update shared TOF distance for the sector
            if (sector_index >= 0 && distance > 0) {
                extern volatile float shared_tof_distances[5];
                shared_tof_distances[sector_index] = distance;
            }

            // Wait before next check (lower priority when not sweeping)
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;  // Skip sweep code, restart loop
        }

        // ====================================================================
        // Automatic servo sweep mode (5 sectors, one per motor)
        // ====================================================================
        // Motor 1: 5° - 39°
        // Motor 2: 39° - 73°
        // Motor 3: 73° - 107°
        // Motor 4: 107° - 141°
        // Motor 5: 141° - 175°
        // ====================================================================

#ifdef SWEEP_MODE_FORWARD
        // ====================================================================
        // FORWARD SWEEP MODE: 0° to 120°, then restart at 0°
        // ====================================================================

        // Track minimum distance per sector (one per motor)
        float min_distance_sector[5] = {999.0f, 999.0f, 999.0f, 999.0f, 999.0f};
        int angle_of_min_sector[5] = {SECTOR_MOTOR_1_MIN, SECTOR_MOTOR_2_MIN,
                                       SECTOR_MOTOR_3_MIN, SECTOR_MOTOR_4_MIN,
                                       SECTOR_MOTOR_5_MIN};

        // Track which sectors have been completed and updated
        bool sector_updated[5] = {false, false, false, false, false};

        // Sweep from min to max angle (using runtime configuration)
        for (int angle = min_angle; angle <= max_angle; angle += step_size) {
            // Move servo to current angle
            tofServo.write(angle);

            // Update shared servo angle (for live radar display)
            extern volatile int shared_servo_angle;
            extern volatile float shared_tof_current;
            shared_servo_angle = angle;

            // Wait for servo to settle (using runtime configuration)
            vTaskDelay(pdMS_TO_TICKS(settle_time));

            // Read TOF distance at this angle
            float distance = tofGetDistance();

            // Update live TOF reading for radar display
            shared_tof_current = distance;

            // Determine which sector (motor) this angle belongs to
            // Use semi-open intervals [MIN, MAX) to avoid boundary ambiguity
            int sector_index = -1;
            if (angle >= SECTOR_MOTOR_1_MIN && angle < SECTOR_MOTOR_1_MAX) {
                sector_index = 0;  // Motor 1 sector: [5, 39)
            } else if (angle >= SECTOR_MOTOR_2_MIN && angle < SECTOR_MOTOR_2_MAX) {
                sector_index = 1;  // Motor 2 sector: [39, 73)
            } else if (angle >= SECTOR_MOTOR_3_MIN && angle < SECTOR_MOTOR_3_MAX) {
                sector_index = 2;  // Motor 3 sector: [73, 107)
            } else if (angle >= SECTOR_MOTOR_4_MIN && angle < SECTOR_MOTOR_4_MAX) {
                sector_index = 3;  // Motor 4 sector: [107, 141)
            } else if (angle >= SECTOR_MOTOR_5_MIN && angle <= SECTOR_MOTOR_5_MAX) {
                sector_index = 4;  // Motor 5 sector: [141, 175]
            }

            // Update shared TOF distance for the corresponding sector (for live radar display)
            // This shows the current distance at the current angle
            if (sector_index >= 0 && distance > 0) {
                extern volatile float shared_tof_distances[5];
                shared_tof_distances[sector_index] = distance;
            }

            // Update minimum distance for this sector
            if (sector_index >= 0 && distance > 0 && distance < min_distance_sector[sector_index]) {
                min_distance_sector[sector_index] = distance;
                angle_of_min_sector[sector_index] = angle;
            }

            // FORWARD sweep: update when reaching/passing MAX angle OR when leaving sector
            // Handle cases where SERVO_STEP doesn't align with MAX angles
            int completed_sector = -1;
            if ((angle >= SECTOR_MOTOR_1_MAX || angle + step_size > SECTOR_MOTOR_1_MAX) && !sector_updated[0]) {
                completed_sector = 0;  // Motor 1 sector completed
            } else if ((angle >= SECTOR_MOTOR_2_MAX || angle + step_size > SECTOR_MOTOR_2_MAX) && !sector_updated[1]) {
                completed_sector = 1;  // Motor 2 sector completed
            } else if ((angle >= SECTOR_MOTOR_3_MAX || angle + step_size > SECTOR_MOTOR_3_MAX) && !sector_updated[2]) {
                completed_sector = 2;  // Motor 3 sector completed
            } else if ((angle >= SECTOR_MOTOR_4_MAX || angle + step_size > SECTOR_MOTOR_4_MAX) && !sector_updated[3]) {
                completed_sector = 3;  // Motor 4 sector completed
            } else if ((angle >= SECTOR_MOTOR_5_MAX || angle + step_size > SECTOR_MOTOR_5_MAX) && !sector_updated[4]) {
                completed_sector = 4;  // Motor 5 sector completed
            }

            // Update shared variable when sector sweep completes (at MAX angle)
            if (completed_sector >= 0 && min_distance_sector[completed_sector] < 999.0f) {
                if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                    shared_min_distance[completed_sector] = min_distance_sector[completed_sector];
                    shared_best_angle[completed_sector] = angle_of_min_sector[completed_sector];
                    xSemaphoreGive(distanceMutex);
                    sector_updated[completed_sector] = true;
                }
            }

            // Small delay between readings (using runtime configuration)
            vTaskDelay(pdMS_TO_TICKS(reading_delay));
        }

        // Position servo at center position (60°) for next sweep
        tofServo.write(60);
        vTaskDelay(pdMS_TO_TICKS(SERVO_SETTLE_MS));

        // Brief pause before starting next sweep
        vTaskDelay(pdMS_TO_TICKS(100));

#endif // SWEEP_MODE_FORWARD

#ifdef SWEEP_MODE_BIDIRECTIONAL
        // ====================================================================
        // BIDIRECTIONAL SWEEP MODE: 0° to 120° to 0°
        // ====================================================================

        // Track minimum distance per sector (one per motor)
        float min_distance_sector[5] = {999.0f, 999.0f, 999.0f, 999.0f, 999.0f};
        int angle_of_min_sector[5] = {SECTOR_MOTOR_1_MIN, SECTOR_MOTOR_2_MIN,
                                       SECTOR_MOTOR_3_MIN, SECTOR_MOTOR_4_MIN,
                                       SECTOR_MOTOR_5_MIN};

        // Track which sectors have been updated during forward and backward sweeps
        bool sector_updated_forward[5] = {false, false, false, false, false};
        bool sector_updated_backward[5] = {false, false, false, false, false};

        // FORWARD SWEEP: min to max angle (using runtime configuration)
        for (int angle = min_angle; angle <= max_angle; angle += step_size) {
            // Move servo to current angle
            tofServo.write(angle);

            // Update shared servo angle (for live radar display)
            extern volatile int shared_servo_angle;
            extern volatile float shared_tof_current;
            shared_servo_angle = angle;

            // Wait for servo to settle (using runtime configuration)
            vTaskDelay(pdMS_TO_TICKS(settle_time));

            // Read TOF distance at this angle
            float distance = tofGetDistance();

            // Update live TOF reading for radar display
            shared_tof_current = distance;

            // Determine which sector (motor) this angle belongs to
            // Use semi-open intervals [MIN, MAX) to avoid boundary ambiguity
            int sector_index = -1;
            if (angle >= SECTOR_MOTOR_1_MIN && angle < SECTOR_MOTOR_1_MAX) {
                sector_index = 0;  // Motor 1 sector: [5, 39)
            } else if (angle >= SECTOR_MOTOR_2_MIN && angle < SECTOR_MOTOR_2_MAX) {
                sector_index = 1;  // Motor 2 sector: [39, 73)
            } else if (angle >= SECTOR_MOTOR_3_MIN && angle < SECTOR_MOTOR_3_MAX) {
                sector_index = 2;  // Motor 3 sector: [73, 107)
            } else if (angle >= SECTOR_MOTOR_4_MIN && angle < SECTOR_MOTOR_4_MAX) {
                sector_index = 3;  // Motor 4 sector: [107, 141)
            } else if (angle >= SECTOR_MOTOR_5_MIN && angle <= SECTOR_MOTOR_5_MAX) {
                sector_index = 4;  // Motor 5 sector: [141, 175]
            }

            // Update shared TOF distance for the corresponding sector (for live radar display)
            if (sector_index >= 0 && distance > 0) {
                extern volatile float shared_tof_distances[5];
                shared_tof_distances[sector_index] = distance;
            }

            // Update minimum distance for this sector
            if (sector_index >= 0 && distance > 0 && distance < min_distance_sector[sector_index]) {
                min_distance_sector[sector_index] = distance;
                angle_of_min_sector[sector_index] = angle;
            }

            // FORWARD sweep: update when reaching/passing MAX angle OR when leaving sector
            // Handle cases where step_size doesn't align with MAX angles
            int completed_sector = -1;
            if ((angle >= SECTOR_MOTOR_1_MAX || angle + step_size > SECTOR_MOTOR_1_MAX) && !sector_updated_forward[0]) {
                completed_sector = 0;  // Motor 1 sector completed
            } else if ((angle >= SECTOR_MOTOR_2_MAX || angle + step_size > SECTOR_MOTOR_2_MAX) && !sector_updated_forward[1]) {
                completed_sector = 1;  // Motor 2 sector completed
            } else if ((angle >= SECTOR_MOTOR_3_MAX || angle + step_size > SECTOR_MOTOR_3_MAX) && !sector_updated_forward[2]) {
                completed_sector = 2;  // Motor 3 sector completed
            } else if ((angle >= SECTOR_MOTOR_4_MAX || angle + step_size > SECTOR_MOTOR_4_MAX) && !sector_updated_forward[3]) {
                completed_sector = 3;  // Motor 4 sector completed
            } else if ((angle >= SECTOR_MOTOR_5_MAX || angle + step_size > SECTOR_MOTOR_5_MAX) && !sector_updated_forward[4]) {
                completed_sector = 4;  // Motor 5 sector completed
            }

            // Update shared variable when sector sweep completes (at MAX angle)
            if (completed_sector >= 0 && min_distance_sector[completed_sector] < 999.0f) {
                if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                    shared_min_distance[completed_sector] = min_distance_sector[completed_sector];
                    shared_best_angle[completed_sector] = angle_of_min_sector[completed_sector];
                    xSemaphoreGive(distanceMutex);
                    sector_updated_forward[completed_sector] = true;
                }
            }

            // Small delay between readings (using runtime configuration)
            vTaskDelay(pdMS_TO_TICKS(reading_delay));
        }

        // Reset sector tracking for backward sweep
        for (int i = 0; i < 5; i++) {
            min_distance_sector[i] = 999.0f;
            angle_of_min_sector[i] = SERVO_MAX_ANGLE;  // Will be updated during backward sweep
        }

        // BACKWARD SWEEP: max to min angle (using runtime configuration)
        for (int angle = max_angle; angle >= min_angle; angle -= step_size) {
            // Move servo to current angle
            tofServo.write(angle);

            // Update shared servo angle (for live radar display)
            extern volatile int shared_servo_angle;
            extern volatile float shared_tof_current;
            shared_servo_angle = angle;

            // Wait for servo to settle (using runtime configuration)
            vTaskDelay(pdMS_TO_TICKS(settle_time));

            // Read TOF distance at this angle
            float distance = tofGetDistance();

            // Update live TOF reading for radar display
            shared_tof_current = distance;

            // Determine which sector (motor) this angle belongs to
            // Use semi-open intervals [MIN, MAX) to avoid boundary ambiguity
            int sector_index = -1;
            if (angle >= SECTOR_MOTOR_1_MIN && angle < SECTOR_MOTOR_1_MAX) {
                sector_index = 0;  // Motor 1 sector: [5, 39)
            } else if (angle >= SECTOR_MOTOR_2_MIN && angle < SECTOR_MOTOR_2_MAX) {
                sector_index = 1;  // Motor 2 sector: [39, 73)
            } else if (angle >= SECTOR_MOTOR_3_MIN && angle < SECTOR_MOTOR_3_MAX) {
                sector_index = 2;  // Motor 3 sector: [73, 107)
            } else if (angle >= SECTOR_MOTOR_4_MIN && angle < SECTOR_MOTOR_4_MAX) {
                sector_index = 3;  // Motor 4 sector: [107, 141)
            } else if (angle >= SECTOR_MOTOR_5_MIN && angle <= SECTOR_MOTOR_5_MAX) {
                sector_index = 4;  // Motor 5 sector: [141, 175]
            }

            // Update shared TOF distance for the corresponding sector (for live radar display)
            if (sector_index >= 0 && distance > 0) {
                extern volatile float shared_tof_distances[5];
                shared_tof_distances[sector_index] = distance;
            }

            // Update minimum distance for this sector
            if (sector_index >= 0 && distance > 0 && distance < min_distance_sector[sector_index]) {
                min_distance_sector[sector_index] = distance;
                angle_of_min_sector[sector_index] = angle;
            }

            // BACKWARD sweep: update when reaching/passing MIN angle OR when leaving sector
            // Handle cases where step_size doesn't align with MIN angles
            int completed_sector = -1;
            if ((angle <= SECTOR_MOTOR_5_MIN || angle - step_size < SECTOR_MOTOR_5_MIN) && !sector_updated_backward[4]) {
                completed_sector = 4;  // Motor 5 sector completed at min angle
            } else if ((angle <= SECTOR_MOTOR_4_MIN || angle - step_size < SECTOR_MOTOR_4_MIN) && !sector_updated_backward[3]) {
                completed_sector = 3;  // Motor 4 sector completed at min angle
            } else if ((angle <= SECTOR_MOTOR_3_MIN || angle - step_size < SECTOR_MOTOR_3_MIN) && !sector_updated_backward[2]) {
                completed_sector = 2;  // Motor 3 sector completed at min angle
            } else if ((angle <= SECTOR_MOTOR_2_MIN || angle - step_size < SECTOR_MOTOR_2_MIN) && !sector_updated_backward[1]) {
                completed_sector = 1;  // Motor 2 sector completed at min angle
            } else if ((angle <= SECTOR_MOTOR_1_MIN || angle - step_size < SECTOR_MOTOR_1_MIN) && !sector_updated_backward[0]) {
                completed_sector = 0;  // Motor 1 sector completed at min angle
            }

            // Update shared variable when reaching min angle of sector
            if (completed_sector >= 0 && min_distance_sector[completed_sector] < 999.0f) {
                if (xSemaphoreTake(distanceMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                    shared_min_distance[completed_sector] = min_distance_sector[completed_sector];
                    shared_best_angle[completed_sector] = angle_of_min_sector[completed_sector];
                    xSemaphoreGive(distanceMutex);
                    sector_updated_backward[completed_sector] = true;
                }
            }

            // Small delay between readings (using runtime configuration)
            vTaskDelay(pdMS_TO_TICKS(reading_delay));
        }

        // Brief pause before starting next sweep (already at min angle)
        vTaskDelay(pdMS_TO_TICKS(100));

#endif // SWEEP_MODE_BIDIRECTIONAL
    }
}
