/**
 * MODE B Dashboard Page
 * 4 Independent Motor Sectors with Servo Sweep (0° - 120°)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ModeBMotorCard } from '@/components/mode-b/ModeBMotorCard';
import { Card, CardContent } from '@/components/ui/card';

// Sector definitions (must match ESP32 src/config/pins.h)
const SECTORS = [
  { motor: 1, minAngle: 0, maxAngle: 30, color: 'rgb(59, 130, 246)' },  // blue
  { motor: 2, minAngle: 31, maxAngle: 60, color: 'rgb(34, 197, 94)' },  // green
  { motor: 3, minAngle: 61, maxAngle: 90, color: 'rgb(251, 146, 60)' }, // orange
  { motor: 4, minAngle: 91, maxAngle: 120, color: 'rgb(168, 85, 247)' }, // purple
];

export default function ModeBDashboardPage() {
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

  const handleToggleRecording = useCallback(() => {
    toggleRecording();
  }, [toggleRecording]);

  const handleTogglePause = useCallback(() => {
    togglePause();
  }, [togglePause]);

  // Snapshot handler for MODE_B with 4 independent sectors
  const handleSnapshot = useCallback(async () => {
    try {
      setSnapshotStatus('Saving MODE_B snapshot...');

      const snapshot = {
        timestamp: new Date().toISOString(),
        mode: 'MODE_B',
        connectionStatus: status,
        isRecording,
        isPaused,
        currentData,
        dataHistory,
        sectors: SECTORS.map((sector) => ({
          motor: sector.motor,
          sectorRange: `${sector.minAngle}°-${sector.maxAngle}°`,
          distance: currentData?.[`tof${sector.motor}_cm` as keyof typeof currentData] ?? 0,
          pressure: currentData?.[`pp${sector.motor}_mv` as keyof typeof currentData] ?? 0,
          duty: currentData?.[`duty${sector.motor}_pct` as keyof typeof currentData] ?? 0,
        })),
        stats: {
          dataPoints: dataHistory.length,
          runtime_ms: currentData?.time_ms ?? 0,
          servoRange: '0°-120°',
          sectorsCount: 4,
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
  }, [status, isRecording, isPaused, currentData, dataHistory]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page Title */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            MODE B: Sector-Based Control
          </h1>
          <p className="text-muted-foreground">
            4 independent motors with dedicated 30° sectors (0°-120° servo sweep)
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

        {/* Header with Controls */}
        <DashboardHeader
          tofDistance={currentData?.tof1_cm ?? 0}
          connectionStatus={status}
          isRecording={isRecording}
          isPaused={isPaused}
          onToggleRecording={handleToggleRecording}
          onTogglePause={handleTogglePause}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onReset={handleReset}
          onSnapshot={handleSnapshot}
        />

        {/* Sector Visualization */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Servo Sectors (0° - 120°)</h2>
            <div className="flex h-8 overflow-hidden rounded-lg">
              {SECTORS.map((sector) => (
                <div
                  key={sector.motor}
                  className="flex items-center justify-center text-xs font-medium text-white"
                  style={{
                    backgroundColor: sector.color,
                    width: `${((sector.maxAngle - sector.minAngle + 1) / 121) * 100}%`,
                  }}
                >
                  M{sector.motor}: {sector.minAngle}°-{sector.maxAngle}°
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Motor Grid (2x2) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {SECTORS.map((sector) => (
            <ModeBMotorCard
              key={sector.motor}
              motorNumber={sector.motor}
              sectorMin={sector.minAngle}
              sectorMax={sector.maxAngle}
              sectorColor={sector.color}
              dataHistory={dataHistory}
              currentData={currentData}
            />
          ))}
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
                    Sweep Range
                  </div>
                  <div className="text-2xl font-bold">0° - 120°</div>
                  <div className="text-xs text-muted-foreground">
                    4 sectors × 30°
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
