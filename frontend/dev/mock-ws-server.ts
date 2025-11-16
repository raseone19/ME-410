/**
 * Mock WebSocket Server for Development
 * Simulates ESP32 data stream at 50Hz without needing the hardware
 * Run with: pnpm tsx dev/mock-ws-server.ts
 */

import { WebSocketServer, WebSocket } from 'ws';
import { generateDataPoint, resetSimulation, type MotorData } from './mock-serial-data';

const PORT = 3001;
const BROADCAST_INTERVAL_MS = 20; // 50Hz = 20ms interval

// Create WebSocket server
const wss = new WebSocketServer({ port: PORT });

// Track connected clients
let clients: Set<WebSocket> = new Set();

// Broadcast interval reference
let broadcastInterval: NodeJS.Timeout | null = null;

// Recording state (simulated)
let isRecording = false;

/**
 * Broadcast data to all connected clients
 */
function broadcastData(data: MotorData): void {
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
 * Start broadcasting mock data
 */
function startBroadcasting(): void {
  if (broadcastInterval) {
    return; // Already broadcasting
  }

  console.log('🚀 Starting data broadcast at 50Hz...');

  broadcastInterval = setInterval(() => {
    const data = generateDataPoint();
    broadcastData(data);
  }, BROADCAST_INTERVAL_MS);
}

/**
 * Stop broadcasting
 */
function stopBroadcasting(): void {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
    console.log('⏸️  Data broadcast stopped');
  }
}

/**
 * Handle incoming messages from clients
 */
function handleClientMessage(ws: WebSocket, message: string): void {
  try {
    const parsed = JSON.parse(message);

    switch (parsed.type) {
      case 'start_recording':
        isRecording = true;
        console.log('📹 Recording started');
        ws.send(JSON.stringify({ type: 'recording_status', isRecording: true }));
        break;

      case 'stop_recording':
        isRecording = false;
        console.log('⏹️  Recording stopped');
        ws.send(JSON.stringify({ type: 'recording_status', isRecording: false }));
        break;

      case 'reset':
        resetSimulation();
        console.log('🔄 Simulation reset');
        ws.send(JSON.stringify({ type: 'reset_complete' }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        console.warn('⚠️  Unknown message type:', parsed.type);
    }
  } catch (error) {
    console.error('❌ Error parsing client message:', error);
  }
}

/**
 * Handle new WebSocket connections
 */
wss.on('connection', (ws: WebSocket) => {
  console.log('✅ Client connected. Total clients:', clients.size + 1);
  clients.add(ws);

  // Send initial connection confirmation
  ws.send(
    JSON.stringify({
      type: 'connected',
      message: 'Connected to mock ESP32 data stream',
      frequency: '50Hz',
      isRecording,
    })
  );

  // Start broadcasting if this is the first client
  if (clients.size === 1) {
    startBroadcasting();
  }

  // Handle messages from client
  ws.on('message', (message: Buffer) => {
    handleClientMessage(ws, message.toString());
  });

  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log('👋 Client disconnected. Total clients:', clients.size);

    // Stop broadcasting if no clients connected
    if (clients.size === 0) {
      stopBroadcasting();
    }
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    clients.delete(ws);
  });
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down mock WebSocket server...');
  stopBroadcasting();
  wss.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

/**
 * Server startup
 */
wss.on('listening', () => {
  console.log('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  console.log('┃  Mock ESP32 WebSocket Server Running      ┃');
  console.log('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫');
  console.log(`┃  Port:       ${PORT}                          ┃`);
  console.log('┃  Frequency:  50Hz (20ms interval)          ┃');
  console.log('┃  URL:        ws://localhost:3001           ┃');
  console.log('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  console.log('\n💡 Waiting for clients to connect...\n');
});

/**
 * Error handling
 */
wss.on('error', (error) => {
  console.error('❌ Server error:', error);
});
