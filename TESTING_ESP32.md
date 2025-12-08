# ESP32-S3 Testing Guide

## System Architecture

```
ESP32-S3 → USB Serial → serial-ws-bridge.ts → WebSocket → Next.js Frontend
          (Binary/CSV)    (Port 115200)        (Port 3001)    (Port 3000)
```

The system has three main components:

1. **ESP32-S3**: Sends motor data via USB serial (Binary or CSV protocol)
2. **Serial-WebSocket Bridge**: Reads serial data and broadcasts to WebSocket clients
3. **Next.js Frontend**: Displays real-time data via WebSocket connection

---

## Testing Methods

### Method 1: Quick Serial Port Test (Check if ESP32 is sending data)

Run this to see if the ESP32 is actually sending data over serial:

```bash
# From the frontend directory
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project/frontend

# List available serial ports
pnpm run list-ports
```

Expected output should show `/dev/cu.usbserial-110`

---

### Method 2: Test with Serial Bridge Only (No Frontend)

This tests if the serial bridge can read from the ESP32:

```bash
# From the frontend directory
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project/frontend

# Run the serial bridge with your port
SERIAL_PORT=/dev/cu.usbserial-110 pnpm run serial-bridge
```

**Expected Output:**
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Serial → WebSocket Bridge Running       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  Serial Port: /dev/cu.usbserial-110        ┃
┃  Baud Rate:   115200                      ┃
┃  WS Port:     3001                        ┃
┃  WS URL:      ws://localhost:3001         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

✅ Serial port opened: /dev/cu.usbserial-110 @ 115200 baud
🔍 Auto-detecting protocol (CSV or Binary)...
✅ Binary protocol detected
```

If you see errors, check:
- ESP32 is connected via USB
- ESP32 is powered on and running (should have uploaded firmware)
- Serial port is correct (`/dev/cu.usbserial-110`)
- No other programs are using the serial port

**Stop the bridge:** Press `Ctrl+C`

---

### Method 3: Test WebSocket Client (Verify data flow)

In a new terminal, test if the WebSocket is receiving data:

```bash
# Terminal 1: Run serial bridge
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project/frontend
SERIAL_PORT=/dev/cu.usbserial-110 pnpm run serial-bridge

# Terminal 2: Test WebSocket client
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project/frontend
pnpm run test-ws-client
```

This should show real-time data packets from the ESP32.

---

### Method 4: Full System Test (Frontend + Bridge)

Run both the serial bridge and the Next.js frontend:

```bash
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project/frontend

# Option A: Development mode (faster, for testing)
SERIAL_PORT=/dev/cu.usbserial-110 pnpm run dev:serial

# Option B: Production mode (slower build, more stable)
pnpm run start:serial
```

**Expected Output:**
```
✅ Serial port opened: /dev/cu.usbserial-110 @ 115200 baud
🔍 Auto-detecting protocol (CSV or Binary)...
✅ Binary protocol detected

   ▲ Next.js 16.0.3
   - Local:        http://localhost:3000
```

**Open in browser:**
- Main dashboard: http://localhost:3000
- Sensors view: http://localhost:3000/sensors
- Motor details: http://localhost:3000/motor/1
- Diagnostics: http://localhost:3000/diagnostics
- Radar view: http://localhost:3000/radar

---

## Troubleshooting

### Problem: "No motors moving" / "No data showing"

**Checklist:**

1. **Is the ESP32 sending data?**
   ```bash
   # Check if serial port has data (Python script)
   python3 << 'EOF'
   import serial
   import time

   ser = serial.Serial('/dev/cu.usbserial-110', 115200, timeout=1)
   print("Reading for 5 seconds...")

   start = time.time()
   while time.time() - start < 5:
       if ser.in_waiting > 0:
           data = ser.read(ser.in_waiting)
           print(f"Received {len(data)} bytes")

   ser.close()
   EOF
   ```

2. **Is the serial bridge running?**
   - Check Terminal 1 for serial bridge output
   - Should see "✅ Binary protocol detected" or "✅ CSV protocol detected"

3. **Is the frontend connected to WebSocket?**
   - Open browser console (F12)
   - Should see: `🔌 Connecting to WebSocket: ws://localhost:3001`
   - Then: `✅ WebSocket connected`
   - Then: `📡 Server confirmed connection`

