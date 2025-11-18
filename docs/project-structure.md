# Project Structure Best Practices

This document explains the project organization and compares it with industry standards.

## Current Structure

```
MovingTof_OneMotor_OK/
├── README.md                         # Project overview
├── platformio.ini                    # Build configuration
├── Claude.md                         # AI development notes
├── .gitignore                        # Git exclusions
├── .vscode/                          # VS Code settings
│   └── README_VSCODE.md              # VS Code guide
├── docs/                             # Centralized documentation
│   ├── architecture.md               # System design
│   ├── hardware.md                   # Pin mappings
│   ├── control-system.md             # PI controller
│   └── communication.md              # Inter-core comm
└── src/                              # Source code
    ├── main.cpp                      # Main orchestration
    ├── config/
    │   ├── pins.h                    # Pin definitions
    │   ├── system_config.h           # System config
    │   └── servo_config.h            # Servo sweep config (NEW)
    ├── sensors/
    │   ├── tof_sensor.cpp/.h         # TOF + servo
    │   └── pressure_pads.cpp/.h      # Pressure sensors
    ├── actuators/
    │   └── motors.cpp/.h             # Motor control
    ├── control/
    │   └── pi_controller.cpp/.h      # PI algorithm
    ├── utils/
    │   ├── multiplexer.cpp/.h        # Multiplexer utilities
    │   └── binary_protocol.h         # Binary data protocol
    └── tasks/
        └── core0_tasks.cpp/.h        # FreeRTOS tasks
```

---

## Design Principles

### 1. Component-Based Architecture

Each folder in `src/` represents a **logical component** with clear responsibility:

