# Quick Start Guide

Get your ESP32 Motor Control Dashboard running in 3 minutes!

## 🎯 Goal
Connect your Next.js dashboard to your ESP32 motor control system.

## 📋 Before You Start

Make sure you have:
- ✅ ESP32 with motor control code uploaded
- ✅ ESP32 connected to WiFi (same network as your computer)
- ✅ Node.js and pnpm installed
- ✅ This frontend project downloaded

## 🚀 3-Minute Setup

### Step 1: Find Your ESP32 IP Address (30 seconds)

**Open Serial Monitor:**
- Arduino IDE: `Tools → Serial Monitor`
- Set baud rate: `115200`

**Look for this line:**
```
IP address: 192.168.1.123
```

✏️ **Write it down!** → `192.168.1.___`

### Step 2: Configure Dashboard (30 seconds)

```bash
cd frontend

# Copy environment template
cp .env.example .env.local

# Open .env.local in your editor
# Replace XXX with your ESP32 IP
```

**Edit `.env.local`:**
```bash
NEXT_PUBLIC_WS_URL=ws://192.168.1.123:81
```
*(Use your IP from Step 1)*

### Step 3: Start Dashboard (2 minutes)

```bash
# Install dependencies (first time only)
pnpm install

# Start the dashboard
pnpm run dev
```

**Open browser:** http://localhost:3000

## ✅ Success Indicators

You should see:
- ✅ Connection status: **"Connected"** (green)
- ✅ TOF distance updating in real-time
- ✅ 4 motor cards showing live pressure data
- ✅ Charts populating with data

## ❌ Troubleshooting

### "Disconnected" Status?

**Quick Fixes:**
1. ✅ ESP32 is powered on?
2. ✅ IP address in `.env.local` matches Serial Monitor?
3. ✅ Both devices on same WiFi network?
4. ✅ ESP32 Serial Monitor shows "WebSocket server started"?

**Try this:**
```bash
# Ping your ESP32
ping 192.168.1.123

# If ping works, restart dev server
pnpm run dev
```

### Can't Find ESP32 IP?

**Alternative Methods:**

**Router Method:**
1. Open router admin (`192.168.1.1` or `192.168.0.1`)
2. Look for "Connected Devices"
3. Find device with MAC starting: `24:0A:C4` or `30:AE:A4`

**Network Scan (Mac/Linux):**
```bash
arp -a | grep -i "24:0a:c4\|30:ae:a4"
```

**Windows:**
```bash
arp -a
# Look for ESP32 MAC address
```

### Charts Empty?

1. Open browser console (F12)
2. Look for WebSocket errors
3. Verify ESP32 is sending data (check Serial Monitor for CSV output)

## 🎨 What You'll See

### Main Dashboard
- **Header**: TOF distance, connection status, controls
- **4 Motor Cards**: Each showing:
  - Real-time pressure chart (setpoint vs actual)
  - Current pressure value
  - PWM duty cycle
  - Tracking error
- **Footer**: System stats (runtime, data points, update rate)

### Motor Detail Pages
Click **"Details"** on any motor card to see:
- 📊 Pressure Tracking Chart
- 📊 PWM Control Signal Chart
- 📊 Tracking Error Chart
- 📊 Session Statistics

### Controls
- **Pause/Resume**: Stop/start data updates
- **Disconnect**: Close WebSocket connection
- **Recording**: Toggle data recording on ESP32
- **Reset**: Clear all data

## 🔄 Development vs Production

### Development (Mock Data)
```bash
# Test without ESP32
pnpm run dev:mock
```
Runs mock WebSocket server on port 3001 with simulated data.

### Production (Real ESP32)
```bash
# Connect to real ESP32
pnpm run dev
```
Uses IP from `.env.local` to connect to real hardware.

## 📱 Mobile Access

Want to access dashboard from your phone?

1. **Find your computer's IP address:**
   - Mac: `System Settings → Network`
   - Windows: `ipconfig` in Command Prompt
   - Linux: `ifconfig` or `ip addr`

2. **On your phone's browser:**
   ```
   http://<YOUR_COMPUTER_IP>:3000
   ```
   Example: `http://192.168.1.50:3000`

3. **Both devices must be on same WiFi network**

## 🎓 Next Steps

Once connected successfully:

1. **Explore Motor Details**: Click "Details" on each motor
2. **Test Controls**: Try Pause, Recording, Reset buttons
3. **Monitor Performance**: Watch real-time PI controller behavior
4. **Tune Parameters**: Adjust setpoints and observe response

## 📚 Full Documentation

- **README.md** - Complete documentation
- **ESP32_CONNECTION_CHECKLIST.md** - Detailed deployment guide
- **CLAUDE.md** (in project root) - Development conventions

## 🆘 Need Help?

1. Check browser console (F12) for errors
2. Check ESP32 Serial Monitor for connection logs
3. Verify network connectivity: `ping <ESP32_IP>`
4. Review ESP32_CONNECTION_CHECKLIST.md for detailed troubleshooting

## 💡 Pro Tips

1. **Bookmark Dashboard**: Save http://localhost:3000 for quick access
2. **Keep Serial Monitor Open**: Useful for debugging
3. **Use Pause Button**: If browser slows down, pause updates
4. **Check WiFi Strength**: Weak signal = connection issues
5. **Set Static IP**: Configure static IP on ESP32 for consistent connection

---

**Ready to start?** Jump to Step 1 and get connected! 🚀
