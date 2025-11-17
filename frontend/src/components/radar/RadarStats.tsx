/**
 * Radar Stats Component
 * Displays statistics and object detection information
 */

'use client';

import { memo, useMemo } from 'react';
import { MotorData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface RadarStatsProps {
  currentData: MotorData | null;
  motorHistory: {
    motor1: MotorData[];
    motor2: MotorData[];
    motor3: MotorData[];
    motor4: MotorData[];
  };
}

export const RadarStats = memo(function RadarStats({ currentData, motorHistory }: RadarStatsProps) {
  // Memoize all distance calculations
  const stats = useMemo(() => {
    // Calculate minimum distance across all sectors
    const distances = currentData
      ? [
          currentData.tof1_cm,
          currentData.tof2_cm,
          currentData.tof3_cm,
          currentData.tof4_cm,
        ]
      : [0, 0, 0, 0];

    const minDistance = Math.min(...distances.filter((d) => d > 0));
    const maxDistance = Math.max(...distances);
    const avgDistance =
      distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Count active detections (valid distances)
    const activeDetections = distances.filter((d) => d > 0 && d <= 300).length;

    // Get closest sector
    const closestSectorIndex = distances.indexOf(minDistance);
    const closestSectorRanges = [
      '0°-30°',
      '31°-60°',
      '61°-90°',
      '91°-120°',
    ];

    return {
      minDistance,
      maxDistance,
      avgDistance,
      activeDetections,
      closestSectorIndex,
      closestSectorRanges,
    };
  }, [currentData]);

  const {
    minDistance,
    maxDistance,
    avgDistance,
    activeDetections,
    closestSectorIndex,
    closestSectorRanges,
  } = stats;

  return (
    <>
      {/* Detection Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Detection Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active Detections</span>
              <span className="font-bold">{activeDetections}/4</span>
            </div>
            <Progress value={(activeDetections / 4) * 100} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Closest Object</span>
              <span className="font-mono font-bold">
                {minDistance < Infinity ? `${minDistance.toFixed(1)} cm` : 'N/A'}
              </span>
            </div>
            {minDistance < Infinity && (
              <div className="text-xs text-muted-foreground">
                Sector: {closestSectorRanges[closestSectorIndex]}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Average Distance</span>
              <span className="font-mono font-bold">
                {avgDistance.toFixed(1)} cm
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Farthest Object</span>
              <span className="font-mono font-bold">
                {maxDistance > 0 ? `${maxDistance.toFixed(1)} cm` : 'N/A'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">History Buffer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((motor) => {
            const motorKey = `motor${motor}` as keyof typeof motorHistory;
            const count = motorHistory[motorKey].length;
            return (
              <div key={motor} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Motor {motor}</span>
                  <span className="font-mono text-xs">{count}/25</span>
                </div>
                <Progress value={(count / 25) * 100} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* System Info */}
      {currentData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">System Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Runtime</span>
              <span className="font-mono">
                {(currentData.time_ms / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Update Rate</span>
              <span className="font-mono">50 Hz</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sweep Range</span>
              <span className="font-mono">0° - 120°</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Range</span>
              <span className="font-mono">300 cm</span>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
});
