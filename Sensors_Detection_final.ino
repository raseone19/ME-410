#include <ESP32Servo.h>

// ========== CONFIGURATION PARAMETERS (CHANGE THESE) ==========
const int ANGLE_INCREMENT = 20;      // Angle increment for servo sweep (degrees)
const int MEASURE_DELAY =10 ;       // Delay at each position for sensor reading (ms)
const int MOVE_DELAY = 5;           // Delay between servo movements (ms)
const int SERVO_PIN = 5;             // Servo motor pin

const int TOF_RX_PIN = 16;           // TOF sensor RX pin (adjust as needed)
const int TOF_TX_PIN = 17;           // TOF sensor TX pin (adjust as needed)
const unsigned long TOF_BAUDRATE = 921600;  // TOF sensor baudrate

// CSV OUTPUT OPTIONS
const bool CSV_MODE = true;          // true = CSV output, false = human-readable output

// COMENTS
// MESURE_DELAY/MOVE_DELAY= 100/5 FAST (100 IS THE MIN) = 300/15 PRECISE. = 150/10 BALANCE
// ========== GLOBAL VARIABLES ==========
Servo motorServo;
HardwareSerial tofSerial(1);  // Use Serial1 for TOF

// TOF sensor variables
uint8_t tof_id = 0;
uint32_t tof_systemTime = 0;
float tof_distance = 0.0f;
uint8_t tof_distanceStatus = 0;
uint16_t tof_signalStrength = 0;
uint8_t tof_rangePrecision = 0;

// Ultrasonic sensor variables
long ultrasonic_anVolt = 0;
float ultrasonic_cm = 0;

// Previous valid readings (for null value handling)
float prev_tof = 0.0f;
float prev_ultrasonic = 0.0f;

// Maximum distance limit
const float MAX_DISTANCE = 800.0f;  // Maximum distance in cm

// ========== TOF SENSOR FUNCTIONS ==========
size_t tof_readN(uint8_t* buf, size_t len, uint16_t timeout = 1500) {
    size_t offset = 0;
    unsigned long startTime = millis();
    while (offset < len) {
        if (tofSerial.available()) {
            buf[offset++] = tofSerial.read();
        }
        if (millis() - startTime > timeout) break;
    }
    return offset;
}

