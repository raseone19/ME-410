# System Architecture

This document describes the overall system architecture, data flow, and module interactions for the 4-Motor Independent PI Control System.

## Table of Contents

1. [System Overview](#system-overview)
2. [Multi-Core Architecture](#multi-core-architecture)
3. [Data Flow](#data-flow)
4. [Module Dependencies](#module-dependencies)
5. [Control Loop Timing](#control-loop-timing)

---

## System Overview

The system uses an ESP32 dual-core microcontroller to manage:
- **4 independent motors** with PI control
- **4 pressure pad sensors** for feedback
- **1 TOF distance sensor** with servo sweep for setpoint calculation
- **Real-time data logging** via Serial

```mermaid
graph TB
    subgraph Sensors
        TOF[TOF Distance Sensor]
        Servo[Servo Motor]
        PP1[Pressure Pad 1]
        PP2[Pressure Pad 2]
        PP3[Pressure Pad 3]
        PP4[Pressure Pad 4]
        MUX[Multiplexer<br/>CD74HC4067]
    end

    subgraph "ESP32 - Core 0"
        SweepTask[Servo Sweep Task<br/>Priority: 2]
        LogTask[Serial Print Task<br/>Priority: 1]
    end

    subgraph "ESP32 - Core 1"
        MainLoop[Main Loop<br/>PI Control @ 50 Hz]
        PI1[PI Controller 1]
        PI2[PI Controller 2]
        PI3[PI Controller 3]
        PI4[PI Controller 4]
    end

    subgraph Actuators
        M1[Motor 1]
        M2[Motor 2]
        M3[Motor 3]
        M4[Motor 4]
    end

    TOF --> SweepTask
    Servo --> SweepTask
    SweepTask -->|Min Distance| MainLoop

    PP1 --> MUX
    PP2 --> MUX
    PP3 --> MUX
    PP4 --> MUX
    MUX --> MainLoop

    MainLoop --> PI1 --> M1
    MainLoop --> PI2 --> M2
    MainLoop --> PI3 --> M3
    MainLoop --> PI4 --> M4

    MainLoop -.->|Shared Vars| LogTask
    LogTask -.->|CSV Output| Serial[Serial Monitor]
```

---

## Multi-Core Architecture

The ESP32's dual cores are utilized to separate time-critical control from data acquisition and logging.

### Core 0: Data Acquisition & Logging

**Tasks:**
1. **Servo Sweep Task** (Priority 2)
   - Sweeps servo from 30° to 90°
   - Reads TOF distance at each angle
   - Finds minimum distance
   - Updates shared variables (mutex-protected)
   - Runs continuously

2. **Serial Print Task** (Priority 1)
   - Reads shared variables from Core 1
   - Outputs CSV data at 50 Hz
   - Lower priority to not interfere with sweep

### Core 1: Real-Time Control

**Main Loop:**
- Runs at exactly 50 Hz (20 ms period)
- Reads minimum distance from Core 0
- Reads 4 pressure pads via multiplexer
- Calculates dynamic setpoint
- Executes 4 independent PI controllers
- Applies motor commands
- Updates shared variables for logging

```mermaid
graph LR
    subgraph "Core 0"
        A[Servo Sweep<br/>Continuous]
        B[Serial Logger<br/>50 Hz]
    end

    subgraph "Core 1"
        C[PI Control Loop<br/>50 Hz]
    end

    subgraph "Shared Memory"
        D[min_distance<br/>Mutex Protected]
        E[setpoint_mv<br/>volatile]
        F[pressure_pads_mv<br/>volatile array]
        G[duty_cycles<br/>volatile array]
    end

    A -->|Write| D
    C -->|Read| D
    C -->|Write| E
    C -->|Write| F
    C -->|Write| G
    B -->|Read| E
    B -->|Read| F
    B -->|Read| G
```

---

## Data Flow

### High-Level Data Flow

```mermaid
flowchart TD
    Start([Start]) --> InitHW[Initialize Hardware]
    InitHW --> StartTasks[Start Core 0 Tasks]
    StartTasks --> LoopStart{Control Loop<br/>Every 20ms}

    LoopStart -->|1| GetDist[Get Min Distance<br/>from Core 0]
    GetDist -->|2| ClassifyRange[Classify Distance<br/>into Range]
    ClassifyRange -->|3| ReadPP[Read 4 Pressure Pads<br/>via Multiplexer]
    ReadPP -->|4| CalcSetpoint[Calculate Dynamic<br/>Setpoint]

    CalcSetpoint -->|5| CheckState{State Machine}

    CheckState -->|Normal| RunPI[Run 4 PI Controllers]
    CheckState -->|Out of Range| Reverse[Reverse All Motors]
    CheckState -->|Waiting| Wait[Wait for Valid<br/>Reading]

    RunPI --> UpdateShared[Update Shared<br/>Variables]
    Reverse --> UpdateShared
    Wait --> UpdateShared

    UpdateShared --> Delay[Delay 1ms]
    Delay --> LoopStart

    subgraph "Parallel: Core 0"
        SweepLoop[Servo Sweep Loop] -.->|Updates| GetDist
        LogLoop[Serial Print Loop] -.->|Reads| UpdateShared
    end
```

### Detailed Control Step (Core 1)

```mermaid
sequenceDiagram
    participant MainLoop as Main Loop
    participant TOF as TOF Module
    participant PP as Pressure Pads
    participant PI as PI Controller
    participant Motor as Motors

    Note over MainLoop,Motor: Control Loop Cycle - Every 20 ms at 50 Hz

    MainLoop->>TOF: getMinDistance()
    TOF-->>MainLoop: min_distance_cm

    MainLoop->>MainLoop: classify range<br/>CLOSE/MEDIUM/FAR

    MainLoop->>PP: readAllPadsMilliVolts()
    PP-->>MainLoop: pressure_pads_mv[4]

    MainLoop->>MainLoop: calculateSetpoint()<br/>based on range

    Note over MainLoop,PI: State Machine Check

    alt Normal Operation
        MainLoop->>PI: controlStep(setpoint, pressures[4], duty_out[4])
        loop For each motor 0-3
            PI->>PI: Calculate error
            PI->>PI: Update integrator
            PI->>PI: Compute PI output
            PI->>PI: Apply saturation & deadband
            PI->>Motor: Apply duty cycle
        end
        PI-->>MainLoop: duty_cycles[4]
    else Out of Range
        MainLoop->>Motor: Reverse all motors
        MainLoop->>PI: resetIntegrators()
    else Waiting for Valid Reading
        MainLoop->>MainLoop: Check if back in range
    end

    MainLoop->>MainLoop: Update shared variables<br/>for logging
```

---

## Module Dependencies

```mermaid
graph TD
    Main[main.cpp] --> Pins[config/pins.h]
    Main --> TOF[sensors/tof_sensor]
    Main --> PP[sensors/pressure_pads]
    Main --> Motors[actuators/motors]
    Main --> PI[control/pi_controller]
    Main --> Tasks[tasks/core0_tasks]

    TOF --> Pins
    PP --> Pins
    PP --> MUX[utils/multiplexer]
    Motors --> Pins
    PI --> Pins
    PI --> Motors
    Tasks --> Pins
    Tasks --> TOF
    MUX --> Pins

    style Main fill:#1e88e5,stroke:#0d47a1,stroke-width:2px,color:#fff
    style Pins fill:#d32f2f,stroke:#b71c1c,stroke-width:2px,color:#fff
    style TOF fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#fff
    style PP fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#fff
    style Motors fill:#f57c00,stroke:#e65100,stroke-width:2px,color:#fff
    style PI fill:#7b1fa2,stroke:#4a148c,stroke-width:2px,color:#fff
    style Tasks fill:#1e88e5,stroke:#0d47a1,stroke-width:2px,color:#fff
    style MUX fill:#388e3c,stroke:#1b5e20,stroke-width:2px,color:#fff
```

### Module Descriptions

| Module | Purpose | Dependencies |
|--------|---------|--------------|
| **main.cpp** | System orchestration, main loop | All modules |
| **config/pins.h** | Pin definitions | None (base) |
| **sensors/tof_sensor** | TOF reading, servo sweep | pins.h |
| **sensors/pressure_pads** | Pressure pad reading | pins.h, multiplexer |
| **utils/multiplexer** | Analog multiplexer control | pins.h |
| **actuators/motors** | Motor PWM control | pins.h |
| **control/pi_controller** | PI algorithm for 4 motors | pins.h, motors |
| **tasks/core0_tasks** | FreeRTOS tasks for Core 0 | pins.h, tof_sensor |

---

## Control Loop Timing

### Timing Diagram

```mermaid
gantt
    title Control System Timing (One 20ms Cycle)
    dateFormat X
    axisFormat %L ms

    section Core 1 (Control)
    Get Min Distance    :0, 1
    Classify Range      :1, 1
    Read 4 Pressure Pads:2, 3
    Calculate Setpoint  :5, 1
    Run 4 PI Controllers:6, 4
    Update Motors       :10, 2
    Update Shared Vars  :12, 1
    Idle Time           :13, 7

    section Core 0 (Sweep)
    TOF Reading         :0, 5
    Move Servo          :5, 3
    TOF Reading         :8, 5
    Move Servo          :13, 3
    TOF Reading         :16, 4

    section Core 0 (Logger)
    Read Shared Vars    :0, 1
    Serial Print CSV    :1, 2
    Wait                :3, 17
```

### Timing Specifications

| Task | Frequency | Period | Execution Time | Core |
|------|-----------|--------|----------------|------|
| PI Control Loop | 50 Hz | 20 ms | ~10-15 ms | Core 1 |
| Servo Sweep | Continuous | ~4-5 s per full sweep | Variable | Core 0 |
| CSV Logger | 50 Hz | 20 ms | ~2-3 ms | Core 0 |
| Pressure Pad Read | 50 Hz | 20 ms | ~3-4 ms (4 channels × 8 samples) | Core 1 |
| TOF Single Read | Variable | N/A | ~50-100 ms | Core 0 |

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

---

## Summary

The architecture leverages the ESP32's dual cores to achieve:
- **Real-time control** at 50 Hz on Core 1
- **Parallel data acquisition** on Core 0
- **Thread-safe communication** via mutex-protected shared variables
- **Modular design** for easy maintenance and extension

This design ensures deterministic control loop timing while maintaining continuous sensor scanning and data logging.
