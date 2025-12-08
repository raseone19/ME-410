/**
 * Simple WebSocket Test Client
 * Connects to the mock server and displays received data
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001';
let dataCount = 0;
const MAX_DISPLAY = 10; // Show first 10 data points

console.log('🔌 Connecting to WebSocket server...');
console.log(`   URL: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to server!\n');
  console.log('📊 Receiving data (showing first 10 points):\n');
});

ws.on('message', (data: Buffer) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.type === 'connected') {
      console.log('📡 Server info:');
      console.log(`   Message: ${message.message}`);
      console.log(`   Frequency: ${message.frequency}`);
      console.log(`   Recording: ${message.isRecording}\n`);
      return;
    }

    if (message.type === 'data' && dataCount < MAX_DISPLAY) {
      dataCount++;
      const d = message.payload;

      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Data Point #${dataCount} (Time: ${d.time_ms}ms)`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`TOF Distance:    ${d.tof_dist_cm.toFixed(2)} cm`);
      console.log(`Setpoint:        ${d.setpoint_mv.toFixed(1)} mV`);
      console.log(`─────────────────────────────────────────────────────────`);
      console.log(`Motor 1: PP=${d.pp1_pct.toFixed(1)}%, Duty=${d.duty1_pct.toFixed(2)}%`);
      console.log(`Motor 2: PP=${d.pp2_pct.toFixed(1)}%, Duty=${d.duty2_pct.toFixed(2)}%`);
      console.log(`Motor 3: PP=${d.pp3_pct.toFixed(1)}%, Duty=${d.duty3_pct.toFixed(2)}%`);
      console.log(`Motor 4: PP=${d.pp4_pct.toFixed(1)}%, Duty=${d.duty4_pct.toFixed(2)}%`);
      console.log(`Recording:       ${message.isRecording ? 'ON' : 'OFF'}\n`);

      if (dataCount === MAX_DISPLAY) {
        console.log('✅ Test complete! Received 10 data points successfully.');
        console.log('📊 Data is streaming at 50Hz (20ms intervals)');
        console.log('\n💡 Press Ctrl+C to stop the test client\n');
      }
    }
  } catch (error) {
    console.error('❌ Error parsing message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', () => {
  console.log('\n👋 Disconnected from server');
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Closing connection...');
  ws.close();
});
