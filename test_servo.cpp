/**
 * @file test_servo.cpp
 * @brief Simple servo test program
 *
 * Upload this to test if the servo is working.
 * The servo should sweep back and forth continuously.
 */

#include <Arduino.h>
#include <ESP32Servo.h>

// Pin configuration
const int SERVO_PIN = 22;

// Servo object
Servo testServo;

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("========================================");
    Serial.println("ESP32 Servo Test");
    Serial.println("========================================");
    Serial.println();

    // Attach servo to pin 22
    Serial.print("Attaching servo to pin ");
    Serial.println(SERVO_PIN);

    testServo.attach(SERVO_PIN);

    Serial.println("Servo attached!");
    Serial.println("Starting sweep test...");
    Serial.println();
}

void loop() {
    // Sweep from 0 to 180 degrees
    Serial.println("Moving to 0 degrees");
    testServo.write(0);
    delay(1000);

    Serial.println("Moving to 45 degrees");
    testServo.write(45);
    delay(1000);

    Serial.println("Moving to 90 degrees");
    testServo.write(90);
    delay(1000);

    Serial.println("Moving to 135 degrees");
    testServo.write(135);
    delay(1000);

    Serial.println("Moving to 180 degrees");
    testServo.write(180);
    delay(1000);

    Serial.println("---");
    delay(500);
}
