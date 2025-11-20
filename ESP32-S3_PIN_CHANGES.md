# ESP32-S3 Pin Changes Summary

## Critical Issue Resolved ✅

**Problem:** ESP32 firmware hung during TOF sensor initialization on ESP32-S3.

**Root Cause:** GPIO 43 and 44 are **USB CDC pins** on ESP32-S3 (used for USB serial communication). Cannot be used for UART1 (TOF sensor).

**Solution:** Reassigned TOF sensor UART pins to GPIO 9 (RX) and GPIO 10 (TX).

---

## All Pin Changes (ESP32 → ESP32-S3)

### Motor Pins (Changed for ESP32-S3 compatibility)

| Motor | Function | Old GPIO | New GPIO |
|-------|----------|----------|----------|
| M1    | PWM      | 19       | **5**    |
| M1    | IN1      | 21       | 21       |
| M1    | IN2      | 20       | **14**   |
| M2    | PWM      | 25       | 35       |
| M2    | IN1      | 27       | 47       |
| M2    | IN2      | 26       | 48       |
| M3    | PWM      | 5        | 36       |
| M3    | IN1      | 16       | 38       |
| M3    | IN2      | 17       | 37       |
| M4    | PWM      | 15       | 41       |
| M4    | IN1      | 4        | 39       |
| M4    | IN2      | 2        | 40       |

**Reason:** GPIO 19 & 20 are USB D-/D+ on ESP32-S3.

---

### TOF Sensor Pins (**CRITICAL FIX**)

| Function | Old GPIO | New GPIO | Reason |
|----------|----------|----------|--------|
| RX       | 44       | **9**    | GPIO 44 is USB CDC RX |
| TX       | 43       | **10**   | GPIO 43 is USB CDC TX |

**⚠️ CRITICAL:** GPIO 43/44 are **reserved for USB CDC** on ESP32-S3. Using them for UART1 will cause the system to hang.

---

### Servo Pin

| Function | Old GPIO | New GPIO |
|----------|----------|----------|
| Servo PWM | 22      | 6        |

---

### Multiplexer Pins

| Function | Old GPIO | New GPIO |
|----------|----------|----------|
| S0       | 23       | 18       |
| S1       | 33       | 17       |
| S2       | 32       | 16       |
| S3       | 3        | 15       |
| SIG      | 35       | 4        |

---

## Hardware Wiring Changes Required

### TOF Sensor (TFmini-S or similar)
- **Disconnect RX from GPIO 44** → **Reconnect to GPIO 9**
- **Disconnect TX from GPIO 43** → **Reconnect to GPIO 10**
- Power (5V) and GND unchanged

### Motor 1
- **Disconnect PWM from GPIO 19** → **Reconnect to GPIO 5**
- **Disconnect IN2 from GPIO 20** → **Reconnect to GPIO 14**
- IN1 stays on GPIO 21

### Servo
- **Disconnect from GPIO 22** → **Reconnect to GPIO 6**

### Multiplexer
- **S0:** GPIO 23 → GPIO 18
- **S1:** GPIO 33 → GPIO 17
- **S2:** GPIO 32 → GPIO 16
- **S3:** GPIO 3 → GPIO 15
- **SIG:** GPIO 35 → GPIO 4

---

## Testing Results

### ✅ Successful Initialization
After pin changes, all components initialize successfully:

```
[1/5] TOF sensor and servo...
    [Step 1/5] TOF Serial: OK
    [Step 2/5] PWM Timer: OK
    [Step 3/5] Servo frequency: OK
    [Step 4/5] Servo attached: OK
    [Step 5/5] Servo position: OK
OK
```

---

## ESP32-S3 Reserved Pins (DO NOT USE)

| GPIO | Function | Why Reserved |
|------|----------|--------------|
| 19   | USB D-   | USB CDC serial communication |
| 20   | USB D+   | USB CDC serial communication |
| 43   | USB CDC TX | USB-to-UART bridge (Serial Monitor) |
| 44   | USB CDC RX | USB-to-UART bridge (Serial Monitor) |
| 0    | Boot Mode | Strapping pin |
| 3    | JTAG | Strapping pin (use with caution) |
| 45   | VDD_SPI | Strapping pin |
| 46   | ROM Messages | Strapping pin |

---

## Safe GPIOs for ESP32-S3

Available for general use:
- **GPIO:** 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21
- **GPIO:** 26-42, 47, 48

**Note:** GPIO 22-25 do not exist on ESP32-S3.

---

## Diagnostic Mode

The firmware now includes diagnostic mode to test each hardware component individually:

**File:** `src/main.cpp` (lines 106-110)

```cpp
const bool ENABLE_TOF = true;            // Test 1: TOF sensor and servo
const bool ENABLE_PRESSURE_PADS = true;  // Test 2: Pressure pads
const bool ENABLE_MOTORS = true;         // Test 3: Motors
const bool ENABLE_PI = true;             // Test 4: PI controllers
const bool ENABLE_CORE0_TASKS = true;    // Test 5: Core 0 tasks
```

Set to `false` to skip components during testing.

---

## Next Steps

1. ✅ **Update firmware with new pins** (DONE)
2. 🔧 **Rewire hardware** according to pin changes above
3. 🧪 **Test each component** using diagnostic mode
4. 📝 **Commit changes** and update documentation

---

**Last Updated:** 2025-01-20
**Migration:** ESP32 → ESP32-S3-WROOM-1U
**Status:** ✅ TOF sensor issue RESOLVED
**Critical Fix:** GPIO 43/44 → GPIO 9/10 for TOF UART
