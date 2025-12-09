/**
 * CSV Recording Hook
 * Records motor data to CSV format and triggers browser download
 * Includes human-readable timestamps (HH:MM:SS.mmm format)
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { MotorData, DistanceRange, ActiveSensor } from '@/lib/types';

export interface CSVRecordingState {
  isRecording: boolean;
  recordingStartTime: number | null;
  recordedPoints: number;
}

interface RecordedDataPoint {
  // Timing (human-readable)
  timestamp: string;         // Wall clock time: HH:MM:SS.mmm
  elapsed: string;           // Time since start: HH:MM:SS.mmm

  // Servo
  servo_angle: number;
  sector: number;            // Current sector (1-5) based on servo angle

  // Distance sensors (raw values)
  ultrasonic_cm: number;     // Raw ultrasonic reading
  tof_raw_cm: number;        // Raw TOF laser reading
  distance_min_cm: number;   // Fused (min of both)
  active_sensor: string;     // Which sensor provided the min
  distance_range: string;    // CLOSE, MEDIUM, FAR, OUT_OF_RANGE

  // Motor 1
  pwm1_pct: number;
  setpoint1_pct: number;
  pressure1_pct: number;

  // Motor 2
  pwm2_pct: number;
  setpoint2_pct: number;
  pressure2_pct: number;

  // Motor 3
  pwm3_pct: number;
  setpoint3_pct: number;
  pressure3_pct: number;

  // Motor 4
  pwm4_pct: number;
  setpoint4_pct: number;
  pressure4_pct: number;

  // Motor 5
  pwm5_pct: number;
  setpoint5_pct: number;
  pressure5_pct: number;
}

/**
 * Format milliseconds to HH:MM:SS.mmm
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format current time to HH:MM:SS.mmm
 */
