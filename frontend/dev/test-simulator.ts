/**
 * Test Script for Enhanced Simulator
 * Demonstrates WebSocket commands and scenario testing
 * Run with: pnpm tsx dev/test-simulator.ts
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001';

// ANSI colors for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run automated test sequence
 */
async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log(colors.bright + '  Enhanced Simulator Test Suite' + colors.reset);
  console.log('='.repeat(60) + '\n');

  const ws = new WebSocket(WS_URL);

  // Wait for connection
  await new Promise((resolve) => {
    ws.on('open', () => {
      log(colors.green, '✓', 'Connected to simulator');
      resolve(null);
    });
  });

  let dataCount = 0;
  let lastData: any = null;

  // Listen for messages
  ws.on('message', (data: Buffer) => {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'connected':
        log(colors.cyan, 'ℹ', `Server: ${message.message}`);
        break;

      case 'data':
        dataCount++;
        lastData = message.payload;
        // Only log every 50th data point to avoid spam
        if (dataCount % 50 === 0) {
          log(
            colors.blue,
            '📊',
            `Received ${dataCount} data points | Mode: ${lastData.current_mode} | Distance: ${lastData.tof_current_cm}cm | Servo: ${lastData.servo_angle}°`
          );
        }
        break;

      case 'status':
        log(colors.cyan, '📊', 'Status received:');
        console.log(JSON.stringify(message.payload, null, 2));
        break;

      case 'scenario_changed':
        log(colors.yellow, '🎬', `Scenario changed to: ${message.scenario}`);
        break;

      case 'mode_changed':
        log(colors.yellow, '🔄', `Mode changed to: MODE ${message.mode}`);
        break;

      case 'reset_complete':
        log(colors.yellow, '🔄', 'Simulation reset complete');
        break;

      case 'recording_status':
        log(
          colors.yellow,
          '📹',
          `Recording ${message.isRecording ? 'started' : 'stopped'}`
        );
        break;

      case 'error':
        log(colors.red, '❌', `Error: ${message.message}`);
        break;

      default:
        // Ignore other messages
        break;
    }
  });

  ws.on('error', (error) => {
    log(colors.red, '❌', `WebSocket error: ${error.message}`);
  });

  // Helper to send command
  function sendCommand(command: any, description: string) {
    log(colors.green, '→', description);
    ws.send(JSON.stringify(command));
  }

  // Test sequence
  console.log('\n' + colors.bright + 'Starting test sequence...' + colors.reset + '\n');

  // Test 1: Get initial status
  await sleep(1000);
  sendCommand({ type: 'get_status' }, 'Test 1: Get initial status');
  await sleep(1000);

  // Test 2: Collect some data
  log(colors.cyan, 'ℹ', 'Test 2: Collecting 100 data points (2 seconds @ 50Hz)...');
  await sleep(2000);
  log(colors.green, '✓', `Collected ${dataCount} data points`);

  // Test 3: Change to MODE A
  await sleep(500);
  sendCommand({ type: 'change_mode', mode: 'A' }, 'Test 3: Change to MODE A');
  await sleep(1000);

  // Test 4: Change to steady scenario
  sendCommand({ type: 'set_scenario', scenario: 'steady' }, 'Test 4: Change to steady scenario');
  await sleep(2000);

  // Test 5: Change to step scenario
  sendCommand({ type: 'set_scenario', scenario: 'step' }, 'Test 5: Change to step scenario');
  await sleep(5000); // Wait for step change
  log(
    colors.cyan,
    'ℹ',
    `Latest data: Distance=${lastData.tof_current_cm}cm, Pressure1=${lastData.pp1_pct}%, Duty1=${lastData.duty1_pct}%`
  );

  // Test 6: Change to MODE B
  sendCommand({ type: 'change_mode', mode: 'B' }, 'Test 6: Change to MODE B');
  await sleep(1000);

  // Test 7: Change to sector_test scenario
  sendCommand(
    { type: 'set_scenario', scenario: 'sector_test' },
    'Test 7: Change to sector_test scenario'
  );
  await sleep(2000);

  // Test 8: Toggle recording
  sendCommand({ type: 'start_recording' }, 'Test 8a: Start recording');
  await sleep(1000);
  sendCommand({ type: 'stop_recording' }, 'Test 8b: Stop recording');
  await sleep(500);

  // Test 9: Reset simulation
  sendCommand({ type: 'reset' }, 'Test 9: Reset simulation');
  await sleep(1000);

  // Test 10: Change to sweep scenario
  sendCommand({ type: 'set_scenario', scenario: 'sweep' }, 'Test 10: Change to sweep scenario');
  await sleep(2000);

  // Test 11: Final status
  sendCommand({ type: 'get_status' }, 'Test 11: Get final status');
  await sleep(1000);

  // Summary
  console.log('\n' + '='.repeat(60));
  log(colors.green, '✓', `All tests completed! Total data points: ${dataCount}`);
  console.log('='.repeat(60) + '\n');

  // Close connection
  ws.close();
  process.exit(0);
}

/**
 * Main
 */
console.log('\n' + colors.bright + 'Enhanced Simulator Test Client' + colors.reset);
console.log(colors.cyan + 'Connecting to ' + WS_URL + '...' + colors.reset + '\n');

runTests().catch((error) => {
  log(colors.red, '❌', `Test failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
