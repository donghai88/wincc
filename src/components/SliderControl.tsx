'use client';

import { useState } from 'react';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color?: string;
  onChange?: (value: number) => void;
}

export default function SliderControl({
  label,
  value,
  min,
  max,
  unit,
  color = '#00f5a0',
  onChange,
}: SliderControlProps) {
  const [localValue, setLocalValue] = useState(value);
  const percentage = ((localValue - min) / (max - min)) * 100;

  // Secondary color for gradient
  const colorMap: Record<string, string> = {
    '#00f5a0': '#00d9f5',
    '#60a5fa': '#a78bfa',
    '#f5a623': '#f093fb',
    '#f472b6': '#ec4899',
  };
  const secondaryColor = colorMap[color] || '#00d9f5';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    setLocalValue(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="py-4 border-b border-white/5 last:border-0 first:pt-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-0.5 h-3 rounded-full"
            style={{ background: `linear-gradient(180deg, ${color}, ${secondaryColor})` }}
          />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
        <div
          className="flex items-baseline gap-1.5 px-2.5 py-1 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span
            className="text-sm font-mono font-medium"
            style={{
              background: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {localValue.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-500">{unit}</span>
        </div>
      </div>

      <div className="relative h-6 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 bg-white/5 rounded-full overflow-hidden">
          {/* Progress fill */}
          <div
            className="h-full rounded-full transition-all duration-150 ease-out"
            style={{
              background: `linear-gradient(90deg, ${color}, ${secondaryColor})`,
              width: `${percentage}%`,
              boxShadow: `0 0 10px ${color}50`,
            }}
          />
        </div>

        {/* Hidden range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={localValue}
          onChange={handleChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        {/* Custom Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full pointer-events-none transition-all duration-150 ease-out"
          style={{
            left: `calc(${percentage}% - 8px)`,
            background: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
            boxShadow: `0 0 12px ${color}80, 0 2px 4px rgba(0,0,0,0.3)`,
          }}
        >
          {/* Inner dot */}
          <div className="absolute inset-1 bg-white/90 rounded-full" />
        </div>
      </div>

      {/* Min/Max labels */}
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-gray-600 font-mono">{min}</span>
        <span className="text-[10px] text-gray-600 font-mono">{max}</span>
      </div>
    </div>
  );
}
