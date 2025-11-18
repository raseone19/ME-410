# Configuration Files Guide

This directory contains configuration files for the 4-motor PI control system. Each file controls different aspects of the system.

## 📁 Configuration Files Overview

| File | Purpose | When to Edit |
|------|---------|--------------|
| **`servo_config.h`** | Servo sweep parameters, angles, sectors, timing | Adjust sweep speed, coverage, motor sectors |
| **`system_config.h`** | System-wide settings (protocol, logging rate, sweep mode) | Change data output format or sweep behavior |
| **`pins.h`** | Hardware pin assignments | Change wiring or use different ESP32 pins |

---

## 🎯 Quick Start: Tuning the Servo Sweep

**Most common adjustments are in `servo_config.h`**

### Want to make the sweep faster?

Edit `servo_config.h`:

```cpp
// Reduce these values:
constexpr uint32_t SERVO_SETTLE_MS = 5;        // Lower = faster (min: 5)
constexpr uint32_t SERVO_READING_DELAY_MS = 2; // Lower = faster (min: 2)
constexpr int SERVO_STEP = 3;                   // Higher = faster (less precision)
```

**Effect:** Sweep completes faster, but may be less accurate

---

### Want more precise distance measurements?

Edit `servo_config.h`:

```cpp
// Increase these values:
constexpr uint32_t SERVO_SETTLE_MS = 15;       // Higher = more stable
constexpr uint32_t SERVO_READING_DELAY_MS = 10; // Higher = more reliable
constexpr int SERVO_STEP = 1;                   // Lower = more data points
```

**Effect:** Sweep takes longer, but more accurate readings

---

### Want to change the sweep range?

Edit `servo_config.h`:

```cpp
// Change the angular range:
constexpr int SERVO_MIN_ANGLE = 10;   // Start at 10° instead of 0°
constexpr int SERVO_MAX_ANGLE = 170;  // Sweep up to 170°
```

**IMPORTANT:** After changing sweep range, you MUST adjust motor sectors (see below)

---

### How to adjust motor sectors?

Each motor is assigned a sector (angular range) of the sweep. The TOF sensor scans these sectors and assigns the minimum distance in each sector to the corresponding motor.

**Example 1: Default 4 equal sectors (0° to 120°)**

```cpp
// Motor 1: 0° to 30° (30° range)
constexpr int SECTOR_MOTOR_1_MIN = 0;
constexpr int SECTOR_MOTOR_1_MAX = 30;

// Motor 2: 30° to 60° (30° range)
constexpr int SECTOR_MOTOR_2_MIN = 30;
constexpr int SECTOR_MOTOR_2_MAX = 60;

// Motor 3: 60° to 90° (30° range)
constexpr int SECTOR_MOTOR_3_MIN = 60;
constexpr int SECTOR_MOTOR_3_MAX = 90;

// Motor 4: 90° to 120° (30° range)
constexpr int SECTOR_MOTOR_4_MIN = 90;
constexpr int SECTOR_MOTOR_4_MAX = 120;
```

**Example 2: Unequal sectors (prioritize front motors)**

```cpp
// Motor 1: 0° to 40° (larger sector for front-left)
constexpr int SECTOR_MOTOR_1_MIN = 0;
constexpr int SECTOR_MOTOR_1_MAX = 40;

// Motor 2: 40° to 80° (larger sector for front-right)
constexpr int SECTOR_MOTOR_2_MIN = 40;
constexpr int SECTOR_MOTOR_2_MAX = 80;

// Motor 3: 80° to 100° (smaller sector for back-left)
constexpr int SECTOR_MOTOR_3_MIN = 80;
constexpr int SECTOR_MOTOR_3_MAX = 100;

// Motor 4: 100° to 120° (smaller sector for back-right)
constexpr int SECTOR_MOTOR_4_MIN = 100;
constexpr int SECTOR_MOTOR_4_MAX = 120;
```

**Rules for sector configuration:**

✅ **DO:**
- Make sectors continuous: `MOTOR_N_MAX == MOTOR_(N+1)_MIN`
- Cover the full sweep range: `MOTOR_1_MIN == SERVO_MIN_ANGLE` and `MOTOR_4_MAX == SERVO_MAX_ANGLE`
- Ensure `MIN < MAX` for each sector

