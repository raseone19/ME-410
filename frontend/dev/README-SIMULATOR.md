# Enhanced ESP32 Simulator

Comprehensive simulator for frontend development without hardware connection.

## Features

✅ **Full MODE A & MODE B support** with realistic servo sweep
✅ **Multiple test scenarios** for different development needs
✅ **Realistic PI controller simulation** with tunable parameters
✅ **Real-time scenario switching** via WebSocket commands
✅ **Configurable noise and dynamics** for realistic sensor behavior
✅ **50Hz data stream** matching real ESP32 timing

---

## Quick Start

### 1. Start the Simulator

```bash
cd frontend
pnpm run mock-server
```

This starts the WebSocket server on `ws://localhost:3001` with the enhanced simulator.

### 2. Start the Frontend

```bash
# In a new terminal
cd frontend
pnpm run dev
```

Visit `http://localhost:3000` to see the dashboard with simulated data.

---

## Simulator Architecture

```
┌─────────────────────────────────────────────────┐
│          Enhanced Simulator                     │
│  ┌───────────────────────────────────────────┐  │
│  │  Scenario Engine                          │  │
│  │  - steady, sweep, step, random, etc.     │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  MODE A/B Simulation                      │  │
│  │  - Servo sweep (MODE B)                   │  │
│  │  - Sector distance capture                │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  PI Controller Simulation                 │  │
│  │  - Per-motor pressure control             │  │
│  │  - Realistic dynamics                     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                    ↓ 50Hz WebSocket
┌─────────────────────────────────────────────────┐
│          Frontend (Next.js)                     │
│  - Dashboard (4-motor grid)                     │
│  - MODE B Page (sector visualization)           │
│  - Radar Page (polar plot)                      │
└─────────────────────────────────────────────────┘
```

---

## Test Scenarios

### 1. **steady** - Constant Distance
- Fixed TOF distance (100 cm by default)
- Useful for: Testing UI components, calibration visualization
- Use case: Component development without distractions

```json
{"type": "set_scenario", "scenario": "steady"}
```

### 2. **sweep** - Distance Sweep
- Smooth sweep between min (30 cm) and max (250 cm)
- Speed: 20 cm/s (default)
- Useful for: Testing setpoint transitions, control behavior
- Use case: Watching PI controller adapt to changing conditions

```json
{"type": "set_scenario", "scenario": "sweep"}
```

### 3. **step** - Step Changes
- Random distance jumps every 5 seconds
- Useful for: Testing transient response, error handling
- Use case: Stress-testing UI updates and control stability

```json
{"type": "set_scenario", "scenario": "step"}
```

### 4. **random** - Random Walk
- Random distance variations within range
- Useful for: Realistic sensor noise simulation
- Use case: Testing noise filtering and smoothing algorithms

```json
{"type": "set_scenario", "scenario": "random"}
```

### 5. **sector_test** - Sector Testing (MODE B)
- Slow sweep optimized for sector validation
- MODE B only
- Useful for: Testing radar visualization, sector boundaries
- Use case: Verifying each motor's sector control

```json
{"type": "set_scenario", "scenario": "sector_test"}
```

### 6. **calibration** - Calibration Pattern
- Fixed distance with intentional per-motor setpoint offsets
- Offsets: [+10, -10, +5, -5] mV
- Useful for: Testing per-motor control differences
- Use case: Calibration UI development

```json
{"type": "set_scenario", "scenario": "calibration"}
```

---

## WebSocket Commands

### Change Mode (A/B)

```json
{
  "type": "change_mode",
  "mode": "A"
}
```

**MODE A**: Single TOF reading, no servo sweep
**MODE B**: Servo sweeps 0-120°, captures 4 sector distances

### Change Scenario

```json
{
  "type": "set_scenario",
  "scenario": "sweep"
}
```

Options: `"steady"`, `"sweep"`, `"step"`, `"random"`, `"sector_test"`, `"calibration"`

### Get Status

```json
{
  "type": "get_status"
}
```

Response includes:
- Current time, distance, servo angle
- Active scenario and mode
- Full configuration

### Reset Simulation

```json
{
  "type": "reset"
}
```

Resets time, distances, pressures to initial state.

### Recording Control

```json
{"type": "start_recording"}
{"type": "stop_recording"}
```

Toggles simulated recording state (shown in UI).

---

## Configuration

Edit `frontend/dev/simulator-config.ts` to customize:

### Distance Parameters
```typescript
initialDistance: 100,  // Starting distance (cm)
minDistance: 30,       // Minimum distance (cm)
maxDistance: 250,      // Maximum distance (cm)
sweepSpeed: 20,        // Sweep speed (cm/s)
```

