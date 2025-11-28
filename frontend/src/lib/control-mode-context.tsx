/**
 * Control Mode Context
 * Provides control mode information (Newtons vs Millivolts) to all components
 */

'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ControlModeInfo {
  mode: string;
  isNewtons: boolean;
  unit: string;
  unitLong: string;
  setpoints: {
    far: string | null;
    medium: string | null;
    close: string | null;
    safeThreshold: string | null;
    securityOffset: string | null;
  };
  loading: boolean;
}

const defaultControlMode: ControlModeInfo = {
  mode: 'UNKNOWN',
  isNewtons: true, // Default to Newtons for safety
  unit: 'N',
  unitLong: 'Newtons',
  setpoints: {
    far: null,
    medium: null,
    close: null,
    safeThreshold: null,
    securityOffset: null,
  },
  loading: true,
};

const ControlModeContext = createContext<ControlModeInfo>(defaultControlMode);

export function useControlMode() {
  return useContext(ControlModeContext);
}

interface ControlModeProviderProps {
  children: ReactNode;
}

export function ControlModeProvider({ children }: ControlModeProviderProps) {
  const [controlMode, setControlMode] = useState<ControlModeInfo>(defaultControlMode);

  useEffect(() => {
    const fetchControlMode = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (data.success && data.config?.system?.controlMode) {
          const cm = data.config.system.controlMode;
          const sp = data.config.system.setpoints || {};

          setControlMode({
            mode: cm.mode,
            isNewtons: cm.isNewtons,
            unit: cm.unit,
            unitLong: cm.unitLong,
            setpoints: {
              far: sp.far,
              medium: sp.medium,
              close: sp.close,
              safeThreshold: sp.safeThreshold,
              securityOffset: sp.securityOffset,
            },
            loading: false,
          });
        } else {
          setControlMode(prev => ({ ...prev, loading: false }));
        }
      } catch (error) {
        console.error('Error fetching control mode:', error);
        setControlMode(prev => ({ ...prev, loading: false }));
      }
    };

    fetchControlMode();
  }, []);

  return (
    <ControlModeContext.Provider value={controlMode}>
      {children}
    </ControlModeContext.Provider>
  );
}
