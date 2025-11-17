/**
 * System Diagnostics Page
 * Real-time system health monitoring and debugging tools
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
import { Progress } from '@/components/ui/progress';
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
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Gauge,
  Network,
  Radio,
  Trash2,
  TrendingUp,
  Wifi,
  XCircle,
} from 'lucide-react';
import { ConnectionStatus } from '@/lib/types';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export default function DiagnosticsPage() {
  const {
    status,
    diagnostics,
    isPaused,
    connect,
    disconnect,
    togglePause,
    resetSimulation,
    clearErrorLog,
  } = useWebSocketStore();

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

  const handleClearErrors = useCallback(() => {
    clearErrorLog();
  }, [clearErrorLog]);

  // Format uptime
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Connection status badge
  const getStatusBadge = () => {
    switch (status) {
      case ConnectionStatus.CONNECTED:
        return (
          <Badge className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Connected
          </Badge>
        );
      case ConnectionStatus.CONNECTING:
        return (
          <Badge variant="secondary" className="gap-1">
            <Activity className="h-3 w-3 animate-pulse" />
            Connecting
          </Badge>
        );
      case ConnectionStatus.DISCONNECTED:
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Disconnected
          </Badge>
        );
      case ConnectionStatus.ERROR:
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        );
    }
  };

  // Prepare latency chart data
  const latencyChartData = diagnostics.latencyHistory.map((latency, index) => ({
    index,
    latency,
  }));

  const latencyChartConfig = {
    latency: { label: 'Latency (ms)', color: '#3b82f6' },
  } satisfies ChartConfig;

  // Calculate packet loss percentage
  const expectedPackets = diagnostics.connectionUptime > 0
    ? Math.floor(diagnostics.connectionUptime / (1000 / diagnostics.expectedFrequency))
    : 0;
  const packetLossPercentage = expectedPackets > 0
    ? ((expectedPackets - diagnostics.totalPacketsReceived) / expectedPackets) * 100
    : 0;

  // Health score (0-100)
  const calculateHealthScore = () => {
    if (status !== ConnectionStatus.CONNECTED) return 0;

    let score = 100;

    // Deduct for high latency
    if (diagnostics.averageLatency > 30) score -= 10;
    if (diagnostics.averageLatency > 50) score -= 20;

    // Deduct for packet loss
    if (packetLossPercentage > 1) score -= 20;
    if (packetLossPercentage > 5) score -= 30;

    // Deduct for frequency deviation
    const freqDeviation = Math.abs(diagnostics.actualFrequency - diagnostics.expectedFrequency);
    if (freqDeviation > 5) score -= 10;
    if (freqDeviation > 10) score -= 20;

    // Deduct for errors
    if (diagnostics.totalErrors > 0) score -= 10;
    if (diagnostics.totalErrors > 5) score -= 20;

    return Math.max(0, score);
  };

  const healthScore = calculateHealthScore();

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>System Diagnostics</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-4 mx-auto w-full max-w-7xl">
          {/* Page Title */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                System Diagnostics
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Real-time monitoring and debugging tools
              </p>
            </div>
            {getStatusBadge()}
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

          {/* System Health Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                System Health Score
              </CardTitle>
              <CardDescription>
                Overall system health based on connection quality, latency, and errors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold">
                    {healthScore}
                    <span className="text-xl text-muted-foreground">/100</span>
                  </div>
                  <Progress value={healthScore} className="flex-1 h-4" />
                  <Badge
                    variant={
                      healthScore >= 80
                        ? 'default'
                        : healthScore >= 60
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : 'Poor'}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <div className="font-medium">{status}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Uptime</div>
                    <div className="font-medium">{formatUptime(diagnostics.connectionUptime)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg Latency</div>
                    <div className="font-medium">{diagnostics.averageLatency.toFixed(1)} ms</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Packet Loss</div>
                    <div className="font-medium">{packetLossPercentage.toFixed(2)}%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connection Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Connection Attempts */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Connection Attempts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{diagnostics.connectionAttempts}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {diagnostics.reconnectionCount} reconnections
                </p>
              </CardContent>
            </Card>

            {/* Total Packets */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Total Packets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.totalPacketsReceived.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected: {expectedPackets.toLocaleString()}
                </p>
              </CardContent>
            </Card>

            {/* Data Rate */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Radio className="h-4 w-4" />
                  Data Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {diagnostics.actualFrequency.toFixed(1)} Hz
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected: {diagnostics.expectedFrequency} Hz
                </p>
                <Progress
                  value={(diagnostics.actualFrequency / diagnostics.expectedFrequency) * 100}
                  className="h-1.5 mt-2"
                />
              </CardContent>
            </Card>

            {/* Total Errors */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Total Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {diagnostics.totalErrors}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {diagnostics.errorLog.length} in log
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Latency Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Latency Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Latency History
                </CardTitle>
                <CardDescription>
                  Time between packets (last 50 readings)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={latencyChartConfig} className="h-[200px] w-full">
                  <LineChart data={latencyChartData} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="index" hide />
                    <YAxis
                      domain={[0, 50]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      dataKey="latency"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Latency Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Latency Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Average</div>
                  <div className="text-2xl font-bold">
                    {diagnostics.averageLatency.toFixed(1)} ms
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Minimum</div>
                  <div className="text-xl font-bold text-green-600">
                    {diagnostics.minLatency !== Infinity
                      ? `${diagnostics.minLatency.toFixed(1)} ms`
                      : 'N/A'}
                  </div>
                </div>
                <Separator />
                <div>
                  <div className="text-sm text-muted-foreground">Maximum</div>
                  <div className="text-xl font-bold text-red-600">
                    {diagnostics.maxLatency > 0
                      ? `${diagnostics.maxLatency.toFixed(1)} ms`
                      : 'N/A'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Error Log */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Error Log
                  </CardTitle>
                  <CardDescription>
                    Recent errors and warnings (last 100)
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearErrors}
                  disabled={diagnostics.errorLog.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Log
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {diagnostics.errorLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No errors detected</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {diagnostics.errorLog.slice().reverse().map((error, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <AlertCircle
                        className={`h-5 w-5 mt-0.5 ${
                          error.severity === 'error'
                            ? 'text-red-500'
                            : error.severity === 'warning'
                            ? 'text-yellow-500'
                            : 'text-blue-500'
                        }`}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {error.type}
                          </Badge>
                          <Badge
                            variant={
                              error.severity === 'error'
                                ? 'destructive'
                                : error.severity === 'warning'
                                ? 'secondary'
                                : 'default'
                            }
                            className="text-xs"
                          >
                            {error.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(error.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm">{error.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Connection Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                Connection Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Last Connected</div>
                  <div className="font-medium">
                    {diagnostics.lastConnectedTime
                      ? new Date(diagnostics.lastConnectedTime).toLocaleString()
                      : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last Packet Received</div>
                  <div className="font-medium">
                    {diagnostics.lastPacketTime
                      ? formatTime(diagnostics.lastPacketTime)
                      : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Connection Uptime</div>
                  <div className="font-medium">
                    {formatUptime(diagnostics.connectionUptime)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Protocol</div>
                  <div className="font-medium">Binary (70 bytes/packet)</div>
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
