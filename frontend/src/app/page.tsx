/**
 * Main Dashboard Page
 * Real-time ESP32 Motor Control Dashboard
 */

'use client';

import { useEffect } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { MotorCard } from '@/components/dashboard/MotorCard';
import { Card, CardContent } from '@/components/ui/card';

export default function DashboardPage() {
  const {
    status,
    currentData,
    dataHistory,
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

  // Get TOF distance (default to 0 if no data)
  const tofDistance = currentData?.tof_dist_cm ?? 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Motor Control Dashboard
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring of 4-motor independent PI control system
          </p>
        </div>

        {/* Header with TOF and Controls */}
        <DashboardHeader
          tofDistance={tofDistance}
          connectionStatus={status}
          isRecording={isRecording}
          isPaused={isPaused}
          onToggleRecording={toggleRecording}
          onTogglePause={togglePause}
          onConnect={() => connect()}
          onDisconnect={disconnect}
          onReset={resetSimulation}
        />

        {/* Motor Grid (2x2) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <MotorCard
            motorNumber={1}
            dataHistory={dataHistory}
            currentData={currentData}
          />
          <MotorCard
            motorNumber={2}
            dataHistory={dataHistory}
            currentData={currentData}
          />
          <MotorCard
            motorNumber={3}
            dataHistory={dataHistory}
            currentData={currentData}
          />
          <MotorCard
            motorNumber={4}
            dataHistory={dataHistory}
            currentData={currentData}
          />
        </div>

        {/* System Stats */}
        {currentData && (
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Runtime</div>
                  <div className="text-2xl font-bold">
                    {(currentData.time_ms / 1000).toFixed(1)}s
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Data Points
                  </div>
                  <div className="text-2xl font-bold">{dataHistory.length}</div>
                  <div className="text-xs text-muted-foreground">
                    / {500} max
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Update Rate
                  </div>
                  <div className="text-2xl font-bold">50 Hz</div>
                  <div className="text-xs text-muted-foreground">
                    20ms interval
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">
                    Target Setpoint
                  </div>
                  <div className="text-2xl font-bold">
                    {currentData.setpoint_mv.toFixed(0)}
                  </div>
                  <div className="text-xs text-muted-foreground">mV</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