function formatCurrentTime(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function getActiveSensorString(sensor: ActiveSensor): string {
  switch (sensor) {
    case ActiveSensor.NONE: return 'NONE';
    case ActiveSensor.TOF: return 'TOF';
    case ActiveSensor.ULTRASONIC: return 'ULTRASONIC';
    case ActiveSensor.BOTH_EQUAL: return 'BOTH';
    default: return 'UNKNOWN';
  }
}

/**
 * Determine sector (1-5) from servo angle
 * Sector boundaries from servo_config.h:
 * - Sector 1: 5° - 39°
 * - Sector 2: 39° - 73°
 * - Sector 3: 73° - 107°
 * - Sector 4: 107° - 141°
 * - Sector 5: 141° - 175°
 */
function getSectorFromAngle(angle: number): number {
  if (angle < 39) return 1;
  if (angle < 73) return 2;
  if (angle < 107) return 3;
  if (angle < 141) return 4;
  return 5;
}

function getDistanceRangeWithThresholds(
  distance: number,
  closeMax: number,
  mediumMax: number,
  farMax: number
): DistanceRange {
  const closeMin = 50; // Fixed sensor limitation
  if (distance < 0 || distance < closeMin || distance > farMax) {
    return DistanceRange.OUT_OF_RANGE;
  } else if (distance < closeMax) {
    return DistanceRange.CLOSE;
  } else if (distance < mediumMax) {
    return DistanceRange.MEDIUM;
  } else {
    return DistanceRange.FAR;
  }
}

export function useCSVRecording() {
  const [state, setState] = useState<CSVRecordingState>({
    isRecording: false,
    recordingStartTime: null,
    recordedPoints: 0,
  });

  const dataBuffer = useRef<RecordedDataPoint[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);

  // Start recording
  const startRecording = useCallback(() => {
    const now = Date.now();
    dataBuffer.current = [];
    recordingStartTimeRef.current = now;
    setState({
      isRecording: true,
      recordingStartTime: now,
      recordedPoints: 0,
    });
    console.log('🔴 CSV Recording started');
  }, []);

  // Record a data point
  const recordDataPoint = useCallback((data: MotorData) => {
    if (!state.isRecording || !recordingStartTimeRef.current) return;

    const elapsed = Date.now() - recordingStartTimeRef.current;

    // Determine distance range using dynamic thresholds from the data
    const distanceRange = getDistanceRangeWithThresholds(
      data.tof_current_cm,
      data.dist_close_max,
      data.dist_medium_max,
      data.dist_far_max
    );

    const point: RecordedDataPoint = {
      // Timing (human-readable)
      timestamp: formatCurrentTime(),
      elapsed: formatTime(elapsed),

      // Servo
      servo_angle: data.servo_angle,
      sector: getSectorFromAngle(data.servo_angle),

      // Distance (both raw + fused)
      ultrasonic_cm: data.ultrasonic_cm,
      tof_raw_cm: data.tof_raw_cm,
      distance_min_cm: data.tof_current_cm,
      active_sensor: getActiveSensorString(data.active_sensor),
      distance_range: distanceRange,

      // Motor 1
      pwm1_pct: data.duty1_pct,
      setpoint1_pct: data.sp1_pct,
      pressure1_pct: data.pp1_pct,

      // Motor 2
      pwm2_pct: data.duty2_pct,
      setpoint2_pct: data.sp2_pct,
      pressure2_pct: data.pp2_pct,

      // Motor 3
      pwm3_pct: data.duty3_pct,
      setpoint3_pct: data.sp3_pct,
      pressure3_pct: data.pp3_pct,

      // Motor 4
      pwm4_pct: data.duty4_pct,
      setpoint4_pct: data.sp4_pct,
      pressure4_pct: data.pp4_pct,

      // Motor 5
      pwm5_pct: data.duty5_pct,
      setpoint5_pct: data.sp5_pct,
      pressure5_pct: data.pp5_pct,
    };

    dataBuffer.current.push(point);
    setState(prev => ({
      ...prev,
      recordedPoints: dataBuffer.current.length,
    }));
  }, [state.isRecording]);

  // Stop recording and trigger download
  const stopRecording = useCallback((customFilename?: string) => {
    if (!state.isRecording) return;

    console.log(`⏹️ CSV Recording stopped. ${dataBuffer.current.length} points recorded.`);

    // Generate CSV
    const headers = [
      'timestamp',
      'elapsed',
      'servo_angle',
      'sector',
      'ultrasonic_cm',
      'tof_raw_cm',
      'distance_min_cm',
      'active_sensor',
      'distance_range',
      'pwm1_pct',
      'setpoint1_pct',
      'pressure1_pct',
      'pwm2_pct',
      'setpoint2_pct',
      'pressure2_pct',
      'pwm3_pct',
      'setpoint3_pct',
      'pressure3_pct',
      'pwm4_pct',
      'setpoint4_pct',
      'pressure4_pct',
      'pwm5_pct',
      'setpoint5_pct',
      'pressure5_pct',
    ];

    const rows = dataBuffer.current.map(point => [
      point.timestamp,
      point.elapsed,
      point.servo_angle,
      point.sector,
      point.ultrasonic_cm.toFixed(2),
      point.tof_raw_cm.toFixed(2),
      point.distance_min_cm.toFixed(2),
      point.active_sensor,
      point.distance_range,
      point.pwm1_pct.toFixed(2),
      point.setpoint1_pct.toFixed(2),
      point.pressure1_pct.toFixed(2),
      point.pwm2_pct.toFixed(2),
      point.setpoint2_pct.toFixed(2),
      point.pressure2_pct.toFixed(2),
      point.pwm3_pct.toFixed(2),
      point.setpoint3_pct.toFixed(2),
      point.pressure3_pct.toFixed(2),
      point.pwm4_pct.toFixed(2),
      point.setpoint4_pct.toFixed(2),
      point.pressure4_pct.toFixed(2),
      point.pwm5_pct.toFixed(2),
      point.setpoint5_pct.toFixed(2),
      point.pressure5_pct.toFixed(2),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    // Generate filename
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    const duration = state.recordingStartTime
      ? Math.round((Date.now() - state.recordingStartTime) / 1000)
      : 0;

    // Use custom filename if provided, otherwise generate default
    let filename: string;
    if (customFilename && customFilename.trim()) {
      // Sanitize filename: remove invalid characters
      const sanitized = customFilename.trim().replace(/[<>:"/\\|?*]/g, '_');
      // Add .csv extension if not present
      filename = sanitized.endsWith('.csv') ? sanitized : `${sanitized}.csv`;
    } else {
      filename = `motor_data_${dateStr}_${timeStr}_${duration}s.csv`;
    }

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Reset state
    dataBuffer.current = [];
    recordingStartTimeRef.current = null;
    setState({
      isRecording: false,
      recordingStartTime: null,
      recordedPoints: 0,
    });
  }, [state.isRecording, state.recordingStartTime]);

  // Toggle recording
  const toggleRecording = useCallback((customFilename?: string) => {
    if (state.isRecording) {
      stopRecording(customFilename);
    } else {
      startRecording();
    }
  }, [state.isRecording, startRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    toggleRecording,
    recordDataPoint,
  };
}
