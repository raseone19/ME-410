# ESP32 Motor Control Dashboard

Real-time web dashboard for monitoring 4-motor independent PI control system.

## Features

- **Real-time Monitoring**: 50Hz data updates via WebSocket
- **4 Motor Cards**: Individual pressure tracking, PWM duty cycle, and error visualization
- **Detailed Analysis**: Individual motor pages with comprehensive charts and statistics
- **TOF Distance Display**: Live time-of-flight sensor readings
- **Pause/Resume**: Control data flow to manage browser performance
- **Recording Control**: Start/stop data recording on ESP32
- **Auto-reconnect**: Automatic reconnection on unexpected disconnections

## Tech Stack

- **Next.js 16** with App Router
- **TypeScript** for type safety
- **shadcn/ui** component library
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Recharts** via shadcn charts for data visualization

## Development Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure WebSocket URL

Copy the example environment file:

```bash
cp .env.example .env.local
```

For **mock server** (development without ESP32):
```env
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

For **real ESP32**:
```env
NEXT_PUBLIC_WS_URL=ws://<ESP32_IP>:81
```

Replace `<ESP32_IP>` with your ESP32's IP address (e.g., `ws://192.168.1.100:81`).

### 3. Run Development Server

**With Mock Data** (no ESP32 required):
```bash
pnpm run dev:mock
```
Starts both Next.js dev server and mock WebSocket server.

**With Real ESP32 via USB Serial** (recommended):
```bash
# First, find your serial port
pnpm run list-ports

# Add to .env.local:
# SERIAL_PORT=/dev/cu.usbserial-0001  # (use your port from list-ports)

# Start serial bridge + dev server
pnpm run dev:serial
```
See **[USB_SERIAL_SETUP.md](./USB_SERIAL_SETUP.md)** for detailed instructions.

**With Real ESP32 via WiFi** (alternative):
```bash
# Make sure .env.local points to your ESP32 IP
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
pnpm run build
pnpm start
```

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main dashboard with 4 motor cards
│   │   ├── motor/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Individual motor detail page
│   │   └── layout.tsx            # Root layout
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── DashboardHeader.tsx   # TOF display & controls
│   │   │   └── MotorCard.tsx         # Individual motor card
│   │   └── ui/                   # shadcn components
│   └── lib/
│       ├── websocket-store.ts    # Zustand WebSocket state
│       └── types.ts              # TypeScript types
├── dev/
│   ├── mock-serial-data.ts       # ESP32 data simulator
│   └── mock-ws-server.ts         # Mock WebSocket server
└── public/
```

## Data Format

The frontend expects WebSocket messages in this format:

```typescript
{
  "type": "data",
  "payload": {
    "time_ms": number,
    "setpoint_mv": number,
    "pp1_mv": number,
    "pp2_mv": number,
    "pp3_mv": number,
    "pp4_mv": number,
    "duty1_pct": number,
    "duty2_pct": number,
    "duty3_pct": number,
    "duty4_pct": number,
    "tof_dist_cm": number
  },
  "timestamp": number,
  "isRecording": boolean
}
```

This matches the ESP32 CSV output:
```
time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
```

## WebSocket Protocol

### Client → Server Messages

- `{ "type": "start_recording" }` - Start recording data
- `{ "type": "stop_recording" }` - Stop recording data
- `{ "type": "reset" }` - Reset simulation/clear data

### Server → Client Messages

- `{ "type": "connected", "message": string, "frequency": string, "isRecording": boolean }`
- `{ "type": "data", "payload": MotorData, "timestamp": number, "isRecording": boolean }`
- `{ "type": "recording_status", "isRecording": boolean }`
- `{ "type": "reset_complete" }`
- `{ "type": "pong" }` (heartbeat response)

## Connecting to ESP32

### Prerequisites

1. ESP32 must have WebSocket server running on port 81
2. ESP32 must be on the same network as your computer (or accessible via IP)
3. Find your ESP32's IP address from Serial Monitor

### How to Find ESP32 IP Address

**Method 1: Serial Monitor (Easiest)**
1. Connect ESP32 via USB
2. Open Serial Monitor (115200 baud)
3. Upload code and watch boot sequence:
   ```
   WiFi connected!
   IP address: 192.168.1.123    ← THIS IS YOUR ESP32 IP
   WebSocket server started on port 81
   ```

**Method 2: Router Admin Panel**
- Login to router (usually `192.168.1.1`)
- Find "Connected Devices" or "DHCP Clients"
- Look for device named "ESP32" or MAC starting with:
  - `24:0A:C4`, `30:AE:A4`, or `A4:CF:12`

**Method 3: Network Scanner**
- Windows: `arp -a` in Command Prompt
- Mac/Linux: `arp -a | grep -i "24:0a:c4\|30:ae:a4\|a4:cf:12"`
- Mobile: Use "Fing" app to scan network

### Steps to Connect

1. **Get ESP32 IP Address** (see methods above)
   - Example: `192.168.1.123`

2. **Configure Frontend**
   ```bash
   # In frontend/.env.local
   NEXT_PUBLIC_WS_URL=ws://192.168.1.123:81
   ```

3. **Start Dashboard**
   ```bash
   pnpm run dev
   ```

4. **Open Browser**
   - Navigate to http://localhost:3000
   - Dashboard should auto-connect to ESP32
   - If connection fails, click "Connect" button manually

## Troubleshooting

### Dashboard shows "Disconnected"

1. Check ESP32 is powered and WiFi connected
2. Verify IP address in `.env.local` is correct
3. Ensure ESP32 WebSocket server is running on port 81
4. Check browser console for connection errors
5. Try clicking "Connect" button manually

### Charts are empty

1. Verify ESP32 is sending data (check Serial Monitor)
2. Check browser console for data format errors
3. Ensure WebSocket messages match expected format

### Browser slowing down

1. Click "Pause" button to stop data processing
2. Reduce `maxHistorySize` in `websocket-store.ts` (default: 500 points)

### Auto-reconnect not working

This is expected after manual disconnect. Auto-reconnect only triggers on unexpected disconnections.

## Development Scripts

- `pnpm run dev` - Start Next.js dev server only
- `pnpm run dev:mock` - Start dev server + mock WebSocket server
- `pnpm run mock-server` - Run mock WebSocket server only
- `pnpm run build` - Build for production
- `pnpm start` - Start production server
- `pnpm run lint` - Run ESLint

## Mock Server Details

The mock server (`dev/mock-ws-server.ts`) simulates realistic ESP32 behavior:

- **50Hz broadcast** (20ms intervals, matching ESP32)
- **PI controller simulation** with realistic lag and noise
- **TOF distance sweep** (20-200cm cyclical pattern)
- **Recording toggle** support
- **Reset simulation** support

Use for frontend development without needing physical ESP32 hardware.