float tof_getDistance() {
    uint8_t rx_buf[16];
    uint8_t ch;
    uint8_t checksum = 0;
    const uint16_t timeout = 1000;
    bool success = false;

    // Clear old data
    while (tofSerial.available() > 0) tofSerial.read();

    unsigned long startTime = millis();

    // Try to read a valid frame
    while (millis() - startTime < timeout) {
        if (tof_readN(&ch, 1, 100) == 1 && ch == 0x57) {
            rx_buf[0] = ch;
            if (tof_readN(&ch, 1, 100) == 1 && ch == 0x00) {
                rx_buf[1] = ch;
                if (tof_readN(&rx_buf[2], 14, 100) == 14) {
                    checksum = 0;
                    for (int i = 0; i < 15; i++) checksum += rx_buf[i];
                    if (checksum == rx_buf[15]) {
                        tof_id = rx_buf[3];
                        tof_systemTime = ((uint32_t)rx_buf[7] << 24) |
                                        ((uint32_t)rx_buf[6] << 16) |
                                        ((uint32_t)rx_buf[5] << 8) |
                                        (uint32_t)rx_buf[4];
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
        return tof_distance * 100.0f;  // Convert to cm
    } else {
        return -1.0f;  // Error value
    }
}

// ========== ULTRASONIC SENSOR FUNCTIONS ==========
float ultrasonic_getDistance() {
    ultrasonic_anVolt = analogRead(ULTRASONIC_PIN);  // ADC value: 0-4095 on ESP32
    ultrasonic_cm = (ultrasonic_anVolt / 4095.0) * 500.0;  // Convert to cm
    return ultrasonic_cm;
}

// ========== DATA FILTERING FUNCTION ==========
float filterSensorData(float raw_value, float &previous_value) {
    float filtered_value = raw_value;
    
    // If value is null or invalid (< 0), use previous value
    if (raw_value < 0 || isnan(raw_value)) {
        filtered_value = previous_value;
    }
    // If value exceeds maximum, cap it at MAX_DISTANCE
    else if (raw_value > MAX_DISTANCE) {
        filtered_value = MAX_DISTANCE;
    }
    // Valid value - update previous value
    else {
        previous_value = raw_value;
        filtered_value = raw_value;
    }
    
    return filtered_value;
}

// ========== MOTOR FUNCTIONS ==========
void moveMotor(int startAngle, int endAngle, int delayTime) {
    if (startAngle < endAngle) {
        for (int pos = startAngle; pos <= endAngle; pos++) {
            motorServo.write(pos);
            delay(delayTime);
        }
    } else if (startAngle > endAngle) {
        for (int pos = startAngle; pos >= endAngle; pos--) {
            motorServo.write(pos);
            delay(delayTime);
        }
    }
}

// ========== MAIN SWEEP FUNCTION ==========
void performSweep() {
    if (!CSV_MODE) {
        Serial.println("\n========== FORWARD SWEEP (0° to 180°) ==========");
    }
    
    // Forward sweep: 0° to 180°
    for (int angle = 0; angle <= 180; angle += ANGLE_INCREMENT) {
        motorServo.write(angle);
        delay(MEASURE_DELAY);
        
        // Read both sensors (raw values)
        float tof_dist_raw = tof_getDistance();
        float ultrasonic_dist_raw = ultrasonic_getDistance();
        
        // Apply filters
        float tof_dist = filterSensorData(tof_dist_raw, prev_tof);
        float ultrasonic_dist = filterSensorData(ultrasonic_dist_raw, prev_ultrasonic);
        
        // Print results
        if (CSV_MODE) {
            // CSV format: angle,ultrasonic_value,tof_value
            Serial.print(angle);
            Serial.print(",");
            Serial.print(ultrasonic_dist, 2);
            Serial.print(",");
            Serial.println(tof_dist, 2);
        } else {
            // Human-readable format
            Serial.print("Angle: ");
            Serial.print(angle);
            Serial.print("° | TOF: ");
            if (tof_dist > 0) {
                Serial.print(tof_dist, 1);
                Serial.print(" cm");
            } else {
                Serial.print("ERROR");
            }
            Serial.print(" | Ultrasonic: ");
            Serial.print(ultrasonic_dist, 1);
            Serial.println(" cm");
        }
        
        // Move smoothly to next position
        int nextAngle = angle + ANGLE_INCREMENT;
        if (nextAngle <= 180) {
            moveMotor(angle, nextAngle, MOVE_DELAY);
        }
    }
    
    if (!CSV_MODE) {
        Serial.println("\n========== BACKWARD SWEEP (180° to 0°) ==========");
    }
    
    // Backward sweep: 180° to 0°
    for (int angle = 180; angle >= 0; angle -= ANGLE_INCREMENT) {
        motorServo.write(angle);
        delay(MEASURE_DELAY);
        
        // Read both sensors (raw values)
        float tof_dist_raw = tof_getDistance();
        float ultrasonic_dist_raw = ultrasonic_getDistance();
        
        // Apply filters
        float tof_dist = filterSensorData(tof_dist_raw, prev_tof);
        float ultrasonic_dist = filterSensorData(ultrasonic_dist_raw, prev_ultrasonic);
        
        // Print results
        if (CSV_MODE) {
            // CSV format: angle,ultrasonic_value,tof_value
            Serial.print(angle);
            Serial.print(",");
            Serial.print(ultrasonic_dist, 2);
            Serial.print(",");
            Serial.println(tof_dist, 2);
        } else {
            // Human-readable format
            Serial.print("Angle: ");
            Serial.print(angle);
            Serial.print("° | TOF: ");
            if (tof_dist > 0) {
                Serial.print(tof_dist, 1);
                Serial.print(" cm");
            } else {
                Serial.print("ERROR");
            }
            Serial.print(" | Ultrasonic: ");
            Serial.print(ultrasonic_dist, 1);
            Serial.println(" cm");
        }
        
        // Move smoothly to next position
        int nextAngle = angle - ANGLE_INCREMENT;
        if (nextAngle >= 0) {
            moveMotor(angle, nextAngle, MOVE_DELAY);
        }
    }
    
    if (!CSV_MODE) {
        Serial.println("\n========== SWEEP COMPLETE ==========\n");
    }
    
    // Explicitly return to 0° at the end of the cycle
    motorServo.write(0);
    delay(1000);  // Wait for it to reach 0° before the next sweep
}

// ========== ARDUINO SETUP ==========
void setup() {
    delay(2000);  // Extra delay for upload stability
    Serial.begin(115200);
    delay(1000);  // Give time to establish serial connection
    
    if (!CSV_MODE) {
        Serial.println("\n\n========================================");
        Serial.println("  OBSTACLE DETECTION SYSTEM - STARTING");
        Serial.println("========================================");
        
        // Initialize TOF sensor
        Serial.println("Initializing TOF sensor...");
    }
    
    tofSerial.begin(TOF_BAUDRATE, SERIAL_8N1, TOF_RX_PIN, TOF_TX_PIN);
    delay(100);
    
    if (!CSV_MODE) {
        Serial.println("TOF sensor initialized");
        
        // Initialize servo motor
        Serial.println("Initializing servo motor...");
    }
    
    motorServo.attach(SERVO_PIN);
    
    if (!CSV_MODE) {
        Serial.println("Servo motor initialized");
        Serial.println("Moving to initial position (0°)...");
    }
    
    // Ensure the servo is at 0° before starting
    motorServo.write(0);
    delay(2000);  // Wait 2 seconds for it to reach 0°
    
    if (!CSV_MODE) {
        Serial.println("Servo at 0° - Ready to start");
        
        // Configuration summary
        Serial.println("\n--- CONFIGURATION ---");
        Serial.print("Angle increment: ");
        Serial.print(ANGLE_INCREMENT);
        Serial.println("°");
        Serial.print("Measure delay: ");
        Serial.print(MEASURE_DELAY);
        Serial.println(" ms");
        Serial.print("Move delay: ");
        Serial.print(MOVE_DELAY);
        Serial.println(" ms");
        Serial.println("=====================\n");
    } else {
        // Print CSV header
        Serial.println("angle,ultrasonic_cm,tof_cm");
    }
    
    delay(1000);
}

// ========== ARDUINO LOOP ==========
void loop() {
    performSweep();
}
