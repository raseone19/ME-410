/**
 * WebSocket Store
 * Manages WebSocket connection and real-time motor data using Zustand
 */

'use client';

import { create } from 'zustand';
import {
  MotorData,
  ConnectionStatus,
  WebSocketMessage,
  RadarScanPoint,
} from './types';

// Diagnostic metrics
export interface DiagnosticMetrics {
  // Connection metrics
  connectionAttempts: number;
  reconnectionCount: number;
  lastConnectedTime: number | null;
  connectionUptime: number; // ms

  // Data metrics
  totalPacketsReceived: number;
  packetsPerSecond: number;
  lastPacketTime: number | null;
  expectedFrequency: number; // Hz (50 for this system)
  actualFrequency: number; // Calculated Hz

  // Latency metrics
  latencyHistory: number[]; // Last 50 latency measurements
  averageLatency: number;
  minLatency: number;
  maxLatency: number;

  // Error tracking
  errorLog: ErrorLogEntry[];
  totalErrors: number;

  // Packet loss
  packetLossCount: number;
  packetLossPercentage: number;
}

export interface ErrorLogEntry {
  timestamp: number;
  type: 'connection' | 'data' | 'protocol' | 'other';
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface WebSocketStore {
  // Connection state
  status: ConnectionStatus;
  error: string | null;
  isPaused: boolean;
  shouldReconnect: boolean; // Flag to control auto-reconnect

  // Data state
  currentData: MotorData | null;
  dataHistory: MotorData[]; // Shared history for backward compatibility
  motorHistory: {
    motor1: MotorData[];
    motor2: MotorData[];
    motor3: MotorData[];
    motor4: MotorData[];
    motor5: MotorData[];
  }; // Per-motor history (25 points each)
  scanHistory: RadarScanPoint[]; // Angle+distance pairs for radar visualization
  maxHistorySize: number;
  maxScanHistorySize: number;

  // Diagnostic metrics
  diagnostics: DiagnosticMetrics;

  // WebSocket instance
  ws: WebSocket | null;

  // Actions
  connect: (url?: string) => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  togglePause: () => void;
  pauseTemporarily: (ms: number) => void;
  resetSimulation: () => void;
  clearHistory: () => void;
  setMaxHistorySize: (size: number) => void;
  addErrorLog: (entry: Omit<ErrorLogEntry, 'timestamp'>) => void;
  clearErrorLog: () => void;
}

// Generate WebSocket URL based on current hostname
// This allows the app to work on localhost, LAN, and remote networks
const getWebSocketUrl = (): string => {
  // If explicitly set in environment, use that
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }

  // In browser, use the current hostname
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;
    const port = '3001'; // WebSocket server port
    return `${protocol}//${hostname}:${port}`;
  }

  // Fallback for SSR (should not be used since connections happen client-side)
  return 'ws://localhost:3001';
};

const DEFAULT_MAX_HISTORY = 150; // Keep last 150 data points (3 seconds at 50Hz)
const DEFAULT_MAX_SCAN_HISTORY = 120; // Keep 120 scan points (sufficient for radar visualization)
const DEBUG_MODE = process.env.NODE_ENV === 'development'; // Only log in development

