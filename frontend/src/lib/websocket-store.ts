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
  isRecording: boolean;
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
  toggleRecording: () => void;
  togglePause: () => void;
  resetSimulation: () => void;
  clearHistory: () => void;
  setMaxHistorySize: (size: number) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const DEFAULT_MAX_HISTORY = 25; // Keep last 25 data points (0.5 seconds at 50Hz, 2.5 seconds at 10Hz)
const DEFAULT_MAX_SCAN_HISTORY = 180; // Keep 180 scan points (one for each degree from 0-180)

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  // Initial state
  status: ConnectionStatus.DISCONNECTED,
  error: null,
  isRecording: false,
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
  connect: (url: string = WS_URL) => {
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

    try {
      const ws = new WebSocket(url);

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
              set({ isRecording: message.isRecording });
              break;

            case 'data':
              const { isPaused } = get();

              // Skip processing if paused
              if (isPaused) {
                break;
              }

              const newData = message.payload;
              const { dataHistory, motorHistory, scanHistory, maxHistorySize, maxScanHistorySize } = get();

              // Add to shared history and maintain max size
              const updatedHistory = [...dataHistory, newData];
              if (updatedHistory.length > maxHistorySize) {
                updatedHistory.shift(); // Remove oldest
              }

              // Add to per-motor history and maintain max size
              const updatedMotorHistory = {
                motor1: [...motorHistory.motor1, newData],
                motor2: [...motorHistory.motor2, newData],
                motor3: [...motorHistory.motor3, newData],
                motor4: [...motorHistory.motor4, newData],
              };

              // Trim each motor history to max size
              if (updatedMotorHistory.motor1.length > maxHistorySize) {
                updatedMotorHistory.motor1.shift();
              }
              if (updatedMotorHistory.motor2.length > maxHistorySize) {
                updatedMotorHistory.motor2.shift();
              }
              if (updatedMotorHistory.motor3.length > maxHistorySize) {
                updatedMotorHistory.motor3.shift();
              }
              if (updatedMotorHistory.motor4.length > maxHistorySize) {
                updatedMotorHistory.motor4.shift();
              }

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

                const updatedScanHistory = [...scanHistory, scanPoint];

                // Trim scan history to max size
                if (updatedScanHistory.length > maxScanHistorySize) {
                  updatedScanHistory.shift();
                }

                set({
                  currentData: newData,
                  dataHistory: updatedHistory,
                  motorHistory: updatedMotorHistory,
                  scanHistory: updatedScanHistory,
                  isRecording: message.isRecording,
                });
              } else {
                set({
                  currentData: newData,
                  dataHistory: updatedHistory,
                  motorHistory: updatedMotorHistory,
                  isRecording: message.isRecording,
                });
              }
              break;

            case 'recording_status':
              set({ isRecording: message.isRecording });
              console.log(
                `📹 Recording ${message.isRecording ? 'started' : 'stopped'}`
              );
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
            get().connect(url);
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

  // Toggle recording state
  toggleRecording: () => {
    const { isRecording, sendMessage } = get();
    const newState = !isRecording;

    sendMessage({
      type: newState ? 'start_recording' : 'stop_recording',
    });
  },

  // Toggle pause state (stop processing incoming data)
  togglePause: () => {
    const { isPaused } = get();
    set({ isPaused: !isPaused });
    console.log(isPaused ? '▶️  Resumed' : '⏸️  Paused');
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
