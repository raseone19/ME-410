# 4-Motor Independent PI Control with Dynamic TOF Setpoint

A robust ESP32-based control system that independently controls 4 DC motors using PI controllers, with a dynamic setpoint calculated from TOF (Time-of-Flight) distance sensor readings.

## Features

- **Independent PI Control**: Each of the 4 motors has its own pressure pad sensor and PI controller
- **Dual Operation Modes**:
  - **Mode A**: Fixed servo at 90°, direct distance reading (faster response)
  - **Mode B**: Servo sweep 30°-90°, minimum distance tracking (better detection)
- **Dynamic Setpoint**: TOF sensor determines distance to calculate optimal setpoint
- **Multi-Core Architecture**: Utilizes both ESP32 cores for parallel processing
  - Core 0: TOF reading and data logging
  - Core 1: Real-time PI control at 50 Hz
- **Adaptive Range Control**: Different control strategies for CLOSE, MEDIUM, and FAR distance ranges
- **Out-of-Range Protection**: Automatic reversal when object gets too close or too far
- **Real-time CSV Logging**: Streams sensor and control data for analysis

## Hardware Requirements

### Main Components

- **ESP32 Dev Module** (dual-core microcontroller)
- **4× DC Motors** with H-bridge drivers (L298N, TB6612, or similar)
- **4× Pressure Pad Sensors** (FSR or similar analog sensors)
- **1× TOF Distance Sensor** (serial UART interface, 921600 baud)
- **1× Servo Motor** (for TOF scanning mechanism)
- **1× CD74HC4067** 16-channel analog multiplexer

### Pin Connections

See [docs/hardware.md](docs/hardware.md) for complete wiring diagram and pin mappings.

## Quick Start

### 1. Hardware Setup

1. Connect the 4 motors to H-bridge drivers
2. Wire pressure pads to multiplexer channels (C1, C2, C3, C6)
3. Connect TOF sensor to Serial1 (RX=GPIO18, TX=GPIO34)
4. Attach servo to GPIO2
5. Connect multiplexer control pins (S0-S3) and signal pin

### 2. Software Setup

#### Visual Studio Code + PlatformIO

