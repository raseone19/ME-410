/**
 * Dashboard Header Component
 * Displays TOF distance, connection status, and recording controls
 */

'use client';

import { Wifi, WifiOff, Radio, Circle, Pause, Play, Camera } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  ConnectionStatus,
  DistanceRange,
  getDistanceRange,
  getDistanceRangeColor,
} from '@/lib/types';

interface DashboardHeaderProps {
  tofDistance: number;
  connectionStatus: ConnectionStatus;
  isRecording: boolean;
  isPaused: boolean;
  onToggleRecording: () => void;
  onTogglePause: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onReset: () => void;
  onSnapshot: () => void;
}

export function DashboardHeader({
  tofDistance,
  connectionStatus,
  isRecording,
  isPaused,
  onToggleRecording,
  onTogglePause,
  onConnect,
  onDisconnect,
  onReset,
  onSnapshot,
}: DashboardHeaderProps) {
  const distanceRange = getDistanceRange(tofDistance);
  const rangeColor = getDistanceRangeColor(distanceRange);

  const isConnected = connectionStatus === ConnectionStatus.CONNECTED;

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        {/* Left: TOF Distance Display */}
        <div className="flex items-center gap-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">TOF Distance</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">
                {tofDistance.toFixed(1)}
              </span>
              <span className="text-lg text-muted-foreground">cm</span>
              <Badge variant={rangeColor}>{distanceRange}</Badge>
            </div>
          </div>
        </div>

        {/* Center: Connection Status */}
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

        {/* Right: Recording Controls */}
        <div className="flex items-center gap-4">
          {/* Pause Button */}
          <Button
            variant={isPaused ? 'default' : 'outline'}
            size="sm"
            onClick={onTogglePause}
            disabled={!isConnected}
          >
            {isPaused ? (
              <>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            )}
          </Button>

          {/* Recording Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {isRecording && (
                <Circle className="h-3 w-3 fill-red-600 text-red-600 animate-pulse" />
              )}
              <Label htmlFor="recording-toggle" className="cursor-pointer">
                {isRecording ? 'Recording' : 'Record'}
              </Label>
            </div>
            <Switch
              id="recording-toggle"
              checked={isRecording}
              onCheckedChange={onToggleRecording}
              disabled={!isConnected}
            />
          </div>

          {/* Snapshot Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onSnapshot}
            disabled={!isConnected}
            title="Save debug snapshot"
          >
            <Camera className="mr-2 h-4 w-4" />
            Snapshot
          </Button>

          {/* Reset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={!isConnected}
          >
            Reset
          </Button>

          {/* Connect/Disconnect Button */}
          {isConnected ? (
            <Button variant="destructive" size="sm" onClick={onDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={onConnect}>
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
