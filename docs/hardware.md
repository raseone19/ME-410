# Hardware Configuration

This document provides complete hardware specifications, pin mappings, and wiring diagrams for the 5-Motor Independent PI Control System.

## Table of Contents

1. [Hardware Components](#hardware-components)
2. [Complete Pin Mapping](#complete-pin-mapping)
3. [Wiring Diagrams](#wiring-diagrams)
4. [Component Specifications](#component-specifications)
5. [Power Requirements](#power-requirements)

---

## Hardware Components

### Required Components

| Component | Quantity | Notes |
|-----------|----------|-------|
| ESP32-S3 Dev Module | 1 | Dual-core, 45 GPIO pins |
| DC Motors | 5 | 6-12V rated |
| H-Bridge Motor Drivers | 5 | L298N, TB6612, or similar |
| Pressure Pad Sensors (FSR) | 5 | Analog output |
| TOF Distance Sensor | 1 | UART serial, 921600 baud |
| Servo Motor | 1 | Standard hobby servo (e.g., SG90) |
| CD74HC4067 Multiplexer | 1 | 16-channel analog MUX |
| Potentiometers | 2 | For force and distance scaling |
| Pull-down Resistors | 5 | 10kΩ for pressure pads |
| Power Supply | 1-2 | 5V for logic, 6-12V for motors |

---

## Complete Pin Mapping

### Motor Control Pins (ESP32-S3)

#### Motor 1
| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| M1_PWM | GPIO 14 | PWM speed control (LEDC channel auto-assigned) |
| M1_IN1 | GPIO 13 | H-bridge direction control 1 |
| M1_IN2 | GPIO 21 | H-bridge direction control 2 |

#### Motor 2
| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| M2_PWM | GPIO 35 | PWM speed control (LEDC channel auto-assigned) |
| M2_IN1 | GPIO 48 | H-bridge direction control 1 |
| M2_IN2 | GPIO 47 | H-bridge direction control 2 |

#### Motor 3
| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| M3_PWM | GPIO 36 | PWM speed control (LEDC channel auto-assigned) |
| M3_IN1 | GPIO 37 | H-bridge direction control 1 |
| M3_IN2 | GPIO 38 | H-bridge direction control 2 |

#### Motor 4
| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| M4_PWM | GPIO 41 | PWM speed control (LEDC channel auto-assigned) |
| M4_IN1 | GPIO 39 | H-bridge direction control 1 |
| M4_IN2 | GPIO 40 | H-bridge direction control 2 |

#### Motor 5
| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| M5_PWM | GPIO 42 | PWM speed control (LEDC channel auto-assigned) |
| M5_IN1 | GPIO 1 | H-bridge direction control 1 (swapped) |
| M5_IN2 | GPIO 2 | H-bridge direction control 2 (swapped) |

**PWM Configuration:**
- Frequency: 20 kHz
- Resolution: 10-bit (0-1023)
- Automatic LEDC channel assignment

---

### TOF Sensor & Servo Pins (ESP32-S3)

| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| TOF_RX | GPIO 10 | Serial receive from TOF sensor |
| TOF_TX | GPIO 11 | Serial transmit to TOF sensor |
| SERVO_PWM | GPIO 6 | Servo control signal (PWM, uses Timer 2) |

**Note:** TOF TX pin connects to ESP32-S3 RX (GPIO 10), TOF RX pin connects to ESP32-S3 TX (GPIO 11).

**TOF Serial Configuration:**
- Baud Rate: 921600
- Format: 8N1 (8 data bits, no parity, 1 stop bit)
- UART: Serial1 (UART1)

**Servo Configuration:**
- Sweep Range: 5° to 175° (5 sectors, configured in servo_config.h)
  - Sector 1: 5° - 39° (Motor 1)
  - Sector 2: 39° - 73° (Motor 2)
  - Sector 3: 73° - 107° (Motor 3)
  - Sector 4: 107° - 141° (Motor 4)
  - Sector 5: 141° - 175° (Motor 5)
- Step Size: 3° per movement
- Settling Time: 10 ms per step
- Reading Delay: 10 ms per step
- PWM Timer: Timer 2 (separate from motor PWM to avoid conflicts)
- Frequency: 50 Hz (standard servo)
- Sweep Modes: Forward-only or Bidirectional (selectable)

---

### Multiplexer Pins (ESP32-S3)

#### Control Pins
| Pin Function | ESP32-S3 GPIO | Description |
|--------------|---------------|-------------|
| MUX_S0 | GPIO 17 | Channel select bit 0 (LSB) |
| MUX_S1 | GPIO 16 | Channel select bit 1 |
| MUX_S2 | GPIO 15 | Channel select bit 2 |
| MUX_S3 | GPIO 7 | Channel select bit 3 (MSB) |
| MUX_SIG | GPIO 4 | Analog signal input (ADC) |

**Multiplexer Configuration:**
- IC: CD74HC4067 (16-channel analog multiplexer)
- Settling Time: 100 µs after channel switch
- ADC Resolution: 12-bit (0-4095)
- ADC Attenuation: 11 dB (0-3.3V range)

#### Pressure Pad Channel Assignments
| Pressure Pad | MUX Channel | Notes |
|--------------|-------------|-------|
| Pressure Pad 1 | C5 | Motor 1 feedback |
| Pressure Pad 2 | C4 | Motor 2 feedback |
| Pressure Pad 3 | C3 | Motor 3 feedback |
| Pressure Pad 4 | C2 | Motor 4 feedback |
| Pressure Pad 5 | C1 | Motor 5 feedback |

#### Potentiometer Channel Assignments
| Potentiometer | MUX Channel | Function |
|---------------|-------------|----------|
| Potentiometer 1 | C12 | Force scaling (0.6-1.0) |
| Potentiometer 2 | C14 | Distance scaling (0.5-1.5) |

**Averaging:**
- 8 samples per pressure pad reading
- 4 samples per potentiometer reading
- 50 µs delay between samples

---

### Power and Ground

| Connection | Description |
|------------|-------------|
| 3.3V | ESP32 power, logic level reference |
| 5V | Servo power, multiplexer VCC |
| Motor Power | 6-12V for H-bridge drivers |
| GND | Common ground for all components |

**Important:** Ensure all components share a common ground!

---

## Wiring Diagrams

### System Block Diagram

```
┌─────────────────┐
│    ESP32 Dev    │
│     Module      │
└────────┬────────┘
         │
    ┌────┴────┬────────┬────────┬────────┐
    │         │        │        │        │
┌───▼───┐ ┌──▼──┐  ┌──▼──┐  ┌──▼──┐  ┌──▼──┐
│H-Br 1 │ │H-Br2│  │H-Br3│  │H-Br4│  │ MUX │
└───┬───┘ └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘
    │        │        │        │        │
┌───▼───┐ ┌──▼──┐  ┌──▼──┐  ┌──▼──┐    │
│Motor 1│ │Motor│  │Motor│  │Motor│    │
│       │ │  2  │  │  3  │  │  4  │    │
└───────┘ └─────┘  └─────┘  └─────┘    │
                                        │
    ┌───────────────────────────────────┘
    │
┌───▼───┐ ┌─────┐  ┌─────┐  ┌─────┐
│  PP1  │ │ PP2 │  │ PP3 │  │ PP4 │
└───────┘ └─────┘  └─────┘  └─────┘


┌─────────────────┐
│   TOF Sensor    │
│   + Servo       │
└─────────────────┘
        │
        ▼
    ESP32 (GPIO 18/34/2)
```

### Multiplexer Connection Detail

```
CD74HC4067 Pinout:
    ┌─────────┐
S0  │1     16 │ VCC (5V)
S1  │2     15 │ C0 (unused)
S2  │3     14 │ C1 ← Pressure Pad 1
S3  │4     13 │ C2 ← Pressure Pad 2
EN  │5     12 │ C3 ← Pressure Pad 3
    │         │
SIG │6     11 │ C4 (unused)
    │         │
GND │7     10 │ C5 (unused)
    │8      9 │ C6 ← Pressure Pad 4
    └─────────┘

Connections:
- S0 → ESP32 GPIO 23
- S1 → ESP32 GPIO 33
- S2 → ESP32 GPIO 32
- S3 → ESP32 GPIO 3
- SIG → ESP32 GPIO 35 (ADC1_CH7)
- EN → GND (always enabled)
- VCC → 5V
- GND → Common Ground
```

### Pressure Pad Wiring (Typical FSR)

```
For each pressure pad:

    +3.3V
      │
      ▼
    ┌───┐
    │FSR│ Pressure Pad (Force Sensitive Resistor)
    └─┬─┘
      │
      ├──────────► To Multiplexer Channel (C1, C2, C3, or C6)
      │
    ┌─▼─┐
    │10k│ Pull-down resistor
    └─┬─┘
      │
     GND

Voltage at MUX channel = (3.3V × R_pulldown) / (R_FSR + R_pulldown)
- No pressure: R_FSR = ∞ → V ≈ 0V
- Max pressure: R_FSR ≈ 1kΩ → V ≈ 3.0V
```

### H-Bridge Connection (Example: L298N)

```
L298N Module per motor:
    ┌──────────────┐
    │    L298N     │
    │   H-Bridge   │
    ├──────────────┤
IN1 │←─────────────│ ESP32 M#_IN1
IN2 │←─────────────│ ESP32 M#_IN2
EN  │←─────────────│ ESP32 M#_PWM
    │              │
OUT1│─────────────►│ Motor Terminal 1
OUT2│─────────────►│ Motor Terminal 2
    │              │
VCC │←─────────────│ Motor Power (6-12V)
GND │←─────────────│ Common Ground
    └──────────────┘

For TB6612FNG (smaller drivers):
Similar connections, but uses:
- AIN1/AIN2 (or BIN1/BIN2) for direction
- PWMA/PWMB for speed
- VM for motor power (up to 15V)
- VCC for logic (3.3V or 5V)
```

### TOF Sensor Connection

```
TOF Sensor:
    ┌──────────────┐
    │ TOF Distance │
    │    Sensor    │
    ├──────────────┤
VCC │←─────────────│ 5V or 3.3V (check datasheet)
GND │←─────────────│ Common Ground
TX  │─────────────►│ ESP32 GPIO 18 (RX)
RX  │←─────────────│ ESP32 GPIO 34 (TX)
    └──────────────┘

Serial Configuration:
- Baud Rate: 921600
- Protocol: Custom binary frames (0x57 start byte)
```

### Servo Connection

```
Servo Motor:
    ┌──────────────┐
    │Servo (SG90 or│
    │   similar)   │
    ├──────────────┤
VCC │←─────────────│ 5V (separate power recommended)
GND │←─────────────│ Common Ground
SIG │←─────────────│ ESP32 GPIO 22 (PWM)
    └──────────────┘

- Sweep Range: 5° to 175° (configured in servo_config.h)
- Uses ESP32Servo library with Timer 2
- Supports forward-only and bidirectional sweep modes
```

---

## Component Specifications

### ESP32-S3 Dev Module

- **Chip:** ESP32-S3
- **Cores:** 2 (Xtensa LX7)
- **Clock:** Up to 240 MHz
- **GPIO:** 45 pins (some input-only)
- **ADC:** 2× 12-bit SAR ADCs (20 channels)
- **PWM:** 8× LEDC channels (high-speed) + 8× (low-speed)
- **UART:** 3× hardware serial ports
- **Power:** 3.3V logic, 5V USB input
- **USB:** Native USB OTG support

### DC Motors

- **Voltage:** 6-12V typical
- **Current:** Check motor specs (usually 0.5-2A per motor)
- **Type:** Brushed DC motors with gearbox recommended

### H-Bridge Drivers

**L298N:**
- Dual H-bridge
- Up to 2A per channel (4A peak)
- 5-35V motor voltage
- Logic voltage: 5V

**TB6612FNG:**
- Dual H-bridge
- Up to 1.2A per channel (3.2A peak)
- 4.5-13.5V motor voltage
- Logic voltage: 3.3V or 5V

### Pressure Pads (FSR)

- **Type:** Force Sensitive Resistor
- **Resistance Range:** ∞ (no force) to ~1kΩ (max force)
- **Active Area:** Varies (e.g., 0.5" diameter)
- **Response Time:** <1 ms

### TOF Sensor

- **Type:** UART-based Time-of-Flight distance sensor
- **Range:** Typically 50-300 cm (check specific model)
- **Accuracy:** ±1-5 cm
- **Update Rate:** ~100 Hz
- **Interface:** Serial UART, 921600 baud

### Servo Motor

- **Type:** Standard hobby servo (e.g., SG90, MG90S)
- **Voltage:** 4.8-6V
- **Torque:** 1.8 kg·cm @ 4.8V
- **Speed:** ~0.1 s/60° @ 4.8V

### Multiplexer (CD74HC4067)

- **Channels:** 16 single-ended or 8 differential
- **Voltage:** 2-6V
- **On-Resistance:** ~70Ω @ 4.5V
- **Bandwidth:** ~6 MHz
- **Switching Time:** ~100 ns

---

## Power Requirements

### Power Budget

| Component | Voltage | Current | Quantity | Total Current |
|-----------|---------|---------|----------|---------------|
| ESP32-S3 | 3.3V | 300 mA | 1 | 300 mA |
| Servo | 5V | 500 mA (stall) | 1 | 500 mA |
| TOF Sensor | 5V | 50 mA | 1 | 50 mA |
| Multiplexer | 5V | 1 mA | 1 | 1 mA |
| Potentiometers | 3.3V | 5 mA | 2 | 10 mA |
| Motors | 6-12V | 1-2A each | 5 | 5-10A |

**Total 5V Rail:** ~850 mA (peak with servo stall)
**Total Motor Rail:** 5-10A (depending on load)

### Recommended Power Setup

1. **Logic Power (ESP32, Multiplexer):**
   - USB power from computer (programming/testing)
   - 5V/1A wall adapter (standalone operation)

2. **Servo Power:**
   - Shared 5V rail with logic (if adequate supply)
   - Separate 5V/1A supply (recommended to avoid brownouts)

3. **Motor Power:**
   - Separate 6-12V/10A supply
   - Common ground with logic power

### Wiring Best Practices

1. **Use separate power supplies** for motors and logic
2. **Connect all grounds together** (common ground)
3. **Add decoupling capacitors** (100µF electrolytic + 0.1µF ceramic) near ESP32
4. **Use thick wires** (18-22 AWG) for motor power
5. **Add flyback diodes** on motors if not using H-bridge modules

---

## GPIO Usage Summary (ESP32-S3)

| GPIO | Function | Type | Notes |
|------|----------|------|-------|
| 1 | M5_IN1 | Output | Motor 5 direction (swapped) |
| 2 | M5_IN2 | Output | Motor 5 direction (swapped) |
| 4 | MUX_SIG | Input | ADC analog input |
| 6 | Servo PWM | Output | Timer 2 |
| 7 | MUX_S3 | Output | Multiplexer select bit 3 |
| 10 | TOF_RX | Input | Serial1 RX |
| 11 | TOF_TX | Output | Serial1 TX |
| 13 | M1_IN1 | Output | Motor 1 direction |
| 14 | M1_PWM | Output | PWM channel |
| 15 | MUX_S2 | Output | Multiplexer select bit 2 |
| 16 | MUX_S1 | Output | Multiplexer select bit 1 |
| 17 | MUX_S0 | Output | Multiplexer select bit 0 |
| 21 | M1_IN2 | Output | Motor 1 direction |
| 35 | M2_PWM | Output | PWM channel |
| 36 | M3_PWM | Output | PWM channel |
| 37 | M3_IN1 | Output | Motor 3 direction |
| 38 | M3_IN2 | Output | Motor 3 direction |
| 39 | M4_IN1 | Output | Motor 4 direction |
| 40 | M4_IN2 | Output | Motor 4 direction |
| 41 | M4_PWM | Output | PWM channel |
| 42 | M5_PWM | Output | PWM channel |
| 47 | M2_IN2 | Output | Motor 2 direction |
| 48 | M2_IN1 | Output | Motor 2 direction |

**Total GPIOs Used:** 23 pins

---

## Troubleshooting Hardware

### Motors not spinning
1. Check motor power supply (6-12V connected?)
2. Verify H-bridge connections (IN1, IN2, EN pins)
3. Check PWM signal with oscilloscope or logic analyzer
4. Test motor directly with battery (bypassing H-bridge)

### Pressure pads reading 0 or 3.3V constantly
1. Check pull-down resistor (10kΩ to GND)
2. Verify multiplexer channel connections
3. Test FSR resistance with multimeter (should change with pressure)
4. Check ADC attenuation setting (should be ADC_11db)

### TOF sensor not responding
1. Verify baud rate (921600)
2. Check RX/TX connections (crossed correctly?)
3. Test with simple serial echo test
4. Ensure TOF power is stable (5V, adequate current)

### Servo jittering or not moving smoothly
1. Use separate 5V power supply for servo
2. Add capacitor (100-1000µF) across servo power pins
3. Reduce sweep speed (increase SERVO_SETTLE_MS)
4. Check servo specifications match code (SG90 vs MG90S, etc.)

---

## Next Steps

- See [control-system.md](control-system.md) for PI controller tuning
- See [communication.md](communication.md) for inter-core communication details
- See [architecture.md](architecture.md) for overall system design
