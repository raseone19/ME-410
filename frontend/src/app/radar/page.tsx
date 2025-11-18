/**
 * Radar Page
 * Real-time TOF sensor radar visualization showing detected objects in 0°-120° sweep
 */

'use client';

import { useEffect, useCallback, useState } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { PerformanceMonitor } from '@/components/debug/PerformanceMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart } from '@/components/radar/RadarChart';
import { RadarStats } from '@/components/radar/RadarStats';
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

export default function RadarPage() {
  const {
    status,
    currentData,
    motorHistory,
    scanHistory,
    isPaused,
    connect,
    disconnect,
    togglePause,
    resetSimulation,
  } = useWebSocketStore();

  // Load sector configuration from ESP32 source (NO FALLBACKS)
  const [sectors, setSectors] = useState<Array<{ min: number | 'ERR'; max: number | 'ERR' }>>([
    { min: 'ERR', max: 'ERR' },
    { min: 'ERR', max: 'ERR' },
    { min: 'ERR', max: 'ERR' },
    { min: 'ERR', max: 'ERR' },
  ]);

  // Load servo angle range from ESP32 source
  const [servoMinAngle, setServoMinAngle] = useState<number>(0);
  const [servoMaxAngle, setServoMaxAngle] = useState<number>(180);

  // Fetch ESP32 configuration for sector angles
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success && data.config) {
          // Load sector angles
          const loadedSectors = [1, 2, 3, 4].map((motorNum) => {
            const motorKey = `motor${motorNum}` as const;
            const sectorData = data.config.sectors?.[motorKey];

            let min: number | 'ERR' = 'ERR';
            let max: number | 'ERR' = 'ERR';

            if (!sectorData) {
              console.error(`[Config Error] Missing sectors.${motorKey} in ESP32 configuration`);
            } else {
              if (!sectorData.min) {
                console.error(`[Config Error] Missing SECTOR_MOTOR_${motorNum}_MIN in src/config/servo_config.h`);
              } else {
                min = parseInt(sectorData.min);
              }

              if (!sectorData.max) {
                console.error(`[Config Error] Missing SECTOR_MOTOR_${motorNum}_MAX in src/config/servo_config.h`);
              } else {
                max = parseInt(sectorData.max);
              }
            }

            return { min, max };
          });

          setSectors(loadedSectors);

          // Load servo angle range
          if (data.config.tof?.servoMinAngle) {
            setServoMinAngle(parseInt(data.config.tof.servoMinAngle));
          }
          if (data.config.tof?.servoMaxAngle) {
            setServoMaxAngle(parseInt(data.config.tof.servoMaxAngle));
          }
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

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Radar Visualization</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="space-y-6 mx-auto w-full" style={{ maxWidth: '100%' }}>
          {/* Page Title */}
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              TOF Radar Visualization
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Real-time object detection across 4 sectors ({servoMinAngle}°-{servoMaxAngle}° sweep)
            </p>
          </div>

        {/* Header with Controls */}
        <div className="max-w-7xl mx-auto">
          <DashboardHeader
            connectionStatus={status}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onReset={handleReset}
          />
        </div>

        {/* Radar Visualization - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle>Radar Sweep ({servoMinAngle}° - {servoMaxAngle}°)</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <RadarChart
              currentData={currentData}
              motorHistory={motorHistory}
              scanHistory={scanHistory}
              sectors={sectors}
              servoMinAngle={servoMinAngle}
              servoMaxAngle={servoMaxAngle}
            />
          </CardContent>
        </Card>

        {/* Stats Panel - Full Width Below */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <RadarStats currentData={currentData} motorHistory={motorHistory} sectors={sectors} />
          </div>
        </div>

        {/* Sector Detail Cards */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((motor) => {
            const sector = sectors[motor - 1];
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

      {/* Performance Monitor (toggle with Ctrl+Shift+P) */}
      <PerformanceMonitor />
    </SidebarInset>
  );
}