### Servo Parameters (MODE B)
```typescript
servoSpeed: 60,  // Degrees per second (2s for 120°)
servoMin: 0,     // Minimum angle (degrees)
servoMax: 120,   // Maximum angle (degrees)
```

### Noise Levels
```typescript
tofNoise: 2,        // TOF noise (cm)
pressureNoise: 5,   // Pressure noise (mV)
```

### PI Controller
```typescript
piResponseSpeed: 0.05,  // How fast pressure responds (0-1)
piKp: 0.15,             // Proportional gain
piKi: 0.02,             // Integral gain
```

### Per-Motor Offsets
```typescript
motorSetpointOffsets: [0, 0, 0, 0]  // Setpoint offset per motor (mV)
```

---

## Testing with Browser Console

Open browser DevTools console and send commands:

```javascript
// Get WebSocket connection from store
const ws = useWebSocketStore.getState().ws;

// Change to MODE A
ws.send(JSON.stringify({ type: "change_mode", mode: "A" }));

// Switch to step scenario
ws.send(JSON.stringify({ type: "set_scenario", scenario: "step" }));

// Get current status
ws.send(JSON.stringify({ type: "get_status" }));
```

---

## Development Workflow Examples

### Scenario 1: Developing a New Motor Card Component

1. Start simulator with **steady** scenario:
   ```bash
   pnpm run mock-server
   ```

2. Modify your component in `src/components/dashboard/MotorCard.tsx`

3. View updates at `http://localhost:3000` with stable data

### Scenario 2: Testing Radar Visualization

1. Start simulator (defaults to MODE B with sweep)

2. Navigate to `/radar` page

3. Watch servo sweep and distance changes in real-time

4. Switch scenarios via browser console to test edge cases

### Scenario 3: Testing PI Controller Response

1. Start with **step** scenario for rapid changes

2. Watch how pressure follows setpoint changes

3. Adjust PI parameters in `simulator-config.ts` if needed

4. Restart simulator to apply changes

### Scenario 4: Testing Error States

1. Switch to **random** scenario for noisy data

2. Verify error badges and color coding work correctly

3. Test outlier handling and data validation

---

## File Structure

```
frontend/dev/
├── simulator-config.ts          # Configuration and scenarios
├── enhanced-simulator.ts         # Core simulator logic
├── mock-ws-server.ts            # WebSocket server (updated)
├── mock-serial-data.ts          # Legacy (replaced by enhanced-simulator)
├── serial-ws-bridge.ts          # Real hardware bridge (unchanged)
└── README-SIMULATOR.md          # This file
```

---

## Comparison: Old vs New Simulator

| Feature | Old Simulator | Enhanced Simulator |
|---------|---------------|-------------------|
| MODE support | MODE A only | MODE A & MODE B |
| Scenarios | Single sweep | 6 scenarios |
| Servo simulation | ❌ None | ✅ Full sweep with sector capture |
| Per-motor setpoints | ❌ Single setpoint | ✅ 4 independent setpoints |
| Configurable | ❌ Hardcoded | ✅ Config file + runtime commands |
| Data structure | ❌ Old format | ✅ Matches current MotorData |
| PI controller | ❌ Simplified | ✅ Realistic with integral term |

---

## Troubleshooting

### Port Already in Use

If you see `Error: listen EADDRINUSE: address already in use :::3001`:

```bash
# Find and kill process on port 3001
lsof -ti:3001 | xargs kill -9

# Or use a different port
PORT=3002 pnpm run mock-server
```

### Frontend Not Connecting

1. Check WebSocket URL in frontend: `NEXT_PUBLIC_WS_URL=ws://localhost:3001`
2. Verify simulator is running: `pnpm run mock-server`
3. Check browser console for connection errors
4. Try manual reconnect from dashboard header

### Data Not Updating

1. Check browser console for WebSocket errors
2. Verify you're not paused (check pause button in header)
3. Restart both simulator and frontend

### Unrealistic Data

1. Adjust noise levels in `simulator-config.ts`
2. Tune PI controller parameters (`piKp`, `piKi`, `piResponseSpeed`)
3. Check scenario is appropriate for your test

---

## Future Enhancements

Potential additions:

- [ ] Binary protocol support (currently JSON only)
- [ ] Data playback from saved sessions
- [ ] Custom scenario scripting (time-based distance profiles)
- [ ] Multi-client synchronization
- [ ] Performance metrics and statistics
- [ ] Automated testing scenarios

---

## Related Documentation

- **Hardware Bridge**: See `serial-ws-bridge.ts` for real ESP32 communication
- **Frontend Store**: See `src/lib/websocket-store.ts` for data handling
- **Type Definitions**: See `src/lib/types.ts` for MotorData structure
- **Main Docs**: See project `README.md` for overall architecture

---

**Last Updated**: 2025-01-17
**Simulator Version**: 2.0 (Enhanced)
