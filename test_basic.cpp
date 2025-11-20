/**
 * Simple ESP32-S3 Test Program
 * Tests basic serial communication without hardware initialization
 */

#include <Arduino.h>

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("========================================");
    Serial.println("ESP32-S3 Basic Test");
    Serial.println("========================================");
    Serial.print("Chip Model: ");
    Serial.println(ESP.getChipModel());
    Serial.print("Chip Revision: ");
    Serial.println(ESP.getChipRevision());
    Serial.print("CPU Frequency: ");
    Serial.print(ESP.getCpuFreqMHz());
    Serial.println(" MHz");
    Serial.print("Free Heap: ");
    Serial.println(ESP.getFreeHeap());
    Serial.println("========================================");
    Serial.println();
    Serial.println("If you see this, the ESP32-S3 is working!");
    Serial.println("Sending test messages every second...");
    Serial.println();
}

int counter = 0;

void loop() {
    Serial.print("Test message #");
    Serial.print(counter++);
    Serial.print(" - Time: ");
    Serial.print(millis());
    Serial.println(" ms");

    delay(1000);
}
