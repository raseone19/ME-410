/**
 * PI Controller Tuning Lab
 * Interactive tuning interface with comprehensive documentation
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
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
  Settings,
  TrendingUp,
  Zap,
  AlertTriangle,
  CheckCircle,
  Target,
  Activity,
} from 'lucide-react';
import { ConnectionStatus } from '@/lib/types';
import type { MotorData } from '@/lib/types';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart, ReferenceLine } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

// Default PI gains (should match ESP32 defaults)
const DEFAULT_KP = 0.15;
const DEFAULT_KI = 0.01;

// Performance thresholds
const SETTLING_THRESHOLD = 50; // mV - within this range is considered settled
const OVERSHOOT_THRESHOLD = 10; // % - acceptable overshoot percentage

export default function TuningPage() {
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

  // PI Gains state (in real application, these would be sent to ESP32)
  const [kp, setKp] = useState(DEFAULT_KP);
  const [ki, setKi] = useState(DEFAULT_KI);

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

  const handleResetGains = useCallback(() => {
    setKp(DEFAULT_KP);
    setKi(DEFAULT_KI);
  }, []);

  // Calculate performance metrics for a motor
  const calculateMotorMetrics = (motorNumber: number) => {
    const history = motorHistory[`motor${motorNumber}` as keyof typeof motorHistory];

    if (history.length < 10) {
      return {
        riseTime: 0,
        settlingTime: 0,
        overshoot: 0,
        steadyStateError: 0,
        isStable: false,
      };
    }

    const pressureKey = `pp${motorNumber}_mv` as keyof MotorData;
    const setpointKey = `sp${motorNumber}_mv` as keyof MotorData;

    // Get current setpoint
    const currentSetpoint = history[history.length - 1][setpointKey] as number;

    // Calculate rise time (time to reach 90% of setpoint from 10%)
    const target10 = currentSetpoint * 0.1;
    const target90 = currentSetpoint * 0.9;
    let riseStartIdx = -1;
    let riseEndIdx = -1;

    for (let i = 0; i < history.length; i++) {
      const pressure = history[i][pressureKey] as number;
      if (riseStartIdx === -1 && pressure >= target10) {
        riseStartIdx = i;
      }
      if (riseStartIdx !== -1 && riseEndIdx === -1 && pressure >= target90) {
        riseEndIdx = i;
        break;
      }
    }

    const riseTime = riseStartIdx !== -1 && riseEndIdx !== -1
      ? ((history[riseEndIdx].time_ms - history[riseStartIdx].time_ms) / 1000)
      : 0;

    // Calculate settling time (time to stay within ±SETTLING_THRESHOLD of setpoint)
    let settlingIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      const pressure = history[i][pressureKey] as number;
      const error = Math.abs(pressure - currentSetpoint);
      if (error > SETTLING_THRESHOLD) {
        settlingIdx = i + 1;
        break;
      }
    }

    const settlingTime = settlingIdx !== -1 && settlingIdx < history.length
      ? ((history[history.length - 1].time_ms - history[settlingIdx].time_ms) / 1000)
      : 0;

    // Calculate overshoot (maximum deviation above setpoint)
    let maxPressure = 0;
    for (const data of history) {
      const pressure = data[pressureKey] as number;
      if (pressure > maxPressure) {
        maxPressure = pressure;
      }
    }
    const overshoot = currentSetpoint > 0
      ? ((maxPressure - currentSetpoint) / currentSetpoint) * 100
      : 0;

    // Calculate steady-state error (average error in last 1 second)
    const recentHistory = history.slice(-50); // Last 1 second at 50Hz
    const steadyStateError = recentHistory.length > 0
      ? recentHistory.reduce((sum, data) => {
          const pressure = data[pressureKey] as number;
          return sum + Math.abs(pressure - currentSetpoint);
        }, 0) / recentHistory.length
      : 0;

    // Check stability (low overshoot, low steady-state error)
    const isStable = overshoot < OVERSHOOT_THRESHOLD && steadyStateError < SETTLING_THRESHOLD;

    return {
      riseTime,
      settlingTime,
      overshoot,
      steadyStateError,
      isStable,
    };
  };

  // Get metrics for all motors
  const motor1Metrics = calculateMotorMetrics(1);
  const motor2Metrics = calculateMotorMetrics(2);
  const motor3Metrics = calculateMotorMetrics(3);
  const motor4Metrics = calculateMotorMetrics(4);

  // Chart configuration
  const chartConfig = {
    setpoint: { label: 'Setpoint', color: '#3b82f6' },
    pressure: { label: 'Actual', color: '#10b981' },
    error: { label: 'Error', color: '#ef4444' },
  } satisfies ChartConfig;

  // Prepare motor data for charts
  const prepareMotorChartData = (motorNumber: number) => {
    const history = motorHistory[`motor${motorNumber}` as keyof typeof motorHistory];
    const pressureKey = `pp${motorNumber}_mv` as keyof MotorData;
    const setpointKey = `sp${motorNumber}_mv` as keyof MotorData;

    return history.map((data) => ({
      time: data.time_ms,
      setpoint: data[setpointKey] as number,
      pressure: data[pressureKey] as number,
      error: Math.abs((data[pressureKey] as number) - (data[setpointKey] as number)),
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
                <BreadcrumbPage>PI Controller Tuning Lab</BreadcrumbPage>
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
              <Settings className="h-8 w-8" />
              PI Controller Tuning Lab
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Interactive tuning interface for optimizing motor control performance
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

          {/* Introduction Card */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <BookOpen className="h-5 w-5" />
                How to Use This Tuning Lab
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <strong>Purpose:</strong> This page helps you tune the PI (Proportional-Integral) controller gains
                to achieve optimal motor performance. Good tuning results in fast response, minimal overshoot,
                and stable tracking of the target pressure.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    What is PI Control?
                  </h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li><strong>P (Proportional):</strong> Responds to current error - higher Kp = faster response</li>
                    <li><strong>I (Integral):</strong> Eliminates steady-state error - higher Ki = better tracking</li>
                    <li>Too high gains cause oscillation and overshoot</li>
                    <li>Too low gains cause slow response and poor tracking</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Key Metrics
                  </h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li><strong>Rise Time:</strong> How fast the system reaches the target</li>
                    <li><strong>Overshoot:</strong> How much it exceeds the target (should be &lt;10%)</li>
                    <li><strong>Settling Time:</strong> Time to stabilize within ±{SETTLING_THRESHOLD}mV</li>
                    <li><strong>Steady-State Error:</strong> Final error after settling (should be &lt;{SETTLING_THRESHOLD}mV)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tuning Guide - Step by Step */}
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Lightbulb className="h-5 w-5" />
                Step-by-Step Tuning Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Start with Low Gains</h4>
                    <p className="text-sm text-muted-foreground">
                      Begin with Kp = 0.1 and Ki = 0.005. The system should respond slowly but stably.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Increase Kp (Proportional Gain)</h4>
                    <p className="text-sm text-muted-foreground">
                      Gradually increase Kp until you see faster response. Stop when you notice oscillations or overshoot &gt;10%.
                      Good range: 0.1 - 0.3
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Tune Ki (Integral Gain)</h4>
                    <p className="text-sm text-muted-foreground">
                      Increase Ki to reduce steady-state error. Stop if oscillations appear or overshoot increases.
                      Good range: 0.005 - 0.02
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
                    4
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">Fine-Tune and Test</h4>
                    <p className="text-sm text-muted-foreground">
                      Make small adjustments (±10%) and observe the metrics. Look for: Fast rise time, low overshoot (&lt;10%),
                      low steady-state error (&lt;50mV), and no oscillations.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warning Card */}
          <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-5 w-5" />
                Important Safety Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ul className="space-y-1 list-disc list-inside">
                <li><strong>Monitor for instability:</strong> If you see continuous oscillations, reduce Kp and Ki immediately</li>
                <li><strong>Hardware limits:</strong> Motors have physical limits - very high gains can cause mechanical stress</li>
                <li><strong>Save working gains:</strong> Once you find good values, document them before experimenting further</li>
                <li><strong>Test incrementally:</strong> Change one parameter at a time and observe the effect</li>
              </ul>
            </CardContent>
          </Card>

          {/* Gain Adjustment Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                PI Gain Adjustment
              </CardTitle>
              <CardDescription>
                Adjust the proportional (Kp) and integral (Ki) gains in real-time.
                Changes would normally be sent to the ESP32 controller.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Kp Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">
                      Kp (Proportional Gain)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Controls response speed - higher = faster but more overshoot
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg font-mono">
                    {kp.toFixed(3)}
                  </Badge>
                </div>
                <Slider
                  value={[kp]}
                  onValueChange={(value) => setKp(value[0])}
                  min={0}
                  max={0.5}
                  step={0.005}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.000 (Slow)</span>
                  <span>0.250 (Default Range)</span>
                  <span>0.500 (Fast/Aggressive)</span>
                </div>
              </div>

              <Separator />

              {/* Ki Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium">
                      Ki (Integral Gain)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Eliminates steady-state error - higher = better tracking but can cause oscillations
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg font-mono">
                    {ki.toFixed(4)}
                  </Badge>
                </div>
                <Slider
                  value={[ki]}
                  onValueChange={(value) => setKi(value[0])}
                  min={0}
                  max={0.05}
                  step={0.001}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.000 (No integral)</span>
                  <span>0.025 (Default Range)</span>
                  <span>0.050 (Aggressive)</span>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={handleResetGains} variant="outline">
                  Reset to Defaults (Kp={DEFAULT_KP}, Ki={DEFAULT_KI})
                </Button>
                <Button variant="secondary" disabled>
                  <Info className="h-4 w-4 mr-2" />
                  Apply to ESP32 (Not Connected)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Metrics - All Motors
              </CardTitle>
              <CardDescription>
                Real-time performance analysis for each motor. Green = Good, Yellow = Acceptable, Red = Needs Tuning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { motor: 1, metrics: motor1Metrics, color: 'blue' },
                  { motor: 2, metrics: motor2Metrics, color: 'green' },
                  { motor: 3, metrics: motor3Metrics, color: 'orange' },
                  { motor: 4, metrics: motor4Metrics, color: 'purple' },
                ].map(({ motor, metrics, color }) => (
                  <Card key={motor} className="border-2">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>Motor {motor}</span>
                        {metrics.isStable ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-yellow-500" />
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Rise Time</span>
                          <span className="font-mono font-bold">
                            {metrics.riseTime > 0 ? `${metrics.riseTime.toFixed(2)}s` : 'N/A'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Time to reach 90% of target. Faster is better.
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Overshoot</span>
                          <span
                            className={`font-mono font-bold ${
                              metrics.overshoot < 5
                                ? 'text-green-600'
                                : metrics.overshoot < 10
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {metrics.overshoot.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Should be &lt;10%. High overshoot = reduce Kp.
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Settling Time</span>
                          <span className="font-mono font-bold">
                            {metrics.settlingTime > 0 ? `${metrics.settlingTime.toFixed(2)}s` : 'N/A'}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Time to stabilize within ±{SETTLING_THRESHOLD}mV.
                        </p>
                      </div>
                      <Separator />
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-muted-foreground">Steady-State Error</span>
                          <span
                            className={`font-mono font-bold ${
                              metrics.steadyStateError < 30
                                ? 'text-green-600'
                                : metrics.steadyStateError < 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}
                          >
                            {metrics.steadyStateError.toFixed(0)} mV
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Should be &lt;50mV. High error = increase Ki.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Motor Response Charts */}
          <Tabs defaultValue="motor1" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="motor1">Motor 1</TabsTrigger>
              <TabsTrigger value="motor2">Motor 2</TabsTrigger>
              <TabsTrigger value="motor3">Motor 3</TabsTrigger>
              <TabsTrigger value="motor4">Motor 4</TabsTrigger>
            </TabsList>

            {[1, 2, 3, 4].map((motorNum) => (
              <TabsContent key={motorNum} value={`motor${motorNum}`} className="space-y-4">
                {/* Pressure Tracking Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Motor {motorNum} - Pressure Tracking
                    </CardTitle>
                    <CardDescription>
                      Shows how well the motor tracks the target setpoint. The green line should closely follow the blue dashed line.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                      <AreaChart
                        data={prepareMotorChartData(motorNum)}
                        margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id={`pressureGradient${motorNum}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="time"
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis domain={[0, 1200]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                          dataKey="pressure"
                          stroke="#10b981"
                          fill={`url(#pressureGradient${motorNum})`}
                          strokeWidth={2}
                          type="monotone"
                          isAnimationActive={false}
                        />
                        <Line
                          dataKey="setpoint"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Error Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Motor {motorNum} - Tracking Error
                    </CardTitle>
                    <CardDescription>
                      Shows the absolute difference between setpoint and actual pressure. Lower is better.
                      Green zone (&lt;50mV) indicates good tracking.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[200px] w-full">
                      <AreaChart
                        data={prepareMotorChartData(motorNum)}
                        margin={{ left: 0, right: 0, top: 5, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id={`errorGradient${motorNum}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="time"
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis domain={[0, 200]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <ReferenceLine
                          y={50}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          label={{ value: 'Good (<50mV)', fontSize: 10, fill: '#10b981' }}
                        />
                        <ReferenceLine
                          y={100}
                          stroke="#f59e0b"
                          strokeDasharray="3 3"
                          label={{ value: 'Acceptable', fontSize: 10, fill: '#f59e0b' }}
                        />
                        <Area
                          dataKey="error"
                          stroke="#ef4444"
                          fill={`url(#errorGradient${motorNum})`}
                          strokeWidth={2}
                          type="monotone"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Quick Reference Card */}
          <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Info className="h-5 w-5" />
                Quick Reference - Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: Slow Response</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Increase Kp by 20-30%</li>
                    <li>Check if rise time is too long (&gt;2s)</li>
                    <li>Ensure motors are receiving adequate power</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: Oscillations</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Reduce Kp by 20-30%</li>
                    <li>Reduce Ki slightly if oscillations persist</li>
                    <li>Check for mechanical binding in motors</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: High Overshoot</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Reduce Kp by 10-20%</li>
                    <li>Check if overshoot is &gt;10%</li>
                    <li>May need to reduce Ki if overshoot is severe</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Problem: High Steady-State Error</h4>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    <li>Increase Ki by 20-50%</li>
                    <li>Ensure error is measured after system has settled</li>
                    <li>Check for sensor calibration issues</li>
                  </ul>
                </div>
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
