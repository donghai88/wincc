'use client';

interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export default function ProgressRing({
  value,
  max,
  label,
  size = 100,
  strokeWidth = 6,
  color = '#00f5a0',
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min((value / max) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Secondary color for gradient
  const colorMap: Record<string, string> = {
    '#00f5a0': '#00d9f5',
    '#60a5fa': '#a78bfa',
    '#f5a623': '#f093fb',
    '#f472b6': '#ec4899',
  };
  const secondaryColor = colorMap[color] || '#00d9f5';

  const gradientId = `ring-gradient-${label.replace(/\s/g, '')}`;
  const glowId = `ring-glow-${label.replace(/\s/g, '')}`;

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={secondaryColor} />
            </linearGradient>
            <filter id={glowId}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={strokeWidth}
          />

          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter={`url(#${glowId})`}
            style={{
              transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-xl font-light font-mono"
            style={{
              background: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {percentage.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="flex items-center gap-1.5 mt-3">
        <div
          className="w-0.5 h-2.5 rounded-full"
          style={{ background: `linear-gradient(180deg, ${color}, ${secondaryColor})` }}
        />
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
    </div>
  );
}
