'use client';

interface ControlPanelProps {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}

export default function ControlPanel({
  title,
  children,
  accentColor = '#00f5a0'
}: ControlPanelProps) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(18,18,24,0.95), rgba(12,12,16,0.98))',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${accentColor}50 50%, transparent 100%)`,
        }}
      />

      {/* Content */}
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-1 h-3.5 rounded-full"
            style={{
              background: `linear-gradient(180deg, ${accentColor}, ${accentColor}50)`,
              boxShadow: `0 0 8px ${accentColor}60`,
            }}
          />
          <h3
            className="text-xs font-medium tracking-[0.15em] uppercase"
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            {title}
          </h3>
        </div>

        {/* Children */}
        {children}
      </div>
    </div>
  );
}
