/**
 * Configuration Page
 * Allows real-time configuration of ESP32 parameters via WebSocket
 */

'use client';

import { useState, useEffect } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Gauge, Radio, AlertCircle } from 'lucide-react';
import { ConnectionStatus } from '@/lib/types';

export default function ConfigPage() {
  const status = useWebSocketStore((state) => state.status);
  const sendMessage = useWebSocketStore((state) => state.sendMessage);

  // TOF Sweep state
  const [sweepEnabled, setSweepEnabled] = useState(true);
  const [manualAngle, setManualAngle] = useState(90);
  const [minAngle, setMinAngle] = useState(5);
  const [maxAngle, setMaxAngle] = useState(175);
  const [stepSize, setStepSize] = useState(5);

  // Connection status
  const isConnected = status === ConnectionStatus.CONNECTED;

  /**
   * Send sweep enable/disable command
   */
  const handleSweepToggle = (enabled: boolean) => {
    setSweepEnabled(enabled);

    const command = enabled ? 'SWEEP:ENABLE' : 'SWEEP:DISABLE';

    sendMessage({
      type: 'sweep_command',
      command: command,
    });

    console.log(`[Config] Sent: ${command}`);
  };

  /**
   * Send manual servo angle command (only when sweep is disabled)
   */
  const handleManualAngle = (value: number[]) => {
    const angle = value[0];
    setManualAngle(angle);

    if (!sweepEnabled) {
      sendMessage({
        type: 'servo_command',
        command: `SERVO:ANGLE:${angle}`,
      });

      console.log(`[Config] Sent: SERVO:ANGLE:${angle}`);
    }
  };

  /**
   * Send sweep configuration commands
   */
  const handleMinAngle = (value: number[]) => {
    const angle = value[0];
    setMinAngle(angle);

    sendMessage({
      type: 'sweep_command',
      command: `SWEEP:MIN:${angle}`,
    });

    console.log(`[Config] Sent: SWEEP:MIN:${angle}`);
  };

  const handleMaxAngle = (value: number[]) => {
    const angle = value[0];
    setMaxAngle(angle);

    sendMessage({
      type: 'sweep_command',
      command: `SWEEP:MAX:${angle}`,
    });

    console.log(`[Config] Sent: SWEEP:MAX:${angle}`);
  };

  const handleStepSize = (value: number[]) => {
    const step = value[0];
    setStepSize(step);

    sendMessage({
      type: 'sweep_command',
      command: `SWEEP:STEP:${step}`,
    });

    console.log(`[Config] Sent: SWEEP:STEP:${step}`);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Real-time control of ESP32 parameters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`h-3 w-3 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Connection Warning */}
      {!isConnected && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                Not Connected
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Configuration changes will not be sent until WebSocket connection is established.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOF & Servo Sweep Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            <CardTitle>TOF Sensor & Servo Sweep</CardTitle>
          </div>
          <CardDescription>
            Control the time-of-flight sensor servo sweep behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sweep Enable/Disable Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="sweep-enable" className="text-base font-medium">
                Automatic Sweep
              </Label>
              <p className="text-sm text-muted-foreground">
                Enable or disable automatic servo sweeping
              </p>
            </div>
            <Switch
              id="sweep-enable"
              checked={sweepEnabled}
              onCheckedChange={handleSweepToggle}
              disabled={!isConnected}
            />
          </div>

          {/* Manual Angle Control (only when sweep disabled) */}
          {!sweepEnabled && (
            <div className="space-y-3 rounded-lg border p-4 bg-accent/50">
              <div className="flex items-center justify-between">
                <Label htmlFor="manual-angle" className="text-base font-medium">
                  Manual Servo Angle
                </Label>
                <span className="text-sm font-mono text-muted-foreground">
                  {manualAngle}°
                </span>
              </div>
              <Slider
                id="manual-angle"
                min={0}
                max={180}
                step={1}
                value={[manualAngle]}
                onValueChange={handleManualAngle}
                disabled={!isConnected}
                className="py-2"
              />
              <p className="text-xs text-muted-foreground">
                Sweep must be disabled to manually control servo position
              </p>
            </div>
          )}

          {/* Sweep Configuration (only when sweep enabled) */}
          {sweepEnabled && (
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Sweep Parameters</h4>

              {/* Min Angle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="min-angle" className="text-sm">
                    Minimum Angle
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {minAngle}°
                  </span>
                </div>
                <Slider
                  id="min-angle"
                  min={0}
                  max={maxAngle - 10}
                  step={5}
                  value={[minAngle]}
                  onValueChange={handleMinAngle}
                  disabled={!isConnected}
                />
              </div>

              {/* Max Angle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="max-angle" className="text-sm">
                    Maximum Angle
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {maxAngle}°
                  </span>
                </div>
                <Slider
                  id="max-angle"
                  min={minAngle + 10}
                  max={180}
                  step={5}
                  value={[maxAngle]}
                  onValueChange={handleMaxAngle}
                  disabled={!isConnected}
                />
              </div>

              {/* Step Size */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="step-size" className="text-sm">
                    Step Size
                  </Label>
                  <span className="text-sm font-mono text-muted-foreground">
                    {stepSize}°
                  </span>
                </div>
                <Slider
                  id="step-size"
                  min={1}
                  max={20}
                  step={1}
                  value={[stepSize]}
                  onValueChange={handleStepSize}
                  disabled={!isConnected}
                />
                <p className="text-xs text-muted-foreground">
                  Smaller steps = slower sweep, more precision
                </p>
              </div>

              {/* Sweep Range Summary */}
              <div className="mt-4 rounded bg-muted p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Sweep Range:</span>
                  <span className="font-mono font-medium">
                    {minAngle}° - {maxAngle}° ({maxAngle - minAngle}° total)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Steps per sweep:</span>
                  <span className="font-mono font-medium">
                    {Math.ceil((maxAngle - minAngle) / stepSize)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future: Motor Control Configuration */}
      <Card className="opacity-50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            <CardTitle>Motor Control (Coming Soon)</CardTitle>
          </div>
          <CardDescription>
            PI controller tuning, setpoints, and motor enable/disable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Motor configuration controls will be added in a future update.
          </p>
        </CardContent>
      </Card>

      {/* Implementation Notes */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Commands sent:</strong> SWEEP:ENABLE, SWEEP:DISABLE, SERVO:ANGLE:&lt;n&gt;,
            SWEEP:MIN:&lt;n&gt;, SWEEP:MAX:&lt;n&gt;, SWEEP:STEP:&lt;n&gt;
          </p>
          <p>
            <strong>Protocol:</strong> Text-based commands via WebSocket → Node.js bridge → USB Serial → ESP32
          </p>
          <p>
            <strong>ESP32 Status:</strong> Firmware needs to be updated to receive and process these commands.
            See <code className="text-xs bg-muted px-1 py-0.5 rounded">docs/command-protocol.md</code> for details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