❌ **DON'T:**
- Leave gaps between sectors
- Overlap sectors
- Create sectors outside the sweep range

The compiler will **automatically check** these rules and show an error if you configure invalid sectors!

---

## 📊 Understanding Sweep Performance

`servo_config.h` automatically calculates sweep performance metrics:

```cpp
// These are calculated automatically - DO NOT EDIT
constexpr int SWEEP_TOTAL_STEPS = ...          // Number of angle steps
constexpr uint32_t SWEEP_ESTIMATED_TIME_MS = ...  // Time per sweep (ms)
constexpr float SWEEP_ESTIMATED_FREQ_HZ = ...     // Sweeps per second
```

**Example calculations:**

| Config | Steps | Time per sweep | Frequency |
|--------|-------|----------------|-----------|
| Default (0-120°, step=2, settle=10ms, delay=5ms) | 61 | ~915 ms | ~1.1 Hz |
| Fast (0-120°, step=3, settle=5ms, delay=2ms) | 41 | ~287 ms | ~3.5 Hz |
| Precise (0-120°, step=1, settle=15ms, delay=10ms) | 121 | ~3025 ms | ~0.33 Hz |

**Note:** In bidirectional mode, divide frequency by 2 (forward + backward)

---

## 🔄 Changing Sweep Mode (Forward vs Bidirectional)

Edit `system_config.h`:

```cpp
// Uncomment ONE of the following:
//#define SWEEP_MODE_FORWARD        // 0° → 120° → return to 0°
#define SWEEP_MODE_BIDIRECTIONAL  // 0° → 120° → 0° (current default)
```

**Forward mode:**
- Sweeps from min to max angle
- Returns to min angle to start next sweep
- Updates distance at max angle of each sector
- Faster if using small `SERVO_READING_DELAY_MS`

**Bidirectional mode:**
- Sweeps forward, then backward
- No return time (already at start position)
- Updates distance at both ends of each sector
- More complete coverage

---

## 📡 Changing Data Output Format

Edit `system_config.h`:

```cpp
// Uncomment ONE protocol:
//#define PROTOCOL_CSV      // Human-readable (use serial monitor)
#define PROTOCOL_BINARY   // High-performance (use Node bridge)
```

**CSV Protocol:**
- ✅ Human-readable in serial monitor
- ✅ Easy debugging
- ❌ Larger data size (~100 bytes/line)
- ❌ Slower parsing

**Binary Protocol:**
- ✅ 35% smaller data size
- ✅ 3-5x faster parsing
- ✅ CRC error detection
- ❌ Requires binary parser (included in `frontend/bridge/`)

---

## 📈 Changing Logging Rate

Edit `system_config.h`:

```cpp
// Uncomment ONE logging rate:
//#define LOGGING_RATE_10HZ   // 10 Hz (100ms) - Best for visualization
//#define LOGGING_RATE_25HZ   // 25 Hz (40ms)  - Balanced
#define LOGGING_RATE_50HZ   // 50 Hz (20ms)  - High detail (default)
//#define LOGGING_RATE_100HZ  // 100 Hz (10ms) - Maximum detail
```

**Recommendations:**
- **10 Hz**: Best for real-time web dashboard (less data)
- **50 Hz**: Matches control loop rate (default)
- **100 Hz**: Maximum detail for analysis (may overwhelm serial)

---

## 🔧 Changing Pin Assignments

**⚠️ Only edit `pins.h` if you changed hardware wiring!**

### Servo pin:

```cpp
constexpr uint8_t SERVO_PIN = 22;  // Change if servo is on different pin
```

### Motor pins (4 motors × 3 pins each):

```cpp
// Motor 1
constexpr uint8_t M1_PWM  = 13;
constexpr uint8_t M1_IN1  = 14;
constexpr uint8_t M1_IN2  = 12;

// Motor 2, 3, 4 follow same pattern...
```

### TOF sensor pins:

```cpp
constexpr uint8_t TOF_RX_PIN = 34;  // Must be input-capable
constexpr uint8_t TOF_TX_PIN = 18;
```

---

## ⚠️ Common Issues and Solutions

### Issue: "ERROR: Gap between Motor X and Motor Y sectors"

**Cause:** Sector boundaries don't align

**Fix:** Make sure `SECTOR_MOTOR_X_MAX == SECTOR_MOTOR_Y_MIN`

