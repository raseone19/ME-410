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
  dataHistory: MotorData[];
  maxHistorySize: number;

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
const DEFAULT_MAX_HISTORY = 500; // Keep last 500 data points (10 seconds at 50Hz)

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  // Initial state
  status: ConnectionStatus.DISCONNECTED,
  error: null,
  isRecording: false,
  isPaused: false,
  shouldReconnect: true, // Auto-reconnect enabled by default
  currentData: null,
  dataHistory: [],
  maxHistorySize: DEFAULT_MAX_HISTORY,
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
              const { dataHistory, maxHistorySize } = get();

              // Add to history and maintain max size
              const updatedHistory = [...dataHistory, newData];
              if (updatedHistory.length > maxHistorySize) {
                updatedHistory.shift(); // Remove oldest
              }

              set({
                currentData: newData,
                dataHistory: updatedHistory,
                isRecording: message.isRecording,
              });
              break;

            case 'recording_status':
              set({ isRecording: message.isRecording });
              console.log(
                `📹 Recording ${message.isRecording ? 'started' : 'stopped'}`
              );
              break;

            case 'reset_complete':
              console.log('🔄 Simulation reset');
              set({ dataHistory: [], currentData: null });
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
    set({ dataHistory: [], currentData: null });
  },

  // Set maximum history size
  setMaxHistorySize: (size: number) => {
    set({ maxHistorySize: size });
  },
}));
