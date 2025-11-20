/**
 * Serial to WebSocket Bridge
 * Reads binary data from ESP32 via USB serial port and broadcasts to WebSocket clients
 * Binary protocol only - 70 bytes per packet with CRC-16 checksum
 */

import { WebSocketServer, WebSocket } from 'ws';
import { SerialPort } from 'serialport';
import type { MotorData } from '../src/lib/types';

const WS_PORT = 3001;
const BAUD_RATE = 115200;

// Binary protocol constants
const PACKET_SIZE = 70;  // Updated to include servo_angle and tof_current_cm
const HEADER_WORD = 0xAA55;  // Combined 16-bit header

// Serial port path - you'll need to update this
// Run: node -e "require('serialport').SerialPort.list().then(ports => console.log(ports))"
// to find your ESP32 port
const SERIAL_PORT = process.env.SERIAL_PORT || '/dev/ttyUSB0'; // Update this!

const wss = new WebSocketServer({ port: WS_PORT });
const clients = new Set<WebSocket>();
let isRecording = false;

// Initialize serial port
let serialPort: SerialPort;
let binaryBuffer = Buffer.alloc(0);

/**
 * Calculate CRC-16-CCITT checksum
 */
function calculateCRC16(data: Buffer): number {
  let crc = 0xFFFF;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;

    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }

  return crc & 0xFFFF;
}

/**
 * Parse binary packet from ESP32
 * Packet structure (70 bytes):
 *   [0-1]:   Header (0xAA55 as uint16)
 *   [2-5]:   timestamp_ms (uint32)
 *   [6-9]:   setpoint1_mv (float)
 *   [10-13]: setpoint2_mv (float)
 *   [14-17]: setpoint3_mv (float)
 *   [18-21]: setpoint4_mv (float)
 *   [22-23]: pp1_mv (uint16)
 *   [24-25]: pp2_mv (uint16)
 *   [26-27]: pp3_mv (uint16)
 *   [28-29]: pp4_mv (uint16)
 *   [30-33]: duty1_pct (float)
 *   [34-37]: duty2_pct (float)
 *   [38-41]: duty3_pct (float)
 *   [42-45]: duty4_pct (float)
 *   [46-49]: tof1_cm (float)
 *   [50-53]: tof2_cm (float)
 *   [54-57]: tof3_cm (float)
 *   [58-61]: tof4_cm (float)
 *   [62]:    servo_angle (uint8)
 *   [63-66]: tof_current_cm (float)
 *   [67]:    current_mode (uint8) - 0=MODE_A, 1=MODE_B
 *   [68-69]: crc (uint16)
 */
function parseBinaryPacket(packet: Buffer): MotorData | null {
  if (packet.length !== PACKET_SIZE) {
    console.warn(`⚠️  Invalid packet size: ${packet.length}, expected ${PACKET_SIZE}`);
    return null;
  }

  // Verify header (read as little-endian uint16)
  const header = packet.readUInt16LE(0);
  if (header !== HEADER_WORD) {
    console.warn(`⚠️  Invalid packet header: 0x${header.toString(16)}, expected 0x${HEADER_WORD.toString(16)}`);
    return null;
  }

  // Verify CRC (calculate CRC of data portion, excluding header and CRC itself)
  const dataForCRC = packet.subarray(2, PACKET_SIZE - 2);
  const calculatedCRC = calculateCRC16(dataForCRC);
  const packetCRC = packet.readUInt16LE(PACKET_SIZE - 2);

  if (calculatedCRC !== packetCRC) {
    console.warn(`⚠️  CRC mismatch: calculated 0x${calculatedCRC.toString(16)}, received 0x${packetCRC.toString(16)}`);
    return null;
  }

  try {
    const currentMode = packet.readUInt8(67); // 0=MODE_A, 1=MODE_B
    return {
      time_ms: packet.readUInt32LE(2),
      sp1_mv: packet.readFloatLE(6),
      sp2_mv: packet.readFloatLE(10),
      sp3_mv: packet.readFloatLE(14),
      sp4_mv: packet.readFloatLE(18),
      pp1_mv: packet.readUInt16LE(22),
      pp2_mv: packet.readUInt16LE(24),
      pp3_mv: packet.readUInt16LE(26),
      pp4_mv: packet.readUInt16LE(28),
      duty1_pct: packet.readFloatLE(30),
      duty2_pct: packet.readFloatLE(34),
      duty3_pct: packet.readFloatLE(38),
      duty4_pct: packet.readFloatLE(42),
      tof1_cm: packet.readFloatLE(46),
      tof2_cm: packet.readFloatLE(50),
      tof3_cm: packet.readFloatLE(54),
      tof4_cm: packet.readFloatLE(58),
      servo_angle: packet.readUInt8(62),
      tof_current_cm: packet.readFloatLE(63),
    };
  } catch (error) {
    console.error('❌ Error parsing binary packet:', error);
    return null;
  }
}