1. **Install VS Code** (if not already installed):
   - Download from [https://code.visualstudio.com/](https://code.visualstudio.com/)

2. **Install PlatformIO Extension**:
   - Open VS Code
   - Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
   - Search for "PlatformIO IDE"
   - Click Install

3. **Open the Project**:
   - File → Open Folder → Select `MovingTof_OneMotor_OK`
   - PlatformIO will automatically install dependencies (ESP32Servo library)

4. **Build and Upload**:
   - **Build**: Click the ✓ icon in the bottom toolbar or press `Ctrl+Alt+B` (Windows/Linux) / `Cmd+Shift+B` (Mac)
   - **Upload**: Click the → icon in the bottom toolbar or press `Ctrl+Alt+U` (Windows/Linux) / `Cmd+Shift+U` (Mac)
   - **Serial Monitor**: Click the 🔌 icon or press `Ctrl+Alt+S` (Windows/Linux) / `Cmd+Shift+S` (Mac)

**Alternative: Command Line**

```bash
# Navigate to project directory
cd MovingTof_OneMotor_OK

# Build the project
pio run

# Upload to ESP32
pio run --target upload

# Open serial monitor
pio device monitor
```

> **Note:** For detailed VS Code usage instructions, see [`.vscode/README_VSCODE.md`](.vscode/README_VSCODE.md)

### 3. Verification

After uploading, you should see:

```
========================================
4-Motor Independent PI Control System
With Dynamic TOF Setpoint
========================================

Initializing hardware...
  - TOF sensor... OK
  - Pressure pads... OK
  - Motors... OK
  - PI controllers... OK

Starting Core 0 tasks...
  - Servo sweep task started on Core 0
  - Serial print task started on Core 0

Initialization complete!
Starting PI control loop on Core 1 at 50 Hz...

time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
...
```

## Project Structure

```
MovingTof_OneMotor_OK/
├── README.md                         # This file
├── platformio.ini                    # PlatformIO configuration
├── docs/                             # Documentation
│   ├── architecture.md               # System architecture
│   ├── hardware.md                   # Pin mappings & wiring
│   ├── control-system.md             # PI controller details
│   └── communication.md              # Inter-core communication
├── src/
│   ├── main.cpp                      # Main program
│   ├── config/
│   │   ├── pins.h                    # Pin definitions
│   │   └── system_config.h           # Operation mode selection
│   ├── sensors/
│   │   ├── tof_sensor.cpp/.h         # TOF + servo sweep
│   │   └── pressure_pads.cpp/.h      # Pressure pad reading
│   ├── actuators/
│   │   └── motors.cpp/.h             # Motor control
│   ├── control/
│   │   └── pi_controller.cpp/.h      # PI controllers
│   ├── utils/
│   │   └── multiplexer.cpp/.h        # Multiplexer functions
│   └── tasks/
│       └── core0_tasks.cpp/.h        # FreeRTOS tasks
```

## Configuration

### Switching Operation Modes

The system supports two operation modes that can be selected before compilation:

**Edit `src/config/system_config.h`:**

```cpp
// Uncomment ONE of the following lines:
//#define MODE_A  // Fixed servo at 90°, direct distance reading
#define MODE_B  // Servo sweep, minimum distance tracking (default)
```

**Mode A - Fixed Servo (Faster Response)**
- Servo stays at 90° (straight ahead)
- Direct TOF reading at ~20Hz
- Lower latency response
- Single direction measurement
- Best for: Forward-only obstacle detection

**Mode B - Servo Sweep (Better Detection)**
- Servo sweeps 30° to 90°
- Tracks minimum distance across sweep
- Wider field of view
- Slower update rate due to sweep time
- Best for: Multi-directional obstacle avoidance

After changing the mode, rebuild and upload:
```bash
pio run --target upload
```

### PI Controller Tuning

Edit `src/control/pi_controller.cpp`:

```cpp
static float Kp = 0.15f;  // Proportional gain
static float Ki = 0.60f;  // Integral gain
```

### Distance Ranges

Edit `src/sensors/tof_sensor.h`:

```cpp
constexpr float DISTANCE_CLOSE_MIN = 50.0f;    // 50-100 cm
constexpr float DISTANCE_MEDIUM_MIN = 100.0f;  // 100-200 cm
constexpr float DISTANCE_FAR_MIN = 200.0f;     // 200-300 cm
```

### Setpoints

Edit `src/sensors/tof_sensor.h`:

```cpp
constexpr float SETPOINT_CLOSE_MV = 1150.0f;   // Close range setpoint
constexpr float SETPOINT_MEDIUM_MV = 800.0f;   // Medium range setpoint
constexpr float SECURITY_OFFSET_MV = 50.0f;    // Far range offset
```

## How It Works

1. **Core 0** continuously sweeps the servo from 30° to 90°, reading the TOF sensor at each angle
2. The minimum distance found is stored in a thread-safe shared variable
3. **Core 1** reads this distance every 20 ms (50 Hz) and classifies it into a range (CLOSE, MEDIUM, FAR)
4. Based on the range, a setpoint is calculated:
   - **CLOSE** (50-100 cm): High pressure setpoint (1150 mV)
   - **MEDIUM** (100-200 cm): Medium pressure setpoint (800 mV)
   - **FAR** (200-300 cm): Dynamic setpoint (current pressure + 50 mV)
5. Each motor's PI controller compares its pressure pad reading to the setpoint
6. The PI algorithm calculates the appropriate duty cycle to reach the setpoint
7. All data is logged in CSV format via Serial at 50 Hz

## Safety Features

- **Out-of-Range Detection**: If distance is <50 cm or >300 cm, all motors reverse for 500 ms
- **Anti-Windup**: PI integrators are clamped to prevent excessive accumulation
- **Deadband**: Motors require minimum 40% duty to overcome static friction
- **Watchdog Protection**: Small delays prevent watchdog timer triggers

## CSV Data Format

```
time_ms,setpoint_mv,pp1_mv,pp2_mv,pp3_mv,pp4_mv,duty1_pct,duty2_pct,duty3_pct,duty4_pct,tof_dist_cm
1234,850.0,820,835,845,830,45.23,38.67,42.11,41.89,156.78
...
```

## Troubleshooting

### Motors not moving
- Check H-bridge connections and power supply
- Verify `MIN_RUN` threshold in `pi_controller.cpp` (default: 40%)
- Ensure pressure pads are connected and reading values

### TOF sensor not responding
- Verify baud rate is 921600
- Check RX/TX pins (RX=18, TX=34)
- Ensure TOF sensor is powered (usually 3.3V or 5V)

### Erratic servo movement
- Check servo power supply (separate from logic if possible)
- Adjust `SERVO_SETTLE_MS` in `pins.h` for slower servos

### Pressure readings are noisy
- Increase `PP_SAMPLES` in `pins.h` (default: 8)
- Check multiplexer wiring and ground connections

## Further Documentation

- [Architecture Overview](docs/architecture.md) - System design and data flow
- [Hardware Guide](docs/hardware.md) - Complete pin mappings and wiring
- [Control System](docs/control-system.md) - PI controller theory and tuning
- [Communication](docs/communication.md) - FreeRTOS and inter-core details

## License

This project is provided as-is for educational and research purposes.

## Authors

EPFL - Semester Project 2025
