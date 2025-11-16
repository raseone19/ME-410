# ESP32 Connection Checklist

Before deploying to the real ESP32, follow this checklist to ensure everything works correctly.

## Pre-Deployment Checklist

### ✅ Verified Items

- [x] **Data Format Compatibility**: Frontend expects exact match with ESP32 CSV format
  - ESP32 outputs: `time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm`
  - Frontend expects: Same 11 fields in WebSocket payload

- [x] **WebSocket Configuration**: URL is configurable via environment variable
  - Default: `ws://localhost:3001` (mock server)
  - Production: `ws://<ESP32_IP>:81` (set in `.env.local`)

- [x] **Build Success**: Production build passes without errors
  - TypeScript compilation: ✅
  - Next.js optimization: ✅
  - No runtime warnings: ✅

- [x] **Component Dependencies**: All shadcn/ui components installed
  - Chart components
  - UI primitives (Card, Badge, Button, etc.)
  - No missing imports

- [x] **Auto-reconnect Fixed**: Manual disconnect stays disconnected
  - Auto-reconnect only on unexpected disconnections
  - User has full control via Connect/Disconnect buttons

## Deployment Steps

### 1. ESP32 Setup

**Required on ESP32 side:**
- [ ] WebSocket server running on port 81
- [ ] WiFi connected and stable
- [ ] CSV data streaming at 50Hz (20ms intervals)
- [ ] Serial Monitor showing IP address

**Verify in Serial Monitor:**
```
WiFi connected
IP address: 192.168.1.XXX
WebSocket server started on port 81
```

### 2. Frontend Configuration

**In `frontend/.env.local`:**
```bash
# Replace XXX with your ESP32's IP address
NEXT_PUBLIC_WS_URL=ws://192.168.1.XXX:81
```

### 3. How to Get ESP32 IP Address

There are **three methods** to find your ESP32's IP address:

#### Method 1: Serial Monitor (Recommended)

1. **Connect ESP32 to Computer**
   - Connect ESP32 via USB cable
   - Open Arduino IDE or PlatformIO

2. **Open Serial Monitor**
   - Arduino IDE: Tools → Serial Monitor
   - PlatformIO: Click Serial Monitor icon
   - Set baud rate to **115200**

3. **Upload Code and Watch Boot Sequence**
   ```
   Starting WiFi connection...
   WiFi connected!
   IP address: 192.168.1.123    ← YOUR ESP32 IP HERE
   WebSocket server started on port 81
   ```

4. **Copy the IP Address**
   - Note: `192.168.1.123` (example - yours will be different)

#### Method 2: Router Admin Panel

1. **Access Router Settings**
   - Open browser to router admin page (usually `192.168.1.1` or `192.168.0.1`)
   - Login with admin credentials

2. **Find Connected Devices**
   - Look for section: "Connected Devices", "DHCP Clients", or "Device List"
   - Find device named "ESP32" or with MAC address starting with common ESP32 prefixes:
     - `24:0A:C4:XX:XX:XX`
     - `30:AE:A4:XX:XX:XX`
     - `A4:CF:12:XX:XX:XX`

3. **Copy IP Address**
   - Listed next to ESP32 device name

#### Method 3: Network Scanner (If Serial Monitor Not Available)

**On Windows:**
```bash
# Install Advanced IP Scanner (free tool)
# Or use command prompt:
arp -a
# Look for ESP32 MAC address in the list
```

**On Mac/Linux:**
```bash
# Install nmap
brew install nmap  # Mac
sudo apt install nmap  # Linux

# Scan your network
nmap -sn 192.168.1.0/24
# Replace 192.168.1.0 with your network range

# Or use arp
arp -a | grep -i "24:0a:c4\|30:ae:a4\|a4:cf:12"
```

**Using Mobile App:**
- Download "Fing" app (iOS/Android)
- Scan network
- Look for ESP32 device

### 4. Testing Procedure

1. **Get ESP32 IP Address** (see methods above)
   - Example: `192.168.1.123`

2. **Configure Frontend**
   ```bash
   cd frontend
   cp .env.example .env.local
   # Edit .env.local with ESP32 IP
   ```

   **In `.env.local`:**
   ```bash
   NEXT_PUBLIC_WS_URL=ws://192.168.1.123:81
   ```

3. **Start Development Server**
   ```bash
   pnpm run dev
   ```

4. **Open Browser**
   - Navigate to http://localhost:3000
   - Check connection status in dashboard header

5. **Verify Functionality**
   - [ ] Connection status shows "Connected"
   - [ ] TOF distance updates in real-time
   - [ ] All 4 motor cards show data
   - [ ] Charts populate with live data
   - [ ] Pressure values change dynamically
   - [ ] PWM duty cycles update
   - [ ] Tracking error calculates correctly

