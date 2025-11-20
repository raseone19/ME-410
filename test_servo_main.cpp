#include <Arduino.h>
#include <ESP32Servo.h>

// Pin del servo (actualizado para ESP32-S3)
#define SERVO_PIN 6

Servo myServo;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("========================================");
  Serial.println("Test de Servo - ESP32-S3");
  Serial.println("========================================");

  // Inicializar servo
  if (myServo.attach(SERVO_PIN, 544, 2400)) {
    Serial.println("✅ Servo conectado en pin 6");
  } else {
    Serial.println("❌ Error al conectar servo");
  }

  Serial.println("Iniciando barrido continuo...");
}

void loop() {
  // Barrido de 0° a 180°
  Serial.println("→ Barrido hacia adelante (0° → 180°)");
  for (int angle = 0; angle <= 180; angle += 5) {
    myServo.write(angle);
    Serial.printf("  Ángulo: %d°\n", angle);
    delay(50);  // Ajusta la velocidad aquí
  }

  delay(500);  // Pausa en el extremo

  // Barrido de 180° a 0°
  Serial.println("← Barrido hacia atrás (180° → 0°)");
  for (int angle = 180; angle >= 0; angle -= 5) {
    myServo.write(angle);
    Serial.printf("  Ángulo: %d°\n", angle);
    delay(50);  // Ajusta la velocidad aquí
  }

  delay(500);  // Pausa antes de repetir
}
