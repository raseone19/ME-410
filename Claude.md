# Claude AI Development Notes

This file contains important instructions and conventions for AI-assisted development on this project.

## Mermaid Diagram Conventions

### ⚠️ IMPORTANT: Note Placement in Sequence Diagrams

**Problem:** Notes placed over a single participant without spanning can break mermaid rendering in some environments.

**Bad Example (Breaks Rendering):**
```mermaid
sequenceDiagram
    participant Loop as Main Loop
    participant TOF as TOF Module

    Note over Loop: This can break rendering

    Loop->>TOF: someFunction()
```

**Good Example (Works Correctly):**
```mermaid
sequenceDiagram
    participant Loop as Main Loop
    participant TOF as TOF Module

    Note over Loop,TOF: Span notes between participants

    Loop->>TOF: someFunction()
```

### Rules for Notes in Mermaid Diagrams

1. **Always span notes between at least two participants:**
   - ✅ `Note over Loop,TOF: message`
   - ❌ `Note over Loop: message`

2. **For single-column notes, span to adjacent participant:**
   - ✅ `Note over Core1,Var: Core 1 tries to read...`
   - ❌ `Note over Core1: Tries to read...`

3. **Avoid parentheses in text (can break rendering):**
   - ✅ `Note over A,B: Control Loop - Every 20 ms at 50 Hz`
   - ❌ `Note over A,B: Control Loop (50 Hz)`
   - ✅ `A->>B: classify range<br/>CLOSE/MEDIUM/FAR`
   - ❌ `A->>B: classify range<br/>(CLOSE/MEDIUM/FAR)`
   - Use dashes, slashes, or line breaks instead of parentheses

4. **Avoid reserved keywords as participant names:**
   - ✅ `participant MainLoop as Main Loop`
   - ❌ `participant Loop as Main Loop` (conflicts with loop keyword)
   - Reserved: `loop`, `alt`, `opt`, `par`, `critical`, `break`, `rect`

5. **Alternative: Use comments in the diagram instead:**
   ```mermaid
   sequenceDiagram
       MainLoop->>MainLoop: Step 1<br/>Every 20 ms
   ```

6. **Or use rect blocks for annotations:**
   ```mermaid
   sequenceDiagram
       rect rgb(200, 220, 250)
           Note over A,B: This is contained
           A->>B: Message
       end
   ```

### Other Mermaid Best Practices

1. **Use `<br/>` for line breaks** in labels, not actual newlines
2. **Escape special characters** properly in labels
3. **Keep diagram complexity manageable** - split large diagrams into multiple smaller ones
4. **Test rendering** in GitHub, VSCode preview, and docs platforms

## Code Style Conventions

### General Guidelines

- **Language:** All code, comments, and documentation in **English**
- **Code organization:** Modular component-based architecture
- **Naming:** Clear, descriptive names (e.g., `shared_min_distance` not `d`)

### File Organization

```
src/
├── main.cpp                  # Main orchestration only
├── config/                   # Configuration headers
├── sensors/                  # Sensor modules
├── actuators/                # Actuator control
├── control/                  # Control algorithms
├── utils/                    # Utility functions
└── tasks/                    # FreeRTOS tasks
```

### Documentation Structure

```
docs/
├── architecture.md           # System design (with mermaid diagrams)
├── hardware.md              # Pin mappings, wiring
├── control-system.md        # Control theory, tuning
└── communication.md         # Inter-core, FreeRTOS
```

### Header Guards

Always use:
```cpp
#ifndef MODULE_NAME_H
#define MODULE_NAME_H
// ... content ...
#endif // MODULE_NAME_H
```

### Comments

- **File headers:** Doxygen-style with `@file`, `@brief`
- **Function headers:** `@brief`, `@param`, `@return`
- **Inline comments:** Explain "why", not "what"

### Variable Naming

- **Shared variables:** `shared_` prefix + `volatile`
- **Constants:** `UPPER_CASE` or `constexpr` with descriptive names
- **Private/local:** `snake_case`
- **Globals:** Minimize; use `extern` properly

## ESP32-Specific Guidelines

### Multi-Core Programming

