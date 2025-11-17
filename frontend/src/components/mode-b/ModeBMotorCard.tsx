/**
 * Motor Card Component
 * Displays individual motor with its dedicated sector
 * Shows sector-specific information (angle range, distance, pressure, duty cycle)
 */

'use client';

import { memo, useMemo, useRef, useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Activity, Gauge, Zap, Ruler, Target } from 'lucide-react';
import {
  Card,
  CardContent,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

  // Memoize chart data transformation (updates at WebSocket rate ~50Hz)
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
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: sectorColor }}
            />
            <CardTitle className="text-base">Motor {motorNumber}</CardTitle>
            <Badge variant={isOnTarget ? 'default' : 'secondary'} className="text-xs">
              <Activity className="mr-1 h-2.5 w-2.5" />
              {isOnTarget ? 'On Target' : 'Adjusting'}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {sectorMin}° - {sectorMax}°
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Chart Legend */}
        <div className="flex items-center justify-end gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm border-2 border-dashed border-blue-500"></div>
            <span className="text-muted-foreground">Setpoint</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm bg-green-500"></div>
            <span className="text-muted-foreground">Actual</span>
          </div>
        </div>

        {/* Pressure Chart */}
        <div className="h-[180px] w-full">
          {chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart
                data={chartData}
                width={600}
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
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Waiting for data...
            </div>
          )}
        </div>

        {/* Compact Metrics with Icons and Tooltips */}
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-2">
            {/* Current Pressure */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted/50 transition-colors cursor-help">
                  <Gauge className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold">{currentPressure}</span>
                      <span className="text-xs text-muted-foreground">mV</span>
                    </div>
                    <Progress value={pressurePercent} className="h-1 mt-1" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold">Current Pressure</div>
                  <div>{currentPressure} mV / {currentSetpoint} mV</div>
                  <div className="text-muted-foreground">{pressurePercent.toFixed(1)}% of max</div>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* PWM Duty Cycle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted/50 transition-colors cursor-help">
                  <Zap className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold">
                        {currentDuty > 0 ? '+' : ''}{currentDuty.toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                    <Progress value={dutyPercent} className="h-1 mt-1" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold">PWM Duty Cycle</div>
                  <div>{currentDuty.toFixed(1)}%</div>
                  <div className="text-muted-foreground">Range: -100% to +100%</div>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* TOF Distance */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted/50 transition-colors cursor-help">
                  <Ruler className="h-4 w-4 text-purple-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-semibold">{currentDistance.toFixed(0)}</span>
                      <span className="text-xs text-muted-foreground">cm</span>
                    </div>
                    <div className={`text-xs font-medium mt-0.5 ${getRangeColor(currentRange)}`}>
                      {currentRange}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold">TOF Distance</div>
                  <div>{currentDistance.toFixed(1)} cm</div>
                  <div className={`font-medium ${getRangeColor(currentRange)}`}>{currentRange}</div>
                  <div className="text-muted-foreground mt-1">
                    CLOSE: 50-100cm<br/>
                    MEDIUM: 100-200cm<br/>
                    FAR: 200-300cm
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Tracking Error */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 hover:bg-muted/50 transition-colors cursor-help">
                  <Target className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-sm font-semibold ${
                          error < 50
                            ? 'text-green-600'
                            : error < 100
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {error.toFixed(0)}
                      </span>
                      <span className="text-xs text-muted-foreground">mV</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isOnTarget ? 'Good' : 'Adj.'}
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-xs">
                  <div className="font-semibold">Tracking Error</div>
                  <div>{error.toFixed(0)} mV</div>
                  <div className="text-muted-foreground">
                    Target: &lt;50mV<br/>
                    Status: {isOnTarget ? 'On Target ✓' : 'Adjusting...'}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
});
