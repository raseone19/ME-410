/**
 * Main Dashboard Page
 * Real-time ESP32 Motor Control Dashboard
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { useWebSocketStore, TRANSITION_PAUSE_MS } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ModeBMotorCard } from '@/components/mode-b/ModeBMotorCard';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';

// UI colors for sectors (hardcoded for visual consistency)
const SECTOR_COLORS = [
  'rgb(59, 130, 246)',   // blue
  'rgb(34, 197, 94)',    // green
  'rgb(251, 146, 60)',   // orange
  'rgb(168, 85, 247)',   // purple
];

export default function DashboardPage() {
  // Individual selectors (recommended by Zustand for best performance)
  const status = useWebSocketStore((state) => state.status);
  const currentData = useWebSocketStore((state) => state.currentData);
  const dataHistory = useWebSocketStore((state) => state.dataHistory);
  const isPaused = useWebSocketStore((state) => state.isPaused);
  const connect = useWebSocketStore((state) => state.connect);
  const disconnect = useWebSocketStore((state) => state.disconnect);
  const togglePause = useWebSocketStore((state) => state.togglePause);
  const pauseTemporarily = useWebSocketStore((state) => state.pauseTemporarily);
  const resetSimulation = useWebSocketStore((state) => state.resetSimulation);

  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Load sector configuration from ESP32 source (NO FALLBACKS - show ERR if missing)
  const [espConfig, setEspConfig] = useState<any>(null);
  const [sectors, setSectors] = useState<Array<{ motor: number; minAngle: number | 'ERR'; maxAngle: number | 'ERR'; color: string }>>([
    { motor: 1, minAngle: 'ERR', maxAngle: 'ERR', color: SECTOR_COLORS[0] },
    { motor: 2, minAngle: 'ERR', maxAngle: 'ERR', color: SECTOR_COLORS[1] },
    { motor: 3, minAngle: 'ERR', maxAngle: 'ERR', color: SECTOR_COLORS[2] },
    { motor: 4, minAngle: 'ERR', maxAngle: 'ERR', color: SECTOR_COLORS[3] },
  ]);

  // Fetch ESP32 configuration for sector angles
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success && data.config) {
          setEspConfig(data.config);

          // Validate and load sectors - NO FALLBACKS, log missing values
          const loadedSectors = [1, 2, 3, 4].map((motorNum) => {
            const motorKey = `motor${motorNum}` as const;
            const sectorData = data.config.sectors?.[motorKey];

            let minAngle: number | 'ERR' = 'ERR';
            let maxAngle: number | 'ERR' = 'ERR';

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

            return {
              motor: motorNum,
              minAngle,
              maxAngle,
              color: SECTOR_COLORS[motorNum - 1],
            };
          });

          setSectors(loadedSectors);
        } else {
          console.error('[Config Error] Failed to load configuration from /api/config');
        }
      } catch (error) {
        console.error('[Config Error] Error fetching config:', error);
      }
    };

    fetchConfig();
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Handle tab visibility - pause when hidden to prevent freezing
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - pause data processing
        pauseTemporarily(500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pauseTemporarily]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);


  // Memoize event handlers to prevent unnecessary re-renders
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

  const handleFullscreen = useCallback(async () => {
    // Pause data processing during transition
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
    // Pause data processing during transition
    pauseTemporarily(TRANSITION_PAUSE_MS);

    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error('Error attempting to exit fullscreen:', err);
      }
    }
  }, [pauseTemporarily]);

  // Snapshot handler
  const handleSnapshot = useCallback(async () => {
    try {
      setSnapshotStatus('Saving snapshot...');

      const snapshot = {
        timestamp: new Date().toISOString(),
        connectionStatus: status,
        isPaused,
        currentData,
        dataHistory,
        sectors: sectors.map((sector) => ({
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
  }, [status, isPaused, currentData, dataHistory]);

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-4 mx-auto w-full max-w-7xl">
          {/* Page Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Motor Control Dashboard
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
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
          connectionStatus={status}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          onReset={handleReset}
          onSnapshot={handleSnapshot}
          onFullscreen={handleFullscreen}
        />

        {/* Sector Visualization */}
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Servo Sectors (0° - 120°)</h2>
            <div className="flex h-8 overflow-hidden rounded-lg">
              {sectors.map((sector) => {
                const hasError = sector.minAngle === 'ERR' || sector.maxAngle === 'ERR';
                const width = hasError
                  ? '25%' // Equal width for ERR sectors
                  : `${((sector.maxAngle as number - (sector.minAngle as number) + 1) / 121) * 100}%`;

                return (
                  <div
                    key={sector.motor}
                    className="flex items-center justify-center text-xs font-medium text-white"
                    style={{
                      backgroundColor: hasError ? '#dc2626' : sector.color, // Red for errors
                      width,
                    }}
                  >
                    M{sector.motor}: {sector.minAngle}°-{sector.maxAngle}°
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Motor Grid (2x2) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sectors.map((sector) => (
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
                    / 150 max (3s at 50Hz)
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

      {/* Fullscreen Motor Cards Container */}
      <div
        ref={fullscreenRef}
        className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background overflow-auto' : 'hidden'}`}
      >
        <div className="container mx-auto p-3 sm:p-6 h-full">
          {/* Exit Button */}
          <div className="flex justify-end mb-3 sm:mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExitFullscreen}
              className="gap-1 sm:gap-2"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Exit Fullscreen (ESC)</span>
              <span className="sm:hidden">Exit</span>
            </Button>
          </div>

          {/* Motor Cards Grid */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 h-[calc(100%-50px)] sm:h-[calc(100%-60px)]">
            {sectors.map((sector) => (
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
        </div>
      </div>

      {/* Performance Monitor (toggle with Ctrl+Shift+P) */}
      <PerformanceMonitor />
    </SidebarInset>
  );
}