| Component | Responsibility | Layer |
|-----------|----------------|-------|
| **config/** | Hardware & system configuration | Foundation |
| **utils/** | Generic utilities & protocols | Foundation |
| **sensors/** | Read physical inputs | Input Layer |
| **actuators/** | Control physical outputs | Output Layer |
| **control/** | Control algorithms | Business Logic |
| **tasks/** | RTOS orchestration | Application Layer |
| **main.cpp** | System initialization | Entry Point |

**Note:** The `config/` folder now contains three separate configuration files:
- `pins.h` - GPIO pin assignments
- `system_config.h` - Protocol and logging configuration
- `servo_config.h` - Servo sweep parameters and sector definitions (NEW)

### 2. Separation of Concerns

- **Hardware abstraction:** `pins.h` centralizes pin definitions
- **Module independence:** Each module can be tested/replaced independently
- **Clear interfaces:** Public .h files, private implementation in .cpp
- **Single responsibility:** Each module does one thing well

### 3. Layered Architecture

```
┌─────────────────────────────────┐
│   main.cpp (Orchestration)      │
├─────────────────────────────────┤
│   tasks/ (FreeRTOS Tasks)       │
├─────────────────────────────────┤
│   control/ (PI Controllers)     │
├─────────────────────────────────┤
│   actuators/  │   sensors/      │
│   (Motors)    │   (TOF, PP)     │
├─────────────────────────────────┤
│   utils/ (Multiplexer)          │
├─────────────────────────────────┤
│   config/ (Pin Definitions)     │
└─────────────────────────────────┘
```

---

## Comparison with Industry Standards

### ESP-IDF (Espressif's Official Framework)

**ESP-IDF component structure:**
```
components/
├── sensor_driver/
├── motor_driver/
└── main/
```

**Our equivalent:**
```
src/
├── sensors/
├── actuators/
└── main.cpp
```

✅ **Very similar** - we follow ESP-IDF conventions

### Arduino Library Structure

**Arduino library:**
```
MyLibrary/
├── src/
│   ├── MyLibrary.h
│   └── MyLibrary.cpp
├── examples/
└── library.properties
```

**Our structure:**
```
src/
├── sensors/tof_sensor.h/.cpp
├── actuators/motors.h/.cpp
...
```

✅ **Compatible** - each module could be extracted as Arduino library

### Clean Architecture (Uncle Bob)

**Clean Architecture layers:**
1. Entities (business logic)
2. Use Cases (application logic)
3. Interface Adapters
4. Frameworks & Drivers

**Our mapping:**
1. Entities → `control/pi_controller`
2. Use Cases → `tasks/core0_tasks`
3. Interface Adapters → `sensors/`, `actuators/`
4. Frameworks → `utils/`, `config/`

✅ **Follows Clean Architecture** principles

---

## Best Practices Checklist

### ✅ Currently Implemented

- [x] Modular component-based design
- [x] Clear separation of concerns
- [x] Centralized configuration (`config/pins.h`)
- [x] Header/source pairs for all modules
- [x] Comprehensive documentation (`docs/`)
- [x] Version control ready (`.gitignore`)
- [x] Modern build system (PlatformIO)
- [x] Consistent naming conventions
- [x] Doxygen-style comments
- [x] AI development notes (`Claude.md`)

### Optional Enhancements

Could add if project grows:

- [ ] **test/** - Unit tests (Google Test, Unity)
- [ ] **include/** - Public headers (if creating library)
- [ ] **lib/** - Third-party libraries
- [ ] **examples/** - Usage examples
- [ ] **scripts/** - Build/deployment scripts
- [ ] **Doxyfile** - Generate API docs with Doxygen
- [ ] **CMakeLists.txt** - CMake support (in addition to PlatformIO)

---

## README.md in src/ Folders

### When to Add

**Add README.md in src/ folders when:**
- Project has many contributors
- Modules are complex with many APIs
- Creating reusable library components
- Onboarding new developers frequently

**Skip README.md in src/ folders when:**
- Project is well-documented centrally (✅ we are)
- Small team maintaining code
- Documentation would be redundant
- Active development (docs get stale)

### Our Recommendation

**Current approach is optimal:**
- Centralized docs in `docs/` folder
- Claude.md for AI development notes
- Inline comments in code
- VS Code guide in `.vscode/`

**If you want to add module READMEs:**
Keep them **minimal** - just quick reference:

```markdown
# sensors/

Input layer - reads TOF distance and pressure pads.

**Modules:**
- `tof_sensor` - TOF distance with servo sweep
- `pressure_pads` - 4 pads via multiplexer

See [docs/architecture.md](../docs/architecture.md)
```

---

## File Naming Conventions

### ✅ Current Naming (Good)

| Pattern | Example | Usage |
|---------|---------|-------|
| `module.h/.cpp` | `tof_sensor.h` | Module implementation |
| `pins.h` | `config/pins.h` | Constants/config header-only |
| `lowercase_snake` | `pressure_pads.cpp` | Source files |
| `CamelCase` | `README.md` | Documentation |

### Alternatives (Also Valid)

| Pattern | Example | Usage |
|---------|---------|-------|
| PascalCase | `TofSensor.h` | C++ classes (less common in embedded) |
| camelCase | `tofSensor.cpp` | Java-style (not typical for C++) |

**Conclusion:** Your current naming is **standard for embedded C++** ✅

---

## Directory Structure Alternatives

### Flat Structure (Simple Projects)

```
src/
├── main.cpp
├── sensor.cpp
├── motor.cpp
└── config.h
```

**Pros:** Simple, easy to navigate
**Cons:** Doesn't scale, hard to maintain

❌ Not recommended for this project

### Feature-Based (Large Apps)

```
src/
├── motor_control/
│   ├── sensors/
│   ├── actuators/
│   └── control/
└── data_logging/
```

**Pros:** Groups related features
**Cons:** Overkill for single-purpose firmware

❌ Not applicable to this project

### Layer-Based (Our Choice) ✅

```
src/
├── sensors/
├── actuators/
├── control/
└── utils/
```

**Pros:** Clear separation, scalable, testable
**Cons:** None for this use case

✅ **Best choice for embedded firmware**

---

## Comparison with Similar Projects

### FreeRTOS Demo Projects

**FreeRTOS structure:**
```
Demo/
├── Common/
├── main.c
└── FreeRTOSConfig.h
```

**Our structure:**
```
src/
├── tasks/
├── main.cpp
└── config/
```

✅ Similar, but we're more modular

### PlatformIO Example Projects

**Typical PlatformIO:**
```
src/
├── main.cpp
└── (all code in main.cpp)
```

**Our structure:**
```
src/
├── main.cpp
├── sensors/
├── actuators/
...
```

✅ **Much better organized** than typical examples

### ESP32 Arduino Examples

**Arduino examples:**
```
sketch.ino
```

**Our structure:**
```
src/
├── main.cpp
├── multiple modules...
```

✅ **Production-grade** vs. example code

---

## Scalability

### Current Project Size

- **Files:** ~15 source files
- **Lines of code:** ~2000-3000
- **Modules:** 8 components
- **Documentation:** ~4000 lines

**Verdict:** Structure is **appropriate and scalable**

### If Project Grows to:

**Medium (5K-10K LOC):**
- Current structure still excellent ✅
- Consider adding unit tests

**Large (10K-50K LOC):**
- Add `test/` folder
- Consider namespace organization
- Add `include/` for public APIs

**Very Large (50K+ LOC):**
- Split into multiple libraries
- Add `components/` architecture
- Consider migrating to ESP-IDF + CMake

---

## Conclusion

### Your Project Structure: **A+ Grade** 🏆

**Strengths:**
- ✅ Follows embedded best practices
- ✅ Modular and maintainable
- ✅ Well-documented
- ✅ Scalable architecture
- ✅ Professional quality

**You're doing better than:**
- Most Arduino examples
- Many open-source embedded projects
- Typical student/hobbyist projects

**On par with:**
- Professional embedded firmware
- ESP-IDF components
- Commercial IoT products

### Recommendations

1. **Keep current structure** - it's excellent
2. **Don't add src/ READMEs yet** - centralized docs are sufficient
3. **Consider adding later:**
   - Unit tests when project stabilizes
   - Doxygen API docs if sharing code
4. **Continue following Claude.md guidelines**

**Bottom line:** Your project organization is **exemplary** for an embedded firmware project of this size and complexity. No changes needed! 🎯
