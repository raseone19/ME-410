/**
 * Dashboard Header Component
 * Displays TOF distance, connection status, control mode, and controls
 */

'use client';

import { memo, useMemo, useState } from 'react';
import { Wifi, WifiOff, Radio, Pause, Play, Camera, Maximize2, Gauge, Circle, Square } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ConnectionStatus,
  DistanceRange,
  getDistanceRange,
  getDistanceRangeColor,
} from '@/lib/types';
import { useControlMode } from '@/lib/control-mode-context';

interface DashboardHeaderProps {
  tofDistance?: number; // Optional - only for single-distance modes
  connectionStatus: ConnectionStatus;
  isPaused: boolean;
  onTogglePause: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onReset: () => void;
  onSnapshot?: () => void; // Optional snapshot handler
  onFullscreen?: () => void; // Optional fullscreen handler
  // CSV Recording
  isRecording?: boolean;
  recordedPoints?: number;
  onToggleRecording?: (filename?: string) => void;
}

export const DashboardHeader = memo(function DashboardHeader({
  tofDistance,
  connectionStatus,
  isPaused,
  onTogglePause,
  onConnect,
  onDisconnect,
  onReset,
  onSnapshot,
  onFullscreen,
  isRecording,
  recordedPoints,
  onToggleRecording,
}: DashboardHeaderProps) {
  // Get control mode from context
  const controlMode = useControlMode();

  // CSV filename state
  const [csvFilename, setCsvFilename] = useState('');

  // Memoize distance calculations (only if tofDistance is provided)
  const { distanceRange, rangeColor } = useMemo(() => {
    if (tofDistance === undefined) {
      return { distanceRange: null, rangeColor: null };
    }
    const range = getDistanceRange(tofDistance);
    return {
      distanceRange: range,
      rangeColor: getDistanceRangeColor(range),
    };
  }, [tofDistance]);

  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
  const showTofDistance = tofDistance !== undefined;

  return (
    <Card>
      <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 md:p-6">
        {/* Left: TOF Distance Display (optional) */}
        {showTofDistance && (
          <div className="flex items-center gap-4 justify-center md:justify-start">
            <div>
              <p className="text-sm text-muted-foreground mb-1">TOF Distance</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl md:text-3xl font-bold">
                  {tofDistance.toFixed(1)}
                </span>
                <span className="text-base md:text-lg text-muted-foreground">cm</span>
                <Badge variant={rangeColor!}>{distanceRange}</Badge>
              </div>
            </div>
          </div>
        )}

        {/* Center: Connection Status + Control Mode */}
        <div className="flex items-center gap-6 justify-center">
          {/* Connection Status */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <Wifi className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-600">Connected</p>
                  <p className="text-xs text-muted-foreground">
                    Receiving data at 50Hz
                  </p>
                </div>
              </>
            ) : connectionStatus === ConnectionStatus.CONNECTING ? (
              <>
                <Radio className="h-5 w-5 text-yellow-600 animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-yellow-600">
                    Connecting...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Establishing connection
                  </p>
                </div>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-600">
                    Disconnected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No data stream
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Control Mode Badge */}
          {!controlMode.loading && (
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-muted-foreground" />
              <Badge
                variant={controlMode.isNewtons ? 'default' : 'secondary'}
                className="text-xs"
              >
                {controlMode.isNewtons ? 'Newtons' : 'Millivolts'}
              </Badge>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
          {/* CSV Recording Controls */}
          {onToggleRecording && (
            <div className="flex items-center gap-2">
              {/* Filename Input - shown when not recording */}
              {!isRecording && (
                <Input
                  type="text"
                  placeholder="Filename (optional)"
                  value={csvFilename}
                  onChange={(e) => setCsvFilename(e.target.value)}
                  disabled={!isConnected}
                  className="w-32 md:w-40 h-8 text-sm"
                />
              )}
              {/* Recording Button */}
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => {
                  if (isRecording) {
                    onToggleRecording(csvFilename || undefined);
                    setCsvFilename(''); // Clear after saving
                  } else {
                    onToggleRecording();
                  }
                }}
                disabled={!isConnected}
                title={isRecording ? `Recording... ${recordedPoints} points` : 'Start CSV recording'}
                className="flex-shrink-0"
              >
                {isRecording ? (
                  <>
                    <Square className="h-4 w-4 md:mr-2 fill-current" />
                    <span className="hidden md:inline">Stop ({recordedPoints})</span>
                    <span className="md:hidden">{recordedPoints}</span>
                  </>
                ) : (
                  <>
                    <Circle className="h-4 w-4 md:mr-2 text-red-500 fill-red-500" />
                    <span className="hidden md:inline">Record CSV</span>
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Pause Button */}
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={onTogglePause}
            disabled={!isConnected}
            className="flex-shrink-0"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Resume</span>
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Pause</span>
              </>
            )}
          </Button>

          {/* Fullscreen Button */}
          {onFullscreen && (
            <Button
              variant="outline"
              size="sm"
              onClick={onFullscreen}
              title="View motors in fullscreen"
              className="flex-shrink-0"
            >
              <Maximize2 className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Fullscreen</span>
            </Button>
          )}

          {/* Snapshot Button */}
          {onSnapshot && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSnapshot}
              disabled={!isConnected}
              title="Save debug snapshot"
              className="flex-shrink-0"
            >
              <Camera className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Snapshot</span>
            </Button>
          )}

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!isConnected}
            className="flex-shrink-0"
          >
            <span className="hidden sm:inline">Reset</span>
            <span className="sm:hidden">↻</span>
          </Button>

          {/* Connect/Disconnect Button */}
          {isConnected ? (
            <Button variant="destructive" size="sm" onClick={onDisconnect} className="flex-shrink-0">
              <span className="hidden sm:inline">Disconnect</span>
              <span className="sm:hidden">✕</span>
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={onConnect} className="flex-shrink-0">
              <span className="hidden sm:inline">Connect</span>
              <span className="sm:hidden">⚡</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