---

### Issue: "WARNING: SECTOR_MOTOR_1_MIN does not start at SERVO_MIN_ANGLE"

**Cause:** First sector doesn't cover beginning of sweep

**Fix:** Set `SECTOR_MOTOR_1_MIN = SERVO_MIN_ANGLE` (usually 0)

---

### Issue: Servo moves too fast and readings are unreliable

**Cause:** Not enough settling time

**Fix:** Increase `SERVO_SETTLE_MS` and `SERVO_READING_DELAY_MS` in `servo_config.h`

```cpp
constexpr uint32_t SERVO_SETTLE_MS = 15;
constexpr uint32_t SERVO_READING_DELAY_MS = 10;
```

---

### Issue: Sweep takes too long

**Cause:** Delays too large or step size too small

**Fix:** Reduce delays or increase step size in `servo_config.h`

```cpp
constexpr int SERVO_STEP = 3;  // Larger step = fewer measurements = faster
constexpr uint32_t SERVO_SETTLE_MS = 5;
constexpr uint32_t SERVO_READING_DELAY_MS = 2;
```

---

## 🧪 Recommended Configurations

### Configuration 1: **Balanced (Default)**
**Use case:** General purpose, good balance of speed and accuracy

```cpp
// servo_config.h
constexpr int SERVO_MIN_ANGLE = 0;
constexpr int SERVO_MAX_ANGLE = 120;
constexpr int SERVO_STEP = 2;
constexpr uint32_t SERVO_SETTLE_MS = 10;
constexpr uint32_t SERVO_READING_DELAY_MS = 5;

// system_config.h
#define SWEEP_MODE_BIDIRECTIONAL
#define LOGGING_RATE_50HZ
#define PROTOCOL_BINARY
```

**Performance:** ~1.1 Hz sweep rate, ~61 measurements per sweep

---

### Configuration 2: **Fast Response**
**Use case:** Quick reactions to obstacles, lower precision acceptable

```cpp
// servo_config.h
constexpr int SERVO_MIN_ANGLE = 0;
constexpr int SERVO_MAX_ANGLE = 120;
constexpr int SERVO_STEP = 4;  // Larger steps
constexpr uint32_t SERVO_SETTLE_MS = 5;  // Faster settling
constexpr uint32_t SERVO_READING_DELAY_MS = 2;  // Minimal delay

// system_config.h
#define SWEEP_MODE_FORWARD  // Skip backward sweep
#define LOGGING_RATE_25HZ
#define PROTOCOL_BINARY
```

**Performance:** ~4.5 Hz sweep rate, ~31 measurements per sweep

---

### Configuration 3: **High Precision**
**Use case:** Maximum accuracy, slow-moving application

```cpp
// servo_config.h
constexpr int SERVO_MIN_ANGLE = 0;
constexpr int SERVO_MAX_ANGLE = 120;
constexpr int SERVO_STEP = 1;  // Smallest step
constexpr uint32_t SERVO_SETTLE_MS = 15;  // Extra settling time
constexpr uint32_t SERVO_READING_DELAY_MS = 10;  // Reliable readings

// system_config.h
#define SWEEP_MODE_BIDIRECTIONAL
#define LOGGING_RATE_50HZ
#define PROTOCOL_BINARY
```

**Performance:** ~0.33 Hz sweep rate, ~121 measurements per sweep

---

## 🛠️ Build and Upload Workflow

After editing configuration files:

1. **Save your changes** to `servo_config.h` or other config files

2. **Build the firmware:**
   ```bash
   cd Project
   ~/.platformio/penv/bin/pio run
   ```

3. **Upload to ESP32:**
   ```bash
   ~/.platformio/penv/bin/pio run --target upload
   ```

4. **Monitor serial output:**
   ```bash
   ~/.platformio/penv/bin/pio device monitor
   ```

The compiler will automatically validate your configuration and show errors if you configured invalid values!

---

## 📚 Additional Resources

- **Main project documentation:** `/docs/`
- **Hardware wiring:** `/docs/hardware.md`
- **Control system tuning:** `/docs/control-system.md`
- **Architecture overview:** `/docs/architecture.md`

---

**Last Updated:** 2025-01-18
**Version:** 1.1 - Added servo_config.h
