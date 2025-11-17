/**
 * Mini Motor Radar Component
 * Compact radar visualization for a single motor - shows only its sector
 * Same style as main radar: 0° = West (left), 90° = North (top), 180° = East (right)
 */

'use client';

import { MotorData, RadarScanPoint } from '@/lib/types';
import { useEffect, useRef, memo, useCallback } from 'react';

interface MiniMotorRadarProps {
  motorNumber: number;
  sectorMin: number | 'ERR';
  sectorMax: number | 'ERR';
  currentData: MotorData | null;
  scanHistory: RadarScanPoint[];
}

const MAX_DISTANCE = 300;

export const MiniMotorRadar = memo(function MiniMotorRadar({
  motorNumber,
  sectorMin,
  sectorMax,
  currentData,
  scanHistory,
}: MiniMotorRadarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameRef = useRef(0);

  // Use refs to store data without triggering effect recreation
  const currentDataRef = useRef(currentData);
  const scanHistoryRef = useRef(scanHistory);

  // Update refs when props change
  useEffect(() => {
    currentDataRef.current = currentData;
    scanHistoryRef.current = scanHistory;
  }, [currentData, scanHistory]);

  // Convert sensor angle to canvas coordinates (same as main radar)
  const angleToCanvas = useCallback((sensorAngle: number, distance: number, centerX: number, centerY: number, maxRadius: number) => {
    // Radar: 0° = West (left), 180° = East (right)
    // Flip the angle: 180 - sensorAngle
    const displayAngle = 180 - sensorAngle;
    const rad = (displayAngle * Math.PI) / 180;
    const r = (distance / MAX_DISTANCE) * maxRadius;

    return {
      x: centerX + r * Math.cos(rad),
      y: centerY - r * Math.sin(rad), // Subtract because canvas Y increases downward
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true
    });
    if (!ctx) return;

    // Set canvas size (compact but readable)
    const size = 300;
    canvas.width = size;
    canvas.height = Math.floor(size * 0.6); // Semicircle ratio

    const centerX = size / 2;
    const centerY = canvas.height - 10;
    const maxRadius = Math.min(size * 0.45, canvas.height - 20);

    // Animation loop
    const animate = (timestamp: number) => {
      // Throttle to ~60fps max
      if (timestamp - lastFrameRef.current < 16) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = timestamp;

      // Clear with solid black
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, size, canvas.height);

      // === BACKGROUND GRID ===
      ctx.save();

      // Range circles
      const ranges = [100, 200, 300];
      for (const range of ranges) {
        const r = (range / MAX_DISTANCE) * maxRadius;

        if (range === 300) {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
          ctx.lineWidth = 1;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, r, Math.PI, 0, false);
        ctx.stroke();

        // Range labels at top
        ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${range}cm`, centerX, centerY - r - 3);
      }

      // Radial lines every 10°
      for (let angle = 0; angle <= 180; angle += 10) {
        const displayAngle = 180 - angle;
        const rad = (displayAngle * Math.PI) / 180;

        if (angle % 30 === 0) {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
          ctx.lineWidth = 1;
        } else {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.08)';
          ctx.lineWidth = 0.5;
        }

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + maxRadius * Math.cos(rad),
          centerY - maxRadius * Math.sin(rad)
        );
        ctx.stroke();
      }

      // Sector boundaries for THIS motor - highlighted
      if (typeof sectorMin === 'number' && typeof sectorMax === 'number') {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);

        for (const angle of [sectorMin, sectorMax]) {
          const displayAngle = 180 - angle;
          const rad = (displayAngle * Math.PI) / 180;
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(
            centerX + maxRadius * Math.cos(rad),
            centerY - maxRadius * Math.sin(rad)
          );
          ctx.stroke();

          // Angle labels
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.font = 'bold 11px monospace';
          const labelR = maxRadius + 15;
          const x = centerX + labelR * Math.cos(rad);
          const y = centerY - labelR * Math.sin(rad);
          ctx.textAlign = 'center';
          ctx.fillText(`${angle}°`, x, y + 4);
        }
        ctx.setLineDash([]);
      } else {
        // Show error state
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CONFIG ERR', centerX, centerY - 20);
      }

      // Sector fill (highlight this motor's area) - only if valid config
      if (typeof sectorMin === 'number' && typeof sectorMax === 'number') {
        const minDisplayAngle = 180 - sectorMax;
        const maxDisplayAngle = 180 - sectorMin;
        const minRad = (minDisplayAngle * Math.PI) / 180;
        const maxRad = (maxDisplayAngle * Math.PI) / 180;

        ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, minRad, maxRad);
        ctx.lineTo(centerX, centerY);
        ctx.fill();
      }

      // Outer arc
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, Math.PI, 0, false);
      ctx.stroke();

      ctx.restore();

      // === HISTORY TRAILS (Filter to this motor's sector only) ===
      const currentScanHistory = scanHistoryRef.current;
      const sectorPoints = typeof sectorMin === 'number' && typeof sectorMax === 'number'
        ? currentScanHistory.filter((point) => point.angle >= sectorMin && point.angle <= sectorMax)
        : [];

      sectorPoints.forEach((point, idx) => {
        const dist = point.distance;
        const angle = point.angle;

        if (dist <= 0 || dist > MAX_DISTANCE) return;

        const pos = angleToCanvas(angle, dist, centerX, centerY, maxRadius);

        // Fade based on position in array (newer points brighter)
        const alpha = 0.15 + (idx / Math.max(sectorPoints.length, 1)) * 0.35;
        ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // === CURRENT DETECTION (Show when servo is in this motor's sector) ===
      const currentDataNow = currentDataRef.current;
      if (currentDataNow &&
          typeof sectorMin === 'number' && typeof sectorMax === 'number' &&
          currentDataNow.servo_angle >= sectorMin &&
          currentDataNow.servo_angle <= sectorMax) {
        const angle = currentDataNow.servo_angle;
        const dist = currentDataNow.tof_current_cm;

        if (dist > 0 && dist <= MAX_DISTANCE) {
          const pos = angleToCanvas(angle, dist, centerX, centerY, maxRadius);

          // Glow effect
          const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 15);
          glow.addColorStop(0, 'rgba(0, 255, 0, 0.8)');
          glow.addColorStop(1, 'rgba(0, 255, 0, 0)');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 15, 0, Math.PI * 2);
          ctx.fill();

          // Bright dot
          ctx.fillStyle = '#0f0';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // Center
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2);
          ctx.fill();

          // Distance label
          ctx.fillStyle = '#0f0';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${dist.toFixed(0)}cm`, pos.x + 8, pos.y - 6);
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.fillText(`${angle}°`, pos.x + 8, pos.y + 4);
        }
      }

      // === SCAN LINE (Show when servo is sweeping through this sector) ===
      if (currentDataNow &&
          typeof sectorMin === 'number' && typeof sectorMax === 'number' &&
          currentDataNow.servo_angle >= sectorMin &&
          currentDataNow.servo_angle <= sectorMax) {
        ctx.save();
        const scanDisplayAngle = 180 - currentDataNow.servo_angle;
        const scanRad = (scanDisplayAngle * Math.PI) / 180;

        const grad = ctx.createLinearGradient(
          centerX,
          centerY,
          centerX + maxRadius * Math.cos(scanRad),
          centerY - maxRadius * Math.sin(scanRad)
        );
        grad.addColorStop(0, 'rgba(0, 255, 0, 0)');
        grad.addColorStop(0.8, 'rgba(0, 255, 0, 0.4)');
        grad.addColorStop(1, 'rgba(0, 255, 0, 0.8)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + maxRadius * Math.cos(scanRad),
          centerY - maxRadius * Math.sin(scanRad)
        );
        ctx.stroke();
        ctx.restore();
      }

      // === CENTER POINT ===
      ctx.fillStyle = '#0f0';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate(0);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [motorNumber, sectorMin, sectorMax, angleToCanvas]);

  return (
    <div className="flex items-center justify-center w-full bg-black rounded-lg border border-border overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full"
        style={{
          imageRendering: 'crisp-edges',
          background: '#000'
        }}
      />
    </div>
  );
});
