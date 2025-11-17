/**
 * Individual Motor Detail Page
 * Deep dive analysis for a single motor - Compact & User-Friendly Design
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Activity, TrendingUp, TrendingDown, Gauge, Zap, Target, Maximize, X, ChevronLeft, ChevronRight, Ruler } from 'lucide-react';
import { useWebSocketStore, TRANSITION_PAUSE_MS } from '@/lib/websocket-store';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { MiniMotorRadar } from '@/components/radar/MiniMotorRadar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart, RadialBar, RadialBarChart, ReferenceLine } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import type { MotorData } from '@/lib/types';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';

// Helper functions for TOF distance range
const getRange = (distance: number) => {
  if (distance < 0) return 'UNKNOWN';
  if (distance >= 200 && distance <= 300) return 'FAR';
  if (distance >= 100 && distance < 200) return 'MEDIUM';
  if (distance >= 50 && distance < 100) return 'CLOSE';
  return 'OUT OF BOUNDS';
};

const getRangeColor = (range: string) => {
  switch (range) {
    case 'FAR': return 'text-blue-500';
    case 'MEDIUM': return 'text-yellow-500';
    case 'CLOSE': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

export default function MotorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const motorId = parseInt(params.id as string);

  const { status, currentData, dataHistory, scanHistory, connect, isPaused, togglePause, pauseTemporarily } =
    useWebSocketStore();

  // Throttled display values (update every 300ms for readability)
  const [displayData, setDisplayData] = useState(currentData);
  const lastDisplayUpdateRef = useRef(0);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const shouldEnterFullscreen = searchParams.get('fs') === '1';

  useEffect(() => {
    if (!currentData) return;

    const now = Date.now();
    if (now - lastDisplayUpdateRef.current >= 300) {
      lastDisplayUpdateRef.current = now;
      setDisplayData(currentData);
    }
  }, [currentData]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Auto-enter fullscreen if URL parameter is set
  useEffect(() => {
    if (shouldEnterFullscreen && fullscreenRef.current && !document.fullscreenElement) {
      const enterFullscreen = async () => {
        try {
          await fullscreenRef.current?.requestFullscreen();
        } catch (err) {
          console.error('Error auto-entering fullscreen:', err);
        }
      };
      // Small delay to ensure DOM is ready
      setTimeout(enterFullscreen, 100);
    }
  }, [shouldEnterFullscreen, motorId]);

  // Fullscreen handlers
  const handleFullscreen = useCallback(async () => {
    pauseTemporarily(TRANSITION_PAUSE_MS);

    if (fullscreenRef.current) {
      try {
        await fullscreenRef.current.requestFullscreen();
      } catch (err) {
        console.error('Error attempting to enable fullscreen:', err);
      }
    }
  }, [pauseTemporarily]);

  const handleExitFullscreen = useCallback(async () => {
    pauseTemporarily(TRANSITION_PAUSE_MS);

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Error attempting to exit fullscreen:', err);
      }
    }
  }, [pauseTemporarily]);

  // Motor navigation handlers - maintain fullscreen during navigation using URL params
  const handlePreviousMotor = useCallback(() => {
    const prevMotor = motorId === 1 ? 4 : motorId - 1;
    const wasFullscreen = !!document.fullscreenElement;

    // Add fs=1 parameter if we're in fullscreen to maintain state
    router.push(`/motor/${prevMotor}${wasFullscreen ? '?fs=1' : ''}`);
  }, [motorId, router]);

  const handleNextMotor = useCallback(() => {
    const nextMotor = motorId === 4 ? 1 : motorId + 1;
    const wasFullscreen = !!document.fullscreenElement;

    // Add fs=1 parameter if we're in fullscreen to maintain state
    router.push(`/motor/${nextMotor}${wasFullscreen ? '?fs=1' : ''}`);
  }, [motorId, router]);

  // Validate motor ID
  if (!motorId || motorId < 1 || motorId > 4) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Invalid Motor</CardTitle>
            <CardDescription>Motor ID must be between 1 and 4</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/')}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Extract motor-specific data
  const pressureKey = `pp${motorId}_mv` as keyof MotorData;
  const dutyKey = `duty${motorId}_pct` as keyof MotorData;
  const setpointKey = `sp${motorId}_mv` as keyof MotorData;
  const tofKey = `tof${motorId}_cm` as keyof MotorData;

  // Sector angles for this motor
  const sectorAngles = [
    { min: 0, max: 30 },    // Motor 1
    { min: 31, max: 60 },   // Motor 2
    { min: 61, max: 90 },   // Motor 3
    { min: 91, max: 120 },  // Motor 4
  ][motorId - 1];

  // Current values (using throttled data for display)
  const currentPressure = displayData ? (displayData[pressureKey] as number) : 0;
  const currentDuty = displayData ? (displayData[dutyKey] as number) : 0;
  const currentSetpoint = displayData ? (displayData[setpointKey] as number) : 0;
  const currentTofDistance = displayData ? (displayData[tofKey] as number) : 0;
  const error = Math.abs(currentPressure - currentSetpoint);
  const isOnTarget = error < 50;
  const currentRange = getRange(currentTofDistance);

  // Prepare chart data (use full dataHistory for charts at 50Hz)
  const fullHistory = dataHistory.map((data) => ({
    time: data.time_ms,
    setpoint: data[setpointKey] as number,
    pressure: data[pressureKey] as number,
    duty: data[dutyKey] as number,
    error: Math.abs((data[pressureKey] as number) - (data[setpointKey] as number)),
  }));

  // Statistics
  const stats = {
    avgPressure: fullHistory.length
      ? fullHistory.reduce((sum, d) => sum + d.pressure, 0) / fullHistory.length
      : 0,
    avgDuty: fullHistory.length
      ? fullHistory.reduce((sum, d) => sum + d.duty, 0) / fullHistory.length
      : 0,
    avgError: fullHistory.length
      ? fullHistory.reduce((sum, d) => sum + d.error, 0) / fullHistory.length
      : 0,
    maxError: fullHistory.length ? Math.max(...fullHistory.map((d) => d.error)) : 0,
    minPressure: fullHistory.length ? Math.min(...fullHistory.map((d) => d.pressure)) : 0,
    maxPressure: fullHistory.length ? Math.max(...fullHistory.map((d) => d.pressure)) : 0,
  };

  const chartConfig = {
    setpoint: { label: 'Setpoint', color: '#3b82f6' },
    pressure: { label: 'Actual Pressure', color: '#10b981' },
    duty: { label: 'PWM Duty', color: '#f59e0b' },
    error: { label: 'Error', color: '#ef4444' },
  } satisfies ChartConfig;

  // Radial chart data for stats
  const pressureRadialData = [
    {
      name: 'pressure',
      value: currentPressure,
      fill: currentPressure > 800 ? '#10b981' : currentPressure > 400 ? '#f59e0b' : '#ef4444'
    }
  ];

  const errorRadialData = [
    {
      name: 'error',
      value: Math.min(error, 200),
      fill: error < 50 ? '#10b981' : error < 100 ? '#f59e0b' : '#ef4444'
    }
  ];

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Motor {motorId}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-4 mx-auto w-full max-w-7xl">
          {/* Compact Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Motor {motorId} Analysis
                  <Badge variant={isOnTarget ? 'default' : 'secondary'} className="text-xs">
                    <Activity className="mr-1 h-3 w-3" />
                    {isOnTarget ? 'On Target' : 'Adjusting'}
                  </Badge>
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={isPaused ? 'default' : 'outline'} onClick={togglePause} size="sm">
                {isPaused ? 'Resume' : 'Pause'} Updates
              </Button>
              <Button variant="outline" size="sm" onClick={handleFullscreen}>
                <Maximize className="h-4 w-4 mr-2" />
                Fullscreen
              </Button>
            </div>
          </div>

          {/* Compact Status Overview - 5 Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {/* TOF Distance */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Ruler className="h-4 w-4 text-purple-500" />
                <p className="text-xs text-muted-foreground">TOF Distance</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{currentTofDistance.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">cm</p>
                <p className={`text-xs font-medium ${getRangeColor(currentRange)}`}>
                  {currentRange}
                </p>
              </div>
            </Card>

            {/* Current Pressure */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-4 w-4 text-blue-500" />
                <p className="text-xs text-muted-foreground">Pressure</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{currentPressure.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">mV</p>
                <Progress value={(currentPressure / 1200) * 100} className="h-1.5" />
              </div>
            </Card>

            {/* Target Setpoint */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-green-500" />
                <p className="text-xs text-muted-foreground">Setpoint</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{currentSetpoint.toFixed(0)}</div>
                <p className="text-xs text-muted-foreground">mV target</p>
              </div>
            </Card>

            {/* PWM Duty */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-orange-500" />
                <p className="text-xs text-muted-foreground">PWM Duty</p>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {currentDuty > 0 ? '+' : ''}{currentDuty.toFixed(1)}%
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {currentDuty > 0 ? (
                    <TrendingUp className="h-3 w-3 text-blue-500" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-orange-500" />
                  )}
                  <span className="text-muted-foreground">
                    {currentDuty > 0 ? 'Increasing' : 'Decreasing'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Tracking Error */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-red-500" />
                <p className="text-xs text-muted-foreground">Error</p>
              </div>
              <div className="space-y-1">
                <div
                  className={`text-2xl font-bold ${
                    error < 50 ? 'text-green-600' : error < 100 ? 'text-yellow-600' : 'text-red-600'
                  }`}
                >
                  {error.toFixed(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {error < 50 ? '✓ On target' : 'Adjusting...'}
                </p>
              </div>
            </Card>
          </div>

          {/* Main Charts - Compact Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Pressure Tracking - Line Chart with Gradient */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pressure Tracking</CardTitle>
                <CardDescription className="text-xs">Actual vs target over 3 seconds</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[220px] w-full">
                  <AreaChart data={fullHistory} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="pressureGradient" x1="0" y1="0" x2="0" y2="1">
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
                      fill="url(#pressureGradient)"
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

            {/* Mini Radar for this Motor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Motor {motorId} - Sector {sectorAngles.min}°-{sectorAngles.max}°</CardTitle>
                <CardDescription className="text-xs">
                  TOF Distance: {currentTofDistance.toFixed(1)} cm
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <MiniMotorRadar
                  motorNumber={motorId}
                  sectorMin={sectorAngles.min}
                  sectorMax={sectorAngles.max}
                  currentData={currentData}
                  scanHistory={scanHistory}
                />
              </CardContent>
            </Card>
          </div>

          {/* Secondary Charts - Duty & Error */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* PWM Duty Cycle - Gradient Area */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PWM Control Signal</CardTitle>
                <CardDescription className="text-xs">Duty cycle over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <AreaChart data={fullHistory} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="dutyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
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
                    <YAxis domain={[-100, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                    <Area
                      dataKey="duty"
                      stroke="#f59e0b"
                      fill="url(#dutyGradient)"
                      strokeWidth={2}
                      type="monotone"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Tracking Error - Gradient Area with Zones */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tracking Error</CardTitle>
                <CardDescription className="text-xs">Deviation from setpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                  <AreaChart data={fullHistory} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
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
                    <ReferenceLine y={50} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target', fontSize: 10 }} />
                    <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                    <Area
                      dataKey="error"
                      stroke="#ef4444"
                      fill="url(#errorGradient)"
                      strokeWidth={2}
                      type="monotone"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Fullscreen Motor View Container */}
      <div
        ref={fullscreenRef}
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background overflow-auto' : 'hidden'}`}
      >
        <div className="container mx-auto p-6 h-full">
          {/* Fullscreen Controls */}
          <div className="flex justify-between items-center mb-4">
            {/* Navigation Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousMotor}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Motor {motorId === 1 ? 4 : motorId - 1}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMotor}
                className="gap-2"
              >
                Motor {motorId === 4 ? 1 : motorId + 1}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Center Title */}
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Motor {motorId} Analysis</h2>
              <Badge variant={isOnTarget ? 'default' : 'secondary'} className="text-xs">
                <Activity className="mr-1 h-3 w-3" />
                {isOnTarget ? 'On Target' : 'Adjusting'}
              </Badge>
            </div>

            {/* Exit Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitFullscreen}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Exit Fullscreen (ESC)
            </Button>
          </div>

          {/* Fullscreen Content - Same layout as main view */}
          <div className="space-y-4">
            {/* Compact Status Overview */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {/* TOF Distance */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Ruler className="h-4 w-4 text-purple-500" />
                  <p className="text-xs text-muted-foreground">TOF Distance</p>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{currentTofDistance.toFixed(0)}</div>
                  <p className="text-xs text-muted-foreground">cm</p>
                  <p className={`text-xs font-medium ${getRangeColor(currentRange)}`}>
                    {currentRange}
                  </p>
                </div>
              </Card>

              {/* Current Pressure */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="h-4 w-4 text-blue-500" />
                  <p className="text-xs text-muted-foreground">Pressure</p>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{currentPressure.toFixed(0)}</div>
                  <p className="text-xs text-muted-foreground">mV</p>
                  <Progress value={(currentPressure / 1200) * 100} className="h-1.5" />
                </div>
              </Card>

              {/* Target Setpoint */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-muted-foreground">Setpoint</p>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{currentSetpoint.toFixed(0)}</div>
                  <p className="text-xs text-muted-foreground">mV target</p>
                </div>
              </Card>

              {/* PWM Duty */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  <p className="text-xs text-muted-foreground">PWM Duty</p>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">
                    {currentDuty > 0 ? '+' : ''}{currentDuty.toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {currentDuty > 0 ? (
                      <TrendingUp className="h-3 w-3 text-blue-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-orange-500" />
                    )}
                    <span className="text-muted-foreground">
                      {currentDuty > 0 ? 'Increasing' : 'Decreasing'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Tracking Error */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-red-500" />
                  <p className="text-xs text-muted-foreground">Error</p>
                </div>
                <div className="space-y-1">
                  <div
                    className={`text-2xl font-bold ${
                      error < 50 ? 'text-green-600' : error < 100 ? 'text-yellow-600' : 'text-red-600'
                    }`}
                  >
                    {error.toFixed(0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {error < 50 ? '✓ On target' : 'Adjusting...'}
                  </p>
                </div>
              </Card>
            </div>

            {/* Main Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Pressure Tracking */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pressure Tracking</CardTitle>
                  <CardDescription className="text-xs">Actual vs target over 3 seconds</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[220px] w-full">
                    <AreaChart data={fullHistory} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="pressureGradientFS" x1="0" y1="0" x2="0" y2="1">
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
                        fill="url(#pressureGradientFS)"
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

              {/* Mini Radar for this Motor */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Motor {motorId} - Sector {sectorAngles.min}°-{sectorAngles.max}°</CardTitle>
                  <CardDescription className="text-xs">
                    TOF Distance: {currentTofDistance.toFixed(1)} cm
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <MiniMotorRadar
                    motorNumber={motorId}
                    sectorMin={sectorAngles.min}
                    sectorMax={sectorAngles.max}
                    currentData={currentData}
                    scanHistory={scanHistory}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Secondary Charts */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* PWM Duty Cycle */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">PWM Control Signal</CardTitle>
                  <CardDescription className="text-xs">Duty cycle over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <AreaChart data={fullHistory} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="dutyGradientFS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
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
                      <YAxis domain={[-100, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
                      <Area
                        dataKey="duty"
                        stroke="#f59e0b"
                        fill="url(#dutyGradientFS)"
                        strokeWidth={2}
                        type="monotone"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Tracking Error */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Tracking Error</CardTitle>
                  <CardDescription className="text-xs">Deviation from setpoint</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <AreaChart data={fullHistory} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                      <defs>
                        <linearGradient id="errorGradientFS" x1="0" y1="0" x2="0" y2="1">
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
                      <ReferenceLine y={50} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Target', fontSize: 10 }} />
                      <ReferenceLine y={100} stroke="#f59e0b" strokeDasharray="3 3" />
                      <Area
                        dataKey="error"
                        stroke="#ef4444"
                        fill="url(#errorGradientFS)"
                        strokeWidth={2}
                        type="monotone"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Monitor (toggle with Ctrl+Shift+P) */}
      <PerformanceMonitor />
    </SidebarInset>
  );
}