1. **Core 0:** Background tasks (data acquisition, logging)
2. **Core 1:** Real-time control loops
3. **Mutex protection** for shared variables written by multiple cores
4. **Volatile** for variables with single writer, multiple readers

### FreeRTOS Tasks

- **Always specify stack size** (minimum 2048, typically 4096)
- **Set appropriate priorities** (higher number = higher priority)
- **Use `xSemaphoreTake` with timeout**, never `portMAX_DELAY` in critical paths
- **Release mutexes** in all code paths (including error returns)

### Pin Configuration

- **Document all pin assignments** in `config/pins.h`
- **Use `constexpr`** for pin definitions
- **Note ADC channels** and input-only pins (GPIO 34, 35, 36, 39)
- **Comment PWM channel assignments**

## Testing Guidelines

### Before Committing

1. ✅ Code compiles without warnings (`-Wall -Wextra`)
2. ✅ All mermaid diagrams render correctly
3. ✅ Documentation is up-to-date
4. ✅ Pin assignments documented
5. ✅ No hardcoded magic numbers

### Hardware Testing Checklist

- [ ] Motors respond to control
- [ ] Pressure pads read correctly
- [ ] TOF sensor communicates
- [ ] Servo sweeps smoothly
- [ ] CSV data logs properly
- [ ] No crashes or watchdog resets

## Project-Specific Notes

### Current Configuration

- **Platform:** ESP32 (dual-core Xtensa LX6)
- **Framework:** Arduino + PlatformIO
- **IDE:** Visual Studio Code
- **Control frequency:** 50 Hz (20 ms period)
- **Motors:** 4 independent motors with PI control
- **Sensors:** 4 pressure pads, 1 TOF with servo sweep

### Key Dependencies

- `ESP32Servo` library (v3.0.5+)
- FreeRTOS (built into ESP32 Arduino core)
- No external SD card, WiFi, or Bluetooth used

### Known Limitations

- **TOF TX pin (GPIO 34)** is input-only; may need reassignment if bidirectional required
- **Motor 5** deliberately removed (hardware limitation)
- **Multiplexer channels** non-consecutive (C1, C2, C3, C6) for compatibility

## Git Workflow

### Commit Message Convention

This project uses **Conventional Commits** specification.

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `chore`: Maintenance tasks (dependencies, build)
- `ci`: CI/CD changes

**Examples:**
```bash
feat(motors): add 4-motor independent PI control
fix(tof): correct distance calculation for servo sweep
docs(readme): add VS Code setup instructions
refactor(sensors): extract pressure pad reading to module
chore(deps): update ESP32Servo to v3.0.5
```

**Scope (optional):** Component affected (motors, sensors, control, docs, etc.)

**References:**
- [Conventional Commits](https://www.conventionalcommits.org/)
- Use present tense: "add feature" not "added feature"
- Keep subject line under 72 characters
- Use body for detailed explanations

---

## AI Assistant Instructions

When modifying this project:

1. ✅ **Always read existing code** before writing
2. ✅ **Maintain modular structure** - don't merge unrelated code
3. ✅ **Update documentation** when changing functionality
4. ✅ **Follow existing naming conventions**
5. ✅ **Test mermaid diagrams** with proper note syntax
6. ✅ **Keep English language** throughout
7. ✅ **Add comments** for complex logic
8. ✅ **Update `platformio.ini`** if adding libraries
9. ✅ **Use Conventional Commits** for all git commits

### Common Pitfalls to Avoid

- ❌ Don't use `Note over SingleParticipant:` in mermaid (must span between participants)
- ❌ Don't use parentheses in mermaid Note text (can break rendering)
- ❌ Don't use reserved keywords as participant names (`Loop`, `Alt`, etc.)
- ❌ Don't mix Spanish and English
- ❌ Don't create new files without reading existing structure
- ❌ Don't forget mutex protection for shared variables
- ❌ Don't use `delay()` in FreeRTOS tasks (use `vTaskDelay`)
- ❌ Don't forget to release mutexes before returning

---

**Last Updated:** 2025-01-16
**Project:** 4-Motor Independent PI Control with Dynamic TOF Setpoint
**Version:** 1.0
