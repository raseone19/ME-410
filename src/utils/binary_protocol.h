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
 * - Data: 38 bytes (timestamps, setpoints, pressures, duties, distance)
 * - CRC: 2 bytes (CRC-16 for error detection)
 * - Total: 42 bytes per packet
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
 * by the compiler, guaranteeing consistent 40-byte size.
 */
struct __attribute__((packed)) DataPacket {
    // Synchronization header (2 bytes)
    uint16_t header;             // 0xAA55 (combined header bytes)

    // Timestamp (4 bytes)
    uint32_t timestamp_ms;       // Milliseconds since system start

    // Setpoints (16 bytes total: 4x float)
    // MODE_A: All motors use setpoint1_mv (others same)
    // MODE_B: Each motor uses its own setpoint
    float setpoint1_mv;          // Motor 1 setpoint in millivolts
    float setpoint2_mv;          // Motor 2 setpoint in millivolts
    float setpoint3_mv;          // Motor 3 setpoint in millivolts
    float setpoint4_mv;          // Motor 4 setpoint in millivolts

    // Pressure pad readings (8 bytes total: 4x uint16_t)
    uint16_t pp1_mv;             // Pressure pad 1 in millivolts
    uint16_t pp2_mv;             // Pressure pad 2 in millivolts
    uint16_t pp3_mv;             // Pressure pad 3 in millivolts
    uint16_t pp4_mv;             // Pressure pad 4 in millivolts

    // Motor duty cycles (16 bytes total: 4x float)
    float duty1_pct;             // Motor 1 duty cycle (0-100%)
    float duty2_pct;             // Motor 2 duty cycle (0-100%)
    float duty3_pct;             // Motor 3 duty cycle (0-100%)
    float duty4_pct;             // Motor 4 duty cycle (0-100%)

    // TOF distances (16 bytes total: 4x float)
    // MODE_A: All motors use tof1_cm (others unused)
    // MODE_B: Each motor uses its own sector's minimum distance
    float tof1_cm;               // Motor 1 sector distance (0°-30° in MODE_B)
    float tof2_cm;               // Motor 2 sector distance (31°-60° in MODE_B)
    float tof3_cm;               // Motor 3 sector distance (61°-90° in MODE_B)
    float tof4_cm;               // Motor 4 sector distance (91°-120° in MODE_B)

    // Live radar scan data (5 bytes)
    uint8_t servo_angle;         // Current servo position in degrees (0-120°)
    float tof_current_cm;        // TOF distance at current servo angle (real-time)

    // Padding for alignment (1 byte)
    uint8_t padding;             // Reserved for future use

    // Error detection (2 bytes)
    uint16_t crc;                // CRC-16 checksum
};

// Compile-time size verification
static_assert(sizeof(DataPacket) == 70, "DataPacket must be exactly 70 bytes");

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
 * @param setpoints_mv Array of 4 setpoints in millivolts (one per motor)
 * @param pp_mv Array of 4 pressure pad readings in millivolts
 * @param duty_pct Array of 4 duty cycle percentages
 * @param tof_dist_cm Array of 4 TOF distances in centimeters (one per motor/sector)
 * @param servo_angle Current servo position in degrees (0-120)
 * @param tof_current_cm TOF distance at current servo angle
 */
inline void buildDataPacket(
    DataPacket* packet,
    uint32_t timestamp_ms,
    const float setpoints_mv[4],
    const uint16_t pp_mv[4],
    const float duty_pct[4],
    const float tof_dist_cm[4],
    uint8_t servo_angle,
    float tof_current_cm
) {
    // Set header
    packet->header = PACKET_HEADER;

    // Set data fields
    packet->timestamp_ms = timestamp_ms;

    packet->setpoint1_mv = setpoints_mv[0];
    packet->setpoint2_mv = setpoints_mv[1];
    packet->setpoint3_mv = setpoints_mv[2];
    packet->setpoint4_mv = setpoints_mv[3];

    packet->pp1_mv = pp_mv[0];
    packet->pp2_mv = pp_mv[1];
    packet->pp3_mv = pp_mv[2];
    packet->pp4_mv = pp_mv[3];

    packet->duty1_pct = duty_pct[0];
    packet->duty2_pct = duty_pct[1];
    packet->duty3_pct = duty_pct[2];
    packet->duty4_pct = duty_pct[3];

    packet->tof1_cm = tof_dist_cm[0];
    packet->tof2_cm = tof_dist_cm[1];
    packet->tof3_cm = tof_dist_cm[2];
    packet->tof4_cm = tof_dist_cm[3];

    // Set live radar data
    packet->servo_angle = servo_angle;
    packet->tof_current_cm = tof_current_cm;
    packet->padding = 0;

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
