/**
 * Configuration Page
 * Comprehensive ESP32 parameter configuration via WebSocket
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocketStore } from '@/lib/websocket-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Gauge, Radio, AlertCircle, Activity, Shield, Settings2 } from 'lucide-react';
import { ConnectionStatus } from '@/lib/types';
import { toast } from 'sonner';

export default function ConfigPage() {
  const status = useWebSocketStore((state) => state.status);
  const connect = useWebSocketStore((state) => state.connect);
  const sendMessage = useWebSocketStore((state) => state.sendMessage);
  const ws = useWebSocketStore((state) => state.ws);
  const isConnected = status === ConnectionStatus.CONNECTED;

  // Auto-connect WebSocket on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Request current config from ESP32 when connected
  useEffect(() => {
    if (isConnected && sendMessage) {
      console.log('[Config] Requesting current configuration from ESP32...');
      sendMessage({ type: 'config_command', command: 'CONFIG:GET' });
    }
  }, [isConnected, sendMessage]);

  // Listen for ACK/ERR/CONFIG messages from ESP32
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Handle configuration data from ESP32
        if (message.type === 'config_data') {
          console.log('[Config] Received configuration from ESP32:', message.config);
          const config = message.config;

          // Update all state variables with backend values
          if (config.sweep) {
            setSweepEnabled(config.sweep.enabled);
            setServoMinAngle(config.sweep.min_angle);
            setServoMaxAngle(config.sweep.max_angle);
            setServoStep(config.sweep.step);
            setServoSettle(config.sweep.settle_ms);
            setServoReadingDelay(config.sweep.reading_delay_ms);
          }

          if (config.sectors) {
            setSectorM1Min(config.sectors.motor_1.min);
            setSectorM1Max(config.sectors.motor_1.max);
            setSectorM2Min(config.sectors.motor_2.min);
            setSectorM2Max(config.sectors.motor_2.max);
            setSectorM3Min(config.sectors.motor_3.min);
            setSectorM3Max(config.sectors.motor_3.max);
            setSectorM4Min(config.sectors.motor_4.min);
            setSectorM4Max(config.sectors.motor_4.max);
          }

          if (config.sampling) {
            setPpSamples(config.sampling.pp_samples);
            setMuxSettle(config.sampling.mux_settle_us);
          }

          if (config.distance) {
            setDistCloseMin(config.distance.close_min_cm);
            setDistMediumMin(config.distance.medium_min_cm);
            setDistFarMin(config.distance.far_min_cm);
            setDistFarMax(config.distance.far_max_cm);
          }

          if (config.setpoints) {
            setSetpointClose(config.setpoints.close_mv);
            setSetpointMedium(config.setpoints.medium_mv);
            setSecurityOffset(config.setpoints.security_offset_mv);
          }

          if (config.safety) {
            setSafetyThreshold(config.safety.threshold_mv);
            setReleaseTime(config.safety.release_time_ms);
          }

          if (config.pi_gains) {
            setPiKp(config.pi_gains.kp);
            setPiKi(config.pi_gains.ki);
          }

          if (config.control_limits) {
            setDutyMax(config.control_limits.duty_max_pct);
            setDutyMin(config.control_limits.duty_min_pct);
            setMinRun(config.control_limits.min_run_pct);
          }

          toast.success('Configuration Loaded', {
            description: 'Current backend configuration loaded successfully',
            duration: 2000,
          });
        }
        // Handle command acknowledgments
        else if (message.type === 'command_ack') {
          // Filter out manual servo angle ACKs to prevent toast spam
          if (message.command && message.command.startsWith('SERVO:ANGLE:')) {
            return; // Don't show toast for manual angle changes
          }

          toast.success('Configuration Updated', {
            description: message.command || 'Parameter updated successfully',
            duration: 3000,
          });
        }
        // Handle command errors
        else if (message.type === 'command_error') {
          toast.error('Configuration Error', {
            description: `${message.errorType}: ${message.detail}`,
            duration: 5000,
          });
        }
      } catch (error) {
        // Ignore parsing errors for non-JSON messages
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, sendMessage]);

  // TOF & Servo Sweep State
  const [sweepEnabled, setSweepEnabled] = useState(true);
  const [manualAngle, setManualAngle] = useState(90);
  const [servoMinAngle, setServoMinAngle] = useState(5);
  const [servoMaxAngle, setServoMaxAngle] = useState(175);
  const [servoStep, setServoStep] = useState(5);
  const [servoSettle, setServoSettle] = useState(5);
  const [servoReadingDelay, setServoReadingDelay] = useState(5);

  // Motor Sector State (4 motors, min/max for each)
  const [sectorM1Min, setSectorM1Min] = useState(5);
  const [sectorM1Max, setSectorM1Max] = useState(45);
  const [sectorM2Min, setSectorM2Min] = useState(45);
  const [sectorM2Max, setSectorM2Max] = useState(90);
  const [sectorM3Min, setSectorM3Min] = useState(90);
  const [sectorM3Max, setSectorM3Max] = useState(135);
  const [sectorM4Min, setSectorM4Min] = useState(135);
  const [sectorM4Max, setSectorM4Max] = useState(175);

  // Sampling State
  const [ppSamples, setPpSamples] = useState(8);
  const [muxSettle, setMuxSettle] = useState(100);

  // Distance Ranges State
  const [distCloseMin, setDistCloseMin] = useState(50);
  const [distMediumMin, setDistMediumMin] = useState(100);
  const [distFarMin, setDistFarMin] = useState(200);
  const [distFarMax, setDistFarMax] = useState(300);

  // Setpoints State
  const [setpointClose, setSetpointClose] = useState(1500);
  const [setpointMedium, setSetpointMedium] = useState(700);
  const [securityOffset, setSecurityOffset] = useState(50);

  // Safety State
  const [safetyThreshold, setSafetyThreshold] = useState(700);
  const [releaseTime, setReleaseTime] = useState(500);

  // PI Gains State
  const [piKp, setPiKp] = useState(0.15);
  const [piKi, setPiKi] = useState(0.60);

  // Control Limits State
  const [dutyMax, setDutyMax] = useState(100);
  const [dutyMin, setDutyMin] = useState(-100);
  const [minRun, setMinRun] = useState(40);

  // Helper function to send commands
  const sendCommand = useCallback((type: string, command: string) => {
    if (!isConnected) return;
    sendMessage({ type, command });
    console.log(`[Config] Sent: ${command}`);
  }, [isConnected, sendMessage]);

  // === TOF & SERVO HANDLERS ===
  const handleSweepToggle = (enabled: boolean) => {
    setSweepEnabled(enabled);
    sendCommand('sweep_command', enabled ? 'SWEEP:ENABLE' : 'SWEEP:DISABLE');
  };

  const handleManualAngle = (value: number[]) => {
    const angle = value[0];
    setManualAngle(angle);
    // Send command immediately for real-time servo control
    // Toast notifications are filtered out in the message handler
    if (!sweepEnabled) sendCommand('servo_command', `SERVO:ANGLE:${angle}`);
  };

  const handleServoMinAngle = (value: number[]) => {
    setServoMinAngle(value[0]);
  };

  const handleServoMinAngleCommit = (value: number[]) => {
    sendCommand('sweep_command', `SWEEP:MIN:${value[0]}`);
  };

  const handleServoMaxAngle = (value: number[]) => {
    setServoMaxAngle(value[0]);
  };

  const handleServoMaxAngleCommit = (value: number[]) => {
    sendCommand('sweep_command', `SWEEP:MAX:${value[0]}`);
  };

  const handleServoStep = (value: number[]) => {
    setServoStep(value[0]);
  };

  const handleServoStepCommit = (value: number[]) => {
    sendCommand('sweep_command', `SWEEP:STEP:${value[0]}`);
  };

  const handleServoSettle = (value: number[]) => {
    setServoSettle(value[0]);
  };

  const handleServoSettleCommit = (value: number[]) => {
    sendCommand('sweep_command', `SWEEP:SETTLE:${value[0]}`);
  };

  const handleServoReadingDelay = (value: number[]) => {
    setServoReadingDelay(value[0]);
  };

  const handleServoReadingDelayCommit = (value: number[]) => {
    sendCommand('sweep_command', `SWEEP:DELAY:${value[0]}`);
  };

  // === SECTOR HANDLERS ===
  const handleSectorM1Min = (value: number[]) => {
    setSectorM1Min(value[0]);
  };

  const handleSectorM1MinCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M1:MIN:${value[0]}`);
  };

  const handleSectorM1Max = (value: number[]) => {
    setSectorM1Max(value[0]);
  };

  const handleSectorM1MaxCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M1:MAX:${value[0]}`);
  };

  const handleSectorM2Min = (value: number[]) => {
    setSectorM2Min(value[0]);
  };

  const handleSectorM2MinCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M2:MIN:${value[0]}`);
  };

  const handleSectorM2Max = (value: number[]) => {
    setSectorM2Max(value[0]);
  };

  const handleSectorM2MaxCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M2:MAX:${value[0]}`);
  };

  const handleSectorM3Min = (value: number[]) => {
    setSectorM3Min(value[0]);
  };

  const handleSectorM3MinCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M3:MIN:${value[0]}`);
  };

  const handleSectorM3Max = (value: number[]) => {
    setSectorM3Max(value[0]);
  };

  const handleSectorM3MaxCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M3:MAX:${value[0]}`);
  };

  const handleSectorM4Min = (value: number[]) => {
    setSectorM4Min(value[0]);
  };

  const handleSectorM4MinCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M4:MIN:${value[0]}`);
  };

  const handleSectorM4Max = (value: number[]) => {
    setSectorM4Max(value[0]);
  };

  const handleSectorM4MaxCommit = (value: number[]) => {
    sendCommand('sweep_command', `SECTOR:M4:MAX:${value[0]}`);
  };

  // === SAMPLING HANDLERS ===
  const handlePpSamples = (value: number[]) => {
    setPpSamples(value[0]);
  };

  const handlePpSamplesCommit = (value: number[]) => {
    sendCommand('sweep_command', `SAMPLING:PP_SAMPLES:${value[0]}`);
  };

  const handleMuxSettle = (value: number[]) => {
    setMuxSettle(value[0]);
  };

  const handleMuxSettleCommit = (value: number[]) => {
    sendCommand('sweep_command', `SAMPLING:MUX_SETTLE:${value[0]}`);
  };

  // === DISTANCE HANDLERS ===
  const handleDistCloseMin = (value: number[]) => {
    setDistCloseMin(value[0]);
  };

  const handleDistCloseMinCommit = (value: number[]) => {
    sendCommand('sweep_command', `DISTANCE:CLOSE_MIN:${value[0]}`);
  };

  const handleDistMediumMin = (value: number[]) => {
    setDistMediumMin(value[0]);
  };

  const handleDistMediumMinCommit = (value: number[]) => {
    sendCommand('sweep_command', `DISTANCE:MEDIUM_MIN:${value[0]}`);
  };

  const handleDistFarMin = (value: number[]) => {
    setDistFarMin(value[0]);
  };

  const handleDistFarMinCommit = (value: number[]) => {
    sendCommand('sweep_command', `DISTANCE:FAR_MIN:${value[0]}`);
  };

  const handleDistFarMax = (value: number[]) => {
    setDistFarMax(value[0]);
  };

  const handleDistFarMaxCommit = (value: number[]) => {
    sendCommand('sweep_command', `DISTANCE:FAR_MAX:${value[0]}`);
  };

  // === SETPOINT HANDLERS ===
  const handleSetpointClose = (value: number[]) => {
    setSetpointClose(value[0]);
  };

  const handleSetpointCloseCommit = (value: number[]) => {
    sendCommand('sweep_command', `SETPOINT:CLOSE:${value[0]}`);
  };

  const handleSetpointMedium = (value: number[]) => {
    setSetpointMedium(value[0]);
  };

  const handleSetpointMediumCommit = (value: number[]) => {
    sendCommand('sweep_command', `SETPOINT:MEDIUM:${value[0]}`);
  };

  const handleSecurityOffset = (value: number[]) => {
    setSecurityOffset(value[0]);
  };

  const handleSecurityOffsetCommit = (value: number[]) => {
    sendCommand('sweep_command', `SETPOINT:OFFSET:${value[0]}`);
  };

  // === SAFETY HANDLERS ===
  const handleSafetyThreshold = (value: number[]) => {
    setSafetyThreshold(value[0]);
  };

  const handleSafetyThresholdCommit = (value: number[]) => {
    sendCommand('sweep_command', `SAFETY:THRESHOLD:${value[0]}`);
  };

  const handleReleaseTime = (value: number[]) => {
    setReleaseTime(value[0]);
  };

  const handleReleaseTimeCommit = (value: number[]) => {
    sendCommand('sweep_command', `SAFETY:RELEASE_TIME:${value[0]}`);
  };

  // === PI HANDLERS ===
  const handlePiKp = (value: number[]) => {
    setPiKp(value[0]);
  };

  const handlePiKpCommit = (value: number[]) => {
    sendCommand('sweep_command', `PI:KP:${value[0]}`);
  };

  const handlePiKi = (value: number[]) => {
    setPiKi(value[0]);
  };

  const handlePiKiCommit = (value: number[]) => {
    sendCommand('sweep_command', `PI:KI:${value[0]}`);
  };

  // === CONTROL HANDLERS ===
  const handleDutyMax = (value: number[]) => {
    setDutyMax(value[0]);
  };

  const handleDutyMaxCommit = (value: number[]) => {
    sendCommand('sweep_command', `CONTROL:MAX_DUTY:${value[0]}`);
  };

  const handleDutyMin = (value: number[]) => {
    setDutyMin(value[0]);
  };

  const handleDutyMinCommit = (value: number[]) => {
    sendCommand('sweep_command', `CONTROL:MIN_DUTY:${value[0]}`);
  };

  const handleMinRun = (value: number[]) => {
    setMinRun(value[0]);
  };

  const handleMinRunCommit = (value: number[]) => {
    sendCommand('sweep_command', `CONTROL:MIN_RUN:${value[0]}`);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Real-time control of all ESP32 parameters
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection Status */}
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


      {/* Configuration Tabs */}
      <Tabs defaultValue="tof" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tof">TOF & Servo</TabsTrigger>
          <TabsTrigger value="motor">Motor & Sampling</TabsTrigger>
          <TabsTrigger value="distance">Distance & Setpoints</TabsTrigger>
          <TabsTrigger value="safety">Safety & Control</TabsTrigger>
        </TabsList>

        {/* TAB 1: TOF & Servo Sweep */}
        <TabsContent value="tof" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                <CardTitle>TOF Sensor & Servo Sweep</CardTitle>
              </div>
              <CardDescription>
                Control servo sweep behavior and manual positioning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sweep Enable/Disable */}
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

              {/* Manual Angle Control */}
              {!sweepEnabled && (
                <div className="space-y-3 rounded-lg border p-4 bg-accent/50">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="manual-angle" className="text-base font-medium">
                      Manual Servo Angle
                    </Label>
                    <span className="text-sm font-mono text-muted-foreground">{manualAngle}°</span>
                  </div>
                  <Slider
                    id="manual-angle"
                    min={0}
                    max={180}
                    step={1}
                    value={[manualAngle]}
                    onValueChange={handleManualAngle}
                    disabled={!isConnected}
                  />
                  <p className="text-xs text-muted-foreground">
                    Drag to control servo in real-time
                  </p>
                </div>
              )}

              {/* Sweep Configuration */}
              {sweepEnabled && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h4 className="font-medium">Sweep Parameters</h4>

                  {/* Min Angle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Minimum Angle</Label>
                      <span className="text-sm font-mono text-muted-foreground">{servoMinAngle}°</span>
                    </div>
                    <Slider
                      min={0}
                      max={servoMaxAngle - 10}
                      step={5}
                      value={[servoMinAngle]}
                      onValueChange={handleServoMinAngle}
                      onValueCommit={handleServoMinAngleCommit}
                      disabled={!isConnected}
                    />
                  </div>

                  {/* Max Angle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Maximum Angle</Label>
                      <span className="text-sm font-mono text-muted-foreground">{servoMaxAngle}°</span>
                    </div>
                    <Slider
                      min={servoMinAngle + 10}
                      max={180}
                      step={5}
                      value={[servoMaxAngle]}
                      onValueChange={handleServoMaxAngle}
                      onValueCommit={handleServoMaxAngleCommit}
                      disabled={!isConnected}
                    />
                  </div>

                  {/* Step Size */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Step Size</Label>
                      <span className="text-sm font-mono text-muted-foreground">{servoStep}°</span>
                    </div>
                    <Slider
                      min={1}
                      max={20}
                      step={1}
                      value={[servoStep]}
                      onValueChange={handleServoStep}
                      onValueCommit={handleServoStepCommit}
                      disabled={!isConnected}
                    />
                  </div>

                  {/* Settle Time */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Settle Time</Label>
                      <span className="text-sm font-mono text-muted-foreground">{servoSettle}ms</span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[servoSettle]}
                      onValueChange={handleServoSettle}
                      onValueCommit={handleServoSettleCommit}
                      disabled={!isConnected}
                    />
                  </div>

                  {/* Reading Delay */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Reading Delay</Label>
                      <span className="text-sm font-mono text-muted-foreground">{servoReadingDelay}ms</span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[servoReadingDelay]}
                      onValueChange={handleServoReadingDelay}
                      onValueCommit={handleServoReadingDelayCommit}
                      disabled={!isConnected}
                    />
                  </div>

                  {/* Summary */}
                  <div className="mt-4 rounded bg-muted p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sweep Range:</span>
                      <span className="font-mono font-medium">
                        {servoMinAngle}° - {servoMaxAngle}° ({servoMaxAngle - servoMinAngle}° total)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Steps per sweep:</span>
                      <span className="font-mono font-medium">
                        {Math.ceil((servoMaxAngle - servoMinAngle) / servoStep)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Motor Sectors & Sampling */}
        <TabsContent value="motor" className="space-y-4">
          {/* Motor Sector Assignments */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                <CardTitle>Motor Sector Assignments</CardTitle>
              </div>
              <CardDescription>
                Define angular sectors for each motor (must be continuous, non-overlapping)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Motor 1 */}
              <div className="space-y-3">
                <h4 className="font-medium">Motor 1 Sector</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Min Angle</Label>
                    <Slider
                      min={0}
                      max={sectorM1Max - 5}
                      step={5}
                      value={[sectorM1Min]}
                      onValueChange={handleSectorM1Min}
                      onValueCommit={handleSectorM1MinCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM1Min}°</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Max Angle</Label>
                    <Slider
                      min={sectorM1Min + 5}
                      max={180}
                      step={5}
                      value={[sectorM1Max]}
                      onValueChange={handleSectorM1Max}
                      onValueCommit={handleSectorM1MaxCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM1Max}°</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Motor 2 */}
              <div className="space-y-3">
                <h4 className="font-medium">Motor 2 Sector</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Min Angle</Label>
                    <Slider
                      min={0}
                      max={sectorM2Max - 5}
                      step={5}
                      value={[sectorM2Min]}
                      onValueChange={handleSectorM2Min}
                      onValueCommit={handleSectorM2MinCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM2Min}°</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Max Angle</Label>
                    <Slider
                      min={sectorM2Min + 5}
                      max={180}
                      step={5}
                      value={[sectorM2Max]}
                      onValueChange={handleSectorM2Max}
                      onValueCommit={handleSectorM2MaxCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM2Max}°</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Motor 3 */}
              <div className="space-y-3">
                <h4 className="font-medium">Motor 3 Sector</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Min Angle</Label>
                    <Slider
                      min={0}
                      max={sectorM3Max - 5}
                      step={5}
                      value={[sectorM3Min]}
                      onValueChange={handleSectorM3Min}
                      onValueCommit={handleSectorM3MinCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM3Min}°</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Max Angle</Label>
                    <Slider
                      min={sectorM3Min + 5}
                      max={180}
                      step={5}
                      value={[sectorM3Max]}
                      onValueChange={handleSectorM3Max}
                      onValueCommit={handleSectorM3MaxCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM3Max}°</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Motor 4 */}
              <div className="space-y-3">
                <h4 className="font-medium">Motor 4 Sector</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Min Angle</Label>
                    <Slider
                      min={0}
                      max={sectorM4Max - 5}
                      step={5}
                      value={[sectorM4Min]}
                      onValueChange={handleSectorM4Min}
                      onValueCommit={handleSectorM4MinCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM4Min}°</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Max Angle</Label>
                    <Slider
                      min={sectorM4Min + 5}
                      max={180}
                      step={5}
                      value={[sectorM4Max]}
                      onValueChange={handleSectorM4Max}
                      onValueCommit={handleSectorM4MaxCommit}
                      disabled={!isConnected}
                    />
                    <span className="text-xs font-mono">{sectorM4Max}°</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sampling Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                <CardTitle>Sampling Configuration</CardTitle>
              </div>
              <CardDescription>
                Pressure pad and multiplexer sampling parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Pressure Pad Samples</Label>
                <Slider
                  min={1}
                  max={32}
                  step={1}
                  value={[ppSamples]}
                  onValueChange={handlePpSamples}
                  onValueCommit={handlePpSamplesCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{ppSamples} samples</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Multiplexer Settle Time</Label>
                <Slider
                  min={0}
                  max={1000}
                  step={10}
                  value={[muxSettle]}
                  onValueChange={handleMuxSettle}
                  onValueCommit={handleMuxSettleCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{muxSettle} µs</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Distance Ranges & Setpoints */}
        <TabsContent value="distance" className="space-y-4">
          {/* Distance Ranges */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>Distance Ranges</CardTitle>
              </div>
              <CardDescription>
                Define distance thresholds for range classification (cm)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Close Range Min</Label>
                <Slider
                  min={0}
                  max={300}
                  step={10}
                  value={[distCloseMin]}
                  onValueChange={handleDistCloseMin}
                  onValueCommit={handleDistCloseMinCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{distCloseMin} cm</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Medium Range Min</Label>
                <Slider
                  min={0}
                  max={300}
                  step={10}
                  value={[distMediumMin]}
                  onValueChange={handleDistMediumMin}
                  onValueCommit={handleDistMediumMinCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{distMediumMin} cm</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Far Range Min</Label>
                <Slider
                  min={0}
                  max={500}
                  step={10}
                  value={[distFarMin]}
                  onValueChange={handleDistFarMin}
                  onValueCommit={handleDistFarMinCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{distFarMin} cm</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Far Range Max</Label>
                <Slider
                  min={0}
                  max={500}
                  step={10}
                  value={[distFarMax]}
                  onValueChange={handleDistFarMax}
                  onValueCommit={handleDistFarMaxCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{distFarMax} cm</span>
              </div>
            </CardContent>
          </Card>

          {/* Setpoints */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                <CardTitle>Pressure Setpoints</CardTitle>
              </div>
              <CardDescription>
                Target pressure values for each distance range (mV)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Close Range Setpoint</Label>
                <Slider
                  min={0}
                  max={3000}
                  step={50}
                  value={[setpointClose]}
                  onValueChange={handleSetpointClose}
                  onValueCommit={handleSetpointCloseCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{setpointClose} mV</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Medium Range Setpoint</Label>
                <Slider
                  min={0}
                  max={2000}
                  step={50}
                  value={[setpointMedium]}
                  onValueChange={handleSetpointMedium}
                  onValueCommit={handleSetpointMediumCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{setpointMedium} mV</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Security Offset (Far Range)</Label>
                <Slider
                  min={0}
                  max={200}
                  step={10}
                  value={[securityOffset]}
                  onValueChange={handleSecurityOffset}
                  onValueCommit={handleSecurityOffsetCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{securityOffset} mV</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: Safety & Control */}
        <TabsContent value="safety" className="space-y-4">
          {/* Safety Thresholds */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Safety Thresholds</CardTitle>
              </div>
              <CardDescription>
                Out-of-range handling and safety parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Safe Pressure Threshold</Label>
                <Slider
                  min={0}
                  max={2000}
                  step={50}
                  value={[safetyThreshold]}
                  onValueChange={handleSafetyThreshold}
                  onValueCommit={handleSafetyThresholdCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{safetyThreshold} mV</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Release Time</Label>
                <Slider
                  min={0}
                  max={2000}
                  step={100}
                  value={[releaseTime]}
                  onValueChange={handleReleaseTime}
                  onValueCommit={handleReleaseTimeCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{releaseTime} ms</span>
              </div>
            </CardContent>
          </Card>

          {/* PI Gains */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                <CardTitle>PI Controller Gains</CardTitle>
              </div>
              <CardDescription>
                Proportional and integral gains for all motors
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Proportional Gain (Kp)</Label>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={[piKp]}
                  onValueChange={handlePiKp}
                  onValueCommit={handlePiKpCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{piKp.toFixed(2)}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Integral Gain (Ki)</Label>
                <Slider
                  min={0}
                  max={2}
                  step={0.01}
                  value={[piKi]}
                  onValueChange={handlePiKi}
                  onValueCommit={handlePiKiCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{piKi.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Control Limits */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                <CardTitle>Control Limits</CardTitle>
              </div>
              <CardDescription>
                Duty cycle limits and minimum run threshold
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Maximum Duty Cycle</Label>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[dutyMax]}
                  onValueChange={handleDutyMax}
                  onValueCommit={handleDutyMaxCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{dutyMax}%</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Minimum Duty Cycle</Label>
                <Slider
                  min={-100}
                  max={0}
                  step={5}
                  value={[dutyMin]}
                  onValueChange={handleDutyMin}
                  onValueCommit={handleDutyMinCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{dutyMin}%</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Minimum Run Threshold</Label>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[minRun]}
                  onValueChange={handleMinRun}
                  onValueCommit={handleMinRunCommit}
                  disabled={!isConnected}
                />
                <span className="text-xs font-mono">{minRun}%</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
