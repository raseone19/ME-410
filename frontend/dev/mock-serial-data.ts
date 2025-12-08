/**
 * Mock Serial Data Generator
 * Simulates ESP32 CSV output at 50Hz (20ms intervals)
 * Matches the exact format from the ESP32 control system
 */

export interface MotorData {
  time_ms: number;
  sp1_pct: number;
  sp2_pct: number;
  sp3_pct: number;
  sp4_pct: number;
  sp5_pct: number;
  pp1_pct: number;
  pp2_pct: number;
  pp3_pct: number;
  pp4_pct: number;
  pp5_pct: number;
  duty1_pct: number;
  duty2_pct: number;
  duty3_pct: number;
  duty4_pct: number;
  duty5_pct: number;
  tof1_cm: number;
  tof2_cm: number;
  tof3_cm: number;
  tof4_cm: number;
  tof5_cm: number;
  servo_angle: number;
  tof_current_cm: number;
}

// Import backend config loader
import { getSetpointValues } from './simulator-config';

// Distance range thresholds (matching ESP32 logic)
const DISTANCE_CLOSE_MAX = 50; // cm
const DISTANCE_MEDIUM_MAX = 150; // cm
const DISTANCE_FAR_MAX = 300; // cm

// Simulation state
let currentTime = 0;
let tofDistance = 175; // Start in MEDIUM range
let tofDirection = -1; // -1 for decreasing, 1 for increasing
let pressureTargets = [850, 850, 850, 850]; // Target pressures for each pad
let currentPressures = [600, 600, 600, 600]; // Current pressures (start low)
let dutyTargets = [0, 0, 0, 0]; // Target duty cycles

/**
 * Get setpoint based on TOF distance (matching ESP32 logic)
 * Uses values from backend configuration
 */
function getSetpointForDistance(distance: number): number {
  const setpoints = getSetpointValues();

  if (distance <= DISTANCE_CLOSE_MAX) {
    return setpoints.SETPOINT_CLOSE;
  } else if (distance <= DISTANCE_MEDIUM_MAX) {
    return setpoints.SETPOINT_MEDIUM;
  } else {
    return setpoints.SETPOINT_FAR;
  }
}

/**
 * Simulate PI controller behavior
 * Simplified version that approximates the ESP32 controller
 */
function simulatePIController(
  currentPressure: number,
  setpoint: number,
  index: number
): number {
  const error = setpoint - currentPressure;
  const kp = 0.15; // Proportional gain (simplified)
  const ki = 0.02; // Integral gain (simplified)

  // Simple proportional + small integral term
  const proportional = kp * error;
  const integral = ki * error;

  // Update duty cycle target with limits
  dutyTargets[index] = Math.max(-100, Math.min(100, proportional + integral));

  return dutyTargets[index];
}

/**
 * Add realistic noise to sensor readings
 */
function addNoise(value: number, noiseLevel: number): number {
  return value + (Math.random() - 0.5) * noiseLevel;
}

/**
 * Generate one data point (simulates one control loop iteration)
 */
export function generateDataPoint(): MotorData {
  // Increment time (20ms per iteration at 50Hz)
  currentTime += 20;

  // Simulate TOF sensor sweep (cycles through ranges)
  tofDistance += tofDirection * 0.5; // Slow movement

  // Reverse direction at boundaries
  if (tofDistance <= 30) {
    tofDirection = 1;
  } else if (tofDistance >= 250) {
    tofDirection = -1;
  }

  // Add small random variation to TOF
  const measuredTOF = addNoise(tofDistance, 2);

  // Get setpoint based on distance
  const setpoint = getSetpointForDistance(tofDistance);

  // Update pressure targets to match setpoint
  pressureTargets = [setpoint, setpoint, setpoint, setpoint];

  // Simulate each motor's pressure and duty cycle
  const dutyCycles: number[] = [];
  const pressures: number[] = [];

  for (let i = 0; i < 4; i++) {
    // Calculate duty cycle using PI controller simulation
    const duty = simulatePIController(currentPressures[i], setpoint, i);
    dutyCycles.push(duty);

    // Simulate pressure response to duty cycle (with lag)
    // Pressure slowly follows the setpoint
    const responseSpeed = 0.05; // How fast pressure responds
    const targetPressure = setpoint + (Math.random() - 0.5) * 20; // Small variation per motor
    currentPressures[i] += (targetPressure - currentPressures[i]) * responseSpeed;

    // Add noise to pressure reading
    const measuredPressure = Math.round(addNoise(currentPressures[i], 5));
    pressures.push(Math.max(0, measuredPressure)); // Pressure can't be negative
  }

  return {
    time_ms: currentTime,
    sp1_pct: parseFloat(setpoint.toFixed(1)),
    sp2_pct: parseFloat(setpoint.toFixed(1)),
    sp3_pct: parseFloat(setpoint.toFixed(1)),
    sp4_pct: parseFloat(setpoint.toFixed(1)),
    sp5_pct: parseFloat(setpoint.toFixed(1)),
    pp1_pct: parseFloat(pressures[0].toFixed(1)),
    pp2_pct: parseFloat(pressures[1].toFixed(1)),
    pp3_pct: parseFloat(pressures[2].toFixed(1)),
    pp4_pct: parseFloat(pressures[3].toFixed(1)),
    pp5_pct: parseFloat(pressures[3].toFixed(1)),
    duty1_pct: parseFloat(dutyCycles[0].toFixed(2)),
    duty2_pct: parseFloat(dutyCycles[1].toFixed(2)),
    duty3_pct: parseFloat(dutyCycles[2].toFixed(2)),
    duty4_pct: parseFloat(dutyCycles[3].toFixed(2)),
    duty5_pct: parseFloat(dutyCycles[3].toFixed(2)),
    tof1_cm: parseFloat(measuredTOF.toFixed(2)),
    tof2_cm: parseFloat(measuredTOF.toFixed(2)),
    tof3_cm: parseFloat(measuredTOF.toFixed(2)),
    tof4_cm: parseFloat(measuredTOF.toFixed(2)),
    tof5_cm: parseFloat(measuredTOF.toFixed(2)),
    servo_angle: 0,
    tof_current_cm: parseFloat(measuredTOF.toFixed(2)),
  };
}

/**
 * Convert data point to CSV format (matching ESP32 output)
 */
export function dataToCSV(data: MotorData): string {
  return `${data.time_ms},${data.sp1_pct},${data.pp1_pct},${data.pp2_pct},${data.pp3_pct},${data.pp4_pct},${data.pp5_pct},${data.duty1_pct},${data.duty2_pct},${data.duty3_pct},${data.duty4_pct},${data.duty5_pct},${data.tof_current_cm}`;
}

/**
 * Reset simulation to initial state
 */
export function resetSimulation(): void {
  currentTime = 0;
  tofDistance = 175;
  tofDirection = -1;
  currentPressures = [600, 600, 600, 600];
  dutyTargets = [0, 0, 0, 0];
}
