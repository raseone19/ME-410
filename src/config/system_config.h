/**
 * @file system_config.h
 * @brief System configuration
 *
 * This file defines the system configuration for the 4-motor PI control system
 * with servo sweep and TOF distance sensing.
 */

#ifndef SYSTEM_CONFIG_H
#define SYSTEM_CONFIG_H

// ============================================================================
// SERIAL OUTPUT PROTOCOL
// ============================================================================

/**
 * Serial output protocol selection:
 *
 * PROTOCOL_CSV:    Human-readable CSV format
 *   - Easy to debug with serial monitor
 *   - Larger data size (~65 bytes/line)
 *   - Slower parsing (string processing)
 *   - Compatible with any serial terminal
 *
 * PROTOCOL_BINARY: High-performance binary format
 *   - 35% smaller (70 bytes/packet vs ~100 bytes CSV)
 *   - 3-5x faster parsing
 *   - CRC error detection
 *   - Requires binary parser (included in Node bridge)
 */

// Uncomment ONE of the following lines:
//#define PROTOCOL_CSV
#define PROTOCOL_BINARY  // Recommended for real-time visualization

// Validate protocol selection
#if (defined(PROTOCOL_CSV) + defined(PROTOCOL_BINARY)) != 1
    #error "ERROR: Select exactly ONE protocol (CSV or BINARY)!"
#endif

#ifdef PROTOCOL_CSV
    constexpr const char* PROTOCOL_NAME = "CSV";
#endif

#ifdef PROTOCOL_BINARY
    constexpr const char* PROTOCOL_NAME = "Binary";
#endif

// ============================================================================
// DATA LOGGING CONFIGURATION
// ============================================================================

/**
 * CSV logging rate options:
 *
 * LOGGING_RATE_10HZ:  10 Hz (100ms) - Best for visualization, lower data rate
 * LOGGING_RATE_25HZ:  25 Hz (40ms)  - Balanced performance and detail
 * LOGGING_RATE_50HZ:  50 Hz (20ms)  - High detail (default, matches control rate)
 * LOGGING_RATE_100HZ: 100 Hz (10ms) - Maximum detail (higher than control rate)
 */

// Uncomment ONE of the following lines:
//#define LOGGING_RATE_10HZ
//#define LOGGING_RATE_25HZ
#define LOGGING_RATE_50HZ   // Default: matches control loop rate
//#define LOGGING_RATE_100HZ

// Validate logging rate selection
#if (defined(LOGGING_RATE_10HZ) + defined(LOGGING_RATE_25HZ) + defined(LOGGING_RATE_50HZ) + defined(LOGGING_RATE_100HZ)) != 1
    #error "ERROR: Select exactly ONE logging rate!"
#endif

// Define logging period based on selected rate
#ifdef LOGGING_RATE_10HZ
    constexpr uint32_t LOGGING_PERIOD_MS = 100;
    constexpr const char* LOGGING_RATE_NAME = "10 Hz";
#endif

#ifdef LOGGING_RATE_25HZ
    constexpr uint32_t LOGGING_PERIOD_MS = 40;
    constexpr const char* LOGGING_RATE_NAME = "25 Hz";
#endif

#ifdef LOGGING_RATE_50HZ
    constexpr uint32_t LOGGING_PERIOD_MS = 20;
    constexpr const char* LOGGING_RATE_NAME = "50 Hz";
#endif

#ifdef LOGGING_RATE_100HZ
    constexpr uint32_t LOGGING_PERIOD_MS = 10;
    constexpr const char* LOGGING_RATE_NAME = "100 Hz";
#endif

// ============================================================================
// CSV OUTPUT CONFIGURATION
// ============================================================================

/**
 * Decimal precision for CSV output:
 * Lower precision = smaller data size = faster transmission = better real-time performance
 *
 * PRECISION_HIGH:   3 decimals (e.g., 123.456) - Maximum detail
 * PRECISION_MEDIUM: 2 decimals (e.g., 123.46)  - Good balance (recommended)
 * PRECISION_LOW:    1 decimal  (e.g., 123.5)   - Fastest, still useful
 * PRECISION_INT:    0 decimals (e.g., 123)     - Integer only
 */

// Uncomment ONE of the following lines:
//#define PRECISION_HIGH
#define PRECISION_MEDIUM  // Recommended for real-time visualization
//#define PRECISION_LOW
//#define PRECISION_INT

// Validate precision selection
#if (defined(PRECISION_HIGH) + defined(PRECISION_MEDIUM) + defined(PRECISION_LOW) + defined(PRECISION_INT)) != 1
    #error "ERROR: Select exactly ONE precision level!"
#endif

// Define decimal places based on selected precision
#ifdef PRECISION_HIGH
    constexpr uint8_t CSV_DECIMAL_PLACES = 3;
#endif

#ifdef PRECISION_MEDIUM
    constexpr uint8_t CSV_DECIMAL_PLACES = 2;
#endif

#ifdef PRECISION_LOW
    constexpr uint8_t CSV_DECIMAL_PLACES = 1;
#endif

#ifdef PRECISION_INT
    constexpr uint8_t CSV_DECIMAL_PLACES = 0;
#endif

// ============================================================================
// SERVO SWEEP MODE CONFIGURATION
// ============================================================================

/**
 * Servo sweep mode selection:
 *
 * SWEEP_MODE_FORWARD:      Forward sweep only (0° to 120°, then restart at 0°)
 *   - Sweeps from min to max angle
 *   - Returns to min angle to start next sweep
 *   - Updates min distance at max angle of each sector
 *   - Simple and fast
 *
 * SWEEP_MODE_BIDIRECTIONAL: Bidirectional sweep (0° to 120° to 0°)
 *   - Sweeps forward from min to max angle
 *   - Then sweeps backward from max to min angle
 *   - Updates min distance at max angle during forward sweep
 *   - Updates min distance at min angle during backward sweep
 *   - More complete coverage, no need to return to start position
 */

// Uncomment ONE of the following lines:
//#define SWEEP_MODE_FORWARD        // Default: forward sweep only
#define SWEEP_MODE_BIDIRECTIONAL  // Bidirectional sweep

// Validate sweep mode selection
#if (defined(SWEEP_MODE_FORWARD) + defined(SWEEP_MODE_BIDIRECTIONAL)) != 1
    #error "ERROR: Select exactly ONE sweep mode!"
#endif

#ifdef SWEEP_MODE_FORWARD
    constexpr const char* SWEEP_MODE_NAME = "Forward";
#endif

#ifdef SWEEP_MODE_BIDIRECTIONAL
    constexpr const char* SWEEP_MODE_NAME = "Bidirectional";
#endif

#endif // SYSTEM_CONFIG_H