6. **Test Controls**
   - [ ] Pause button freezes data display
   - [ ] Resume button resumes updates
   - [ ] Disconnect button stops connection
   - [ ] Connect button re-establishes connection
   - [ ] Recording toggle sends messages to ESP32
   - [ ] Reset button clears data

7. **Test Motor Detail Pages**
   - [ ] Click "Details" on each motor card
   - [ ] Individual motor pages load correctly
   - [ ] All 4 charts render (Pressure, PWM, Error, Stats)
   - [ ] Statistics calculate correctly
   - [ ] Back button returns to dashboard

## Known Differences from Mock Server

The mock server simulates data, but the real ESP32 will have:
- **Different TOF patterns**: Real sensor data instead of cyclical 20-200cm sweep
- **Real PI controller behavior**: Actual pressure response with physical lag
- **Network latency**: Slight delays vs local mock server
- **Possible data gaps**: WiFi interference may cause occasional missed packets

## Troubleshooting Guide

### Connection Issues

**Symptom**: Dashboard shows "Disconnected"

**Check:**
1. ESP32 Serial Monitor shows IP address
2. `.env.local` has correct IP
3. Both devices on same WiFi network
4. ESP32 WebSocket server running on port 81
5. Browser console for WebSocket errors (F12 → Console)

**Fix:**
```bash
# Verify ESP32 IP with ping
ping 192.168.1.XXX

# Check .env.local
cat .env.local

# Restart dev server
pnpm run dev
```

### Data Format Errors

**Symptom**: Browser console shows parsing errors

**Check:**
1. ESP32 CSV format matches expected schema
2. All 11 fields present in each message
3. Field types (numbers vs strings)

**Fix:** Verify ESP32 Serial output matches:
```
time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
1000,500,450,460,455,458,12.5,-8.3,15.2,-5.1,85.3
```

### Chart Issues

**Symptom**: Charts empty or not updating

**Check:**
1. WebSocket receiving data (browser console)
2. `dataHistory` populating in store
3. Chart colors rendering (#3b82f6 for blue, #10b981 for green)

**Fix:**
- Open browser DevTools → Components (React tab)
- Check `useWebSocketStore` state
- Verify `dataHistory.length > 0`

### Performance Issues

**Symptom**: Browser slows down or becomes unresponsive

**Solutions:**
1. Click "Pause" to stop DOM updates
2. Reduce `maxHistorySize` in `websocket-store.ts`:
   ```typescript
   const DEFAULT_MAX_HISTORY = 250; // Reduce from 500
   ```
3. Close unused motor detail pages
4. Use a modern browser (Chrome, Edge, Firefox)

## WebSocket Protocol Reference

### Messages to ESP32

```typescript
// Start recording
ws.send(JSON.stringify({ type: "start_recording" }));

// Stop recording
ws.send(JSON.stringify({ type: "stop_recording" }));

// Reset simulation
ws.send(JSON.stringify({ type: "reset" }));
```

### Expected Messages from ESP32

```typescript
// Connection established
{
  "type": "connected",
  "message": "WebSocket connected",
  "frequency": "50Hz",
  "isRecording": false
}

// Data stream (every 20ms)
{
  "type": "data",
  "payload": {
    "time_ms": 1000,
    "setpoint_mv": 500,
    "pp1_mv": 450,
    "pp2_mv": 460,
    "pp3_mv": 455,
    "pp4_mv": 458,
    "duty1_pct": 12.5,
    "duty2_pct": -8.3,
    "duty3_pct": 15.2,
    "duty4_pct": -5.1,
    "tof_dist_cm": 85.3
  },
  "timestamp": 1234567890,
  "isRecording": false
}

// Recording status change
{
  "type": "recording_status",
  "isRecording": true
}

// Reset complete
{
  "type": "reset_complete"
}
```

## Success Criteria

Before marking deployment as complete, verify:

- [x] Production build passes (`pnpm run build`)
- [ ] ESP32 WebSocket server running
- [ ] Frontend connects to ESP32 successfully
- [ ] All 4 motors display real-time data
- [ ] Charts update smoothly without lag
- [ ] Motor detail pages work for all 4 motors
- [ ] Pause/Resume controls work correctly
- [ ] Manual disconnect stays disconnected
- [ ] Connect button re-establishes connection
- [ ] No browser console errors
- [ ] No TypeScript compilation errors

## Next Steps After Successful Connection

Once everything is verified working:

1. **Optional**: Deploy to production with `pnpm run build && pnpm start`
2. **Optional**: Add database integration for data persistence
3. **Optional**: Implement CSV export functionality
4. **Optional**: Add authentication for secure access

## Support

If issues persist:
1. Check browser console (F12) for errors
2. Check ESP32 Serial Monitor for connection logs
3. Verify network connectivity between devices
4. Review this checklist step by step