/**
 * Process incoming binary data
 * Accumulates data in buffer and extracts complete packets
 */
function processBinaryData(chunk: Buffer) {
  // Append new data to buffer
  binaryBuffer = Buffer.concat([binaryBuffer, chunk]);

  // Process all complete packets in buffer
  while (binaryBuffer.length >= PACKET_SIZE) {
    // Look for packet header (0xAA55 as little-endian uint16)
    let headerIndex = -1;
    for (let i = 0; i <= binaryBuffer.length - PACKET_SIZE; i++) {
      const word = binaryBuffer.readUInt16LE(i);
      if (word === HEADER_WORD) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      // No header found, keep last PACKET_SIZE bytes in case header is split
      if (binaryBuffer.length > PACKET_SIZE * 2) {
        binaryBuffer = binaryBuffer.subarray(binaryBuffer.length - PACKET_SIZE);
      }
      break;
    }

    // Discard data before header
    if (headerIndex > 0) {
      binaryBuffer = binaryBuffer.subarray(headerIndex);
    }

    // Check if we have a complete packet
    if (binaryBuffer.length < PACKET_SIZE) {
      break;
    }

    // Extract packet
    const packet = binaryBuffer.subarray(0, PACKET_SIZE);
    binaryBuffer = binaryBuffer.subarray(PACKET_SIZE);

    // Parse and broadcast packet
    const motorData = parseBinaryPacket(packet);
    if (motorData) {
      broadcastData(motorData);
    }
  }
}

function initSerial() {
  try {
    serialPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
    });

    serialPort.on('open', () => {
      console.log(`✅ Serial port opened: ${SERIAL_PORT} @ ${BAUD_RATE} baud`);
      console.log('📡 Binary protocol mode (70-byte packets with CRC-16)');
    });

    serialPort.on('error', (err) => {
      console.error('❌ Serial port error:', err.message);
      console.log('\n💡 Tips:');
      console.log('   - Check SERIAL_PORT environment variable');
      console.log('   - Run: npx @serialport/list to find available ports');
      console.log('   - Make sure ESP32 is connected via USB');
      console.log('   - On Linux: You may need permissions (sudo usermod -a -G dialout $USER)');
      console.log('   - On Mac: Port usually /dev/cu.usbserial-* or /dev/tty.usbserial-*');
      console.log('   - On Windows: Port usually COM3, COM4, etc.');
    });

    // Listen for raw binary data only
    serialPort.on('data', (chunk: Buffer) => {
      processBinaryData(chunk);
    });
  } catch (error) {
    console.error('❌ Failed to open serial port:', error);
    process.exit(1);
  }
}


/**
 * Broadcast data to all connected WebSocket clients
 */
