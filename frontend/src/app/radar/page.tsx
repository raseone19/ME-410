/**
 * Radar Page
 * Real-time TOF sensor radar visualization showing detected objects in 0°-120° sweep
 */

'use client';

import { useEffect } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from '@/components/radar/RadarChart';
import { RadarStats } from '@/components/radar/RadarStats';

export default function RadarPage() {
  const {
    status,
    currentData,
    motorHistory,
    scanHistory,
    isRecording,
    isPaused,
    connect,
    disconnect,
    toggleRecording,
    togglePause,
    resetSimulation,
  } = useWebSocketStore();

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6" style={{ maxWidth: '100%' }}>
        {/* Page Title */}
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight">
            TOF Radar Visualization
          </h1>
          <p className="text-muted-foreground">
            Real-time object detection across 4 sectors (0°-120° sweep)
          </p>
        </div>

        {/* Header with Controls */}
        <div className="max-w-7xl mx-auto">
          <DashboardHeader
            tofDistance={currentData?.tof1_cm ?? 0}
            connectionStatus={status}
            isRecording={isRecording}
            isPaused={isPaused}
            onToggleRecording={toggleRecording}
            onTogglePause={togglePause}
            onConnect={() => connect()}
            onDisconnect={disconnect}
            onReset={resetSimulation}
          />
        </div>

        {/* Radar Visualization - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle>Radar Sweep (0° - 120°)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <RadarChart
              currentData={currentData}
              motorHistory={motorHistory}
              scanHistory={scanHistory}
            />
          </CardContent>
        </Card>

        {/* Stats Panel - Full Width Below */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <RadarStats currentData={currentData} motorHistory={motorHistory} />
          </div>
        </div>

        {/* Sector Detail Cards */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((motor) => {
            const sectorRanges = [
              { min: 0, max: 30 },
              { min: 31, max: 60 },
              { min: 61, max: 90 },
              { min: 91, max: 120 },
            ];
            const sector = sectorRanges[motor - 1];
            const distance = currentData?.[`tof${motor}_cm` as keyof typeof currentData] as number ?? 0;
            const pressure = currentData?.[`pp${motor}_mv` as keyof typeof currentData] as number ?? 0;
            const duty = currentData?.[`duty${motor}_pct` as keyof typeof currentData] as number ?? 0;

            return (
              <Card key={motor}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Motor {motor} - Sector {sector.min}°-{sector.max}°
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Distance</span>
                    <span className="font-mono font-bold">
                      {distance.toFixed(1)} cm
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pressure</span>
                    <span className="font-mono font-bold">
                      {pressure.toFixed(0)} mV
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duty Cycle</span>
                    <span className="font-mono font-bold">
                      {duty.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
