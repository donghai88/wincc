'use client';

import { useEffect, useState, useRef, useId } from 'react';

interface DataPoint {
  time: number;
  value: number;
}

interface LiveChartProps {
  data: DataPoint[];
  label: string;
  unit: string;
  color?: string;
  height?: number;
}

export default function LiveChart({
  data,
  label,
  unit,
  color = '#00f5a0',
  height = 120,
}: LiveChartProps) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [height]);

  if (data.length === 0) {
    return <div className="w-full" style={{ height }} />;
  }

  const padding = { top: 12, right: 12, bottom: 28, left: 48 };
  const chartWidth = Math.max(0, dimensions.width - padding.left - padding.right);
  const chartHeight = Math.max(0, dimensions.height - padding.top - padding.bottom);

  const values = data.map((d) => d.value);
  const minValue = Math.min(...values) * 0.95;
  const maxValue = Math.max(...values) * 1.05;
  const valueRange = maxValue - minValue || 1;

  const xScale = (index: number) => (index / Math.max(1, data.length - 1)) * chartWidth;
  const yScale = (value: number) =>
    chartHeight - ((value - minValue) / valueRange) * chartHeight;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.value)}`)
    .join(' ');

  const areaPath = `${linePath} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

  const currentValue = data[data.length - 1]?.value ?? 0;

  // Generate unique IDs for SVG elements
  const gradientId = `chart-gradient-${id.replace(/:/g, '')}`;
  const glowFilterId = `chart-glow-${id.replace(/:/g, '')}`;
  const lineGradientId = `line-gradient-${id.replace(/:/g, '')}`;

  // Secondary color for gradient (shift hue slightly)
  const getSecondaryColor = (primaryColor: string) => {
    const colorMap: Record<string, string> = {
      '#00f5a0': '#00d9f5',
      '#60a5fa': '#a78bfa',
      '#f5a623': '#f093fb',
      '#f472b6': '#ec4899',
      '#00d4aa': '#00d9f5',
      '#fbbf24': '#f093fb',
    };
    return colorMap[primaryColor] || '#00d9f5';
  };

  const secondaryColor = getSecondaryColor(color);

  return (
    <div className="w-full" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {/* Label */}
        <div className="flex items-center gap-2">
          <div
            className="w-1 h-3 rounded-full"
            style={{
              background: `linear-gradient(180deg, ${color}, ${secondaryColor})`,
              boxShadow: `0 0 6px ${color}60`,
            }}
          />
          <span className="text-xs text-gray-400 tracking-wide">{label}</span>
        </div>

        {/* Current Value */}
        <div
          className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span
            className="text-lg font-light font-mono"
            style={{
              background: `linear-gradient(135deg, ${color}, ${secondaryColor})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {currentValue.toFixed(1)}
          </span>
          <span className="text-xs text-gray-500">{unit}</span>
        </div>
      </div>

      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="overflow-visible"
      >
        <defs>
          {/* Area gradient */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="50%" stopColor={color} stopOpacity="0.1" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>

          {/* Line gradient */}
          <linearGradient id={lineGradientId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>

          {/* Glow filter */}
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line
                x1={0}
                y1={chartHeight * tick}
                x2={chartWidth}
                y2={chartHeight * tick}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="2 6"
              />
              {tick % 0.5 === 0 && (
                <text
                  x={-10}
                  y={chartHeight * tick + 3}
                  textAnchor="end"
                  className="text-[10px] fill-gray-600 font-mono"
                >
                  {(maxValue - valueRange * tick).toFixed(0)}
                </text>
              )}
            </g>
          ))}

          {/* Vertical grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <line
              key={`v-${tick}`}
              x1={chartWidth * tick}
              y1={0}
              x2={chartWidth * tick}
              y2={chartHeight}
              stroke="rgba(255,255,255,0.03)"
            />
          ))}

          {/* Area Fill */}
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
          />

          {/* Glow Line (behind main line) */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.3}
            filter={`url(#${glowFilterId})`}
          />

          {/* Main Line with gradient */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${lineGradientId})`}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points (last 5) */}
          {data.slice(-5).map((d, i) => {
            const realIndex = data.length - 5 + i;
            if (realIndex < 0) return null;
            const isLast = i === 4 || realIndex === data.length - 1;
            return (
              <circle
                key={realIndex}
                cx={xScale(realIndex)}
                cy={yScale(d.value)}
                r={isLast ? 4 : 2}
                fill={isLast ? color : 'rgba(255,255,255,0.2)'}
                style={isLast ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}
              />
            );
          })}

          {/* Current Point Pulse Ring */}
          <circle
            cx={xScale(data.length - 1)}
            cy={yScale(currentValue)}
            r={8}
            fill="none"
            stroke={color}
            strokeWidth={1}
            opacity={0.4}
            className="animate-ping"
          />
        </g>
      </svg>

      <style jsx>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animate-ping {
          animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
      `}</style>
    </div>
  );
}
