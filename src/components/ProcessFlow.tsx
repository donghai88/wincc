'use client';

interface ProcessFlowProps {
  stages: {
    name: string;
    status: 'active' | 'idle' | 'error';
    value?: number;
  }[];
}

export default function ProcessFlow({ stages }: ProcessFlowProps) {
  const getGradient = (status: string) => {
    switch (status) {
      case 'active': return { start: '#00f5a0', end: '#00d9f5', bg: 'rgba(0,245,160,0.08)' };
      case 'error': return { start: '#f5515f', end: '#9f041b', bg: 'rgba(245,81,95,0.08)' };
      default: return { start: '#4a4a4a', end: '#3a3a3a', bg: 'rgba(255,255,255,0.02)' };
    }
  };

  return (
    <div className="relative py-3">
      {/* Base Connection Line */}
      <div className="absolute top-1/2 left-6 right-6 h-px bg-white/5 -translate-y-1/2" />

      {/* Animated Pulse Line */}
      <div className="absolute top-1/2 left-6 right-6 h-px -translate-y-1/2 overflow-hidden">
        <div
          className="h-full w-1/3"
          style={{
            background: 'linear-gradient(90deg, transparent, #00f5a0, #00d9f5, transparent)',
            animation: 'flowPulse 3s ease-in-out infinite',
          }}
        />
      </div>

      <div className="relative flex justify-between items-center px-2">
        {stages.map((stage, index) => {
          const gradient = getGradient(stage.status);
          const isActive = stage.status === 'active';

          return (
            <div
              key={stage.name}
              className="flex flex-col items-center relative"
            >
              {/* Glow Effect for Active */}
              {isActive && (
                <div
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full blur-xl opacity-30"
                  style={{ background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})` }}
                />
              )}

              {/* Node Container */}
              <div
                className="relative w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300"
                style={{
                  background: gradient.bg,
                  border: `1px solid ${isActive ? gradient.start + '40' : 'rgba(255,255,255,0.05)'}`,
                  boxShadow: isActive ? `0 0 20px ${gradient.start}20` : 'none',
                }}
              >
                {/* Value */}
                <span
                  className="text-sm font-mono font-medium"
                  style={{
                    background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {stage.value?.toFixed(0) ?? '—'}
                </span>

                {/* Pulse Ring for Active */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl"
                    style={{
                      border: `1px solid ${gradient.start}`,
                      animation: 'pulseRing 2s ease-out infinite',
                    }}
                  />
                )}

                {/* Status Indicator */}
                <div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${gradient.start}, ${gradient.end})`,
                    boxShadow: isActive ? `0 0 6px ${gradient.start}` : 'none',
                  }}
                />
              </div>

              {/* Label */}
              <span className="text-[11px] text-gray-500 mt-2 text-center tracking-wide">
                {stage.name}
              </span>

              {/* Connector Arrow (except last) */}
              {index < stages.length - 1 && (
                <div
                  className="absolute top-1/2 -right-4 -translate-y-1/2 text-gray-600 opacity-30"
                  style={{ fontSize: '8px' }}
                >
                  ▶
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes flowPulse {
          0% { transform: translateX(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateX(400%); opacity: 0; }
        }
        @keyframes pulseRing {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
