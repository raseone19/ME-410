# USB Serial Connection Guide

Connect your ESP32 Motor Control Dashboard via USB cable (no WiFi needed!).

## 🎯 Overview

Instead of WiFi, we use a **Serial-to-WebSocket Bridge** that:
1. Reads CSV data from ESP32 via USB serial port
2. Converts it to WebSocket messages
3. Broadcasts to the Next.js dashboard

```
ESP32 (USB) → Serial Bridge → WebSocket → Next.js Dashboard
```

## 🚀 Quick Start (3 Steps)

### Step 1: Find Your ESP32 Serial Port

```bash
cd frontend
pnpm run list-ports
```

**Output example:**
```
✅ Found 2 serial port(s):

1. /dev/cu.usbserial-0001
   Manufacturer: Silicon Labs
   🎯 ← LIKELY ESP32!

✅ Recommended port for ESP32:
   SERIAL_PORT=/dev/cu.usbserial-0001
```

### Step 2: Configure Environment

```bash
# Copy .env.example if you haven't already
cp .env.example .env.local

# Add the serial port to .env.local
echo "SERIAL_PORT=/dev/cu.usbserial-0001" >> .env.local
```

**Your `.env.local` should look like:**
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:3001
SERIAL_PORT=/dev/cu.usbserial-0001
```

### Step 3: Start Everything

```bash
# This starts BOTH serial bridge AND Next.js dev server
pnpm run dev:serial
```

**Open browser:** http://localhost:3000

## ✅ Success Indicators

You should see:

**In Terminal:**
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Serial → WebSocket Bridge Running       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  Serial Port: /dev/cu.usbserial-0001      ┃
┃  Baud Rate:   115200                       ┃
┃  WS Port:     3001                         ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

✅ Serial port opened
📋 CSV Header: time_ms,setpoint_mv,pp1_mv,...
✅ Client connected. Total clients: 1
```

**In Browser:**
- Connection status: **"Connected"** (green)
- TOF distance updating
- 4 motor cards showing live data
- Charts populating

## 🔧 Detailed Setup

### Finding Serial Port (Platform-Specific)

#### Mac

**Automatic detection:**
```bash
pnpm run list-ports
```

**Manual check:**
```bash
ls /dev/cu.*
# Look for: /dev/cu.usbserial-* or /dev/cu.SLAB_USBtoUART
```

**Common Mac ports:**
- `/dev/cu.usbserial-0001`
- `/dev/cu.usbserial-14140`
- `/dev/cu.SLAB_USBtoUART`

#### Linux

**Automatic detection:**
```bash
pnpm run list-ports
```

**Manual check:**
```bash
ls /dev/ttyUSB* /dev/ttyACM*
```

**Common Linux ports:**
- `/dev/ttyUSB0`
- `/dev/ttyUSB1`
- `/dev/ttyACM0`

**Permission Issues:**
```bash
# Add your user to dialout group
sudo usermod -a -G dialout $USER

# Logout and login again for changes to take effect
# Or manually set permissions (temporary):
sudo chmod 666 /dev/ttyUSB0
```

#### Windows

**Automatic detection:**
```bash
pnpm run list-ports
```

**Manual check:**
- Open **Device Manager**
- Expand **Ports (COM & LPT)**
- Look for "Silicon Labs CP210x" or "USB Serial Port"
- Note the COM port (e.g., COM3, COM4)

**Common Windows ports:**
- `COM3`
- `COM4`
- `COM5`

**Driver Issues:**
If ESP32 not detected, install CP210x USB to UART Bridge driver:
https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers

## 📋 Available Scripts

```bash
# List all available serial ports
pnpm run list-ports

# Start serial bridge only (no Next.js)
pnpm run serial-bridge

# Start serial bridge + Next.js dev server
pnpm run dev:serial

# Use mock server instead (no hardware needed)
pnpm run dev:mock
```

## ⚙️ Advanced Configuration

### Custom Serial Port

**Via environment variable:**
```bash
SERIAL_PORT=/dev/ttyUSB1 pnpm run dev:serial
```

**Or in `.env.local`:**
```bash
SERIAL_PORT=/dev/ttyUSB1
```

### Different Baud Rate

If your ESP32 uses a different baud rate, edit `dev/serial-ws-bridge.ts`:

```typescript
const BAUD_RATE = 115200; // Change this
```

### Different WebSocket Port

Edit `dev/serial-ws-bridge.ts`:

```typescript
const WS_PORT = 3001; // Change this

// Also update .env.local:
// NEXT_PUBLIC_WS_URL=ws://localhost:3002
```

## 🐛 Troubleshooting

### "No serial ports found"

1. **Check USB connection:**
   - Try a different USB cable (must support data, not just power)
   - Try a different USB port on your computer
   - Disconnect and reconnect ESP32

2. **Check drivers:**
   - **Windows**: Install CP210x driver
   - **Mac**: Usually works out of the box
   - **Linux**: Check `dmesg` after connecting ESP32

3. **Verify ESP32 is powered:**
   - LED should be on when connected
   - Upload blink sketch to test

### "Serial port error: Access denied" (Linux)

```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Logout and login

# Or temporary fix:
sudo chmod 666 /dev/ttyUSB0
```

### "Serial port error: Device or resource busy"

Another program is using the serial port (Arduino IDE, PlatformIO, screen, etc.)

