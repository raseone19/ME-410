/**
 * Enhanced Simulator - Generates realistic ESP32 motor control data
 * Supports both MODE A and MODE B with full servo sweep simulation
 * Includes multiple test scenarios and realistic PI controller behavior
 */

import { MotorData } from '../src/lib/types';
import {
  SimulatorConfig,
  DEFAULT_CONFIG,
  SCENARIO_CONFIGS,
  ScenarioType,
  getSetpointForDistance,
  getMotorForAngle,
  SECTORS,
} from './simulator-config';

/**
 * Simulator state
 */
interface SimulatorState {
  config: SimulatorConfig;
  time_ms: number;
  tofDistance: number;
  tofDirection: number; // -1 or 1
  servoAngle: number;
  servoDirection: number; // -1 or 1
  currentPressures: [number, number, number, number];
  integralErrors: [number, number, number, number];
  sectorDistances: [number, number, number, number]; // Captured distance for each sector
  stepTimer: number; // For step scenario
}

/**
 * Simulator class
 */
export class EnhancedSimulator {
  private state: SimulatorState;

  constructor(config: Partial<SimulatorConfig> = {}) {
    this.state = {
      config: { ...DEFAULT_CONFIG, ...config },
      time_ms: 0,
      tofDistance: config.initialDistance || DEFAULT_CONFIG.initialDistance,
      tofDirection: 1,
      servoAngle: 0,
      servoDirection: 1,
      currentPressures: [600, 600, 600, 600],
      integralErrors: [0, 0, 0, 0],
      sectorDistances: [100, 100, 100, 100],
      stepTimer: 0,
    };
  }

  /**
   * Reset simulator to initial state
   */
  reset(): void {
    const config = this.state.config;
    this.state = {
      config,
      time_ms: 0,
      tofDistance: config.initialDistance,
      tofDirection: 1,
      servoAngle: 0,
      servoDirection: 1,
      currentPressures: [600, 600, 600, 600],
      integralErrors: [0, 0, 0, 0],
      sectorDistances: [100, 100, 100, 100],
      stepTimer: 0,
    };
  }

  /**
   * Change scenario
   */
  setScenario(scenario: ScenarioType): void {
    const scenarioConfig = SCENARIO_CONFIGS[scenario];
    this.state.config = { ...this.state.config, ...scenarioConfig };
    this.reset();
  }

  /**
   * Change mode
   */
  setMode(mode: 'A' | 'B'): void {
    this.state.config.mode = mode;
  }

  /**
   * Get current configuration
   */
  getConfig(): SimulatorConfig {
    return { ...this.state.config };
  }

  /**
   * Update TOF distance based on scenario
   */
  private updateTOFDistance(dt_s: number): void {
    const { scenario, minDistance, maxDistance, sweepSpeed } = this.state.config;

    switch (scenario) {
      case 'steady':
        // Distance stays constant
        break;

      case 'sweep':
        // Smooth sweep between min and max
        this.state.tofDistance += this.state.tofDirection * sweepSpeed * dt_s;

        if (this.state.tofDistance <= minDistance) {
          this.state.tofDistance = minDistance;
          this.state.tofDirection = 1;
        } else if (this.state.tofDistance >= maxDistance) {
          this.state.tofDistance = maxDistance;
          this.state.tofDirection = -1;
        }
        break;

      case 'step':
        // Step changes every 5 seconds
        this.state.stepTimer += dt_s;
        if (this.state.stepTimer >= 5) {
          this.state.stepTimer = 0;
          // Jump to random distance
          this.state.tofDistance = minDistance + Math.random() * (maxDistance - minDistance);
        }
        break;

      case 'random':
        // Random walk
        const randomDelta = (Math.random() - 0.5) * sweepSpeed * dt_s * 0.5;
        this.state.tofDistance = Math.max(
          minDistance,
          Math.min(maxDistance, this.state.tofDistance + randomDelta)
        );
        break;

      case 'sector_test':
        // Slow sweep for testing sectors
        this.state.tofDistance += this.state.tofDirection * sweepSpeed * dt_s * 0.3;
        if (this.state.tofDistance <= minDistance) {
          this.state.tofDistance = minDistance;
          this.state.tofDirection = 1;
        } else if (this.state.tofDistance >= maxDistance) {
          this.state.tofDistance = maxDistance;
          this.state.tofDirection = -1;
        }
        break;

      case 'calibration':
        // Fixed distance for calibration
        this.state.tofDistance = 100;
        break;
    }
  }