4. **Check diagnostics page:**
   - Go to http://localhost:3000/diagnostics
   - Check "Connection Status" should be "Connected"
   - Check "Packets Received" should be increasing
   - Check "Actual Frequency" should be around 50 Hz

### Problem: "Serial port error" / "Permission denied"

**On macOS:**
```bash
# Check if port exists
ls -la /dev/cu.usbserial*

# Should show: crw-rw-rw- ... /dev/cu.usbserial-110
```

**Port in use:**
```bash
# Kill any processes using the port
lsof /dev/cu.usbserial-110
# Then kill the PID shown
```

### Problem: ESP32 not initializing

**Check serial output manually:**
```bash
# Use screen to see raw serial output
screen /dev/cu.usbserial-110 115200

# You should see:
# ========================================
# 4-Motor Independent PI Control System
# With Servo Sweep and TOF Distance Sensing
# ========================================
# ...initialization messages...
```

Press `Ctrl+A` then `K` to kill screen session.

**If you see garbage text:**
- Wrong baud rate (should be 115200)
- ESP32 is stuck in bootloader mode
- Re-upload firmware

**If you see nothing:**
- ESP32 might not be running
- Check power LED on ESP32
- Press RESET button on ESP32
- Re-upload firmware:
  ```bash
  cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project
  ~/.platformio/penv/bin/pio run --target upload
  ```

### Problem: "Protocol not detected"

The serial bridge auto-detects Binary or CSV protocol.

**Expected ESP32 output formats:**

**Binary Protocol (Primary):**
- Packets start with header `0xAA55`
- 70 bytes per packet
- Includes CRC checksum

**CSV Protocol (Legacy):**
- First line: Header with column names
- Data lines: `time_ms,sp1_mv,sp2_mv,...` (18 columns)

If neither is detected, the ESP32 might not be sending data at all.

---

## Expected Data Flow

When everything is working:

1. **ESP32 boots** → Prints initialization messages to serial
2. **ESP32 starts control loop** → Sends data packets at 50 Hz (every 20ms)
3. **Serial bridge receives** → Parses binary/CSV packets
4. **Serial bridge broadcasts** → Sends via WebSocket to port 3001
5. **Frontend connects** → Receives data and updates UI in real-time
6. **Motors move** → Based on pressure pad readings and TOF distances

**Data packet contains:**
- 4 motor setpoints (mV)
- 4 pressure pad readings (mV)
- 4 motor duty cycles (%)
- 4 TOF sector distances (cm)
- Current servo angle (degrees)
- Current TOF reading (cm)
- Timestamp (ms)

---

## Quick Reference Commands

```bash
# List serial ports
pnpm run list-ports

# Test serial bridge only
SERIAL_PORT=/dev/cu.usbserial-110 pnpm run serial-bridge

# Test with mock data (no ESP32 needed)
pnpm run dev:mock

# Full system with real ESP32
SERIAL_PORT=/dev/cu.usbserial-110 pnpm run dev:serial

# Upload firmware to ESP32
cd /Users/miguelmoorcastro/Desktop/EPFL/410/Projects/TEST3/Project
~/.platformio/penv/bin/pio run --target upload

# Monitor ESP32 serial output directly
screen /dev/cu.usbserial-110 115200
# (Ctrl+A, K to exit)
```

---

## Testing Checklist

- [ ] ESP32 firmware uploaded successfully
- [ ] ESP32 power LED is on
- [ ] Serial port `/dev/cu.usbserial-110` exists
- [ ] Serial bridge starts without errors
- [ ] Protocol detected (Binary or CSV)
- [ ] WebSocket server listening on port 3001
- [ ] Frontend running on http://localhost:3000
- [ ] Browser shows "Connected" status
- [ ] Packets counter increasing in diagnostics
- [ ] Charts updating in real-time
- [ ] Motors responding to pressure pads

---

**Last Updated:** 2025-01-20
**ESP32:** ESP32-S3-WROOM-1U
**Serial Port:** /dev/cu.usbserial-110
**Baud Rate:** 115200
**WebSocket Port:** 3001
**Frontend Port:** 3000
