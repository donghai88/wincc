'use client';

import { useState } from 'react';

interface ToggleSwitchProps {
  label: string;
  defaultChecked?: boolean;
  color?: string;
  onChange?: (checked: boolean) => void;
}

export default function ToggleSwitch({
  label,
  defaultChecked = false,
  color = '#00f5a0',
  onChange,
}: ToggleSwitchProps) {
  const [checked, setChecked] = useState(defaultChecked);

  // Secondary color for gradient
  const colorMap: Record<string, string> = {
    '#00f5a0': '#00d9f5',
    '#60a5fa': '#a78bfa',
    '#f5a623': '#f093fb',
    '#f472b6': '#ec4899',
  };
  const secondaryColor = colorMap[color] || '#00d9f5';

  const handleToggle = () => {
    const newValue = !checked;
    setChecked(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <span className="text-xs text-gray-400">{label}</span>
      <button
        onClick={handleToggle}
        className="relative w-11 h-6 rounded-full transition-all duration-300"
        style={{
          background: checked
            ? `linear-gradient(135deg, ${color}, ${secondaryColor})`
            : 'rgba(255,255,255,0.08)',
          boxShadow: checked ? `0 0 16px ${color}50` : 'none',
          border: checked ? 'none' : '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Thumb */}
        <div
          className="absolute top-1 w-4 h-4 rounded-full shadow-lg transition-all duration-200 ease-out"
          style={{
            left: checked ? '1.5rem' : '0.25rem',
            background: checked ? '#fff' : 'rgba(255,255,255,0.6)',
            boxShadow: checked ? `0 0 8px ${color}80` : '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />

        {/* Glow effect when active */}
        {checked && (
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-sm"
            style={{ background: `linear-gradient(135deg, ${color}, ${secondaryColor})` }}
          />
        )}
      </button>
    </div>
  );
}
