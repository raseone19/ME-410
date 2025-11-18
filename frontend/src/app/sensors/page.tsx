/**
 * Sensor Debug Console
 * Hardware inspection and diagnostics with comprehensive documentation
 */

'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  AlertCircle,
  BookOpen,
  Info,
  Lightbulb,
  Cpu,
  Radio,
  Gauge,
  Ruler,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Zap,
  Eye,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { ConnectionStatus } from '@/lib/types';
import type { MotorData } from '@/lib/types';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export default function SensorsPage() {
  const {
    status,
    currentData,
    motorHistory,
    isPaused,
    connect,
    disconnect,
    togglePause,
    resetSimulation,
  } = useWebSocketStore();

  // Configuration state
  const [espConfig, setEspConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Fetch ESP32 configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success) {
          setEspConfig(data.config);
        } else {
          setConfigError(data.error || 'Failed to load configuration');
        }
      } catch (error: any) {
        console.error('Error fetching config:', error);
        setConfigError(error.message || 'Network error');
      } finally {
        setConfigLoading(false);
      }
    };

    fetchConfig();
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Memoize event handlers
  const handleConnect = useCallback(() => {
    connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const handleReset = useCallback(() => {
    resetSimulation();
  }, [resetSimulation]);

  const handleTogglePause = useCallback(() => {
    togglePause();
  }, [togglePause]);

  // Extract configuration values (NO FALLBACKS - show ERR if missing)
  const pressurePadMax = 1200; // UI constant

  // Validate and extract configuration values (only runs when config changes)
  const configValues = useMemo(() => {
    let pressurePadChannels: number[] | 'ERR' = 'ERR';
    let tofMaxDistance: number | 'ERR' = 'ERR';
    let servoMinAngle: number | 'ERR' = 'ERR';
    let servoMaxAngle: number | 'ERR' = 'ERR';

    // Only validate if config is loaded
    if (espConfig) {
      if (!espConfig?.pressurePads?.channels) {
        console.error('[Config Error] Missing PP_CHANNELS in src/config/pins.h');
      } else {
        pressurePadChannels = espConfig.pressurePads.channels;
      }

      if (!espConfig?.tofConstants?.distanceFarMax) {
        console.error('[Config Error] Missing DISTANCE_FAR_MAX in src/sensors/tof_sensor.h');
      } else {
        tofMaxDistance = parseFloat(espConfig.tofConstants.distanceFarMax.replace('f', ''));
      }

      if (!espConfig?.tof?.servoMinAngle) {
        console.error('[Config Error] Missing SERVO_MIN_ANGLE in src/config/pins.h');
      } else {
        servoMinAngle = parseInt(espConfig.tof.servoMinAngle);
      }

      if (!espConfig?.tof?.servoMaxAngle) {
        console.error('[Config Error] Missing SERVO_MAX_ANGLE in src/config/pins.h');
      } else {
        servoMaxAngle = parseInt(espConfig.tof.servoMaxAngle);
      }
    }

    return { pressurePadChannels, tofMaxDistance, servoMinAngle, servoMaxAngle };
  }, [espConfig]);

  const { pressurePadChannels, tofMaxDistance, servoMinAngle, servoMaxAngle } = configValues;

  // Load sector angles from configuration (NO FALLBACKS)
  const sectorAngles = useMemo(() => {
    return [1, 2, 3, 4].map((motorNum) => {
      const motorKey = `motor${motorNum}` as const;
      const sectorData = espConfig?.sectors?.[motorKey];

      let minAngle: number | 'ERR' = 'ERR';
      let maxAngle: number | 'ERR' = 'ERR';

      // Only validate if config is loaded
      if (espConfig) {
        if (!sectorData) {
          console.error(`[Config Error] Missing sectors.${motorKey} in ESP32 configuration`);
        } else {
          if (!sectorData.min) {
            console.error(`[Config Error] Missing SECTOR_MOTOR_${motorNum}_MIN in src/config/pins.h`);
          } else {
            minAngle = parseInt(sectorData.min);
          }

          if (!sectorData.max) {
            console.error(`[Config Error] Missing SECTOR_MOTOR_${motorNum}_MAX in src/config/pins.h`);
          } else {
            maxAngle = parseInt(sectorData.max);
          }
        }
      }

      return { sector: motorNum, motor: motorNum, minAngle, maxAngle };
    });
  }, [espConfig]);

  // Calculate sensor statistics (noise analysis)
  const calculateSensorStats = useMemo(() => {
    const stats = {
      pp1: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      pp2: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      pp3: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      pp4: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      tof1: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      tof2: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      tof3: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
      tof4: { min: Infinity, max: -Infinity, avg: 0, stdDev: 0, samples: 0 },
    };

    // Use last 100 samples for statistics (2 seconds at 50Hz)
    const allHistory = [
      ...motorHistory.motor1,
      ...motorHistory.motor2,
      ...motorHistory.motor3,
      ...motorHistory.motor4,
    ];

    if (allHistory.length === 0) return stats;

    // Calculate for pressure pads
    for (let i = 1; i <= 4; i++) {
      const key = `pp${i}` as keyof typeof stats;
      const dataKey = `pp${i}_mv` as keyof MotorData;
      const history = motorHistory[`motor${i}` as keyof typeof motorHistory].slice(-100);

      if (history.length > 0) {
        const values = history.map(d => d[dataKey] as number);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);

        stats[key] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg,
          stdDev,
          samples: values.length,
        };
      }
    }

    // Calculate for TOF sensors
    for (let i = 1; i <= 4; i++) {
      const key = `tof${i}` as keyof typeof stats;
      const dataKey = `tof${i}_cm` as keyof MotorData;
      const history = motorHistory[`motor${i}` as keyof typeof motorHistory].slice(-100);

      if (history.length > 0) {
        const values = history.map(d => d[dataKey] as number).filter(v => v > 0 && v <= 300);
        if (values.length > 0) {
          const sum = values.reduce((a, b) => a + b, 0);
          const avg = sum / values.length;
          const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
          const stdDev = Math.sqrt(variance);

          stats[key] = {
            min: Math.min(...values),
            max: Math.max(...values),
            avg,
            stdDev,
            samples: values.length,
          };
        }
      }
    }

    return stats;
  }, [motorHistory]);

  // Sensor health indicators
  const getPressurePadHealth = (padNumber: number) => {
    const value = currentData?.[`pp${padNumber}_mv` as keyof MotorData] as number ?? 0;
    const stats = calculateSensorStats[`pp${padNumber}` as keyof typeof calculateSensorStats];

    // Check for sensor issues
    if (value < 0 || value > pressurePadMax) {
      return { status: 'error', message: 'Out of range', icon: XCircle, color: 'text-red-500' };
    }
    if (stats.stdDev > 50) {
      return { status: 'warning', message: 'High noise', icon: AlertTriangle, color: 'text-yellow-500' };
    }
    if (stats.samples < 10) {
      return { status: 'info', message: 'Collecting data...', icon: Activity, color: 'text-blue-500' };
    }
    return { status: 'ok', message: 'Normal', icon: CheckCircle, color: 'text-green-500' };
  };

  const getTOFHealth = (sectorNumber: number) => {
    const value = currentData?.[`tof${sectorNumber}_cm` as keyof MotorData] as number ?? 0;
    const stats = calculateSensorStats[`tof${sectorNumber}` as keyof typeof calculateSensorStats];

    if (tofMaxDistance === 'ERR') {
      return { status: 'error', message: 'Config Error', icon: AlertTriangle, color: 'text-red-500' };
    }
    if (value <= 0 || value > tofMaxDistance) {
      return { status: 'warning', message: 'Out of range or no reading', icon: AlertTriangle, color: 'text-yellow-500' };
    }
    if (stats.stdDev > 10) {
      return { status: 'warning', message: 'High noise', icon: AlertTriangle, color: 'text-yellow-500' };
    }
    if (stats.samples < 10) {
      return { status: 'info', message: 'Collecting data...', icon: Activity, color: 'text-blue-500' };
    }
    return { status: 'ok', message: 'Normal', icon: CheckCircle, color: 'text-green-500' };
  };

  // Chart configuration
  const chartConfig = {
    value: { label: 'Value', color: '#3b82f6' },
  } satisfies ChartConfig;

  // Prepare pressure pad history for charts
  const preparePressurePadChart = (padNumber: number) => {
    const history = motorHistory[`motor${padNumber}` as keyof typeof motorHistory].slice(-100);
    const dataKey = `pp${padNumber}_mv` as keyof MotorData;
    return history.map((data, index) => ({
      index,
      value: data[dataKey] as number,
    }));
  };

  // Prepare TOF history for charts
  const prepareTOFChart = (sectorNumber: number) => {
    const history = motorHistory[`motor${sectorNumber}` as keyof typeof motorHistory].slice(-100);
    const dataKey = `tof${sectorNumber}_cm` as keyof MotorData;
    return history.map((data, index) => ({
      index,
      value: data[dataKey] as number,
    }));
  };

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Sensor Debug Console</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-4 mx-auto w-full max-w-7xl">
          {/* Page Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Eye className="h-8 w-8" />
              Sensor Debug Console
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Hardware inspection, calibration verification, and troubleshooting
            </p>
          </div>

          {/* Header with Controls */}
          <DashboardHeader
            connectionStatus={status}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onReset={handleReset}
          />

          {/* Live ESP32 Configuration */}
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <FileCode className="h-5 w-5" />
                  Live ESP32 Configuration
                </CardTitle>
                {configLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin text-green-600" />
                )}
              </div>
              <CardDescription>
                Configuration loaded directly from ESP32 source code (src/config/pins.h and system_config.h).
                This shows the actual hardware setup compiled into the firmware.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configError ? (
                <div className="flex items-center gap-2 p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <div>
                    <div className="font-semibold">Could not load configuration</div>
                    <div className="text-sm text-muted-foreground">{configError}</div>
                  </div>
                </div>
              ) : espConfig ? (
                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  {/* Motors Configuration */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Motors ({espConfig.motors.numMotors} Total)
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Motor 1</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>PWM: GPIO {espConfig.motors.motor1.pwm}</div>
                          <div>IN1: GPIO {espConfig.motors.motor1.in1} | IN2: GPIO {espConfig.motors.motor1.in2}</div>
                        </div>
                      </div>
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Motor 2</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>PWM: GPIO {espConfig.motors.motor2.pwm}</div>
                          <div>IN1: GPIO {espConfig.motors.motor2.in1} | IN2: GPIO {espConfig.motors.motor2.in2}</div>
                        </div>
                      </div>
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Motor 3</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>PWM: GPIO {espConfig.motors.motor3.pwm}</div>
                          <div>IN1: GPIO {espConfig.motors.motor3.in1} | IN2: GPIO {espConfig.motors.motor3.in2}</div>
                        </div>
                      </div>
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Motor 4</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>PWM: GPIO {espConfig.motors.motor4.pwm}</div>
                          <div>IN1: GPIO {espConfig.motors.motor4.in1} | IN2: GPIO {espConfig.motors.motor4.in2}</div>
                        </div>
                      </div>
                      <div className="bg-muted p-2 rounded text-xs">
                        <div><strong>PWM Frequency:</strong> {espConfig.motors.pwmFreqHz} Hz</div>
                        <div><strong>PWM Resolution:</strong> {espConfig.motors.pwmResBits}-bit (0-{Math.pow(2, parseInt(espConfig.motors.pwmResBits)) - 1})</div>
                      </div>
                    </div>
                  </div>

                  {/* Sensors Configuration */}
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      Sensors & Multiplexer
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Pressure Pads ({espConfig?.pressurePads?.numPads ?? 'ERR'}x)</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>Channels: {pressurePadChannels === 'ERR' ? 'ERR' : `C${pressurePadChannels.join(', C')}`}</div>
                          <div>ADC Samples: {espConfig?.pressurePads?.samples ?? 'ERR'} per reading</div>
                        </div>
                      </div>
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Multiplexer (CD74HC4067)</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>S0: GPIO {espConfig?.multiplexer?.s0 ?? 'ERR'} | S1: GPIO {espConfig?.multiplexer?.s1 ?? 'ERR'}</div>
                          <div>S2: GPIO {espConfig?.multiplexer?.s2 ?? 'ERR'} | S3: GPIO {espConfig?.multiplexer?.s3 ?? 'ERR'}</div>
                          <div>SIG: GPIO {espConfig?.multiplexer?.sig ?? 'ERR'} (ADC input)</div>
                          <div>Settling: {espConfig?.multiplexer?.settleUs ?? 'ERR'}µs</div>
                        </div>
                      </div>
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">TOF Sensor + Servo</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>RX: GPIO {espConfig?.tof?.rxPin ?? 'ERR'} | TX: GPIO {espConfig?.tof?.txPin ?? 'ERR'}</div>
                          <div>Baud Rate: {espConfig?.tof?.baudrate ?? 'ERR'}</div>
                          <div>Servo: GPIO {espConfig?.tof?.servoPin ?? 'ERR'}</div>
                          <div>Sweep: {servoMinAngle}°-{servoMaxAngle}° in {espConfig?.tof?.servoStep ?? 'ERR'}° steps</div>
                          <div>Settling: {espConfig?.tof?.servoSettleMs ?? 'ERR'}ms per step</div>
                        </div>
                      </div>
                      <div className="bg-card p-3 rounded border">
                        <div className="font-semibold mb-1">Sector Assignments</div>
                        <div className="space-y-0.5 text-muted-foreground">
                          <div>Motor 1: {espConfig?.sectors?.motor1?.min ?? 'ERR'}°-{espConfig?.sectors?.motor1?.max ?? 'ERR'}°</div>
                          <div>Motor 2: {espConfig?.sectors?.motor2?.min ?? 'ERR'}°-{espConfig?.sectors?.motor2?.max ?? 'ERR'}°</div>
                          <div>Motor 3: {espConfig?.sectors?.motor3?.min ?? 'ERR'}°-{espConfig?.sectors?.motor3?.max ?? 'ERR'}°</div>
                          <div>Motor 4: {espConfig?.sectors?.motor4?.min ?? 'ERR'}°-{espConfig?.sectors?.motor4?.max ?? 'ERR'}°</div>
                        </div>
                      </div>
                      <div className="bg-muted p-2 rounded text-xs">
                        <div><strong>Protocol:</strong> {espConfig?.system?.protocol ?? 'ERR'}</div>
                        <div><strong>Data Rate:</strong> {espConfig?.system?.loggingRate ?? 'ERR'} ({espConfig?.system?.loggingPeriodMs ?? 'ERR'}ms)</div>
                        <div><strong>Precision:</strong> {espConfig?.system?.precision ?? 'ERR'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Introduction Card */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <BookOpen className="h-5 w-5" />
                Hardware Overview - What Sensors Do We Have?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>Purpose:</strong> This page helps you inspect raw sensor data, verify hardware connections,
                and diagnose sensor issues. Use this when motors aren't responding correctly or sensor readings seem incorrect.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Pressure Pads (4x Analog Sensors)
                  </h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li><strong>Function:</strong> Measure pressure/force applied to each motor</li>
                    <li><strong>Output:</strong> 0-1200 mV (millivolts)</li>
                    <li><strong>Connection:</strong> Via CD74HC4067 multiplexer on channels C1, C2, C3, C6</li>
                    <li><strong>Read via:</strong> ESP32 ADC (GPIO 35) with 8-sample averaging</li>
                    <li><strong>Good reading:</strong> Stable values with low noise (&lt;20mV variation)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    TOF Sensor (1x Distance Sensor + Servo)
                  </h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li><strong>Function:</strong> Measures distance to objects in front of the system</li>
                    <li><strong>Output:</strong> 0-300 cm distance</li>
                    <li><strong>Connection:</strong> Serial (921600 baud) on GPIO 34 (RX) / GPIO 18 (TX)</li>
                    <li><strong>Servo sweep:</strong> 0°-120° in 2° increments, 80ms settling per step</li>
                    <li><strong>Sectors:</strong> 4 motors × 30° sectors (M1: 0-30°, M2: 31-60°, M3: 61-90°, M4: 91-120°)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How to Use Guide */}
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Lightbulb className="h-5 w-5" />
                How to Use This Debug Console
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Check Sensor Health Indicators</h4>
                    <p className="text-sm text-muted-foreground">
                      Look for green checkmarks (✓) = normal, yellow warnings (⚠) = attention needed, red X (✗) = error.
                      This gives you a quick overview of sensor status.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Inspect Raw Values</h4>
                    <p className="text-sm text-muted-foreground">
                      Check if sensor values are within expected ranges. Pressure pads: 0-1200mV. TOF: 0-300cm.
                      Values stuck at 0 or maximum usually indicate hardware issues.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Analyze Noise Levels</h4>
                    <p className="text-sm text-muted-foreground">
                      Check the "Noise Analysis" section. Standard deviation (StdDev) shows sensor stability.
                      Good sensors: &lt;20mV for pressure, &lt;5cm for TOF. High noise indicates electrical interference or loose connections.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Use Charts to Spot Patterns</h4>
                    <p className="text-sm text-muted-foreground">
                      The real-time charts show sensor behavior over 2 seconds. Look for: smooth curves (good),
                      spikes or jumps (noise/interference), flat lines (disconnected sensor).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pressure Pads Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                Pressure Pad Sensors (4x Analog via Multiplexer)
              </CardTitle>
              <CardDescription>
                Real-time pressure readings in millivolts. Each pad is read through the CD74HC4067 multiplexer
                with 8-sample averaging for noise reduction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((padNum) => {
                  const value = currentData?.[`pp${padNum}_mv` as keyof MotorData] as number ?? 0;
                  const health = getPressurePadHealth(padNum);
                  const HealthIcon = health.icon;
                  const stats = calculateSensorStats[`pp${padNum}` as keyof typeof calculateSensorStats];
                  const channel = pressurePadChannels === 'ERR' ? 'ERR' : pressurePadChannels[padNum - 1];

                  return (
                    <Card key={padNum} className="border-2">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>Pressure Pad {padNum}</span>
                          <HealthIcon className={`h-5 w-5 ${health.color}`} />
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Multiplexer Channel C{channel}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Current Value */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Current Reading</div>
                          <div className="text-3xl font-bold font-mono">
                            {value.toFixed(0)}
                            <span className="text-base text-muted-foreground ml-1">mV</span>
                          </div>
                          <Progress value={(value / pressurePadMax) * 100} className="h-2 mt-2" />
                        </div>

                        <Separator />

                        {/* Statistics */}
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={health.status === 'ok' ? 'default' : health.status === 'warning' ? 'secondary' : 'destructive'}>
                              {health.message}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Min:</span>
                            <span className="font-mono">{stats.min !== Infinity ? `${stats.min.toFixed(0)} mV` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max:</span>
                            <span className="font-mono">{stats.max !== -Infinity ? `${stats.max.toFixed(0)} mV` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg:</span>
                            <span className="font-mono">{stats.avg > 0 ? `${stats.avg.toFixed(0)} mV` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Noise (σ):</span>
                            <span className={`font-mono ${stats.stdDev > 50 ? 'text-red-600' : stats.stdDev > 20 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {stats.stdDev > 0 ? `±${stats.stdDev.toFixed(1)} mV` : 'N/A'}
                            </span>
                          </div>
                        </div>

                        <Separator />

                        {/* Expected Range */}
                        <div className="text-xs space-y-1">
                          <div className="font-semibold">Expected Range:</div>
                          <div className="text-muted-foreground">
                            0 - {pressurePadMax} mV
                          </div>
                          <div className="text-muted-foreground text-[10px] mt-1">
                            Higher values = more pressure
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* TOF Sensor Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="h-5 w-5" />
                TOF Distance Sensor with Servo Sweep
              </CardTitle>
              <CardDescription>
                Time-of-Flight sensor measures distance (0-300cm) across 4 sectors as servo sweeps 0°-120°.
                Each sector is assigned to one motor.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {sectorAngles.map(({ sector, motor, minAngle, maxAngle }) => {
                  const value = currentData?.[`tof${sector}_cm` as keyof MotorData] as number ?? 0;
                  const servoAngle = currentData?.servo_angle ?? 0;
                  const currentDistance = currentData?.tof_current_cm ?? 0;
                  const health = getTOFHealth(sector);
                  const HealthIcon = health.icon;
                  const stats = calculateSensorStats[`tof${sector}` as keyof typeof calculateSensorStats];
                  const isInSector = typeof minAngle === 'number' && typeof maxAngle === 'number' && servoAngle >= minAngle && servoAngle <= maxAngle;

                  return (
                    <Card key={sector} className={`border-2 ${isInSector ? 'border-blue-400 bg-blue-50/30' : ''}`}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center justify-between">
                          <span>Sector {sector} (Motor {motor})</span>
                          <HealthIcon className={`h-5 w-5 ${health.color}`} />
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Angles: {minAngle}° - {maxAngle}°
                          {isInSector && <Badge className="ml-2 text-[10px] h-4">ACTIVE</Badge>}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Sector Average Distance */}
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Sector Average</div>
                          <div className="text-3xl font-bold font-mono">
                            {value.toFixed(0)}
                            <span className="text-base text-muted-foreground ml-1">cm</span>
                          </div>
                          <Progress value={tofMaxDistance === 'ERR' ? 0 : (value / tofMaxDistance) * 100} className="h-2 mt-2" />
                        </div>

                        {/* Current Reading (if in this sector) */}
                        {isInSector && (
                          <>
                            <Separator />
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">
                                Live Reading at {servoAngle.toFixed(0)}°
                              </div>
                              <div className="text-xl font-bold font-mono text-blue-600">
                                {currentDistance.toFixed(1)}
                                <span className="text-sm text-muted-foreground ml-1">cm</span>
                              </div>
                            </div>
                          </>
                        )}

                        <Separator />

                        {/* Statistics */}
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={health.status === 'ok' ? 'default' : 'secondary'}>
                              {health.message}
                            </Badge>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Min:</span>
                            <span className="font-mono">{stats.min !== Infinity ? `${stats.min.toFixed(0)} cm` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max:</span>
                            <span className="font-mono">{stats.max !== -Infinity ? `${stats.max.toFixed(0)} cm` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg:</span>
                            <span className="font-mono">{stats.avg > 0 ? `${stats.avg.toFixed(0)} cm` : 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Noise (σ):</span>
                            <span className={`font-mono ${stats.stdDev > 10 ? 'text-red-600' : stats.stdDev > 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                              {stats.stdDev > 0 ? `±${stats.stdDev.toFixed(1)} cm` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Servo Status */}
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Current Servo Angle</div>
                    <div className="text-2xl font-bold font-mono">
                      {currentData?.servo_angle.toFixed(0) ?? 0}°
                    </div>
                    <Progress
                      value={servoMaxAngle === 'ERR' ? 0 : ((currentData?.servo_angle ?? 0) / servoMaxAngle) * 100}
                      className="h-1.5 mt-2"
                    />
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Sweep Range</div>
                    <div className="text-lg font-semibold">{servoMinAngle}° - {servoMaxAngle}°</div>
                    <div className="text-xs text-muted-foreground mt-1">2° steps, 80ms settling</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Current Distance</div>
                    <div className="text-lg font-semibold">
                      {currentData?.tof_current_cm.toFixed(1) ?? 0} cm
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Real-time at servo position</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Noise Analysis Charts */}
          <Tabs defaultValue="pressure" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pressure">Pressure Pads Noise</TabsTrigger>
              <TabsTrigger value="tof">TOF Sensor Noise</TabsTrigger>
            </TabsList>

            <TabsContent value="pressure" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Pressure Pad Stability Analysis</CardTitle>
                  <CardDescription>
                    Last 2 seconds (100 samples). Smooth curves indicate stable sensors.
                    Spikes or erratic behavior suggest noise or interference.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((padNum) => (
                      <div key={padNum}>
                        <h4 className="text-sm font-semibold mb-2">Pressure Pad {padNum}</h4>
                        <ChartContainer config={chartConfig} className="h-[150px] w-full">
                          <LineChart
                            data={preparePressurePadChart(padNum)}
                            margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="index" hide />
                            <YAxis domain={[0, 1200]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              dataKey="value"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ChartContainer>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tof" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">TOF Sensor Stability Analysis</CardTitle>
                  <CardDescription>
                    Sector averages over last 2 seconds. Variations are normal as servo sweeps.
                    Check for sudden jumps or stuck values.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((sectorNum) => (
                      <div key={sectorNum}>
                        <h4 className="text-sm font-semibold mb-2">Sector {sectorNum} (Motor {sectorNum})</h4>
                        <ChartContainer config={chartConfig} className="h-[150px] w-full">
                          <LineChart
                            data={prepareTOFChart(sectorNum)}
                            margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="index" hide />
                            <YAxis domain={[0, 300]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line
                              dataKey="value"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ChartContainer>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Hardware Info Card */}
          <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Cpu className="h-5 w-5" />
                Hardware Configuration Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <h4 className="font-semibold">Multiplexer (CD74HC4067)</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li><strong>Control Pins:</strong> S0=GPIO23, S1=GPIO33, S2=GPIO32, S3=GPIO3</li>
                    <li><strong>Signal Pin:</strong> GPIO35 (ADC1_CH7, input-only)</li>
                    <li><strong>Settling Time:</strong> 100µs after channel switch</li>
                    <li><strong>Active Channels:</strong> C1, C2, C3, C6 (non-consecutive by design)</li>
                    <li><strong>Sampling:</strong> 8 samples averaged per reading</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold">TOF Sensor + Servo</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li><strong>TOF RX:</strong> GPIO34 (input-only)</li>
                    <li><strong>TOF TX:</strong> GPIO18</li>
                    <li><strong>Baud Rate:</strong> 921600</li>
                    <li><strong>Servo Pin:</strong> GPIO22 (PWM)</li>
                    <li><strong>Sweep:</strong> 0°-120° in 2° steps</li>
                    <li><strong>Settling:</strong> 80ms per step for stable reading</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting Guide */}
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
                Troubleshooting Common Sensor Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: Pressure Pad Stuck at 0 mV</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Check physical connection to multiplexer</li>
                    <li>Verify multiplexer power supply (3.3V or 5V)</li>
                    <li>Test with multimeter: should read 0-3.3V on sensor output</li>
                    <li>Check if multiplexer channel is correctly mapped</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: Pressure Pad High Noise (&gt;50mV)</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Check for loose wiring or poor connections</li>
                    <li>Add capacitor (0.1µF) close to sensor for filtering</li>
                    <li>Route sensor wires away from motor power cables</li>
                    <li>Verify ground connection is solid</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: TOF Always Shows 0 cm</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Check serial connection (RX/TX not swapped)</li>
                    <li>Verify baud rate is 921600</li>
                    <li>Ensure TOF sensor has power (check LED if present)</li>
                    <li>Test TOF with separate serial monitor</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: Servo Not Moving</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Check servo power supply (needs 5V, adequate current)</li>
                    <li>Verify GPIO22 is outputting PWM signal</li>
                    <li>Test servo with known-good setup</li>
                    <li>Check for mechanical binding in servo arm</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: Erratic TOF Readings</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Ensure servo has settled (wait 80ms after movement)</li>
                    <li>Check for reflective or transparent surfaces</li>
                    <li>Verify sensor lens is clean</li>
                    <li>Distance may be outside sensor range (0-300cm)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: All Sensors Show Same Value</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Multiplexer not switching channels correctly</li>
                    <li>Check S0-S3 control pins are connected</li>
                    <li>Verify multiplexer enable (EN) pin is grounded</li>
                    <li>Test by manually setting channel in code</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calibration Info */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Info className="h-5 w-5" />
                Calibration & Expected Values
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Pressure Pads - Expected Behavior</h4>
                <ul className="space-y-1 text-xs list-disc list-inside">
                  <li><strong>No pressure:</strong> Should read close to 0 mV (±20 mV tolerance)</li>
                  <li><strong>Light touch:</strong> 100-300 mV</li>
                  <li><strong>Moderate pressure:</strong> 400-700 mV</li>
                  <li><strong>High pressure:</strong> 800-1200 mV</li>
                  <li><strong>Noise level:</strong> Should be &lt;20 mV standard deviation</li>
                  <li><strong>Response time:</strong> Nearly instantaneous (&lt;20ms)</li>
                </ul>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2">TOF Sensor - Expected Behavior</h4>
                <ul className="space-y-1 text-xs list-disc list-inside">
                  <li><strong>Range:</strong> 0-300 cm (readings outside this indicate error)</li>
                  <li><strong>Accuracy:</strong> ±2 cm typical, ±5 cm at maximum range</li>
                  <li><strong>Update rate:</strong> 50 Hz after servo settling</li>
                  <li><strong>Noise level:</strong> Should be &lt;5 cm standard deviation</li>
                  <li><strong>Servo sweep:</strong> Smooth motion, no jerking or skipping</li>
                  <li><strong>Sector update:</strong> Each sector updates every ~1.2 seconds (full sweep cycle)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Monitor (toggle with Ctrl+Shift+P) */}
      <PerformanceMonitor />
    </SidebarInset>
  );
}