  /**
   * Update servo angle (MODE B only)
   */
  private updateServoAngle(dt_s: number): void {
    const { mode, servoSpeed, servoMin, servoMax } = this.state.config;

    if (mode !== 'B') {
      this.state.servoAngle = 0;
      return;
    }

    // Update servo position
    this.state.servoAngle += this.state.servoDirection * servoSpeed * dt_s;

    // Reverse at limits
    if (this.state.servoAngle <= servoMin) {
      this.state.servoAngle = servoMin;
      this.state.servoDirection = 1;
    } else if (this.state.servoAngle >= servoMax) {
      this.state.servoAngle = servoMax;
      this.state.servoDirection = -1;
    }
  }

  /**
   * Capture sector distance when servo passes sector midpoint
   */
  private updateSectorDistances(): void {
    const angle = Math.round(this.state.servoAngle);

    // Check if we're at a sector midpoint
    const sectorMidpoints = [15, 45, 75, 105]; // Midpoints of 4 sectors

    for (let i = 0; i < 4; i++) {
      const midpoint = sectorMidpoints[i];
      // Capture when we're within 1 degree of midpoint
      if (Math.abs(angle - midpoint) <= 1) {
        // Add some variation based on sector (simulate different distances per sector)
        const variation = (i - 1.5) * 10; // -15, -5, +5, +15 cm variation
        this.state.sectorDistances[i] = Math.max(
          30,
          Math.min(300, this.state.tofDistance + variation + this.addNoise(5))
        );
      }
    }
  }

  /**
   * Simulate PI controller for one motor
   */
  private simulatePIController(
    motorIndex: number,
    setpoint: number,
    dt_s: number
  ): number {
    const { piKp, piKi } = this.state.config;
    const currentPressure = this.state.currentPressures[motorIndex];

    // Calculate error
    const error = setpoint - currentPressure;

    // Update integral
    this.state.integralErrors[motorIndex] += error * dt_s;

    // Anti-windup
    this.state.integralErrors[motorIndex] = Math.max(
      -1000,
      Math.min(1000, this.state.integralErrors[motorIndex])
    );

    // Calculate duty cycle
    const proportional = piKp * error;
    const integral = piKi * this.state.integralErrors[motorIndex];
    const dutyCycle = proportional + integral;

    // Clamp duty cycle
    return Math.max(-100, Math.min(100, dutyCycle));
  }

  /**
   * Update pressure based on duty cycle
   */
  private updatePressure(motorIndex: number, dutyCycle: number, setpoint: number): void {
    const { piResponseSpeed } = this.state.config;

    // Simplified pressure dynamics
    // Higher duty cycle -> pressure approaches setpoint faster
    const responseFactor = piResponseSpeed * (1 + Math.abs(dutyCycle) / 100);
    const targetPressure = setpoint;

    this.state.currentPressures[motorIndex] +=
      (targetPressure - this.state.currentPressures[motorIndex]) * responseFactor;

    // Ensure pressure is non-negative
    this.state.currentPressures[motorIndex] = Math.max(
      0,
      this.state.currentPressures[motorIndex]
    );
  }

  /**
   * Add noise to a value
   */
  private addNoise(noiseLevel: number): number {
    return (Math.random() - 0.5) * 2 * noiseLevel;
  }

