/**
 * @file binary_protocol.h
 * @brief Binary protocol for high-performance data transmission
 *
 * Defines binary packet structure for sending motor control data
 * via serial port. Provides ~35% size reduction and 3-5x faster
 * parsing compared to CSV format.
 *
 * Packet Format:
 * - Header: 2 bytes (0xAA, 0x55) for synchronization
 * - Timestamp: 4 bytes (uint32_t milliseconds)
 * - Setpoints: 20 bytes (5× float)
 * - Pressure Pads: 10 bytes (5× uint16_t)
 * - Duty Cycles: 20 bytes (5× float)
 * - TOF Distances: 20 bytes (5× float)
 * - Servo Angle: 1 byte (uint8_t)
 * - Current TOF: 4 bytes (float)
 * - Mode: 1 byte (uint8_t)
 * - Active Sensor: 1 byte (uint8_t: 0=none, 1=TOF, 2=ultrasonic, 3=both)
 * - CRC: 2 bytes (CRC-16 for error detection)
 * - Total: 85 bytes per packet
 */

#ifndef BINARY_PROTOCOL_H
#define BINARY_PROTOCOL_H

#include <Arduino.h>

// ============================================================================
// Protocol Configuration
// ============================================================================

constexpr uint16_t PACKET_HEADER = 0xAA55;  // Combined sync header (0xAA55)

// ============================================================================
// Data Packet Structure
// ============================================================================

/**
 * @brief Binary data packet structure
 *
 * Uses __attribute__((packed)) to ensure no padding bytes are added
 * by the compiler, guaranteeing consistent size.
 *
 * All pressure/setpoint values are now NORMALIZED (0-100%)
 * based on calibrated prestress (0%) and maxstress*0.95 (100%)
 */
struct __attribute__((packed)) DataPacket {
    // Synchronization header (2 bytes)
    uint16_t header;             // 0xAA55 (combined header bytes)

    // Timestamp (4 bytes)
    uint32_t timestamp_ms;       // Milliseconds since system start

    // Setpoints (20 bytes total: 5x float)
    // All setpoints are in PERCENTAGE (0-100%)
    float setpoint1_pct;         // Motor 1 setpoint in % (0-100)
    float setpoint2_pct;         // Motor 2 setpoint in % (0-100)
    float setpoint3_pct;         // Motor 3 setpoint in % (0-100)
    float setpoint4_pct;         // Motor 4 setpoint in % (0-100)
    float setpoint5_pct;         // Motor 5 setpoint in % (0-100)

    // Pressure pad readings - NORMALIZED (20 bytes total: 5x float)
    // All values are in PERCENTAGE (0-100%) based on calibration
    float pp1_pct;               // Pressure pad 1 normalized (0-100%)
    float pp2_pct;               // Pressure pad 2 normalized (0-100%)
    float pp3_pct;               // Pressure pad 3 normalized (0-100%)
    float pp4_pct;               // Pressure pad 4 normalized (0-100%)
    float pp5_pct;               // Pressure pad 5 normalized (0-100%)

    // Motor duty cycles (20 bytes total: 5x float)
    float duty1_pct;             // Motor 1 duty cycle (-100 to +100%)
    float duty2_pct;             // Motor 2 duty cycle (-100 to +100%)
    float duty3_pct;             // Motor 3 duty cycle (-100 to +100%)
    float duty4_pct;             // Motor 4 duty cycle (-100 to +100%)
    float duty5_pct;             // Motor 5 duty cycle (-100 to +100%)

    // TOF distances (20 bytes total: 5x float)
    // Each motor uses its own sector's minimum distance
    float tof1_cm;               // Motor 1 sector distance (5°-39°)
    float tof2_cm;               // Motor 2 sector distance (39°-73°)
    float tof3_cm;               // Motor 3 sector distance (73°-107°)
    float tof4_cm;               // Motor 4 sector distance (107°-141°)
    float tof5_cm;               // Motor 5 sector distance (141°-175°)

    // Live radar scan data (5 bytes)
    uint8_t servo_angle;         // Current servo position in degrees (0-175°)
    float tof_current_cm;        // TOF distance at current servo angle (real-time)

    // Operation mode (1 byte)
    uint8_t current_mode;        // Current mode: 0=MODE_A, 1=MODE_B

    // Active sensor (1 byte)
    uint8_t active_sensor;       // Which sensor: 0=none, 1=TOF, 2=ultrasonic, 3=both

    // Potentiometer values (8 bytes: 2x float)
    float force_scale;           // Force scale from pot 1 (0.6-1.0)
    float distance_scale;        // Distance scale from pot 2 (0.5-1.5)

    // Dynamic distance thresholds (12 bytes: 3x float)
    float dist_close_max_cm;     // CLOSE/MEDIUM boundary (75-125 cm)
    float dist_medium_max_cm;    // MEDIUM/FAR boundary (125-275 cm)
    float dist_far_max_cm;       // FAR/OUT boundary (150-450 cm)

    // Error detection (2 bytes)
    uint16_t crc;                // CRC-16 checksum
};

// Compile-time size verification
// 95 bytes + 8 bytes (2 floats for scales) + 12 bytes (3 floats for thresholds) = 115 bytes
static_assert(sizeof(DataPacket) == 115, "DataPacket must be exactly 115 bytes");

