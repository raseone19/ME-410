/**
 * MotorCard Component
 * Displays real-time data for a single motor including:
 * - Force chart (setpoint vs actual in Newtons)
 * - Current force gauge
 * - TOF distance with range classification
 * - PWM duty cycle gauge
 */

'use client';

import { memo, useMemo } from 'react';
import Link from 'next/link';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MotorData, getDistanceRange } from '@/lib/types';
import { millivoltsToNewtons } from '@/lib/utils';

interface MotorCardProps {
  motorNumber: 1 | 2 | 3 | 4;
  dataHistory: MotorData[];
  currentData: MotorData | null;
}

const chartConfig = {
  setpoint: {
    label: 'Setpoint',
    color: '#3b82f6', // Blue
  },
  actual: {
    label: 'Actual',
    color: '#10b981', // Green
  },
} satisfies ChartConfig;

// Helper function for range color (outside component to avoid recreating)
const getRangeColor = (range: string) => {
  switch (range) {
    case 'FAR': return 'text-blue-500';
    case 'MEDIUM': return 'text-yellow-500';
    case 'CLOSE': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

export const MotorCard = memo(function MotorCard({
  motorNumber,
  dataHistory,
  currentData,
}: MotorCardProps) {
  // Extract motor-specific data keys (these don't change)
  const pressureKey = `pp${motorNumber}_mv` as keyof MotorData;
  const dutyKey = `duty${motorNumber}_pct` as keyof MotorData;
  const setpointKey = `sp${motorNumber}_mv` as keyof MotorData;
  const tofKey = `tof${motorNumber}_cm` as keyof MotorData;

  // Memoize chart data transformation (only recalculate when dataHistory changes)
  // Convert pressure readings from mV to Newtons, setpoints are already in Newtons
  const chartData = useMemo(() => {
    const padIndex = motorNumber - 1; // Convert motor number (1-4) to pad index (0-3)
    return dataHistory.slice(-100).map((data) => ({
      time: data.time_ms,
      setpoint: data[setpointKey] as number, // Already in Newtons from ESP32
      actual: millivoltsToNewtons(padIndex, data[pressureKey] as number), // Convert mV to N
    }));
  }, [dataHistory, pressureKey, setpointKey, motorNumber]);

  // Memoize current values (only recalculate when currentData changes)
  // Convert pressure from mV to Newtons, setpoints are already in Newtons
  const currentValues = useMemo(() => {
    const padIndex = motorNumber - 1; // Convert motor number (1-4) to pad index (0-3)
    const currentPressureMv = currentData ? (currentData[pressureKey] as number) : 0;
    const currentForce = millivoltsToNewtons(padIndex, currentPressureMv); // Convert to Newtons
    const currentDuty = currentData ? (currentData[dutyKey] as number) : 0;
    const currentSetpoint = currentData ? (currentData[setpointKey] as number) : 0; // Already in Newtons
    const currentDistance = currentData ? (currentData[tofKey] as number) : 0;

    // Calculate percentages (max force ~15N for display purposes)
    const forcePercent = Math.min((currentForce / 15) * 100, 100);
    const dutyPercent = ((currentDuty + 100) / 200) * 100;

    // Calculate error and status (in Newtons)
    const error = Math.abs(currentForce - currentSetpoint);
    const isOnTarget = error < 0.5; // Within 0.5N

    // Get distance range
    const currentRange = getDistanceRange(currentDistance);

    return {
      currentForce,
      currentDuty,
      currentSetpoint,
      currentDistance,
      forcePercent,
      dutyPercent,
      error,
      isOnTarget,
      currentRange,
    };
  }, [currentData, pressureKey, dutyKey, setpointKey, tofKey, motorNumber]);

  const {
    currentForce,
    currentDuty,
    currentSetpoint,
    currentDistance,
    forcePercent,
    dutyPercent,
    error,
    isOnTarget,
    currentRange,
  } = currentValues;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Motor {motorNumber}</CardTitle>
            <Badge variant={isOnTarget ? 'default' : 'secondary'}>
              <Activity className="mr-1 h-3 w-3" />
              {isOnTarget ? 'On Target' : 'Adjusting'}
            </Badge>
          </div>
          <Link
            href={`/motor/${motorNumber}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <CardDescription>
          Force: {currentForce.toFixed(2)} N / {currentSetpoint.toFixed(2)} N
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Chart Legend */}
        <div className="flex items-center justify-end gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm border-2 border-dashed border-blue-500"></div>
            <span className="text-muted-foreground">Setpoint</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-green-500"></div>
            <span className="text-muted-foreground">Actual</span>
          </div>
        </div>

        {/* Pressure Chart */}
        <div className="h-[180px] w-full">
          <ChartContainer config={chartConfig} className="h-full w-full">
            <LineChart
              data={chartData}
              width={500}
              height={180}
              margin={{
                left: 12,
                right: 12,
                top: 5,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="time"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `${(value / 1000).toFixed(1)}s`}
                minTickGap={50}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                domain={[0, 15]}
                tickFormatter={(value) => `${value}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `Time: ${(value / 1000).toFixed(1)}s`}
                    formatter={(value, name) => [`${Number(value).toFixed(2)} N`, name]}
                  />
                }
              />
              <Line
                dataKey="setpoint"
                type="monotone"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Setpoint"
                isAnimationActive={false}
              />
              <Line
                dataKey="actual"
                type="monotone"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Actual"
                isAnimationActive={false}
              />
            </LineChart>
          </ChartContainer>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Current Force */}
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Current Force
            </div>
            <div className="text-2xl font-bold">{currentForce.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">N</div>
            <Progress value={forcePercent} className="h-1.5" />
          </div>

          {/* TOF Distance */}
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              TOF Distance
            </div>
            <div className="text-2xl font-bold">{currentDistance.toFixed(1)}</div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">cm</div>
              <div className={`text-xs font-semibold ${getRangeColor(currentRange)}`}>
                {currentRange}
              </div>
            </div>
          </div>

          {/* PWM Duty Cycle */}
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              PWM Duty Cycle
            </div>
            <div className="text-2xl font-bold">
              {currentDuty > 0 ? '+' : ''}
              {currentDuty.toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">%</div>
            <Progress value={dutyPercent} className="h-1.5" />
          </div>
        </div>

        {/* Error Display */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm font-medium text-muted-foreground">
            Tracking Error
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-bold ${
                error < 0.5
                  ? 'text-green-600'
                  : error < 1.0
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {error.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">N</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
