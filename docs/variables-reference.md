# Variables Reference

This document provides a comprehensive reference of all variables used in the 4-Motor Independent PI Control System, organized by module and scope.

## Table of Contents

1. [Configuration Constants](#configuration-constants)
2. [Shared Variables (Inter-Core)](#shared-variables-inter-core)
3. [Local Variables (Main Loop)](#local-variables-main-loop)
4. [TOF Sensor Variables](#tof-sensor-variables)
5. [PI Controller Variables](#pi-controller-variables)
6. [State Machine Variables](#state-machine-variables)
7. [Multiplexer Variables](#multiplexer-variables)

---

## Configuration Constants

### Pin Definitions (`src/config/pins.h`)

#### Motor Pins
| Constant | Value | Description |
|----------|-------|-------------|
| `M1_PWM` | 13 | Motor 1 PWM pin |
| `M1_IN1` | 14 | Motor 1 direction control 1 |
| `M1_IN2` | 12 | Motor 1 direction control 2 |
| `M2_PWM` | 25 | Motor 2 PWM pin |
| `M2_IN1` | 27 | Motor 2 direction control 1 |
| `M2_IN2` | 26 | Motor 2 direction control 2 |
| `M3_PWM` | 5 | Motor 3 PWM pin |
| `M3_IN1` | 16 | Motor 3 direction control 1 |
| `M3_IN2` | 17 | Motor 3 direction control 2 |
| `M4_PWM` | 15 | Motor 4 PWM pin |
| `M4_IN1` | 4 | Motor 4 direction control 1 |
| `M4_IN2` | 2 | Motor 4 direction control 2 |

#### TOF and Servo Pins
| Constant | Value | Description |
|----------|-------|-------------|
| `TOF_RX_PIN` | 34 | TOF sensor RX (input-only pin) |
| `TOF_TX_PIN` | 18 | TOF sensor TX |
| `TOF_BAUDRATE` | 921600 | TOF serial communication baud rate |
| `SERVO_PIN` | 22 | Servo PWM control pin |

#### Multiplexer Pins
| Constant | Value | Description |
|----------|-------|-------------|
| `MUX_S0` | 23 | Multiplexer select bit 0 (LSB) |
| `MUX_S1` | 33 | Multiplexer select bit 1 |
| `MUX_S2` | 32 | Multiplexer select bit 2 |
| `MUX_S3` | 35 | Multiplexer select bit 3 (MSB) |
| `MUX_SIG` | 36 | Multiplexer signal pin (ADC) |

#### Servo Configuration (from `servo_config.h`)
| Constant | Value | Description |
|----------|-------|-------------|
| `SERVO_MIN_ANGLE` | 5 | Minimum sweep angle (degrees) |
| `SERVO_MAX_ANGLE` | 175 | Maximum sweep angle (degrees) |
| `SERVO_STEP` | 3 | Angle increment per step (degrees) |
| `SERVO_SETTLE_MS` | 80 | Settling time per angle (milliseconds) |
| `SERVO_READING_DELAY_MS` | 10 | Delay between TOF readings (milliseconds) |

#### Sweep Mode Configuration
| Mode | Description |
|------|-------------|
| `SWEEP_MODE_FORWARD` | Forward-only sweep (5°→175°, reset to 5°) |
| `SWEEP_MODE_BIDIRECTIONAL` | Bidirectional sweep (5°→175°→5°) |

#### Sector Definitions (from `servo_config.h`)
| Constant | Min | Max | Description |
|----------|-----|-----|-------------|
| `SECTOR_MOTOR_1_MIN` | 5 | - | Motor 1 sector start |
| `SECTOR_MOTOR_1_MAX` | 45 | - | Motor 1 sector end |
| `SECTOR_MOTOR_2_MIN` | 45 | - | Motor 2 sector start |
| `SECTOR_MOTOR_2_MAX` | 90 | - | Motor 2 sector end |
| `SECTOR_MOTOR_3_MIN` | 90 | - | Motor 3 sector start |
| `SECTOR_MOTOR_3_MAX` | 135 | - | Motor 3 sector end |
| `SECTOR_MOTOR_4_MIN` | 135 | - | Motor 4 sector start |
| `SECTOR_MOTOR_4_MAX` | 175 | - | Motor 4 sector end |

#### Multiplexer Channels
| Constant | Value | Description |
|----------|-------|-------------|
| `PP1_CHANNEL` | 1 | Pressure pad 1 multiplexer channel |
| `PP2_CHANNEL` | 2 | Pressure pad 2 multiplexer channel |
| `PP3_CHANNEL` | 3 | Pressure pad 3 multiplexer channel |
| `PP4_CHANNEL` | 6 | Pressure pad 4 multiplexer channel |

#### Sampling Configuration
| Constant | Value | Description |
|----------|-------|-------------|
| `PP_SAMPLES` | 8 | Number of samples per pressure pad reading |
| `PP_SAMPLE_DELAY_US` | 50 | Delay between samples (microseconds) |
| `MUX_SETTLE_US` | 100 | Multiplexer settling time (microseconds) |

### System Configuration (`src/config/system_config.h`)

#### Protocol Selection
| Constant | Description |
|----------|-------------|
| `PROTOCOL_CSV` | Human-readable CSV format (if defined) |
| `PROTOCOL_BINARY` | High-performance binary format (if defined) |

#### Logging Rate
| Constant | Period (ms) | Description |
|----------|-------------|-------------|
| `LOGGING_RATE_10HZ` | 100 | 10 Hz logging |
| `LOGGING_RATE_25HZ` | 40 | 25 Hz logging |
| `LOGGING_RATE_50HZ` | 20 | 50 Hz logging (default) |
| `LOGGING_RATE_100HZ` | 10 | 100 Hz logging |
| `LOGGING_PERIOD_MS` | - | Actual period based on selection |

#### CSV Precision
| Constant | Value | Description |
|----------|-------|-------------|
| `CSV_DECIMAL_PLACES` | 2 | Decimal places for CSV output (default: medium) |

### TOF Sensor Configuration (`src/sensors/tof_sensor.h`)

#### Distance Ranges
| Constant | Value | Description |
|----------|-------|-------------|
| `DISTANCE_CLOSE_MIN` | 50.0f | Close range minimum (cm) |
| `DISTANCE_MEDIUM_MIN` | 100.0f | Medium range minimum (cm) |
| `DISTANCE_FAR_MIN` | 200.0f | Far range minimum (cm) |
| `DISTANCE_FAR_MAX` | 300.0f | Far range maximum (cm) |

#### Setpoints
| Constant | Value | Description |
|----------|-------|-------------|
| `SETPOINT_CLOSE_MV` | 1500.0f | Close range pressure setpoint (mV) |
| `SETPOINT_MEDIUM_MV` | 700.0f | Medium range pressure setpoint (mV) |
| `SECURITY_OFFSET_MV` | 50.0f | Far range baseline offset (mV) |
| `FAR_RANGE_BASELINE_MV` | 500.0f | Fixed baseline for FAR range (mV) |

#### Safety Thresholds
| Constant | Value | Description |
|----------|-------|-------------|
| `SAFE_PRESSURE_THRESHOLD_MV` | 600.0f | Safe pressure level for state transitions (mV) |
| `RELEASE_TIME_MS` | 500 | Release period duration (milliseconds) |

### PI Controller Configuration (`src/control/pi_controller.cpp`)

#### PI Gains
| Constant | Value | Description |
|----------|-------|-------------|
| `Kp` | 0.15f | Proportional gain |
| `Ki` | 0.60f | Integral gain |

#### Control Limits
| Constant | Value | Description |
|----------|-------|-------------|
| `MAX_DUTY` | 100.0f | Maximum duty cycle (%) |
| `MIN_DUTY` | -100.0f | Minimum duty cycle (%) |
| `MIN_RUN` | 40.0f | Minimum duty to overcome friction (%) |
| `MAX_INTEGRATOR` | 50.0f | Maximum integrator value (anti-windup) |
| `MIN_INTEGRATOR` | -50.0f | Minimum integrator value (anti-windup) |

### Control Loop Configuration (`src/main.cpp`)

| Constant | Value | Description |
|----------|-------|-------------|
| `CTRL_FREQ_HZ` | 50 | Control loop frequency (Hz) |
| `CTRL_DT_MS` | 20 | Control loop period (milliseconds) |
| `NUM_MOTORS` | 4 | Number of motors in system |

### FreeRTOS Task Priorities (`src/tasks/core0_tasks.h`)

| Constant | Value | Description |
|----------|-------|-------------|
| `SERVO_SWEEP_PRIORITY` | 2 | Servo sweep task priority (higher) |
| `SERIAL_PRINT_PRIORITY` | 1 | Serial print task priority (lower) |

---

## Shared Variables (Inter-Core)

These variables are shared between Core 0 (data acquisition) and Core 1 (control loop). They require mutex protection or are declared `volatile`.

### Distance and Angle Tracking (Mutex Protected)

Defined in `src/sensors/tof_sensor.cpp`:

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `distanceMutex` | `SemaphoreHandle_t` | Global | Mutex for protecting distance/angle arrays |
| `shared_min_distance[4]` | `volatile float` | Global | Minimum distance per sector (cm), initialized to 999.0f |
| `shared_best_angle[4]` | `volatile int` | Global | Angle of minimum distance per sector (degrees) |
| `sweep_active` | `volatile bool` | Global | Flag indicating if sweep is active (unused in current implementation) |

**Sector Mapping:**
- Index 0: Motor 1 (5° - 45°)
- Index 1: Motor 2 (45° - 90°)
- Index 2: Motor 3 (90° - 135°)
- Index 3: Motor 4 (135° - 175°)

**Access Pattern:**
- **Written by:** Core 0 (Servo Sweep Task) with mutex
- **Read by:** Core 1 (Main Loop) with mutex
- **Update Frequency:** When each sector completes (~2.5-3s per sector)

### Control Data (Volatile, No Mutex)

Defined in `src/tasks/core0_tasks.cpp`:

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `shared_setpoints_mv[4]` | `volatile float` | Global | Current setpoints for each motor (mV) |
| `shared_pressure_pads_mv[4]` | `volatile uint16_t` | Global | Current pressure pad readings (mV) |
| `shared_duty_cycles[4]` | `volatile float` | Global | Current duty cycles for each motor (%) |
| `shared_tof_distances[4]` | `volatile float` | Global | TOF distances per sector for logging (cm) |
| `shared_servo_angle` | `volatile int` | Global | Current servo angle (degrees, 0-120) |
| `shared_tof_current` | `volatile float` | Global | Current TOF reading at current angle (cm) |

**Access Pattern:**
- **Written by:** Core 1 (Main Loop)
- **Read by:** Core 0 (Serial Print Task)
- **Update Frequency:** 50 Hz (every 20 ms)

---

## Local Variables (Main Loop)

These variables are local to the main loop in `src/main.cpp` and are not shared between cores.

### State Machine Variables

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `current_state[4]` | `SystemState` | Static | Current state for each motor |
| `reverse_start_time[4]` | `uint32_t` | Static | Timestamp when reverse period started (ms) |

**Possible States (SystemState enum):**
- `NORMAL_OPERATION` - PI control active
- `OUT_OF_RANGE_DEFLATING` - Reversing motor to deflate
- `OUT_OF_RANGE_RELEASING` - Reverse period after deflation
- `WAITING_FOR_VALID_READING` - Waiting for valid distance and safe pressure

### Distance Range Tracking

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `current_range[4]` | `DistanceRange` | Static | Current distance range classification per motor |
| `previous_range[4]` | `DistanceRange` | Static | Previous distance range for transition detection |

**Possible Ranges (DistanceRange enum):**
- `RANGE_CLOSE` - 50-100 cm
- `RANGE_MEDIUM` - 100-200 cm
- `RANGE_FAR` - 200-300 cm
- `RANGE_OUT_OF_BOUNDS` - Outside valid ranges
- `RANGE_UNKNOWN` - No valid reading

### Baseline Pressure Tracking

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `far_range_baseline_mv[4]` | `float` | Static | Baseline pressure captured when entering FAR range (mV) |
| `far_range_baseline_captured[4]` | `bool` | Static | Flag indicating if baseline has been captured |

### Control Loop Variables

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `pressure_pads_mv[4]` | `uint16_t` | Static | Local copy of pressure pad readings (mV) |
| `duty_cycles[4]` | `float` | Static | Local copy of duty cycles (%) |
| `setpoints_mv[4]` | `float` | Static | Local copy of setpoints per motor (mV) |
| `last_control_ms` | `uint32_t` | Static | Timestamp of last control loop execution (ms) |

---

## TOF Sensor Variables

These variables are internal to the TOF sensor module (`src/sensors/tof_sensor.cpp`).

### Serial Communication

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `tofSerial` | `HardwareSerial` | Static | Serial1 instance for TOF communication |

### TOF Data Parsing

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `tof_id` | `uint8_t` | Static | TOF sensor ID from data frame |
| `tof_systemTime` | `uint32_t` | Static | TOF system timestamp (ms) |
| `tof_distance` | `float` | Static | Parsed distance from TOF (meters, converted to cm) |
| `tof_distanceStatus` | `uint8_t` | Static | Distance measurement status code |
| `tof_signalStrength` | `uint16_t` | Static | Signal strength of TOF reading |
| `tof_rangePrecision` | `uint8_t` | Static | Range precision indicator |

### Servo Control

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `tofServo` | `Servo` | Static | ESP32Servo instance for servo control |
| `servo_channels_allocated` | `bool` | Static | Flag to ensure timer allocation happens once |

---

## PI Controller Variables

These variables are internal to the PI controller module (`src/control/pi_controller.cpp`).

### PI State (Per Motor)

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `integrator[4]` | `float` | Static | Integral accumulator for each motor |
| `last_error[4]` | `float` | Static | Previous error for derivative calculation (unused) |

**Note:** Arrays are sized for 4 motors (NUM_MOTORS = 4)

---

## State Machine Variables

State machine is implemented in `src/main.cpp`.

### State Enum

```cpp
enum SystemState {
    NORMAL_OPERATION,           // PI control active
    OUT_OF_RANGE_DEFLATING,    // Reversing to deflate (pressure > threshold)
    OUT_OF_RANGE_RELEASING,    // Reverse period (pressure safe, distance invalid)
    WAITING_FOR_VALID_READING  // Stopped, waiting for valid data
};
```

### Distance Range Enum

```cpp
enum DistanceRange {
    RANGE_CLOSE,         // 50-100 cm
    RANGE_MEDIUM,        // 100-200 cm
    RANGE_FAR,           // 200-300 cm
    RANGE_OUT_OF_BOUNDS, // < 50 or > 300 cm
    RANGE_UNKNOWN        // Invalid reading (-1 or 999)
};
```

---

## Multiplexer Variables

These variables are internal to the multiplexer module (`src/utils/multiplexer.cpp`).

### No persistent variables

The multiplexer module is stateless - it only contains functions that select channels and read values. All channel selections are passed as parameters.

---

## Binary Protocol Variables

Defined in `src/utils/binary_protocol.h`:

### Packet Structure

```cpp
struct DataPacket {
    uint16_t header;           // 0xAA55 sync header
    uint32_t timestamp_ms;     // System timestamp (milliseconds)
    float setpoints[4];        // Setpoints for 4 motors (mV)
    uint16_t pressures[4];     // Pressure pad readings (mV)
    float duties[4];           // Duty cycles (%)
    float tof_distances[4];    // TOF distances per sector (cm)
    uint8_t servo_angle;       // Current servo angle (0-120)
    float tof_current;         // Current TOF reading (cm)
    uint8_t mode;              // Mode byte (always 1 = sweep mode)
    uint16_t crc;              // CRC-16 checksum
};
```

**Total Size:** 70 bytes (enforced by `static_assert`)

---

## Variable Naming Conventions

### Prefixes

- `shared_*` - Variables shared between cores (Core 0 ↔ Core 1)
- `tof_*` - TOF sensor related variables
- `M1_*, M2_*, M3_*, M4_*` - Motor-specific pin definitions
- `MUX_*` - Multiplexer related constants
- `PP*_*` - Pressure pad related (e.g., `PP1_CHANNEL`)

### Suffixes

- `*_PIN` - GPIO pin number
- `*_MV` - Value in millivolts
- `*_MS` - Time in milliseconds
- `*_US` - Time in microseconds
- `*_HZ` - Frequency in Hertz
- `*_PCT` - Percentage value
- `*_CM` - Distance in centimeters

### Array Sizes

- `[4]` - Arrays sized for 4 motors (NUM_MOTORS)
- Motor index: 0 = Motor 1, 1 = Motor 2, 2 = Motor 3, 3 = Motor 4

---

## Variable Initialization Summary

### At Startup (setup())

1. **Hardware initialization:**
   - `tofSerial.begin()` - Initialize TOF serial
   - `tofServo.attach()` - Attach servo to GPIO 22
   - `distanceMutex = xSemaphoreCreateMutex()` - Create mutex

2. **Variable initialization:**
   - `shared_min_distance[4] = {999.0f, 999.0f, 999.0f, 999.0f}` - Invalid/uninitialized
   - `shared_best_angle[4] = {0, 30, 60, 90}` - Sector minimums
   - `current_state[4] = {NORMAL_OPERATION, ...}` - All motors start normal
   - `integrator[4] = {0.0f, ...}` - Zero integrators

### During Operation

1. **Servo Sweep Task (Core 0):**
   - Continuously updates `shared_servo_angle` and `shared_tof_current`
   - Updates `shared_min_distance[i]` and `shared_best_angle[i]` when sector `i` completes

2. **Main Loop (Core 1):**
   - Every 20 ms: Reads sensors, runs PI control, updates `shared_*` variables

3. **Serial Print Task (Core 0):**
   - Every 20-100 ms: Reads `shared_*` variables, sends binary/CSV data

---

## Quick Reference: Most Important Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `shared_min_distance[4]` | Core 0 → Core 1 | Minimum distance per motor sector |
| `shared_pressure_pads_mv[4]` | Core 1 → Core 0 | Current pressure readings for logging |
| `shared_duty_cycles[4]` | Core 1 → Core 0 | Current motor duty cycles for logging |
| `setpoints_mv[4]` | Main loop | Dynamic setpoints calculated per motor |
| `current_state[4]` | Main loop | State machine state per motor |
| `integrator[4]` | PI controller | PI integral accumulator per motor |
| `distanceMutex` | Global | Protects distance/angle shared variables |

---

## See Also

- [Architecture Overview](architecture.md) - System design and data flow
- [Hardware Guide](hardware.md) - Complete pin mappings
- [Control System](control-system.md) - PI controller details
- [Communication](communication.md) - Inter-core communication
