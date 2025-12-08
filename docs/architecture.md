# System Architecture

This document describes the overall system architecture, data flow, and module interactions for the 5-Motor Independent PI Control System with servo sweep TOF sensing.

## Table of Contents

1. [System Overview](#system-overview)
2. [Multi-Core Architecture](#multi-core-architecture)
3. [Data Flow](#data-flow)
4. [Module Dependencies](#module-dependencies)
5. [Control Loop Timing](#control-loop-timing)

---

## System Overview

The system uses an ESP32 dual-core microcontroller to manage:
- **5 independent motors** with PI control
- **5 pressure pad sensors** for feedback
- **1 TOF distance sensor** with servo sweep (5°-175° divided into 5 sectors)
- **Configurable sweep modes** (forward-only or bidirectional)
- **Real-time data logging** via Serial (Binary or CSV protocol)
- **Web dashboard** with real-time visualization and dynamic configuration loading

```mermaid
graph TB
    subgraph Sensors
        TOF[TOF Distance Sensor<br/>UART 921600 baud]
        Servo[Servo Motor<br/>5°-175° sweep]
        PP1[Pressure Pad 1]
        PP2[Pressure Pad 2]
        PP3[Pressure Pad 3]
        PP4[Pressure Pad 4]
        PP5[Pressure Pad 5]
        MUX[Multiplexer<br/>CD74HC4067]
    end

    subgraph "ESP32 - Core 0"
        SweepTask[Servo Sweep Task<br/>5 Sectors<br/>Priority: 2]
        LogTask[Serial Print Task<br/>Binary/CSV<br/>Priority: 1]
    end

    subgraph "ESP32 - Core 1"
        MainLoop[Main Loop<br/>PI Control @ 50 Hz]
        PI1[PI Controller 1<br/>Sector 1: 5°-39°]
        PI2[PI Controller 2<br/>Sector 2: 39°-73°]
        PI3[PI Controller 3<br/>Sector 3: 73°-107°]
        PI4[PI Controller 4<br/>Sector 4: 107°-141°]
        PI5[PI Controller 5<br/>Sector 5: 141°-175°]
    end

    subgraph Actuators
        M1[Motor 1]
        M2[Motor 2]
        M3[Motor 3]
        M4[Motor 4]
        M5[Motor 5]
    end

    TOF --> SweepTask
    Servo --> SweepTask
    SweepTask -->|Min Distance<br/>Per Sector| MainLoop

    PP1 --> MUX
    PP2 --> MUX
    PP3 --> MUX
    PP4 --> MUX
    PP5 --> MUX
    MUX --> MainLoop

    MainLoop --> PI1 --> M1
    MainLoop --> PI2 --> M2
    MainLoop --> PI3 --> M3
    MainLoop --> PI4 --> M4
    MainLoop --> PI5 --> M5

    MainLoop -.->|Shared Vars| LogTask
    LogTask -.->|Binary/CSV| Serial[WebSocket Bridge<br/>or Serial Monitor]
```

---

## Multi-Core Architecture

The ESP32's dual cores are utilized to separate time-critical control from data acquisition and logging.

### Core 0: Data Acquisition & Logging

**Tasks:**
1. **Servo Sweep Task** (Priority 2)
   - Sweeps servo from 5° to 175° in 3° steps
   - Supports two sweep modes (configured in servo_config.h):
     - **SWEEP_MODE_FORWARD**: Continuous forward sweep (5°→175°, reset to 5°)
     - **SWEEP_MODE_BIDIRECTIONAL**: Forward and backward sweep (5°→175°→5°)
   - Reads TOF distance at each angle
   - Tracks minimum distance independently for 5 sectors:
     - Sector 1 (Motor 1): 5° - 39° (34° range)
     - Sector 2 (Motor 2): 39° - 73° (34° range)
     - Sector 3 (Motor 3): 73° - 107° (34° range)
     - Sector 4 (Motor 4): 107° - 141° (34° range)
     - Sector 5 (Motor 5): 141° - 175° (34° range)
   - Updates shared variables (mutex-protected) when each sector completes
   - Handles sector completion correctly even when SERVO_STEP doesn't align with sector boundaries
   - Runs continuously

2. **Serial Print Task** (Priority 1)
   - Reads shared variables from Core 1
   - Outputs binary (115 bytes) or CSV data at configurable rate (10-100 Hz)
   - Includes potentiometer values and dynamic distance thresholds
   - Lower priority to not interfere with sweep
   - Sends to WebSocket bridge or serial monitor

### Core 1: Real-Time Control

**Main Loop:**
- Runs at exactly 50 Hz (20 ms period)
- For each motor independently:
  - Reads minimum distance from its sector (from Core 0)
  - Reads pressure pad via multiplexer (normalized to 0-100%)
  - Reads potentiometer values for force and distance scaling
  - Classifies distance into range (CLOSE/MEDIUM/FAR) using dynamic thresholds
  - Calculates dynamic setpoint based on range (normalized percentage)
  - Executes PI controller
  - Manages safety state machine
  - Applies motor command
- Updates shared variables for logging (including scale values and thresholds)

```mermaid
graph LR
    subgraph "Core 0"
        A[Servo Sweep<br/>Continuous<br/>5 Sectors]
        B[Serial Logger<br/>50 Hz<br/>Binary/CSV]
    end

    subgraph "Core 1"
        C[PI Control Loop<br/>50 Hz<br/>5 Motors]
    end

    subgraph "Shared Memory"
        D[min_distance per sector<br/>Mutex Protected<br/>Array of 5]
        E[best_angle per sector<br/>Mutex Protected<br/>Array of 5]
        F[setpoints_pct<br/>volatile array of 5<br/>Normalized 0-100%]
        G[pressure_pct<br/>volatile array of 5<br/>Normalized 0-100%]
        H[duty_cycles<br/>volatile array of 5]
        I[force_scale<br/>distance_scale<br/>Dynamic thresholds]
    end

    A -->|Write| D
    A -->|Write| E
    C -->|Read| D
    C -->|Read| E
    C -->|Write| F
    C -->|Write| G
    C -->|Write| H
    B -->|Read| F
    B -->|Read| G
    B -->|Read| H
    B -->|Read| D
```

---

## Data Flow

### High-Level Data Flow

```mermaid
flowchart TD
    Start([Start]) --> InitHW[Initialize Hardware]
    InitHW --> StartTasks[Start Core 0 Tasks<br/>Sweep + Logger]
    StartTasks --> LoopStart{Control Loop<br/>Every 20ms}

    LoopStart -->|1| ReadPP[Read 5 Pressure Pads<br/>via Multiplexer]

    ReadPP -->|2| ProcessMotors[Process Each Motor<br/>Independently]

    ProcessMotors -->|Per Motor| GetDist[Get Min Distance<br/>for This Sector]
    GetDist -->|Per Motor| ClassifyRange[Classify Distance<br/>CLOSE/MEDIUM/FAR]
    ClassifyRange -->|Per Motor| CalcSetpoint[Calculate Dynamic<br/>Setpoint]

    CalcSetpoint -->|Per Motor| CheckState{State Machine}

    CheckState -->|Normal| RunPI[Run PI Controller]
    CheckState -->|Deflating| Reverse[Reverse Motor]
    CheckState -->|Releasing| Continue[Continue Reverse]
    CheckState -->|Waiting| Wait[Motor Stopped]

    RunPI --> NextMotor{More Motors?}
    Reverse --> NextMotor
    Continue --> NextMotor
    Wait --> NextMotor

    NextMotor -->|Yes| ProcessMotors
    NextMotor -->|No| UpdateShared[Update Shared<br/>Variables]

    UpdateShared --> Delay[Delay 1ms]
    Delay --> LoopStart

    subgraph "Parallel: Core 0"
        SweepLoop[Servo Sweep Loop<br/>5 Sectors] -.->|Updates| GetDist
        LogLoop[Serial Print Loop] -.->|Reads| UpdateShared
    end
```

### Detailed Control Step (Core 1)

```mermaid
sequenceDiagram
    participant MainLoop as Main Loop
    participant PP as Pressure Pads
    participant TOF as TOF Module
    participant PI as PI Controller
    participant Motor as Motors
    participant SM as State Machine

    Note over MainLoop,Motor: Control Loop Cycle - Every 20 ms at 50 Hz

    MainLoop->>PP: readAllPadsMilliVolts()
    PP-->>MainLoop: pressure_pads_mv array of 5

    loop For each motor i from 0 to 4
        MainLoop->>TOF: getMinDistance from motor i sector
        TOF-->>MainLoop: min_distance_cm for sector i

        MainLoop->>MainLoop: classify range<br/>CLOSE/MEDIUM/FAR

        alt Distance valid
            MainLoop->>MainLoop: calculateSetpoint()<br/>based on range
        else Distance invalid or 999
            MainLoop->>MainLoop: setpoint = -1 (invalid)
        end

        MainLoop->>SM: Check state for motor i

        alt State = NORMAL_OPERATION
            MainLoop->>PI: controlStep for motor i
            PI->>PI: Calculate error
            PI->>PI: Update integrator
            PI->>PI: Compute PI output
            PI->>PI: Apply saturation & deadband
            PI->>Motor: Apply duty cycle
            PI-->>MainLoop: duty_cycle
        else State = OUT_OF_RANGE_DEFLATING
            MainLoop->>Motor: Reverse motor i
            alt Pressure below safe threshold
                MainLoop->>SM: Transition to NORMAL or RELEASING
            end
        else State = OUT_OF_RANGE_RELEASING
            MainLoop->>Motor: Continue reverse motor i
            alt Release period complete
                MainLoop->>SM: Transition to WAITING_FOR_VALID_READING
            end
        else State = WAITING_FOR_VALID_READING
            MainLoop->>Motor: Brake motor i
            alt Distance valid and pressure safe
                MainLoop->>SM: Transition to NORMAL_OPERATION
            end
        end
    end

    MainLoop->>MainLoop: Update shared variables<br/>for logging
```

---

## Module Dependencies

```mermaid
graph TD
    Main[main.cpp] --> Config[config/system_config.h]
    Main --> Pins[config/pins.h]
    Main --> ServoConfig[config/servo_config.h<br/>NEW]
    Main --> TOF[sensors/tof_sensor]
    Main --> PP[sensors/pressure_pads]
    Main --> Motors[actuators/motors]
    Main --> PI[control/pi_controller]
    Main --> Tasks[tasks/core0_tasks]

    TOF --> Pins
    TOF --> Config
    TOF --> ServoConfig
    TOF --> ESP32PWM[ESP32PWM.h<br/>Timer allocation]
    PP --> Pins
    PP --> MUX[utils/multiplexer]
    Motors --> Pins
    PI --> Pins
    PI --> Motors
    Tasks --> Pins
    Tasks --> Config
    Tasks --> TOF
    Tasks --> BinProto[utils/binary_protocol]
    MUX --> Pins
    BinProto --> Pins

    style Main fill:#1e88e5,stroke:#0d47a1,stroke-width:2px,color:#fff
    style Config fill:#d32f2f,stroke:#b71c1c,stroke-width:2px,color:#fff
    style Pins fill:#d32f2f,stroke:#b71c1c,stroke-width:2px,color:#fff
    style TOF fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#fff
    style PP fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#fff
    style Motors fill:#f57c00,stroke:#e65100,stroke-width:2px,color:#fff
    style PI fill:#7b1fa2,stroke:#4a148c,stroke-width:2px,color:#fff
    style Tasks fill:#1e88e5,stroke:#0d47a1,stroke-width:2px,color:#fff
    style MUX fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#fff
    style BinProto fill:#795548,stroke:#3e2723,stroke-width:2px,color:#fff
```

### Module Descriptions

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| **main.cpp** | System orchestration, 5-motor control loop | All modules |
| **config/pins.h** | Pin definitions | None (base) |
| **config/system_config.h** | Protocol and logging configuration | None (base) |
| **config/servo_config.h** | Servo sweep configuration (NEW) | None (base) |
| **sensors/tof_sensor** | TOF reading, servo sweep (5 sectors) | pins.h, system_config.h, servo_config.h, ESP32PWM |
| **sensors/pressure_pads** | Pressure pad reading (5 pads) | pins.h, multiplexer |
| **utils/multiplexer** | Analog multiplexer control | pins.h |
| **actuators/motors** | Motor PWM control (5 motors) | pins.h |
| **control/pi_controller** | PI algorithm for 5 motors | pins.h, motors |
| **tasks/core0_tasks** | FreeRTOS tasks for Core 0 | pins.h, tof_sensor, binary_protocol |
| **utils/binary_protocol** | Binary packet encoding/decoding | pins.h |

---

## Control Loop Timing

### Timing Diagram

**One Control Cycle (20 ms):**

| Time (ms) | Core 1 - Control Loop | Core 0 - Sweep Task | Core 0 - Logger Task |
|-----------|----------------------|---------------------|----------------------|
| 0-3 | Read 5 Pressure Pads | TOF Reading | Read Shared Vars |
| 3-5 | Motor 1 Processing | TOF Reading (cont.) | Binary Encode/CSV |
| 5-7 | Motor 2 Processing | Move Servo | Serial Transmit |
| 7-9 | Motor 3 Processing | Move Servo (cont.) | Waiting |
| 9-11 | Motor 4 Processing | TOF Reading | Waiting |
| 11-12 | Update Shared Vars | TOF Reading (cont.) | Waiting |
| 12-20 | Idle Time | TOF Reading (cont.) | Waiting |

**Notes:**
- Core 1 completes control loop in ~12 ms, leaving 8 ms idle time
- Core 0 Sweep Task runs continuously, taking TOF readings at each servo angle
- Core 0 Logger Task transmits data in ~5 ms, then waits for next period

### Timing Specifications

| Task | Frequency | Period | Execution Time | Core |
|------|-----------|--------|----------------|------|
| PI Control Loop (5 motors) | 50 Hz | 20 ms | ~10-12 ms | Core 1 |
| Servo Sweep (5°-175°) | Continuous | ~10-12 s per full sweep | Variable | Core 0 |
| Serial Logger | 10-100 Hz | 10-100 ms | ~3-5 ms | Core 0 |
| Pressure Pad Read (5 pads) | 50 Hz | 20 ms | ~3-4 ms | Core 1 |
| TOF Single Read | Variable | N/A | ~50-100 ms | Core 0 |
| Sector Update | ~5× per sweep | ~2.5-3 s | Immediate | Core 0 |

### Critical Timing Constraints

1. **PI Control Must Run at 50 Hz**
   - Ensures stable control loop
   - Deadlines must be met to avoid jitter
   - Max execution time: <20 ms

2. **Mutex Access Must Be Fast**
   - Timeout: 10 ms maximum
   - Prevents blocking between cores
   - Ensures real-time responsiveness

3. **Multiplexer Settling Time**
   - 100 µs after channel switch
   - Required for accurate readings
   - Additional 50 µs between samples

4. **Servo Settling Time**
   - 80 ms per angle step
   - Allows mechanical stabilization
   - Critical for accurate TOF readings

5. **Sector Completion Updates**
   - Immediate update when sector completes
   - Mutex-protected write from Core 0
   - Non-blocking read from Core 1

---

## Safety State Machine (Per Motor)

Each motor operates independently with its own state machine:

```mermaid
stateDiagram-v2
    [*] --> NORMAL_OPERATION: System Start

    NORMAL_OPERATION --> OUT_OF_RANGE_DEFLATING: Distance invalid or<br/>out of bounds

    OUT_OF_RANGE_DEFLATING --> NORMAL_OPERATION: Pressure safe AND<br/>distance valid
    OUT_OF_RANGE_DEFLATING --> OUT_OF_RANGE_RELEASING: Pressure safe BUT<br/>distance still invalid

    OUT_OF_RANGE_RELEASING --> NORMAL_OPERATION: Distance valid AND<br/>pressure safe
    OUT_OF_RANGE_RELEASING --> WAITING_FOR_VALID_READING: Release period<br/>complete

    WAITING_FOR_VALID_READING --> NORMAL_OPERATION: Distance valid AND<br/>pressure safe
    WAITING_FOR_VALID_READING --> OUT_OF_RANGE_DEFLATING: Pressure above<br/>safe threshold

    note right of NORMAL_OPERATION
        PI control active
        Motor follows setpoint
    end note

    note right of OUT_OF_RANGE_DEFLATING
        Motor reversing
        Deflating until safe
    end note

    note right of OUT_OF_RANGE_RELEASING
        Motor reversing
        Fixed release period
    end note

    note right of WAITING_FOR_VALID_READING
        Motor stopped
        Waiting for valid data
    end note
```

---

## Web Dashboard Architecture

The system includes a real-time web dashboard built with Next.js and React for live visualization of all system data.

### Frontend Components

```mermaid
graph TB
    subgraph "ESP32"
        ESP[ESP32<br/>Binary Protocol]
    end

    subgraph "WebSocket Bridge"
        Bridge[serial-ws-bridge.ts<br/>Node.js]
        Parser[Binary Parser<br/>70-byte packets]
    end

    subgraph "Next.js Frontend"
        WS[WebSocket Client]
        Store[Zustand Store<br/>Global State]

        subgraph "Pages"
            Main[Main Dashboard<br/>5-motor overview]
            Motor[Motor Detail<br/>Individual analysis]
            Radar[Radar View<br/>TOF sweep visualization]
        end

        subgraph "Components"
            Cards[Motor Cards]
            Charts[Live Charts]
            RadarViz[Radar Chart]
            Controls[Control Panel]
        end
    end

    ESP -->|Serial USB<br/>70 bytes @ 50Hz| Bridge
    Bridge -->|Parse| Parser
    Parser -->|WebSocket<br/>JSON| WS
    WS --> Store
    Store --> Main
    Store --> Motor
    Store --> Radar
    Main --> Cards
    Main --> Controls
    Motor --> Charts
    Radar --> RadarViz
```

### Dashboard Features

**Main Dashboard (`/`):**
- Overview of all 5 motors simultaneously
- Live metrics: pressure (mV), duty cycle (%), distance (cm), setpoint (mV)
- Connection status and controls (connect, disconnect, record, pause)
- Real-time updates at logging rate (10-100 Hz)

![Main Dashboard](Home_1.png)
![Motor Grid](Home_2.png)

**Motor Detail View (`/motor/[id]`):**
- Individual motor analysis with historical charts
- Pressure vs time, duty cycle vs time, distance vs time
- Rolling 10-second window for trend analysis
- State machine status display

![Motor Detail - Upper](Motor_detailed_1.png)
![Motor Detail - Charts](Motor_detailed_2.png)

**Radar Visualization (`/radar`):**
- Live TOF sweep visualization (5°-175° dynamic range)
- 5 sectors color-coded by motor (boundaries loaded from backend)
- Real-time servo angle indicator
- Current distance reading per sector
- Polar coordinate display
- Sector statistics (min distance, best angle)
- Dynamically adapts to servo configuration changes

![Radar View - Polar Plot](Radar_1.png)
![Radar View - Statistics](Radar_2.png)

### Data Flow: ESP32 to Frontend

1. **ESP32 Core 0** - Serial Print Task outputs binary packets (115 bytes) at configured logging rate
2. **WebSocket Bridge** - Node.js server reads serial port, parses binary protocol
3. **WebSocket** - JSON data broadcast to connected clients
4. **Frontend Store** - Zustand state management updates component data
5. **React Components** - Re-render with latest values (optimized with useMemo)

### Binary Protocol Structure (115 bytes)

```
[0-1]     Header: 0xAA 0x55 (synchronization)
[2-5]     Timestamp (uint32_t milliseconds)
[6-25]    Setpoints: 5× float (percentage 0-100%)
[26-45]   Pressure Pads: 5× float (normalized 0-100%)
[46-65]   Duty Cycles: 5× float (-100 to +100%)
[66-85]   TOF Distances: 5× float (cm per sector)
[86]      Servo Angle (uint8_t, 0-175°)
[87-90]   Current TOF Reading: float (live distance at servo angle)
[91]      Mode Byte (uint8_t, always 1 for sweep mode)
[92]      Active Sensor (uint8_t: 0=none, 1=TOF, 2=ultrasonic, 3=both)
[93-96]   Force Scale: float (0.6-1.0 from potentiometer 1)
[97-100]  Distance Scale: float (0.5-1.5 from potentiometer 2)
[101-104] CLOSE/MEDIUM boundary: float (75-125 cm)
[105-108] MEDIUM/FAR boundary: float (125-275 cm)
[109-112] FAR/OUT boundary: float (150-450 cm)
[113-114] CRC-16 checksum
```

**Key Features:**
- All pressure/setpoint values are **normalized (0-100%)** based on calibration
- Dynamic distance thresholds adjustable via potentiometers
- CRC-16 error detection for data integrity
- 3-5x faster parsing than CSV format

---

## Summary

The architecture leverages the ESP32's dual cores to achieve:
- **Real-time control** at 50 Hz on Core 1 for 5 independent motors
- **Parallel data acquisition** on Core 0 with configurable servo sweep modes (forward/bidirectional) and sector-based distance tracking (5°-175° range)
- **Thread-safe communication** via mutex-protected shared variables
- **Modular design** for easy maintenance and extension with separate configuration files
- **Independent motor control** with per-motor state machines and setpoints
- **Normalized pressure values** (0-100%) based on calibrated prestress and maxstress
- **Potentiometer-controlled scaling** for force (0.6-1.0) and distance (0.5-1.5)
- **Dynamic distance thresholds** adjustable via potentiometers
- **Flexible output** supporting both binary (115-byte packets) and CSV protocols
- **Web dashboard** with real-time visualization, historical charts, and adaptive radar display
- **WebSocket bridge** for seamless ESP32-to-browser communication
- **Dynamic configuration loading** from ESP32 source files to frontend (no hardcoded values)

This design ensures deterministic control loop timing while maintaining continuous sensor scanning with configurable sweep patterns, independent motor control, and real-time data logging/visualization through a modern web interface that automatically adapts to backend configuration changes.