**Fix:**
```bash
# Find what's using the port
lsof /dev/ttyUSB0  # Linux/Mac

# Close Arduino IDE Serial Monitor
# Or kill the process using the port
```

### Dashboard shows "Disconnected"

1. **Check serial bridge is running:**
   - Look for "Serial → WebSocket Bridge Running" message
   - Check for "Serial port opened" message

2. **Check ESP32 is sending data:**
   - Serial bridge should show CSV lines scrolling
   - If not, upload ESP32 code again

3. **Check Next.js is running:**
   - Should see "Ready" message
   - Browser should connect to http://localhost:3000

### Charts empty

1. **Check browser console (F12):**
   - Look for WebSocket connection errors
   - Verify WebSocket URL is `ws://localhost:3001`

2. **Check serial bridge terminal:**
   - Should see data being received from ESP32
   - Should see "Client connected" message

3. **Verify CSV format:**
   - ESP32 must output exact format:
     ```
     time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
     ```
   - 11 fields, comma-separated
   - All numeric values

### Wrong serial port detected

If auto-detection picks wrong port:

```bash
# Manually set the correct port
SERIAL_PORT=/dev/ttyUSB1 pnpm run dev:serial
```

### Data parsing errors

Check terminal for warnings like:
```
⚠️  Invalid CSV line (expected 11 fields, got 10)
```

**Fix:**
- Verify ESP32 code matches expected CSV format
- Check for extra commas or missing fields
- Ensure no debug Serial.print() statements interfering

## 🔄 Switching Between Modes

### USB Serial Mode (Default)

```bash
# .env.local
NEXT_PUBLIC_WS_URL=ws://localhost:3001
SERIAL_PORT=/dev/cu.usbserial-0001

# Run
pnpm run dev:serial
```

### Mock Mode (No Hardware)

```bash
# .env.local
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# Run
pnpm run dev:mock
```

### WiFi Mode (Alternative)

```bash
# .env.local
NEXT_PUBLIC_WS_URL=ws://192.168.1.123:81

# Run
pnpm run dev
```

## 📊 How It Works

### Architecture

```
┌─────────────┐                ┌───────────────────┐                ┌──────────────┐
│   ESP32     │  USB Serial    │  Serial Bridge    │  WebSocket     │   Next.js    │
│             ├───────────────→│                   ├───────────────→│  Dashboard   │
│ (CSV @50Hz) │  115200 baud   │  - Reads CSV      │  ws://3001     │              │
└─────────────┘                │  - Parses data    │                └──────────────┘
                               │  - Broadcasts WS  │
                               └───────────────────┘
```

### Data Flow

1. **ESP32 outputs CSV** to serial port (50Hz):
   ```
   1000,500,450,460,455,458,12.5,-8.3,15.2,-5.1,85.3
   ```

2. **Serial bridge reads and parses:**
   ```typescript
   {
     time_ms: 1000,
     setpoint_mv: 500,
     pp1_mv: 450,
     // ... etc
   }
   ```

3. **Bridge broadcasts WebSocket message:**
   ```json
   {
     "type": "data",
     "payload": { ... },
     "timestamp": 1234567890,
     "isRecording": false
   }
   ```

4. **Dashboard receives and displays** in real-time

## 🆚 USB vs WiFi Comparison

| Feature | USB Serial | WiFi |
|---------|-----------|------|
| Setup Complexity | ⭐⭐ Easy | ⭐⭐⭐ Medium |
| Latency | ⚡ Very Low | 🐌 Higher |
| Reliability | ✅ Very Stable | ⚠️ Can drop |
| Mobility | ❌ Tethered | ✅ Wireless |
| Network Required | ❌ No | ✅ Yes |
| Driver Installation | Mac: No<br>Linux: Maybe<br>Windows: Yes | No |

**Recommendation:** Use USB Serial for development, WiFi for demos.

## 💡 Pro Tips

1. **Keep Serial Monitor Closed:**
   - Arduino IDE and serial bridge can't share the port
   - Close Serial Monitor before running bridge

2. **Use Correct USB Cable:**
   - Some cables are power-only (won't work)
   - Use a data-capable USB cable

3. **Check Baud Rate:**
   - ESP32 and bridge must match (115200)
   - Verify in ESP32 code: `Serial.begin(115200)`

4. **Auto-reconnect:**
   - If ESP32 disconnects/reconnects, restart serial bridge
   - Future: Add auto-reconnect to bridge

5. **Debugging:**
   - Serial bridge shows all received lines
   - Watch for parsing errors in terminal

## 📚 Related Documentation

- **README.md** - General dashboard documentation
- **QUICK_START.md** - 3-minute quick start (WiFi)
- **ESP32_CONNECTION_CHECKLIST.md** - Deployment checklist

## 🆘 Still Need Help?

1. Run diagnostics:
   ```bash
   pnpm run list-ports
   ```

2. Check serial bridge logs for errors

3. Verify ESP32 is outputting CSV:
   ```bash
   # Test with screen (Linux/Mac)
   screen /dev/ttyUSB0 115200

   # Should see CSV lines scrolling
   # Press Ctrl+A, then K to exit
   ```

4. Check GitHub issues or create new one with:
   - Platform (Mac/Linux/Windows)
   - Output of `pnpm run list-ports`
   - Serial bridge terminal logs
   - Browser console errors
