# ESP32-S3-WROOM-1U Migration Guide

## Overview
This guide details the changes needed to migrate from ESP32 to ESP32-S3-WROOM-1U microcontroller.

## Software Changes (Already Applied ✅)

### 1. PlatformIO Configuration
**File:** `platformio.ini`

- Changed board from `esp32dev` to `esp32-s3-devkitc-1`
- Updated upload speed to 921600 baud
- Added USB CDC support flag: `ARDUINO_USB_CDC_ON_BOOT=1`
- Updated environment name to `esp32-s3`

### 2. Pin Reassignments
**File:** `src/config/pins.h`

Due to ESP32-S3 hardware differences (GPIO 19 & 20 are USB pins), Motor 1 pins were updated:

| Pin Function | Old GPIO | New GPIO | Reason |
|-------------|----------|----------|--------|
| M1_PWM      | 19       | **5**    | GPIO 19 is USB D- on ESP32-S3 |
| M1_IN2      | 20       | **14**   | GPIO 20 is USB D+ on ESP32-S3 |
| M1_IN1      | 21       | 21       | No change |

All other pins remain unchanged.

---

## Hardware Wiring Changes Required 🔧

### Motor 1 Rewiring

You need to physically reconnect Motor 1 to the new GPIO pins on the ESP32-S3:

#### **What to Change:**

1. **M1_PWM Signal Wire:**
   - **Disconnect** from GPIO 19
   - **Reconnect** to GPIO 5

2. **M1_IN2 Direction Wire:**
   - **Disconnect** from GPIO 20
   - **Reconnect** to GPIO 14

3. **M1_IN1 Direction Wire:**
   - **Keep connected** to GPIO 21 (no change)

#### **Wiring Checklist:**

- [ ] M1_PWM: Moved from GPIO 19 → GPIO 5
- [ ] M1_IN1: Still on GPIO 21 (no change)
- [ ] M1_IN2: Moved from GPIO 20 → GPIO 14
- [ ] Verify all other motor connections (M2, M3, M4) are unchanged
- [ ] Verify TOF sensor connections (RX=44, TX=43, Servo=6) are unchanged
- [ ] Verify multiplexer connections (S0=18, S1=17, S2=16, S3=15, SIG=4) are unchanged

---

## Complete Pin Reference (ESP32-S3)

### Motors (4 total)

| Motor | PWM Pin | IN1 Pin | IN2 Pin |
|-------|---------|---------|---------|
| M1    | **5**   | 21      | **14**  |
| M2    | 35      | 47      | 48      |
| M3    | 36      | 38      | 37      |
| M4    | 41      | 39      | 40      |

### TOF Sensor & Servo

| Component | Pin | GPIO |
|-----------|-----|------|
| TOF RX    | RX  | 44   |
| TOF TX    | TX  | 43   |
| Servo     | PWM | 6    |

### Multiplexer (CD74HC4067)

| Control | GPIO |
|---------|------|
| S0      | 18   |
| S1      | 17   |
| S2      | 16   |
| S3      | 15   |
| SIG     | 4    |

### Pressure Pads (via Multiplexer)

| Pad | Channel |
|-----|---------|
| PP1 | C0      |
| PP2 | C2      |
| PP3 | C4      |
| PP4 | C6      |

---

## Build and Upload Instructions

### 1. Build the Firmware
```bash
cd Project
~/.platformio/penv/bin/pio run
```

### 2. Upload to ESP32-S3
```bash
~/.platformio/penv/bin/pio run --target upload
```

**Note:** The ESP32-S3 uses native USB, so it will appear as a USB CDC device (not a serial chip like CP2102/CH340).

### 3. Monitor Serial Output
```bash
~/.platformio/penv/bin/pio device monitor
```

---

## ESP32-S3 Important Notes

### USB Pins
- **GPIO 19 & 20** are dedicated USB D-/D+ pins when using native USB
- These pins are now **reserved for programming/debugging**
- Do NOT connect hardware to GPIO 19 or 20

### Strapping Pins (Use with Caution)
- **GPIO 0:** Boot mode selection
- **GPIO 3:** JTAG enable
- **GPIO 45:** VDD_SPI voltage selection
- **GPIO 46:** ROM message printing

Avoid using these pins for motors or sensors if possible.

### Available GPIO (Safe for General Use)
- GPIO: 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21
- GPIO: 26-48 (excluding strapping pins 45, 46)
- **NOT available:** GPIO 22-25 (don't exist on ESP32-S3)

---

## Testing Checklist

After rewiring Motor 1, verify:

- [ ] **Build succeeds** without errors
- [ ] **Upload succeeds** via USB
- [ ] **Serial monitor** shows boot messages
- [ ] **Motor 1** responds to PWM control (M1_PWM on GPIO 5)
- [ ] **Motor 1** direction changes work (IN1=GPIO 21, IN2=GPIO 14)
- [ ] **Motors 2-4** still work correctly (no changes)
- [ ] **TOF sensor** communicates at 921600 baud
- [ ] **Servo** sweeps smoothly
- [ ] **Pressure pads** read correctly via multiplexer
- [ ] **No USB conflicts** when monitoring serial output

---

## Troubleshooting

### Upload Fails
- Press and hold **BOOT** button while connecting USB
- Release after "Connecting..." appears
- ESP32-S3 should enter download mode

### Serial Monitor Shows Garbage
- Verify monitor speed is 115200 baud
- Check USB cable quality (some charge-only cables don't work)

### Motor 1 Doesn't Respond
- Double-check wiring: PWM on GPIO 5, IN2 on GPIO 14
- Verify H-bridge power supply
- Check motor driver connections

### USB Not Recognized
- Install ESP32-S3 USB drivers if needed (usually automatic on macOS/Linux)
- Try different USB cable or port
- Verify `ARDUINO_USB_CDC_ON_BOOT=1` is set in `platformio.ini`

---

## Summary

✅ **Software:** Configuration updated for ESP32-S3
🔧 **Hardware:** Only Motor 1 needs rewiring (2 wires)
📋 **Action Required:** Physically move M1_PWM to GPIO 5 and M1_IN2 to GPIO 14

**Next Steps:**
1. Rewire Motor 1 according to the checklist above
2. Build and upload the firmware
3. Test all systems (motors, sensors, servo)
4. Verify no errors in serial monitor

---

**Last Updated:** 2025-01-20
**Migration:** ESP32 → ESP32-S3-WROOM-1U
**Project:** 4-Motor Independent PI Control with Dynamic TOF Setpoint
