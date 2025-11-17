/**
 * Motor Card Component
 * Displays individual motor with its dedicated sector
 * Shows sector-specific information (angle range, distance, pressure, duty cycle)
 */

'use client';

import { memo, useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
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
import { MotorData } from '@/lib/types';

interface ModeBMotorCardProps {
  motorNumber: number;
  sectorMin: number;
  sectorMax: number;
  sectorColor: string;
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

// Helper functions outside component to avoid recreating
const getRange = (distance: number) => {
  if (distance < 0) return 'UNKNOWN';
  if (distance >= 200 && distance <= 300) return 'FAR';
  if (distance >= 100 && distance < 200) return 'MEDIUM';
  if (distance >= 50 && distance < 100) return 'CLOSE';
  return 'OUT OF BOUNDS';
};

const getRangeColor = (range: string) => {
  switch (range) {
    case 'FAR': return 'text-blue-500';
    case 'MEDIUM': return 'text-yellow-500';
    case 'CLOSE': return 'text-red-500';
    default: return 'text-gray-500';
  }
};

export const ModeBMotorCard = memo(function ModeBMotorCard({
  motorNumber,
  sectorMin,
  sectorMax,
  sectorColor,
  dataHistory,
  currentData,
}: ModeBMotorCardProps) {
  // Extract motor-specific data keys
  const pressureKey = `pp${motorNumber}_mv` as keyof MotorData;
  const dutyKey = `duty${motorNumber}_pct` as keyof MotorData;
  const setpointKey = `sp${motorNumber}_mv` as keyof MotorData;
  const tofKey = `tof${motorNumber}_cm` as keyof MotorData;

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    return dataHistory.slice(-100).map((data) => ({
      time: data.time_ms,
      setpoint: data[setpointKey] as number,
      actual: data[pressureKey] as number,
    }));
  }, [dataHistory, pressureKey, setpointKey]);

  // Memoize current values and calculations
  const currentValues = useMemo(() => {
    const currentPressure = currentData ? (currentData[pressureKey] as number) : 0;
    const currentDuty = currentData ? (currentData[dutyKey] as number) : 0;
    const currentSetpoint = currentData ? (currentData[setpointKey] as number) : 0;
    const currentDistance = currentData ? (currentData[tofKey] as number) : 0;

    // Calculate percentages
    const pressurePercent = Math.min((currentPressure / 1200) * 100, 100);
    const dutyPercent = ((currentDuty + 100) / 200) * 100;

    // Calculate error and status
    const error = Math.abs(currentPressure - currentSetpoint);
    const isOnTarget = error < 50; // Within 50mV

    // Get range
    const currentRange = getRange(currentDistance);

    return {
      currentPressure,
      currentDuty,
      currentSetpoint,
      currentDistance,
      pressurePercent,
      dutyPercent,
      error,
      isOnTarget,
      currentRange,
    };
  }, [currentData, pressureKey, dutyKey, setpointKey, tofKey]);

  const {
    currentPressure,
    currentDuty,
    currentSetpoint,
    currentDistance,
    pressurePercent,
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
            <div
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: sectorColor }}
            />
            <CardTitle className="text-lg">Motor {motorNumber}</CardTitle>
            <Badge variant={isOnTarget ? 'default' : 'secondary'}>
              <Activity className="mr-1 h-3 w-3" />
              {isOnTarget ? 'On Target' : 'Adjusting'}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            Sector: {sectorMin}° - {sectorMax}°
          </div>
        </div>
        <CardDescription>
          Pressure: {currentPressure}mV / {currentSetpoint}mV
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
                domain={[0, 1200]}
                tickFormatter={(value) => `${value}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => `Time: ${(value / 1000).toFixed(1)}s`}
                    formatter={(value, name) => [`${value} mV`, name]}
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
        <div className="grid grid-cols-2 gap-4">
          {/* Current Pressure */}
          <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
            <div className="text-xs font-medium text-muted-foreground">
              Current Pressure
            </div>
            <div className="text-2xl font-bold">{currentPressure}</div>
            <div className="text-xs text-muted-foreground">mV</div>
            <Progress value={pressurePercent} className="h-1.5" />
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

        {/* Additional sector-specific metrics */}
        <div className="grid grid-cols-2 gap-4">
          {/* TOF Distance */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-muted-foreground">
              TOF Distance
            </span>
            <div className="flex flex-col items-end gap-1">
              <span className="text-lg font-bold">
                {currentDistance.toFixed(1)}
              </span>
              <span className="text-xs text-muted-foreground">cm</span>
              <span className={`text-xs font-semibold ${getRangeColor(currentRange)}`}>
                {currentRange}
              </span>
            </div>
          </div>

          {/* Tracking Error */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm font-medium text-muted-foreground">
              Tracking Error
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-bold ${
                  error < 50
                    ? 'text-green-600'
                    : error < 100
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {error.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">mV</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
