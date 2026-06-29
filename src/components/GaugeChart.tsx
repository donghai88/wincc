'use client';

import { useEffect, useState } from 'react';

interface GaugeChartProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  status?: 'normal' | 'warning' | 'danger';
}

export default function GaugeChart({ value, max, label, unit, status = 'normal' }: GaugeChartProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const getGradient = () => {
    switch (status) {
      case 'warning': return { start: '#f5a623', end: '#f093fb', glow: 'rgba(245,166,35,0.5)' };
      case 'danger': return { start: '#f5515f', end: '#9f041b', glow: 'rgba(245,81,95,0.5)' };
      default: return { start: '#00f5a0', end: '#00d9f5', glow: 'rgba(0,245,160,0.5)' };
    }
  };

  const gradient = getGradient();
  const gradientId = `gauge-gradient-${label.replace(/\s/g, '')}`;

  // SVG arc calculations
  const size = 100;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      {/* Gauge SVG */}
      <div className="relative" style={{ width: size, height: size / 2 + 16 }}>
        <svg
          width={size}
          height={size / 2 + 16}
          viewBox={`0 0 ${size} ${size / 2 + 16}`}
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradient.start} />
              <stop offset="100%" stopColor={gradient.end} />
            </linearGradient>
            <filter id={`glow-${label.replace(/\s/g, '')}`}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Background Arc */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Progress Arc */}
          <path
            d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter={`url(#glow-${label.replace(/\s/g, '')})`}
            style={{
              transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = Math.PI - (tick / 100) * Math.PI;
            const innerR = radius - strokeWidth - 2;
            const outerR = radius - strokeWidth + 1;
            const x1 = size / 2 + innerR * Math.cos(angle);
            const y1 = size / 2 - innerR * Math.sin(angle);
            const x2 = size / 2 + outerR * Math.cos(angle);
            const y2 = size / 2 - outerR * Math.sin(angle);
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="1"
              />
            );
          })}
        </svg>

        {/* Value Display */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
          <span
            className="text-xl font-light font-mono"
            style={{
              background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {displayValue.toFixed(1)}
          </span>
          <span className="text-xs text-gray-500 ml-1">{unit}</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-xs text-gray-500 mt-2 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