function broadcastData(data: MotorData) {
  const message = JSON.stringify({
    type: 'data',
    payload: data,
    timestamp: Date.now(),
    isRecording,
  });

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Broadcast message to all clients
 */
function broadcast(message: any) {
  const msg = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

/**
 * Send command to ESP32 via serial port
 */
function sendCommandToESP32(command: string) {
  if (serialPort && serialPort.isOpen) {
    serialPort.write(command, (err) => {
      if (err) {
        console.error('❌ Error sending command to ESP32:', err.message);
      } else {
        console.log(`✅ Sent to ESP32: ${command.trim()}`);
      }
    });
  } else {
    console.error('❌ Cannot send command: Serial port not open');
  }
}

// WebSocket Server
wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  console.log(`✅ Client connected. Total clients: ${clients.size}`);

  // Send connection confirmation
  ws.send(
    JSON.stringify({
      type: 'connected',
      message: 'Connected to ESP32 via serial bridge',
      frequency: '50Hz (from ESP32)',
      isRecording,
    })
  );

  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'start_recording':
          isRecording = true;
          broadcast({
            type: 'recording_status',
            isRecording: true,
          });
          console.log('📹 Recording started');
          break;

        case 'stop_recording':
          isRecording = false;
          broadcast({
            type: 'recording_status',
            isRecording: false,
          });
          console.log('⏹️  Recording stopped');
          break;

        case 'reset':
          // Note: Cannot reset ESP32 via serial, only acknowledge
          broadcast({
            type: 'reset_complete',
          });
          console.log('🔄 Reset requested (ESP32 continues running)');
          break;

        case 'change_mode':
          // Send mode change command to ESP32
          const mode = message.mode; // 'A' or 'B'
          if (mode === 'A' || mode === 'B') {
            sendCommandToESP32(`MODE:${mode}\n`);
            console.log(`🔄 Mode change requested: MODE ${mode}`);
            // Acknowledge to client
            broadcast({
              type: 'mode_changed',
              mode: mode,
            });
          } else {
            console.warn('⚠️  Invalid mode:', mode);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid mode. Use "A" or "B"'
            }));
          }
          break;

        case 'sweep_command':
          // Send sweep configuration command to ESP32
          const sweepCmd = message.command;
          if (sweepCmd && typeof sweepCmd === 'string') {
            sendCommandToESP32(sweepCmd + '\n');
            console.log(`🔄 Sweep command sent: ${sweepCmd}`);
            // Acknowledge to client
            broadcast({
              type: 'command_ack',
              command: sweepCmd,
              timestamp: Date.now(),
            });
          } else {
            console.warn('⚠️  Invalid sweep command:', sweepCmd);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid sweep command format'
            }));
          }
          break;

        case 'servo_command':
          // Send manual servo angle command to ESP32
          const servoCmd = message.command;
          if (servoCmd && typeof servoCmd === 'string') {
            sendCommandToESP32(servoCmd + '\n');
            console.log(`🔄 Servo command sent: ${servoCmd}`);
            // Acknowledge to client
            broadcast({
              type: 'command_ack',
              command: servoCmd,
              timestamp: Date.now(),
            });
          } else {
            console.warn('⚠️  Invalid servo command:', servoCmd);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid servo command format'
            }));
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`👋 Client disconnected. Total clients: ${clients.size}`);
  });

  ws.on('error', (error) => {
    console.error('WebSocket client error:', error);
    clients.delete(ws);
  });
});

// Start WebSocket Server
wss.on('listening', () => {
  console.log('\n┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃  Serial → WebSocket Bridge Running       ┃');
  console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫');
  console.log(`┃  Serial Port: ${SERIAL_PORT.padEnd(27)} ┃`);
  console.log(`┃  Baud Rate:   ${BAUD_RATE.toString().padEnd(27)} ┃`);
  console.log(`┃  WS Port:     ${WS_PORT.toString().padEnd(27)} ┃`);
  console.log(`┃  WS URL:      ws://localhost:${WS_PORT.toString().padEnd(15)} ┃`);
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n');
  console.log('💡 Waiting for WebSocket clients to connect...\n');

  // Initialize serial connection
  initSerial();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');

  if (serialPort && serialPort.isOpen) {
    serialPort.close((err) => {
      if (err) {
        console.error('Error closing serial port:', err);
      } else {
        console.log('✅ Serial port closed');
      }
    });
  }

  wss.close(() => {
    console.log('✅ WebSocket server closed');
    process.exit(0);
  });
});
