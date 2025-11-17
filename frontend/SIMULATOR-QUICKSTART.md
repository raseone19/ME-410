# Simulator Quick Start Guide

Develop the frontend independently without ESP32 hardware.

## 🚀 Quick Start (30 seconds)

### 1. Start the simulator:
```bash
cd frontend
pnpm run mock-server
```

### 2. Start the frontend (new terminal):
```bash
cd frontend
pnpm run dev
```

### 3. Open browser:
Visit `http://localhost:3000`

You should see live data flowing at 50Hz with realistic motor control simulation!

---

## 📋 Common Commands

### Development Modes

```bash
# Simulator only (no frontend)
pnpm run mock-server

# Frontend + Simulator together
pnpm run dev:mock

# Frontend + Real ESP32 hardware
pnpm run dev:serial

# Just the frontend (requires simulator or hardware running separately)
pnpm run dev
```

### Testing

```bash
# Test simulator with automated scenarios
pnpm run test-simulator

# Simple WebSocket connection test
pnpm run test-ws-client
```

---

## 🎬 Test Scenarios

Switch scenarios via browser console:

```javascript
// Get WebSocket from store
const ws = useWebSocketStore.getState().ws;

// Scenarios:
ws.send(JSON.stringify({ type: "set_scenario", scenario: "steady" }));      // Fixed distance
ws.send(JSON.stringify({ type: "set_scenario", scenario: "sweep" }));       // Smooth sweep
ws.send(JSON.stringify({ type: "set_scenario", scenario: "step" }));        // Step changes
ws.send(JSON.stringify({ type: "set_scenario", scenario: "random" }));      // Random walk
ws.send(JSON.stringify({ type: "set_scenario", scenario: "sector_test" })); // Sector testing
ws.send(JSON.stringify({ type: "set_scenario", scenario: "calibration" })); // Calibration

// Change mode
ws.send(JSON.stringify({ type: "change_mode", mode: "A" })); // MODE A
ws.send(JSON.stringify({ type: "change_mode", mode: "B" })); // MODE B

// Get status
ws.send(JSON.stringify({ type: "get_status" }));
```

---

## 🔧 Scenario Use Cases

| Scenario | Description | Best For |
|----------|-------------|----------|
| **steady** | Constant distance (100cm) | UI development, layout testing |
| **sweep** | Smooth min→max→min cycle | Watching setpoint transitions |
| **step** | Random jumps every 5s | Stress testing, transient response |
| **random** | Random distance walk | Realistic noise simulation |
| **sector_test** | Slow sweep (MODE B) | Radar page, sector boundaries |
| **calibration** | Fixed with motor offsets | Per-motor tuning, calibration UI |

---

## 📊 What You Get

✅ **Realistic data at 50Hz** (20ms intervals)
✅ **MODE A & MODE B support** with servo sweep
✅ **4 independent motors** with PI control simulation
✅ **TOF sensor** with realistic noise
✅ **Pressure sensors** with control feedback
✅ **Duty cycle outputs** following PI controller
✅ **Sector distances** (MODE B) captured during servo sweep

---

## 🐛 Troubleshooting

### "Port 3001 already in use"
```bash
lsof -ti:3001 | xargs kill -9
pnpm run mock-server
```

### "Frontend not connecting"
1. Check simulator is running: `pnpm run mock-server`
2. Check browser console for WebSocket errors
3. Click "Connect" button in dashboard header
4. Verify URL is `ws://localhost:3001`

### "No data appearing"
1. Check you're not paused (pause button in header)
2. Check browser console for errors
3. Restart both simulator and frontend

---

## 📚 Full Documentation

See `frontend/dev/README-SIMULATOR.md` for:
- Detailed scenario descriptions
- Configuration options
- Architecture diagrams
- Advanced usage examples
- WebSocket protocol details

---

## 🎯 Next Steps

1. **Start developing**: Make UI changes and see instant updates
2. **Test scenarios**: Switch scenarios to test edge cases
3. **Customize**: Edit `frontend/dev/simulator-config.ts` for your needs
4. **Connect hardware**: When ready, use `pnpm run dev:serial` with real ESP32

---

**Happy coding! 🚀**