// Transition pause duration (ms) - pause data processing during page transitions/fullscreen
export const TRANSITION_PAUSE_MS = 250;

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  // Initial state
  status: ConnectionStatus.DISCONNECTED,
  error: null,
  isPaused: false,
  shouldReconnect: true, // Auto-reconnect enabled by default
  currentData: null,
  dataHistory: [],
  motorHistory: {
    motor1: [],
    motor2: [],
    motor3: [],
    motor4: [],
    motor5: [],
  },
  scanHistory: [],
  maxHistorySize: DEFAULT_MAX_HISTORY,
  maxScanHistorySize: DEFAULT_MAX_SCAN_HISTORY,
  ws: null,
  diagnostics: {
    connectionAttempts: 0,
    reconnectionCount: 0,
    lastConnectedTime: null,
    connectionUptime: 0,
    totalPacketsReceived: 0,
    packetsPerSecond: 0,
    lastPacketTime: null,
    expectedFrequency: 50,
    actualFrequency: 0,
    latencyHistory: [],
    averageLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    errorLog: [],
    totalErrors: 0,
    packetLossCount: 0,
    packetLossPercentage: 0,
  },

  // Connect to WebSocket server
  connect: (url?: string) => {
    const wsUrl = url || getWebSocketUrl();
    const { ws: existingWs, status, diagnostics } = get();

    // Don't reconnect if already connected or connecting
    if (
      existingWs &&
      (status === ConnectionStatus.CONNECTED ||
        status === ConnectionStatus.CONNECTING)
    ) {
      return;
    }

    // Track connection attempt
    const isReconnection = diagnostics.connectionAttempts > 0;
    set({
      status: ConnectionStatus.CONNECTING,
      error: null,
      shouldReconnect: true,
      diagnostics: {
        ...diagnostics,
        connectionAttempts: diagnostics.connectionAttempts + 1,
        reconnectionCount: isReconnection ? diagnostics.reconnectionCount + 1 : 0,
      }
    });

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        const now = Date.now();
        const { diagnostics } = get();
        set({
          status: ConnectionStatus.CONNECTED,
          error: null,
          diagnostics: {
            ...diagnostics,
            lastConnectedTime: now,
            connectionUptime: 0,
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('📡 Server confirmed connection');
              break;

            case 'data':
              const { isPaused, diagnostics: currentDiagnostics } = get();

              // Track packet metrics
              const now = Date.now();
              const timeSinceLastPacket = currentDiagnostics.lastPacketTime
                ? now - currentDiagnostics.lastPacketTime
                : 0;

              // Calculate latency (time between packets)
              const latency = timeSinceLastPacket;
              const updatedLatencyHistory = latency > 0 && latency < 1000
                ? [...currentDiagnostics.latencyHistory.slice(-49), latency]
                : currentDiagnostics.latencyHistory;

              const avgLatency = updatedLatencyHistory.length > 0
                ? updatedLatencyHistory.reduce((sum, l) => sum + l, 0) / updatedLatencyHistory.length
                : 0;

              const minLatency = updatedLatencyHistory.length > 0
                ? Math.min(...updatedLatencyHistory)
                : Infinity;

              const maxLatency = updatedLatencyHistory.length > 0
                ? Math.max(...updatedLatencyHistory)
                : 0;

              // Calculate actual frequency
              const actualFreq = latency > 0 ? 1000 / latency : 0;

              // Update connection uptime
              const uptime = currentDiagnostics.lastConnectedTime
                ? now - currentDiagnostics.lastConnectedTime
                : 0;

              // Update diagnostics
              const updatedDiagnostics = {
                ...currentDiagnostics,
                totalPacketsReceived: currentDiagnostics.totalPacketsReceived + 1,
                lastPacketTime: now,
                latencyHistory: updatedLatencyHistory,
                averageLatency: avgLatency,
                minLatency,
                maxLatency,
                actualFrequency: actualFreq,
                connectionUptime: uptime,
              };

              // Skip processing if paused
              if (isPaused) {
                set({ diagnostics: updatedDiagnostics });
                break;
              }

              const newData = message.payload;
              const { dataHistory, motorHistory, scanHistory, maxHistorySize, maxScanHistorySize } = get();

              // Optimized: slice from end if at capacity, then add new data
              const updatedHistory = dataHistory.length >= maxHistorySize
                ? [...dataHistory.slice(-maxHistorySize + 1), newData]
                : [...dataHistory, newData];

              // Optimized: Update motor history with slice instead of shift
              const updatedMotorHistory = {
                motor1: motorHistory.motor1.length >= maxHistorySize
                  ? [...motorHistory.motor1.slice(-maxHistorySize + 1), newData]
                  : [...motorHistory.motor1, newData],
                motor2: motorHistory.motor2.length >= maxHistorySize
                  ? [...motorHistory.motor2.slice(-maxHistorySize + 1), newData]
                  : [...motorHistory.motor2, newData],
                motor3: motorHistory.motor3.length >= maxHistorySize
                  ? [...motorHistory.motor3.slice(-maxHistorySize + 1), newData]
                  : [...motorHistory.motor3, newData],
                motor4: motorHistory.motor4.length >= maxHistorySize
                  ? [...motorHistory.motor4.slice(-maxHistorySize + 1), newData]
                  : [...motorHistory.motor4, newData],
                motor5: motorHistory.motor5.length >= maxHistorySize
                  ? [...motorHistory.motor5.slice(-maxHistorySize + 1), newData]
                  : [...motorHistory.motor5, newData],
              };

              // Add to scan history for radar visualization using live servo data
              const angle = newData.servo_angle;
              const currentDistance = newData.tof_current_cm;

              // Only add valid readings
              if (currentDistance > 0 && currentDistance <= 300 && angle >= 0 && angle <= 180) {
                const scanPoint: RadarScanPoint = {
                  angle: angle,
                  distance: currentDistance,
                  timestamp: newData.time_ms,
                };

                // Optimized: slice from end if at capacity
                const updatedScanHistory = scanHistory.length >= maxScanHistorySize
                  ? [...scanHistory.slice(-maxScanHistorySize + 1), scanPoint]
                  : [...scanHistory, scanPoint];

                set({
                  currentData: newData,
                  dataHistory: updatedHistory,
                  motorHistory: updatedMotorHistory,
                  scanHistory: updatedScanHistory,
                  diagnostics: updatedDiagnostics,
                });
              } else {
                set({
                  currentData: newData,
                  dataHistory: updatedHistory,
                  motorHistory: updatedMotorHistory,
                  diagnostics: updatedDiagnostics,
                });
              }
              break;

            case 'reset_complete':
              console.log('🔄 Simulation reset');
              set({
                dataHistory: [],
                motorHistory: {
                  motor1: [],
                  motor2: [],
                  motor3: [],
                  motor4: [],
                  motor5: [],
                },
                scanHistory: [],
                currentData: null,
              });
              break;

            case 'error':
              console.error('❌ Error from server:', message.message);
              break;

            case 'pong':
              // Heartbeat response
              break;

            default:
              console.warn('Unknown message type:', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        const { diagnostics } = get();
        const errorEntry: ErrorLogEntry = {
          timestamp: Date.now(),
          type: 'connection',
          message: 'WebSocket connection error',
          severity: 'error',
        };
        set({
          status: ConnectionStatus.ERROR,
          error: 'WebSocket connection error',
          diagnostics: {
            ...diagnostics,
            errorLog: [...diagnostics.errorLog.slice(-99), errorEntry],
            totalErrors: diagnostics.totalErrors + 1,
          }
        });
      };

      ws.onclose = () => {
        console.log('👋 WebSocket disconnected');
        set({
          status: ConnectionStatus.DISCONNECTED,
          ws: null,
        });

        // Auto-reconnect after 3 seconds (only if not manually disconnected)
        setTimeout(() => {
          const { status, shouldReconnect } = get();
          if (status === ConnectionStatus.DISCONNECTED && shouldReconnect) {
            console.log('🔄 Attempting to reconnect...');
            get().connect(wsUrl);
          }
        }, 3000);
      };

      set({ ws });
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      set({
        status: ConnectionStatus.ERROR,
        error: 'Failed to create WebSocket connection',
      });
    }
  },

  // Disconnect from WebSocket server
  disconnect: () => {
    const { ws } = get();
    if (ws) {
      // Set shouldReconnect to false to prevent auto-reconnect
      set({ shouldReconnect: false });
      ws.close();
      set({
        ws: null,
        status: ConnectionStatus.DISCONNECTED,
        currentData: null,
      });
    }
  },

  // Send message to server
  sendMessage: (message: any) => {
    const { ws, status } = get();
    if (ws && status === ConnectionStatus.CONNECTED) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  },

  // Toggle pause state (stop processing incoming data)
  togglePause: () => {
    const { isPaused } = get();
    set({ isPaused: !isPaused });
    console.log(isPaused ? '▶️  Resumed' : '⏸️  Paused');
  },

  // Temporarily pause data processing (for transitions)
  pauseTemporarily: (ms: number) => {
    const wasAlreadyPaused = get().isPaused;

    // Always pause during transition
    set({ isPaused: true });

    // Only auto-resume if user didn't manually pause
    setTimeout(() => {
      if (!wasAlreadyPaused) {
        set({ isPaused: false });
      }
    }, ms);
  },

  // Reset simulation
  resetSimulation: () => {
    get().sendMessage({ type: 'reset' });
  },

  // Clear data history
  clearHistory: () => {
    set({
      dataHistory: [],
      motorHistory: {
        motor1: [],
        motor2: [],
        motor3: [],
        motor4: [],
        motor5: [],
      },
      scanHistory: [],
      currentData: null,
    });
  },

  // Set maximum history size
  setMaxHistorySize: (size: number) => {
    set({ maxHistorySize: size });
  },

  // Add error log entry
  addErrorLog: (entry: Omit<ErrorLogEntry, 'timestamp'>) => {
    const { diagnostics } = get();
    const errorEntry: ErrorLogEntry = {
      ...entry,
      timestamp: Date.now(),
    };
    set({
      diagnostics: {
        ...diagnostics,
        errorLog: [...diagnostics.errorLog.slice(-99), errorEntry],
        totalErrors: diagnostics.totalErrors + 1,
      }
    });
  },

  // Clear error log
  clearErrorLog: () => {
    const { diagnostics } = get();
    set({
      diagnostics: {
        ...diagnostics,
        errorLog: [],
        totalErrors: 0,
      }
    });
  },
}));