// ============================================================================
// CRC-16 Calculation
// ============================================================================

/**
 * @brief Calculate CRC-16 checksum
 *
 * Uses CRC-16-CCITT algorithm (polynomial 0x1021)
 * for error detection in binary packets.
 *
 * @param data Pointer to data buffer
 * @param length Length of data in bytes
 * @return 16-bit CRC checksum
 */
inline uint16_t calculateCRC16(const uint8_t* data, size_t length) {
    uint16_t crc = 0xFFFF;  // Initial value

    for (size_t i = 0; i < length; ++i) {
        crc ^= (uint16_t)data[i] << 8;

        for (uint8_t bit = 0; bit < 8; ++bit) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;  // Polynomial
            } else {
                crc = crc << 1;
            }
        }
    }

    return crc;
}

// ============================================================================
// Packet Building Functions
// ============================================================================

/**
 * @brief Build a binary data packet
 *
 * Constructs a complete binary packet with header, data, and CRC checksum.
 *
 * @param packet Pointer to DataPacket structure to fill
 * @param timestamp_ms Timestamp in milliseconds
 * @param setpoints_pct Array of 5 setpoints in percentage (0-100%)
 * @param pp_pct Array of 5 normalized pressure pad readings (0-100%)
 * @param duty_pct Array of 5 duty cycle percentages (-100 to +100%)
 * @param tof_dist_cm Array of 5 TOF distances in centimeters (one per motor/sector)
 * @param servo_angle Current servo position in degrees (0-175)
 * @param tof_current_cm TOF distance at current servo angle
 * @param current_mode Current operation mode (0=MODE_A, 1=MODE_B)
 * @param active_sensor Which sensor provided min distance (0=none, 1=TOF, 2=ultrasonic, 3=both)
 * @param force_scale Force scale from potentiometer 1 (0.6-1.0)
 * @param distance_scale Distance scale from potentiometer 2 (0.5-1.5)
 * @param dist_close_max CLOSE/MEDIUM distance boundary in cm
 * @param dist_medium_max MEDIUM/FAR distance boundary in cm
 * @param dist_far_max FAR/OUT distance boundary in cm
 */
inline void buildDataPacket(
    DataPacket* packet,
    uint32_t timestamp_ms,
    const float setpoints_pct[5],
    const float pp_pct[5],
    const float duty_pct[5],
    const float tof_dist_cm[5],
    uint8_t servo_angle,
    float tof_current_cm,
    uint8_t current_mode,
    uint8_t active_sensor,
    float force_scale,
    float distance_scale,
    float dist_close_max,
    float dist_medium_max,
    float dist_far_max
) {
    // Set header
    packet->header = PACKET_HEADER;

    // Set data fields
    packet->timestamp_ms = timestamp_ms;

    packet->setpoint1_pct = setpoints_pct[0];
    packet->setpoint2_pct = setpoints_pct[1];
    packet->setpoint3_pct = setpoints_pct[2];
    packet->setpoint4_pct = setpoints_pct[3];
    packet->setpoint5_pct = setpoints_pct[4];

    packet->pp1_pct = pp_pct[0];
    packet->pp2_pct = pp_pct[1];
    packet->pp3_pct = pp_pct[2];
    packet->pp4_pct = pp_pct[3];
    packet->pp5_pct = pp_pct[4];

    packet->duty1_pct = duty_pct[0];
    packet->duty2_pct = duty_pct[1];
    packet->duty3_pct = duty_pct[2];
    packet->duty4_pct = duty_pct[3];
    packet->duty5_pct = duty_pct[4];

    packet->tof1_cm = tof_dist_cm[0];
    packet->tof2_cm = tof_dist_cm[1];
    packet->tof3_cm = tof_dist_cm[2];
    packet->tof4_cm = tof_dist_cm[3];
    packet->tof5_cm = tof_dist_cm[4];

    // Set live radar data and current mode
    packet->servo_angle = servo_angle;
    packet->tof_current_cm = tof_current_cm;
    packet->current_mode = current_mode;
    packet->active_sensor = active_sensor;

    // Set potentiometer scale values
    packet->force_scale = force_scale;
    packet->distance_scale = distance_scale;

    // Set dynamic distance thresholds
    packet->dist_close_max_cm = dist_close_max;
    packet->dist_medium_max_cm = dist_medium_max;
    packet->dist_far_max_cm = dist_far_max;

    // Calculate CRC (exclude header and CRC field itself)
    const uint8_t* data_start = (const uint8_t*)packet + 2;  // Skip header (2 bytes)
    size_t data_length = sizeof(DataPacket) - 2 - 2;        // Exclude header and CRC
    packet->crc = calculateCRC16(data_start, data_length);
}

/**
 * @brief Send binary packet via Serial
 *
 * Transmits a complete binary packet over the Serial interface.
 *
 * @param packet Pointer to DataPacket to send
 */
inline void sendBinaryPacket(const DataPacket* packet) {
    Serial.write((const uint8_t*)packet, sizeof(DataPacket));
}

#endif // BINARY_PROTOCOL_H