  /**
   * Generate one data point
   */
  generateDataPoint(): MotorData {
    const { frequency, mode, tofNoise, pressureNoise, motorSetpointOffsets } = this.state.config;

    // Calculate time delta
    const dt_s = 1 / frequency;
    this.state.time_ms += dt_s * 1000;

    // Update TOF distance
    this.updateTOFDistance(dt_s);

    // Update servo angle (MODE B only)
    this.updateServoAngle(dt_s);

    // Update sector distances
    this.updateSectorDistances();

    // Get base setpoint from distance
    const baseSetpoint = getSetpointForDistance(this.state.tofDistance);

    // Calculate per-motor setpoints with offsets
    const setpoints: [number, number, number, number] = [
      baseSetpoint + motorSetpointOffsets[0],
      baseSetpoint + motorSetpointOffsets[1],
      baseSetpoint + motorSetpointOffsets[2],
      baseSetpoint + motorSetpointOffsets[3],
    ];

    // Simulate PI controller for each motor
    const dutyCycles: [number, number, number, number] = [0, 0, 0, 0];
    const pressures: [number, number, number, number] = [0, 0, 0, 0];

    for (let i = 0; i < 4; i++) {
      // Calculate duty cycle
      dutyCycles[i] = this.simulatePIController(i, setpoints[i], dt_s);

      // Update pressure
      this.updatePressure(i, dutyCycles[i], setpoints[i]);

      // Add noise to pressure reading
      pressures[i] = Math.round(
        Math.max(0, this.state.currentPressures[i] + this.addNoise(pressureNoise))
      );
    }

    // Get current TOF reading with noise
    const tof_current_cm = Math.max(
      0,
      Math.min(300, this.state.tofDistance + this.addNoise(tofNoise))
    );

    // Build data point
    const data: MotorData = {
      time_ms: Math.round(this.state.time_ms),
      sp1_mv: parseFloat(setpoints[0].toFixed(1)),
      sp2_mv: parseFloat(setpoints[1].toFixed(1)),
      sp3_mv: parseFloat(setpoints[2].toFixed(1)),
      sp4_mv: parseFloat(setpoints[3].toFixed(1)),
      pp1_mv: pressures[0],
      pp2_mv: pressures[1],
      pp3_mv: pressures[2],
      pp4_mv: pressures[3],
      duty1_pct: parseFloat(dutyCycles[0].toFixed(2)),
      duty2_pct: parseFloat(dutyCycles[1].toFixed(2)),
      duty3_pct: parseFloat(dutyCycles[2].toFixed(2)),
      duty4_pct: parseFloat(dutyCycles[3].toFixed(2)),
      tof1_cm: parseFloat(this.state.sectorDistances[0].toFixed(2)),
      tof2_cm: parseFloat(this.state.sectorDistances[1].toFixed(2)),
      tof3_cm: parseFloat(this.state.sectorDistances[2].toFixed(2)),
      tof4_cm: parseFloat(this.state.sectorDistances[3].toFixed(2)),
      servo_angle: Math.round(this.state.servoAngle),
      tof_current_cm: parseFloat(tof_current_cm.toFixed(2)),
    };

    return data;
  }

  /**
   * Get simulator status
   */
  getStatus(): {
    time_s: number;
    distance: number;
    servoAngle: number;
    scenario: ScenarioType;
    mode: 'A' | 'B';
  } {
    return {
      time_s: this.state.time_ms / 1000,
      distance: this.state.tofDistance,
      servoAngle: this.state.servoAngle,
      scenario: this.state.config.scenario,
      mode: this.state.config.mode,
    };
  }
}

/**
 * Global simulator instance
 */
let globalSimulator = new EnhancedSimulator();

/**
 * Get data point from global simulator
 */
export function generateDataPoint(): MotorData {
  return globalSimulator.generateDataPoint();
}

/**
 * Reset global simulator
 */
export function resetSimulation(): void {
  globalSimulator.reset();
}

/**
 * Change scenario
 */
export function setScenario(scenario: ScenarioType): void {
  globalSimulator.setScenario(scenario);
}

/**
 * Change mode
 */
export function setMode(mode: 'A' | 'B'): void {
  globalSimulator.setMode(mode);
}

/**
 * Get simulator status
 */
export function getSimulatorStatus() {
  return globalSimulator.getStatus();
}

/**
 * Get current config
 */
export function getConfig(): SimulatorConfig {
  return globalSimulator.getConfig();
}
