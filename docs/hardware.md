# Hardware Configuration

This document provides complete hardware specifications, pin mappings, and wiring diagrams for the 4-Motor Independent PI Control System.

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
| ESP32 Dev Module | 1 | Dual-core, 38 GPIO pins |
| DC Motors | 4 | 6-12V rated |
| H-Bridge Motor Drivers | 4 | L298N, TB6612, or similar |
| Pressure Pad Sensors (FSR) | 4 | Analog output |
| TOF Distance Sensor | 1 | UART serial, 921600 baud |
| Servo Motor | 1 | Standard hobby servo (e.g., SG90) |
| CD74HC4067 Multiplexer | 1 | 16-channel analog MUX |
| Pull-down Resistors | 4 | 10kΩ for pressure pads |
| Power Supply | 1-2 | 5V for logic, 6-12V for motors |

---

## Complete Pin Mapping

### Motor Control Pins

#### Motor 1
| Pin Function | ESP32 GPIO | Description |
|--------------|------------|-------------|
| M1_PWM | GPIO 25 | PWM speed control (LEDC channel auto-assigned) |
| M1_IN1 | GPIO 27 | H-bridge direction control 1 |
| M1_IN2 | GPIO 26 | H-bridge direction control 2 |

#### Motor 2
| Pin Function | ESP32 GPIO | Description |
|--------------|------------|-------------|
| M2_PWM | GPIO 13 | PWM speed control (LEDC channel auto-assigned) |
| M2_IN1 | GPIO 14 | H-bridge direction control 1 |
| M2_IN2 | GPIO 12 | H-bridge direction control 2 |

#### Motor 3
| Pin Function | ESP32 GPIO | Description |
|--------------|------------|-------------|
| M3_PWM | GPIO 15 | PWM speed control (LEDC channel auto-assigned) |
| M3_IN1 | GPIO 4 | H-bridge direction control 1 |
| M3_IN2 | GPIO 2 | H-bridge direction control 2 |

#### Motor 4
| Pin Function | ESP32 GPIO | Description |
|--------------|------------|-------------|
| M4_PWM | GPIO 5 | PWM speed control (LEDC channel auto-assigned) |
| M4_IN1 | GPIO 16 | H-bridge direction control 1 |
| M4_IN2 | GPIO 17 | H-bridge direction control 2 |

**PWM Configuration:**
- Frequency: 20 kHz
- Resolution: 10-bit (0-1023)
- Automatic LEDC channel assignment

---

### TOF Sensor & Servo Pins

| Pin Function | ESP32 GPIO | Description |
|--------------|------------|-------------|
| TOF_RX | GPIO 18 | Serial receive from TOF sensor |
| TOF_TX | GPIO 34 | Serial transmit to TOF sensor (input-only pin)* |
| SERVO_PWM | GPIO 2 | Servo control signal |

**Note:** GPIO 34 is input-only on ESP32. If the TOF requires bidirectional TX, use GPIO 22 or another output-capable pin.

**TOF Serial Configuration:**
- Baud Rate: 921600
- Format: 8N1 (8 data bits, no parity, 1 stop bit)
- UART: Serial1 (UART1)

**Servo Configuration:**
- Sweep Range: 30° to 90°
- Step Size: 2° per movement
- Settling Time: 80 ms per step

---

### Multiplexer Pins

#### Control Pins
| Pin Function | ESP32 GPIO | Description |
|--------------|------------|-------------|
| MUX_S0 | GPIO 23 | Channel select bit 0 (LSB) |
| MUX_S1 | GPIO 33 | Channel select bit 1 |
| MUX_S2 | GPIO 32 | Channel select bit 2 |
| MUX_S3 | GPIO 3 (RX0) | Channel select bit 3 (MSB) |
| MUX_SIG | GPIO 35 | Analog signal input (ADC1_CH7) |

**Multiplexer Configuration:**
- IC: CD74HC4067 (16-channel analog multiplexer)
- Settling Time: 100 µs after channel switch
- ADC Resolution: 12-bit (0-4095)
- ADC Attenuation: 11 dB (0-3.3V range)

#### Pressure Pad Channel Assignments
| Pressure Pad | MUX Channel | Notes |
|--------------|-------------|-------|
| Pressure Pad 1 | C1 | Motor 1 feedback |
| Pressure Pad 2 | C2 | Motor 2 feedback |
| Pressure Pad 3 | C3 | Motor 3 feedback |
| Pressure Pad 4 | C6 | Motor 4 feedback |

**Averaging:**
- 8 samples per reading
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
SIG │←─────────────│ ESP32 GPIO 2 (PWM)
    └──────────────┘

- Sweep Range: 30° to 90°
- Uses ESP32Servo library
```

---

## Component Specifications

### ESP32 Dev Module

- **Chip:** ESP32-WROOM-32
- **Cores:** 2 (Xtensa LX6)
- **Clock:** Up to 240 MHz
- **GPIO:** 38 pins (some input-only)
- **ADC:** 2× 12-bit SAR ADCs (18 channels)
- **PWM:** 16× LEDC channels
- **UART:** 3× hardware serial ports
- **Power:** 3.3V logic, 5V USB input

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
| ESP32 | 3.3V | 240 mA | 1 | 240 mA |
| Servo | 5V | 500 mA (stall) | 1 | 500 mA |
| TOF Sensor | 5V | 50 mA | 1 | 50 mA |
| Multiplexer | 5V | 1 mA | 1 | 1 mA |
| Motors | 6-12V | 1-2A each | 4 | 4-8A |

**Total 5V Rail:** ~800 mA (peak with servo stall)
**Total Motor Rail:** 4-8A (depending on load)

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

## GPIO Usage Summary

| GPIO | Function | Type | Notes |
|------|----------|------|-------|
| 2 | Servo PWM | Output | |
| 3 | MUX_S3 | Output | RX0 pin |
| 4 | M3_IN1 | Output | |
| 5 | M4_PWM | Output | PWM channel |
| 12 | M2_IN2 | Output | Boot config pin |
| 13 | M2_PWM | Output | PWM channel |
| 14 | M2_IN1 | Output | |
| 15 | M3_PWM | Output | PWM channel, Boot config pin |
| 16 | M4_IN1 | Output | |
| 17 | M4_IN2 | Output | |
| 18 | TOF_RX | Input | Serial1 RX |
| 23 | MUX_S0 | Output | |
| 25 | M1_PWM | Output | PWM channel |
| 26 | M1_IN2 | Output | |
| 27 | M1_IN1 | Output | |
| 32 | MUX_S2 | Output | |
| 33 | MUX_S1 | Output | |
| 34 | TOF_TX | Input-only | Serial1 TX (if bidirectional needed, use different pin) |
| 35 | MUX_SIG | Input-only | ADC1_CH7 |

**Total GPIOs Used:** 18 pins

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
