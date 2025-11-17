/**
 * Performance Monitor Component
 * Displays real-time performance metrics: FPS, render counts, latency, memory
 *
 * Usage: Add <PerformanceMonitor /> to any page during development
 */

'use client';

import { useEffect, useState, useRef, memo } from 'react';
import { Activity, Cpu, Clock, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useWebSocketStore } from '@/lib/websocket-store';

interface PerformanceMetrics {
  fps: number;
  renderCount: number;
  wsLatency: number;
  dataProcessingTime: number;
  memoryUsage: number;
  dataRate: number; // Messages per second
}

export const PerformanceMonitor = memo(function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    renderCount: 0,
    wsLatency: 0,
    dataProcessingTime: 0,
    memoryUsage: 0,
    dataRate: 0,
  });

  const [isVisible, setIsVisible] = useState(false); // Hidden by default
  const renderCountRef = useRef(0);
  const fpsFramesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef(performance.now());
  const messageCountRef = useRef(0);
  const lastMessageTimeRef = useRef(Date.now());
  const dataProcessingTimeRef = useRef(0);

  // Track WebSocket messages for latency and rate (using ref to avoid re-renders)
  const lastReceiveTimeRef = useRef(0);

  useEffect(() => {
    const unsubscribe = useWebSocketStore.subscribe((state) => {
      const currentData = state.currentData;

      if (currentData) {
        const now = performance.now();
        messageCountRef.current++;

        // Calculate latency between messages (not absolute time)
        const latency = lastReceiveTimeRef.current > 0
          ? now - lastReceiveTimeRef.current
          : 0;
        lastReceiveTimeRef.current = now;

        // Update metrics every second only
        const currentTime = Date.now();
        if (currentTime - lastMessageTimeRef.current >= 1000) {
          const dataRate = messageCountRef.current;
          messageCountRef.current = 0;
          lastMessageTimeRef.current = currentTime;

          setMetrics((prev) => ({
            ...prev,
            wsLatency: latency,
            dataRate,
            dataProcessingTime: 0, // Minimal since we're not doing heavy processing
          }));
        }
      }
    });

    return unsubscribe;
  }, []);

  // FPS Counter
  useEffect(() => {
    let frameId: number;
    let frameCount = 0;
    let lastFPSUpdate = performance.now();

    const measureFPS = (currentTime: number) => {
      frameCount++;

      // Update FPS display every second
      if (currentTime - lastFPSUpdate >= 1000) {
        const fps = Math.round(frameCount * 1000 / (currentTime - lastFPSUpdate));
        frameCount = 0;
        lastFPSUpdate = currentTime;

        setMetrics((prev) => ({ ...prev, fps }));
      }

      frameId = requestAnimationFrame(measureFPS);
    };

    frameId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Render Counter (update count on every render, but only setState periodically)
  renderCountRef.current++;

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => ({ ...prev, renderCount: renderCountRef.current }));
    }, 1000); // Update display once per second

    return () => clearInterval(interval);
  }, []);

  // Memory Usage (if available)
  useEffect(() => {
    const updateMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const usedMB = Math.round(memory.usedJSHeapSize / 1048576);
        setMetrics((prev) => ({ ...prev, memoryUsage: usedMB }));
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 1000);
    return () => clearInterval(interval);
  }, []);

  // Toggle visibility with keyboard shortcut (Ctrl+Shift+P)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="rounded-full bg-gray-800 p-2 text-white shadow-lg hover:bg-gray-700"
          title="Show Performance Monitor (Ctrl+Shift+P)"
        >
          <Activity className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-green-500';
    if (fps >= 45) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getLatencyColor = (latency: number) => {
    if (latency <= 50) return 'text-green-500';
    if (latency <= 100) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 shadow-2xl">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Performance Monitor
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
            title="Hide (Ctrl+Shift+P)"
          >
            Hide
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* FPS */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-muted-foreground">FPS</span>
            </div>
            <span className={`font-bold ${getFPSColor(metrics.fps)}`}>
              {metrics.fps}
            </span>
          </div>

          {/* Data Rate */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-muted-foreground">Data Rate</span>
            </div>
            <span className="font-bold">
              {metrics.dataRate} msg/s
            </span>
          </div>

          {/* Message Interval */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-muted-foreground">Msg Interval</span>
            </div>
            <span className={`font-bold ${getLatencyColor(metrics.wsLatency)}`}>
              {metrics.wsLatency.toFixed(1)}ms
            </span>
          </div>

          {/* Processing Time */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-green-500" />
              <span className="text-muted-foreground">Processing</span>
            </div>
            <span className="font-bold">
              {metrics.dataProcessingTime.toFixed(2)}ms
            </span>
          </div>

          {/* Memory Usage */}
          {metrics.memoryUsage > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-3.5 w-3.5 text-red-500" />
                <span className="text-muted-foreground">Memory</span>
              </div>
              <span className="font-bold">
                {metrics.memoryUsage} MB
              </span>
            </div>
          )}

          {/* Render Count */}
          <div className="flex items-center justify-between border-t pt-2">
            <span className="text-muted-foreground">Total Renders</span>
            <span className="font-mono">{metrics.renderCount}</span>
          </div>
        </div>

        {/* Performance Tips */}
        <div className="mt-3 border-t pt-2 text-xs">
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Target FPS:</span>
              <span className="text-green-500">≥ 55</span>
            </div>
            <div className="flex justify-between">
              <span>Target Interval:</span>
              <span className="text-green-500">~20ms</span>
            </div>
            <div className="flex justify-between">
              <span>Expected Rate:</span>
              <span>50 msg/s</span>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcut Hint */}
        <div className="mt-2 text-center text-xs text-muted-foreground">
          Press <kbd className="rounded bg-muted px-1">Ctrl+Shift+P</kbd> to toggle
        </div>
      </CardContent>
    </Card>
  );
});
