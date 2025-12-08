/**
 * @file test_ultrasound.cpp
 * @brief Test code for HRLV-MaxSonar-EZ ultrasonic sensor (MaxBotix)
 *
 * This sensor supports 3 output modes (only one pin needed):
 * - Analog (AN): Voltage output (Vcc/512 per cm)
 * - PWM (PW): Pulse width output (147μs per cm)
 * - Serial (TX): Serial output at 9600 baud
 *
 * Default: ANALOG mode on GPIO 5
 * Change TEST_MODE to try different modes
 */

#include <Arduino.h>

// ============================================================================
// CONFIGURATION
// ============================================================================

// Choose test mode: MODE_PWM, MODE_ANALOG, or MODE_SERIAL
#define MODE_PWM 1
#define MODE_ANALOG 2
#define MODE_SERIAL 3

#define TEST_MODE MODE_ANALOG  // Change this to switch modes

// Pin configuration
constexpr uint8_t SENSOR_PIN = 19;  // GPIO 19

// Timing
constexpr uint32_t READ_INTERVAL_MS = 100;  // Read every 100ms (MaxSonar updates at ~10Hz)

// Analog mode constants
constexpr float ADC_MAX = 4095.0;        // ESP32 12-bit ADC
constexpr float VREF = 3.3;              // ESP32 reference voltage
constexpr float VOLTS_PER_CM = 3.3/512;  // HRLV: 3.3V / 512cm range

// PWM mode constants
constexpr float US_PER_CM = 147.0;       // HRLV: 147μs per cm
constexpr uint32_t PWM_TIMEOUT_US = 100000; // 100ms timeout

// Serial mode
constexpr uint32_t SERIAL_BAUD = 9600;

// ============================================================================
// SENSOR READING FUNCTIONS
// ============================================================================

/**
 * @brief Read distance using PWM output
 * @return Distance in centimeters, or -1 if error
 */
float readDistancePWM() {
  // Read pulse width (HIGH time)
  unsigned long pulseWidth = pulseIn(SENSOR_PIN, HIGH, PWM_TIMEOUT_US);

  if (pulseWidth == 0) {
    return -1.0; // Timeout
  }

  // Convert pulse width to distance
  // HRLV: 147μs per cm
  float distance_cm = pulseWidth / US_PER_CM;

  return distance_cm;
}

/**
 * @brief Read distance using analog voltage output
 * @return Distance in centimeters, or -1 if error
 */
float readDistanceAnalog() {
  // Read ADC value
  int adcValue = analogRead(SENSOR_PIN);

  // Convert to voltage
  float voltage = (adcValue / ADC_MAX) * VREF;

  // Convert voltage to distance
  // HRLV: Vcc/512 per cm, with Vcc = 3.3V
  float distance_cm = voltage / VOLTS_PER_CM;

  return distance_cm;
}

/**
 * @brief Read distance using serial output
 * @return Distance in centimeters, or -1 if error
 */
float readDistanceSerial() {
  // Check if data available
  if (Serial2.available() < 1) {
    return -1.0;
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
      return distance_cm;
    }
  }

  return -1.0;
}

// ============================================================================
// MAIN PROGRAM
// ============================================================================

void setup() {
  // Initialize USB serial for output
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n===========================================");
  Serial.println("  HRLV-MaxSonar-EZ Ultrasonic Test");
  Serial.println("===========================================");

#if TEST_MODE == MODE_PWM
  Serial.println("Mode: PWM");
#elif TEST_MODE == MODE_ANALOG
  Serial.println("Mode: ANALOG");
#elif TEST_MODE == MODE_SERIAL
  Serial.println("Mode: SERIAL");
#endif

  Serial.printf("Pin: GPIO %d\n", SENSOR_PIN);
  Serial.println("===========================================");
  Serial.println("Range: 30cm - 500cm (HRLV model)");
  Serial.println("===========================================\n");

#if TEST_MODE == MODE_PWM
  // Configure pin as input for PWM reading
  pinMode(SENSOR_PIN, INPUT);
  Serial.println("✓ PWM mode initialized");
  Serial.println("  Reading pulse width from PW pin...\n");

#elif TEST_MODE == MODE_ANALOG
  // Configure pin as analog input
  pinMode(SENSOR_PIN, INPUT);
  analogReadResolution(12); // 12-bit resolution
  Serial.println("✓ Analog mode initialized");
  Serial.println("  Reading voltage from AN pin...\n");

#elif TEST_MODE == MODE_SERIAL
  // Configure Serial2 for MaxSonar communication
  Serial2.begin(SERIAL_BAUD, SERIAL_8N1, SENSOR_PIN, -1); // RX only
  Serial.println("✓ Serial mode initialized");
  Serial.println("  Reading serial data from TX pin...\n");

#else
  #error "Invalid TEST_MODE. Use: MODE_PWM, MODE_ANALOG, or MODE_SERIAL"
#endif

  delay(250); // Give sensor time to stabilize
  Serial.println("Starting measurements...\n");
}

void loop() {
  // Read distance based on mode
  float distance = -1.0;

#if TEST_MODE == MODE_PWM
  distance = readDistancePWM();
#elif TEST_MODE == MODE_ANALOG
  distance = readDistanceAnalog();
#elif TEST_MODE == MODE_SERIAL
  distance = readDistanceSerial();
#endif

  // Print result
  if (distance < 0) {
    Serial.println("❌ ERROR: No reading / Timeout");
  } else if (distance < 30.0) {
    Serial.printf("⚠️  Too close: %.1f cm (min 30cm)\n", distance);
  } else if (distance > 500.0) {
    Serial.printf("⚠️  Out of range: %.1f cm (max 500cm)\n", distance);
  } else {
    // Print with visual bar
    Serial.printf("✅ %4.1f cm  ", distance);

    // Visual bar (scale: 30-500cm mapped to 0-50 chars)
    int barLength = map(distance, 30, 500, 0, 50);
    Serial.print("[");
    for (int i = 0; i < 50; i++) {
      if (i < barLength) {
        Serial.print("=");
      } else {
        Serial.print(" ");
      }
    }
    Serial.println("]");
  }

  delay(READ_INTERVAL_MS);
}
