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
// CONTROL MODE SELECTION
// ============================================================================
/**
 * Control mode options:
 *
 * CONTROL_MODE_NEWTONS: Uses calibrated force values in Newtons
 *   - Requires per-pad calibration (PP_OFFSET_RO, PP_SLOPE_S in pressure_pads.h)
 *   - Setpoints in Newtons (e.g., 1N, 2N, 4N)
 *   - PI gains scaled for Newton units (Kp=12, Ki=48)
 *   - More accurate, accounts for sensor variations
 *
 * CONTROL_MODE_MILLIVOLTS: Uses raw ADC readings in millivolts
 *   - No calibration needed
 *   - Setpoints in millivolts (e.g., 500mV, 1000mV, 2000mV)
 *   - PI gains scaled for mV units (Kp=0.15, Ki=0.60)
 *   - Simpler, good for testing or uncalibrated sensors
 */

// Uncomment ONE of the following lines:
#define CONTROL_MODE_NEWTONS      // Default: calibrated force control
//#define CONTROL_MODE_MILLIVOLTS   // Raw millivolt control

// Validate control mode selection
#if (defined(CONTROL_MODE_NEWTONS) + defined(CONTROL_MODE_MILLIVOLTS)) != 1
    #error "ERROR: Select exactly ONE control mode!"
#endif

#ifdef CONTROL_MODE_NEWTONS
    constexpr const char* CONTROL_MODE_NAME = "Newtons (calibrated)";
#endif

#ifdef CONTROL_MODE_MILLIVOLTS
    constexpr const char* CONTROL_MODE_NAME = "Millivolts (raw)";
#endif

// ============================================================================
// SERIAL OUTPUT PROTOCOL
// ============================================================================

/**
 * Binary protocol only:
 *   - High-performance binary format (70 bytes/packet)
 *   - CRC-16 error detection
 *   - 3-5x faster than CSV
 *   - Requires binary parser (included in Node bridge)
 */

#define PROTOCOL_BINARY
constexpr const char* PROTOCOL_NAME = "Binary";

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
