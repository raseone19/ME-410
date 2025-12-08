/**
 * Potentiometer Panel Component
 * Displays live potentiometer settings:
 * - Pot 1: Force scale (0.6-1.0) and resulting setpoints
 * - Pot 2: Distance scale (0.5-1.5) and resulting thresholds
 */

'use client';

import { memo, useMemo } from 'react';
import { Sliders, Gauge, Ruler } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { MotorData } from '@/lib/types';

interface PotentiometerPanelProps {
  currentData: MotorData | null;
}

// Base setpoints at max (100% pot)
const BASE_SETPOINT_CLOSE = 100;
const BASE_SETPOINT_MEDIUM = 75;
const BASE_SETPOINT_FAR = 50;

export const PotentiometerPanel = memo(function PotentiometerPanel({
  currentData,
}: PotentiometerPanelProps) {
  const values = useMemo(() => {
    const forceScale = currentData?.force_scale ?? 1.0;
    const distanceScale = currentData?.distance_scale ?? 1.0;
    const distCloseMax = currentData?.dist_close_max ?? 100;
    const distMediumMax = currentData?.dist_medium_max ?? 200;
    const distFarMax = currentData?.dist_far_max ?? 300;

    // Calculate force percentages based on scale
    // pot 1 ranges from 0.6 to 1.0, so normalize to 0-100%
    const forcePercent = ((forceScale - 0.6) / 0.4) * 100;

    // Calculate distance percentages based on scale
    // pot 2 ranges from 0.5 to 1.5, so normalize to 0-100%
    const distancePercent = ((distanceScale - 0.5) / 1.0) * 100;

    // Calculate resulting setpoints
    const setpointClose = BASE_SETPOINT_CLOSE * forceScale;
    const setpointMedium = BASE_SETPOINT_MEDIUM * forceScale;
    const setpointFar = BASE_SETPOINT_FAR * forceScale;

    return {
      forceScale,
      distanceScale,
      forcePercent,
      distancePercent,
      distCloseMax,
      distMediumMax,
      distFarMax,
      setpointClose,
      setpointMedium,
      setpointFar,
    };
  }, [currentData]);

  const {
    forceScale,
    distanceScale,
    forcePercent,
    distancePercent,
    distCloseMax,
    distMediumMax,
    distFarMax,
    setpointClose,
    setpointMedium,
    setpointFar,
  } = values;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sliders className="h-4 w-4" />
          Potentiometer Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Potentiometer 1: Force Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Force Scale (Pot 1)</span>
            </div>
            <span className="text-sm font-bold">{(forceScale * 100).toFixed(0)}%</span>
          </div>
          <Progress value={forcePercent} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-red-500/10 p-1.5 text-center">
              <div className="font-semibold text-red-600">CLOSE</div>
              <div>{setpointClose.toFixed(0)}%</div>
            </div>
            <div className="rounded bg-yellow-500/10 p-1.5 text-center">
              <div className="font-semibold text-yellow-600">MEDIUM</div>
              <div>{setpointMedium.toFixed(0)}%</div>
            </div>
            <div className="rounded bg-blue-500/10 p-1.5 text-center">
              <div className="font-semibold text-blue-600">FAR</div>
              <div>{setpointFar.toFixed(0)}%</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Potentiometer 2: Distance Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Distance Scale (Pot 2)</span>
            </div>
            <span className="text-sm font-bold">{(distanceScale * 100).toFixed(0)}%</span>
          </div>
          <Progress value={distancePercent} className="h-2" />
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded bg-red-500/10 p-1.5 text-center">
              <div className="font-semibold text-red-600">CLOSE</div>
              <div>50-{distCloseMax.toFixed(0)}cm</div>
            </div>
            <div className="rounded bg-yellow-500/10 p-1.5 text-center">
              <div className="font-semibold text-yellow-600">MEDIUM</div>
              <div>{distCloseMax.toFixed(0)}-{distMediumMax.toFixed(0)}cm</div>
            </div>
            <div className="rounded bg-blue-500/10 p-1.5 text-center">
              <div className="font-semibold text-blue-600">FAR</div>
              <div>{distMediumMax.toFixed(0)}-{distFarMax.toFixed(0)}cm</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
