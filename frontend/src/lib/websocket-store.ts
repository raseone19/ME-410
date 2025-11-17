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
  }; // Per-motor history (25 points each)
  scanHistory: RadarScanPoint[]; // Angle+distance pairs for radar visualization
  maxHistorySize: number;
  maxScanHistorySize: number;

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
  },
  scanHistory: [],
  maxHistorySize: DEFAULT_MAX_HISTORY,
  maxScanHistorySize: DEFAULT_MAX_SCAN_HISTORY,
  ws: null,

  // Connect to WebSocket server
  connect: (url?: string) => {
    const wsUrl = url || getWebSocketUrl();
    const { ws: existingWs, status } = get();

    // Don't reconnect if already connected or connecting
    if (
      existingWs &&
      (status === ConnectionStatus.CONNECTED ||
        status === ConnectionStatus.CONNECTING)
    ) {
      return;
    }

    set({ status: ConnectionStatus.CONNECTING, error: null, shouldReconnect: true });

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        set({ status: ConnectionStatus.CONNECTED, error: null });
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('📡 Server confirmed connection');
              break;

            case 'data':
              const { isPaused } = get();

              // Skip processing if paused
              if (isPaused) {
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
                });
              } else {
                set({
                  currentData: newData,
                  dataHistory: updatedHistory,
                  motorHistory: updatedMotorHistory,
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
        set({
          status: ConnectionStatus.ERROR,
          error: 'WebSocket connection error',
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
      },
      scanHistory: [],
      currentData: null,
    });
  },

  // Set maximum history size
  setMaxHistorySize: (size: number) => {
    set({ maxHistorySize: size });
  },
}));
