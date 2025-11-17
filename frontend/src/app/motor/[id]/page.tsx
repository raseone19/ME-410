/**
 * Individual Motor Detail Page
 * Deep dive analysis for a single motor
 */

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Area, AreaChart } from 'recharts';
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

export default function MotorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const motorId = parseInt(params.id as string);

  const { status, currentData, dataHistory, connect, isPaused, togglePause } =
    useWebSocketStore();

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

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

  // Current values
  const currentPressure = currentData ? (currentData[pressureKey] as number) : 0;
  const currentDuty = currentData ? (currentData[dutyKey] as number) : 0;
  const currentSetpoint = currentData ? (currentData[setpointKey] as number) : 0;
  const error = Math.abs(currentPressure - currentSetpoint);
  const isOnTarget = error < 50;

  // Prepare chart data
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
        <div className="space-y-6 mx-auto w-full max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                  Motor {motorId} Analysis
                <Badge variant={isOnTarget ? 'default' : 'secondary'}>
                  <Activity className="mr-1 h-3 w-3" />
                  {isOnTarget ? 'On Target' : 'Adjusting'}
                </Badge>
              </h1>
              <p className="text-muted-foreground">
                Detailed performance metrics and visualization
              </p>
            </div>
          </div>
          <Button variant={isPaused ? 'default' : 'outline'} onClick={togglePause}>
            {isPaused ? 'Resume' : 'Pause'} Updates
          </Button>
        </div>

        {/* Current Status Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Current Pressure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{currentPressure}</div>
              <p className="text-xs text-muted-foreground">mV</p>
              <Progress value={(currentPressure / 1200) * 100} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Target Setpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{currentSetpoint.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">mV</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>PWM Duty Cycle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {currentDuty > 0 ? '+' : ''}
                {currentDuty.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground">%</p>
              <div className="mt-2 flex items-center gap-1 text-xs">
                {currentDuty > 0 ? (
                  <TrendingUp className="h-3 w-3 text-blue-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-orange-500" />
                )}
                <span className="text-muted-foreground">
                  {currentDuty > 0 ? 'Increasing' : 'Decreasing'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Tracking Error</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-bold ${
                  error < 50 ? 'text-green-600' : error < 100 ? 'text-yellow-600' : 'text-red-600'
                }`}
              >
                {error.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">mV</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Pressure vs Setpoint */}
          <Card>
            <CardHeader>
              <CardTitle>Pressure Tracking</CardTitle>
              <CardDescription>Actual pressure vs target setpoint over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ChartContainer config={chartConfig}>
                  <LineChart data={fullHistory} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis domain={[0, 1200]} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="setpoint"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Setpoint"
                    />
                    <Line
                      dataKey="pressure"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="Actual"
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* PWM Duty Cycle */}
          <Card>
            <CardHeader>
              <CardTitle>PWM Control Signal</CardTitle>
              <CardDescription>Motor duty cycle percentage over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ChartContainer config={chartConfig}>
                  <AreaChart data={fullHistory} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis domain={[-100, 100]} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      dataKey="duty"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      name="PWM Duty"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* Tracking Error */}
          <Card>
            <CardHeader>
              <CardTitle>Tracking Error</CardTitle>
              <CardDescription>Absolute difference from target setpoint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ChartContainer config={chartConfig}>
                  <AreaChart data={fullHistory} margin={{ left: 12, right: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}s`}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis domain={[0, 200]} tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      dataKey="error"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.2}
                      strokeWidth={2}
                      name="Error"
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Session Statistics</CardTitle>
              <CardDescription>Performance metrics for current session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Avg Pressure</div>
                  <div className="text-xl font-bold">{stats.avgPressure.toFixed(1)} mV</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Duty</div>
                  <div className="text-xl font-bold">{stats.avgDuty.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Avg Error</div>
                  <div className="text-xl font-bold">{stats.avgError.toFixed(1)} mV</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Max Error</div>
                  <div className="text-xl font-bold">{stats.maxError.toFixed(1)} mV</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Pressure Range</div>
                  <div className="text-sm font-medium">
                    {stats.minPressure.toFixed(0)} - {stats.maxPressure.toFixed(0)} mV
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Data Points</div>
                  <div className="text-xl font-bold">{fullHistory.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>

      {/* Performance Monitor (toggle with Ctrl+Shift+P) */}
      <PerformanceMonitor />
    </SidebarInset>
  );
}
