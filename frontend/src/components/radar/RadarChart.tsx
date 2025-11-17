/**
 * Radar Chart Component
 * Submarine-style radar visualization with green on black
 * 180° semicircle: West (0°) on left to East (180°) on right
 */

'use client';

import { MotorData, RadarScanPoint } from '@/lib/types';
import { useEffect, useRef, useCallback, memo } from 'react';

interface RadarChartProps {
  currentData: MotorData | null;
  motorHistory: {
    motor1: MotorData[];
    motor2: MotorData[];
    motor3: MotorData[];
    motor4: MotorData[];
  };
  scanHistory: RadarScanPoint[];
}

// Sector configuration (sensors cover 0-120° of the 180° display)
const SECTORS = [
  { motor: 1, minAngle: 0, maxAngle: 30, label: 'M1', color: '#00ff00' },
  { motor: 2, minAngle: 31, maxAngle: 60, label: 'M2', color: '#00ff00' },
  { motor: 3, minAngle: 61, maxAngle: 90, label: 'M3', color: '#00ff00' },
  { motor: 4, minAngle: 91, maxAngle: 120, label: 'M4', color: '#00ff00' },
];

const MAX_DISTANCE = 300;

export const RadarChart = memo(function RadarChart({ currentData, motorHistory, scanHistory }: RadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const lastFrameRef = useRef(0);

  // Use refs to store data without triggering effect recreation
  const currentDataRef = useRef(currentData);
  const motorHistoryRef = useRef(motorHistory);
  const scanHistoryRef = useRef(scanHistory);

  // Update refs when props change (doesn't trigger useEffect)
  useEffect(() => {
    currentDataRef.current = currentData;
    motorHistoryRef.current = motorHistory;
    scanHistoryRef.current = scanHistory;
  }, [currentData, motorHistory, scanHistory]);

  // Convert sensor angle to canvas coordinates
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

    // Set canvas size
    const container = canvas.parentElement;
    const width = container?.clientWidth ?? 800;
    const height = Math.floor(width * 0.55);

    canvas.width = width;
    canvas.height = height;

    const centerX = width / 2;
    const centerY = height - 20;
    const maxRadius = Math.min(width * 0.48, height - 40);

    // Animation loop with optimizations
    const animate = (timestamp: number) => {
      // Throttle to ~60fps max
      if (timestamp - lastFrameRef.current < 16) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameRef.current = timestamp;

      // Clear with solid black
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);

      // === BACKGROUND GRID ===
      ctx.save();

      // Range circles every 50cm - dartboard style
      const ranges = [50, 100, 150, 200, 250, 300];

      for (const range of ranges) {
        const r = (range / MAX_DISTANCE) * maxRadius;

        // Last one (300cm) is bolder
        if (range === 300) {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.6)';
          ctx.lineWidth = 3;
        } else {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.25)';
          ctx.lineWidth = 2;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, r, Math.PI, 0, false);
        ctx.stroke();

        // Range labels at top of each arc (90° position)
        if (range === 300) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.font = 'bold 13px monospace';
        } else {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
          ctx.font = 'bold 11px monospace';
        }
        // Position at top center of arc (90° = Math.PI/2)
        const labelX = centerX;
        const labelY = centerY - r - 5;
        ctx.textAlign = 'center';
        ctx.fillText(`${range}cm`, labelX, labelY);
      }
      ctx.textAlign = 'left'; // Reset text align

      // Radial lines every 10° with different styling
      for (let angle = 0; angle <= 180; angle += 10) {
        // Display angle: flip for 0° = West
        const displayAngle = 180 - angle;
        const rad = (displayAngle * Math.PI) / 180;

        // Thicker lines at major angles (every 30°)
        if (angle % 30 === 0) {
          ctx.strokeStyle = 'rgba(0, 255, 0, 0.25)';
          ctx.lineWidth = 1.5;
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

        // Angle labels at every 30°
        if (angle % 30 === 0) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
          ctx.font = 'bold 12px monospace';
          const labelR = maxRadius + 20;
          const x = centerX + labelR * Math.cos(rad);
          const y = centerY - labelR * Math.sin(rad);
          ctx.fillText(`${angle}°`, x - 12, y + 4);
        }
      }

      // Draw sector boundaries (motor divisions) - highlighted lines
      const sectorBoundaries = [0, 30, 60, 90, 120];
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);

      for (const angle of sectorBoundaries) {
        const displayAngle = 180 - angle;
        const rad = (displayAngle * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
          centerX + maxRadius * Math.cos(rad),
          centerY - maxRadius * Math.sin(rad)
        );
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Outer arc
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, Math.PI, 0, false);
      ctx.stroke();

      ctx.restore();

      // === HISTORY TRAILS (Angle-based scan points) ===
      const currentScanHistory = scanHistoryRef.current;
      currentScanHistory.forEach((point, idx) => {
        const dist = point.distance;
        const angle = point.angle;

        if (dist <= 0 || dist > MAX_DISTANCE) return;
        if (angle < 0 || angle > 180) return;

        const pos = angleToCanvas(angle, dist, centerX, centerY, maxRadius);

        // Fade based on age (older points are more transparent)
        const alpha = 0.15 + (idx / currentScanHistory.length) * 0.25;
        ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // === CURRENT DETECTION (Show live servo position and distance) ===
      const currentDataNow = currentDataRef.current;
      if (currentDataNow && currentDataNow.servo_angle >= 0 && currentDataNow.servo_angle <= 120) {
        const angle = currentDataNow.servo_angle;
        const dist = currentDataNow.tof_current_cm;  // Use live TOF reading at current servo angle

        if (dist > 0 && dist <= MAX_DISTANCE) {
          const pos = angleToCanvas(angle, dist, centerX, centerY, maxRadius);

          // Glow
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
          ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Center
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
          ctx.fill();

          // Label
          ctx.fillStyle = '#0f0';
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${dist.toFixed(0)}cm`, pos.x + 10, pos.y - 8);
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
          ctx.fillText(`${angle}°`, pos.x + 10, pos.y + 5);
        }
      }

      // === SCAN LINE (Synced with actual servo position) ===
      if (currentDataNow && currentDataNow.servo_angle >= 0 && currentDataNow.servo_angle <= 120) {
        ctx.save();
        const scanDisplayAngle = 180 - currentDataNow.servo_angle; // Flip for 0° = West
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
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
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
  }, [angleToCanvas]); // Only recreate animation loop on mount, not on data changes

  return (
    <div className="flex items-center justify-center w-full bg-black rounded-lg p-2">
      <canvas
        ref={canvasRef}
        className="max-w-full"
        style={{
          imageRendering: 'crisp-edges',
          background: '#000'
        }}
      />
    </div>
  );
});