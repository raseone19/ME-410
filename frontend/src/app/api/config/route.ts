/**
 * API Route: Read ESP32 Configuration
 * Reads pins.h and system_config.h to extract hardware configuration
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to ESP32 source files (relative to project root)
    const projectRoot = path.join(process.cwd(), '..');
    const pinsFilePath = path.join(projectRoot, 'src', 'config', 'pins.h');
    const systemConfigPath = path.join(projectRoot, 'src', 'config', 'system_config.h');

    // Read files
    const pinsContent = fs.readFileSync(pinsFilePath, 'utf-8');
    const systemConfigContent = fs.readFileSync(systemConfigPath, 'utf-8');

    // Helper function to extract constexpr values
    const extractValue = (content: string, varName: string): string | null => {
      // Match: constexpr type varName = value;
      const regex = new RegExp(`constexpr\\s+\\w+\\s+${varName}\\s*=\\s*([^;]+);`, 'm');
      const match = content.match(regex);
      return match ? match[1].trim() : null;
    };

    // Helper function to extract array values
    const extractArray = (content: string, varName: string): string[] => {
      const regex = new RegExp(`${varName}\\[.*?\\]\\s*=\\s*\\{([^}]+)\\}`, 's');
      const match = content.match(regex);
      if (match) {
        return match[1].split(',').map(v => v.trim()).filter(v => v && !v.startsWith('//'));
      }
      return [];
    };

    // Helper function to extract active #define
    const extractDefine = (content: string, options: string[]): string | null => {
      for (const option of options) {
        // Check if line is NOT commented out
        const regex = new RegExp(`^\\s*#define\\s+${option}`, 'm');
        if (regex.test(content)) {
          return option;
        }
      }
      return null;
    };

    // Parse pins.h
    const motorPins = {
      motor1: {
        pwm: extractValue(pinsContent, 'M1_PWM'),
        in1: extractValue(pinsContent, 'M1_IN1'),
        in2: extractValue(pinsContent, 'M1_IN2'),
      },
      motor2: {
        pwm: extractValue(pinsContent, 'M2_PWM'),
        in1: extractValue(pinsContent, 'M2_IN1'),
        in2: extractValue(pinsContent, 'M2_IN2'),
      },
      motor3: {
        pwm: extractValue(pinsContent, 'M3_PWM'),
        in1: extractValue(pinsContent, 'M3_IN1'),
        in2: extractValue(pinsContent, 'M3_IN2'),
      },
      motor4: {
        pwm: extractValue(pinsContent, 'M4_PWM'),
        in1: extractValue(pinsContent, 'M4_IN1'),
        in2: extractValue(pinsContent, 'M4_IN2'),
      },
      numMotors: extractValue(pinsContent, 'NUM_MOTORS'),
      pwmFreqHz: extractValue(pinsContent, 'PWM_FREQ_HZ'),
      pwmResBits: extractValue(pinsContent, 'PWM_RES_BITS'),
    };

    const tofPins = {
      rxPin: extractValue(pinsContent, 'TOF_RX_PIN'),
      txPin: extractValue(pinsContent, 'TOF_TX_PIN'),
      baudrate: extractValue(pinsContent, 'TOF_BAUDRATE'),
      servoPin: extractValue(pinsContent, 'SERVO_PIN'),
      servoMinAngle: extractValue(pinsContent, 'SERVO_MIN_ANGLE'),
      servoMaxAngle: extractValue(pinsContent, 'SERVO_MAX_ANGLE'),
      servoStep: extractValue(pinsContent, 'SERVO_STEP'),
      servoSettleMs: extractValue(pinsContent, 'SERVO_SETTLE_MS'),
    };

    const sectors = {
      motor1: {
        min: extractValue(pinsContent, 'SECTOR_MOTOR_1_MIN'),
        max: extractValue(pinsContent, 'SECTOR_MOTOR_1_MAX'),
      },
      motor2: {
        min: extractValue(pinsContent, 'SECTOR_MOTOR_2_MIN'),
        max: extractValue(pinsContent, 'SECTOR_MOTOR_2_MAX'),
      },
      motor3: {
        min: extractValue(pinsContent, 'SECTOR_MOTOR_3_MIN'),
        max: extractValue(pinsContent, 'SECTOR_MOTOR_3_MAX'),
      },
      motor4: {
        min: extractValue(pinsContent, 'SECTOR_MOTOR_4_MIN'),
        max: extractValue(pinsContent, 'SECTOR_MOTOR_4_MAX'),
      },
    };

    const multiplexer = {
      s0: extractValue(pinsContent, 'MUX_S0'),
      s1: extractValue(pinsContent, 'MUX_S1'),
      s2: extractValue(pinsContent, 'MUX_S2'),
      s3: extractValue(pinsContent, 'MUX_S3'),
      sig: extractValue(pinsContent, 'MUX_SIG'),
      settleUs: extractValue(pinsContent, 'MUX_SETTLE_US'),
    };

    const pressurePads = {
      numPads: extractValue(pinsContent, 'NUM_PRESSURE_PADS'),
      channels: extractArray(pinsContent, 'PP_CHANNELS'),
      samples: extractValue(pinsContent, 'PP_SAMPLES'),
    };

    // Parse system_config.h
    const protocol = extractDefine(systemConfigContent, ['PROTOCOL_CSV', 'PROTOCOL_BINARY']);
    const loggingRate = extractDefine(systemConfigContent, [
      'LOGGING_RATE_10HZ',
      'LOGGING_RATE_25HZ',
      'LOGGING_RATE_50HZ',
      'LOGGING_RATE_100HZ',
    ]);
    const precision = extractDefine(systemConfigContent, [
      'PRECISION_HIGH',
      'PRECISION_MEDIUM',
      'PRECISION_LOW',
      'PRECISION_INT',
    ]);

    // Get logging period based on rate
    let loggingPeriodMs = '20';
    if (loggingRate === 'LOGGING_RATE_10HZ') loggingPeriodMs = '100';
    else if (loggingRate === 'LOGGING_RATE_25HZ') loggingPeriodMs = '40';
    else if (loggingRate === 'LOGGING_RATE_50HZ') loggingPeriodMs = '20';
    else if (loggingRate === 'LOGGING_RATE_100HZ') loggingPeriodMs = '10';

    const systemConfig = {
      protocol: protocol?.replace('PROTOCOL_', '') || 'UNKNOWN',
      loggingRate: loggingRate?.replace('LOGGING_RATE_', '') || 'UNKNOWN',
      loggingPeriodMs,
      precision: precision?.replace('PRECISION_', '') || 'UNKNOWN',
    };

    // Return complete configuration
    return NextResponse.json({
      success: true,
      config: {
        motors: motorPins,
        tof: tofPins,
        sectors,
        multiplexer,
        pressurePads,
        system: systemConfig,
      },
      filePaths: {
        pinsFile: pinsFilePath,
        systemConfigFile: systemConfigPath,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error reading config files:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to read configuration files',
      },
      { status: 500 }
    );
  }
}
