/**
 * Serial to WebSocket Bridge
 * Reads CSV data from ESP32 via USB serial port and broadcasts to WebSocket clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import type { MotorData } from '../src/lib/types';

const WS_PORT = 3001;
const BAUD_RATE = 115200;

// Binary protocol constants
const PACKET_SIZE = 40;
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
let parser: ReadlineParser;
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
 * Packet structure (40 bytes):
 *   [0-1]:   Header (0xAA55 as uint16)
 *   [2-5]:   timestamp_ms (uint32)
 *   [6-9]:   setpoint_mv (float)
 *   [10-11]: pp1_mv (uint16)
 *   [12-13]: pp2_mv (uint16)
 *   [14-15]: pp3_mv (uint16)
 *   [16-17]: pp4_mv (uint16)
 *   [18-21]: duty1_pct (float)
 *   [22-25]: duty2_pct (float)
 *   [26-29]: duty3_pct (float)
 *   [30-33]: duty4_pct (float)
 *   [34-37]: tof_dist_cm (float)
 *   [38-39]: crc (uint16)
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
    return {
      time_ms: packet.readUInt32LE(2),
      setpoint_mv: packet.readFloatLE(6),
      pp1_mv: packet.readUInt16LE(10),
      pp2_mv: packet.readUInt16LE(12),
      pp3_mv: packet.readUInt16LE(14),
      pp4_mv: packet.readUInt16LE(16),
      duty1_pct: packet.readFloatLE(18),
      duty2_pct: packet.readFloatLE(22),
      duty3_pct: packet.readFloatLE(26),
      duty4_pct: packet.readFloatLE(30),
      tof_dist_cm: packet.readFloatLE(34),
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

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log(`✅ Serial port opened: ${SERIAL_PORT} @ ${BAUD_RATE} baud`);
      console.log('🔍 Auto-detecting protocol (CSV or Binary)...');
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

    let isFirstLine = true;
    let protocolDetected = false;
    let useBinaryProtocol = false;

    // Listen for raw binary data
    serialPort.on('data', (chunk: Buffer) => {
      // Auto-detect protocol on first data
      if (!protocolDetected) {
        // Check if starts with binary header (0xAA55)
        if (chunk.length >= 2) {
          const header = chunk.readUInt16LE(0);
          if (header === HEADER_WORD) {
            useBinaryProtocol = true;
            protocolDetected = true;
            console.log('✅ Binary protocol detected');
            // Stop CSV parser
            parser.removeAllListeners('data');
          }
        }
      }

      // Process binary data if binary protocol
      if (useBinaryProtocol) {
        processBinaryData(chunk);
      }
    });

    // CSV parser (will be disabled if binary detected)
    parser.on('data', (line: string) => {
      const trimmed = line.trim();

      // Auto-detect CSV protocol
      if (!protocolDetected && trimmed.includes(',')) {
        protocolDetected = true;
        useBinaryProtocol = false;
        console.log('✅ CSV protocol detected');
      }

      // Skip header line
      if (isFirstLine) {
        console.log('📋 CSV Header:', trimmed);
        isFirstLine = false;
        return;
      }

      // Skip empty lines
      if (!trimmed) return;

      // Only process if using CSV protocol
      if (!useBinaryProtocol) {
        try {
          const motorData = parseCSVLine(trimmed);
          if (motorData) {
            broadcastData(motorData);
          }
        } catch (error) {
          console.error('❌ Parse error:', error);
          console.log('   Line:', trimmed);
        }
      }
    });
  } catch (error) {
    console.error('❌ Failed to open serial port:', error);
    process.exit(1);
  }
}

/**
 * Parse CSV line from ESP32
 * Format: time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
 */
function parseCSVLine(line: string): MotorData | null {
  const parts = line.split(',').map((s) => s.trim());

  if (parts.length !== 11) {
    console.warn('⚠️  Invalid CSV line (expected 11 fields, got', parts.length, '):', line);
    return null;
  }

  try {
    return {
      time_ms: parseInt(parts[0]),
      setpoint_mv: parseFloat(parts[1]),
      pp1_mv: parseFloat(parts[2]),
      pp2_mv: parseFloat(parts[3]),
      pp3_mv: parseFloat(parts[4]),
      pp4_mv: parseFloat(parts[5]),
      duty1_pct: parseFloat(parts[6]),
      duty2_pct: parseFloat(parts[7]),
      duty3_pct: parseFloat(parts[8]),
      duty4_pct: parseFloat(parts[9]),
      tof_dist_cm: parseFloat(parts[10]),
    };
  } catch (error) {
    console.error('❌ Failed to parse numbers from:', line);
    return null;
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
