'use client';

import { useState, useEffect, useCallback } from 'react';

interface DataPoint {
  time: number;
  value: number;
}

export function useRealtimeData(
  baseValue: number,
  variance: number,
  interval: number = 1000,
  maxPoints: number = 30
) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [currentValue, setCurrentValue] = useState(baseValue);

  const generateValue = useCallback(() => {
    const change = (Math.random() - 0.5) * variance * 2;
    const newValue = Math.max(0, baseValue + change);
    return Math.round(newValue * 100) / 100;
  }, [baseValue, variance]);

  useEffect(() => {
    // Initialize with historical data
    const initialData: DataPoint[] = [];
    for (let i = maxPoints - 1; i >= 0; i--) {
      initialData.push({
        time: Date.now() - i * interval,
        value: generateValue(),
      });
    }
    setData(initialData);
    setCurrentValue(initialData[initialData.length - 1].value);

    const timer = setInterval(() => {
      const newValue = generateValue();
      setCurrentValue(newValue);
      setData((prev) => {
        const newData = [...prev, { time: Date.now(), value: newValue }];
        return newData.slice(-maxPoints);
      });
    }, interval);

    return () => clearInterval(timer);
  }, [generateValue, interval, maxPoints]);

  return { data, currentValue };
}

export function useSystemMetrics() {
  const { data: temperatureData, currentValue: temperature } = useRealtimeData(72, 8, 2000);
  const { data: pressureData, currentValue: pressure } = useRealtimeData(1.2, 0.3, 1500);
  const { data: flowRateData, currentValue: flowRate } = useRealtimeData(450, 50, 1800);
  const { data: powerData, currentValue: power } = useRealtimeData(85, 10, 2200);

  const [efficiency, setEfficiency] = useState(94.5);
  const [uptime, setUptime] = useState(99.97);

  useEffect(() => {
    const timer = setInterval(() => {
      setEfficiency((prev) => {
        const change = (Math.random() - 0.5) * 2;
        return Math.max(85, Math.min(100, prev + change));
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return {
    temperature: { data: temperatureData, current: temperature },
    pressure: { data: pressureData, current: pressure },
    flowRate: { data: flowRateData, current: flowRate },
    power: { data: powerData, current: power },
    efficiency,
    uptime,
  };
}
