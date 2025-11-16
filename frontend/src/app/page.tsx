/**
 * Main Dashboard Page
 * Real-time ESP32 Motor Control Dashboard
 */

'use client';

import { useEffect, useState } from 'react';
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

  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Get TOF distance (MODE_A uses tof1_cm, all motors see same distance)
  const tofDistance = currentData?.tof1_cm ?? 0;

  // Snapshot handler
  const handleSnapshot = async () => {
    try {
      setSnapshotStatus('Saving snapshot...');

      const snapshot = {
        timestamp: new Date().toISOString(),
        connectionStatus: status,
        isRecording,
        isPaused,
        currentData,
        dataHistory,
        stats: {
          dataPoints: dataHistory.length,
          runtime_ms: currentData?.time_ms ?? 0,
          tofDistance,
        },
      };

      const response = await fetch('/api/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snapshot),
      });

      const result = await response.json();

      if (result.success) {
        setSnapshotStatus(`✅ Saved: ${result.filename}`);
        setTimeout(() => setSnapshotStatus(null), 3000);
      } else {
        setSnapshotStatus(`❌ Error: ${result.error}`);
        setTimeout(() => setSnapshotStatus(null), 5000);
      }
    } catch (error) {
      console.error('Snapshot error:', error);
      setSnapshotStatus('❌ Failed to save snapshot');
      setTimeout(() => setSnapshotStatus(null), 5000);
    }
  };

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

        {/* Snapshot Status Notification */}
        {snapshotStatus && (
          <Card className="bg-primary/10 border-primary">
            <CardContent className="p-4">
              <p className="text-sm font-medium">{snapshotStatus}</p>
            </CardContent>
          </Card>
        )}

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
          onSnapshot={handleSnapshot}
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
                    / 25 max (0.5s at 50Hz)
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
                    Target Setpoint (M1)
                  </div>
                  <div className="text-2xl font-bold">
                    {currentData.sp1_mv.toFixed(0)}
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
