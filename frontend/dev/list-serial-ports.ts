/**
 * List Available Serial Ports
 * Helper script to find your ESP32's serial port
 */

import { SerialPort } from 'serialport';

async function listPorts() {
  console.log('\n🔍 Scanning for serial ports...\n');

  try {
    const ports = await SerialPort.list();

    if (ports.length === 0) {
      console.log('❌ No serial ports found!');
      console.log('\n💡 Tips:');
      console.log('   - Make sure ESP32 is connected via USB');
      console.log('   - Check USB cable (must support data, not just power)');
      console.log('   - Try a different USB port');
      console.log('   - On Linux: Check permissions (sudo usermod -a -G dialout $USER)');
      return;
    }

    console.log(`✅ Found ${ports.length} serial port(s):\n`);

    ports.forEach((port, index) => {
      console.log(`${index + 1}. ${port.path}`);
      console.log(`   Manufacturer: ${port.manufacturer || 'Unknown'}`);
      console.log(`   Serial Number: ${port.serialNumber || 'N/A'}`);
      console.log(`   Product ID: ${port.productId || 'N/A'}`);
      console.log(`   Vendor ID: ${port.vendorId || 'N/A'}`);

      // Detect ESP32
      const isLikelyESP32 =
        port.manufacturer?.toLowerCase().includes('silicon labs') ||
        port.manufacturer?.toLowerCase().includes('espressif') ||
        port.manufacturer?.toLowerCase().includes('cp210') ||
        port.productId === '7523' || // Common ESP32 USB chip
        port.vendorId === '10c4'; // Silicon Labs

      if (isLikelyESP32) {
        console.log('   🎯 ← LIKELY ESP32!');
      }

      console.log('');
    });

    const esp32Ports = ports.filter(
      (p) =>
        p.manufacturer?.toLowerCase().includes('silicon labs') ||
        p.manufacturer?.toLowerCase().includes('espressif') ||
        p.manufacturer?.toLowerCase().includes('cp210') ||
        p.productId === '7523' ||
        p.vendorId === '10c4'
    );

    if (esp32Ports.length > 0) {
      console.log('✅ Recommended port for ESP32:');
      console.log(`   SERIAL_PORT=${esp32Ports[0].path}`);
      console.log('\n📋 Copy this to your .env.local:');
      console.log(`   SERIAL_PORT=${esp32Ports[0].path}`);
    } else {
      console.log('⚠️  Could not auto-detect ESP32.');
      console.log('   Please try each port manually.');
      console.log('\n📋 To test a port, run:');
      console.log(`   SERIAL_PORT=${ports[0].path} pnpm run serial-bridge`);
    }
  } catch (error) {
    console.error('❌ Error listing ports:', error);
  }
}

listPorts();
