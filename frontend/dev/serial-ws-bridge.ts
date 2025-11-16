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

function initSerial() {
  try {
    serialPort = new SerialPort({
      path: SERIAL_PORT,
      baudRate: BAUD_RATE,
    });

    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    serialPort.on('open', () => {
      console.log(`✅ Serial port opened: ${SERIAL_PORT} @ ${BAUD_RATE} baud`);
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

    parser.on('data', (line: string) => {
      const trimmed = line.trim();

      // Skip header line
      if (isFirstLine) {
        console.log('📋 CSV Header:', trimmed);
        isFirstLine = false;
        return;
      }

      // Skip empty lines
      if (!trimmed) return;

      // Parse CSV line
      try {
        const motorData = parseCSVLine(trimmed);
        if (motorData) {
          broadcastData(motorData);
        }
      } catch (error) {
        console.error('❌ Parse error:', error);
        console.log('   Line:', trimmed);
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
