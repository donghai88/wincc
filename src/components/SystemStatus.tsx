'use client';

interface SystemStatusProps {
  systems: {
    name: string;
    status: 'online' | 'offline' | 'warning';
    load?: number;
  }[];
}

export default function SystemStatus({ systems }: SystemStatusProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'online':
        return {
          gradient: 'linear-gradient(135deg, #00f5a0, #00d9f5)',
          color: '#00f5a0',
          text: '运行中',
        };
      case 'warning':
        return {
          gradient: 'linear-gradient(135deg, #f5a623, #f093fb)',
          color: '#f5a623',
          text: '警告',
        };
      case 'offline':
        return {
          gradient: 'linear-gradient(135deg, #f5515f, #9f041b)',
          color: '#f5515f',
          text: '离线',
        };
      default:
        return {
          gradient: 'linear-gradient(135deg, #6b7280, #4b5563)',
          color: '#6b7280',
          text: '未知',
        };
    }
  };

  return (
    <div className="space-y-3">
      {systems.map((system) => {
        const style = getStatusStyle(system.status);
        return (
          <div
            key={system.name}
            className="relative flex items-center justify-between p-3 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            {/* Left accent */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5"
              style={{ background: style.gradient }}
            />

            <div className="flex items-center gap-3 pl-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: style.gradient,
                  boxShadow: `0 0 8px ${style.color}`,
                }}
              />
              <span className="text-xs text-gray-300">{system.name}</span>
            </div>

            <div className="flex items-center gap-4">
              {system.load !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        background: style.gradient,
                        width: `${system.load}%`,
                        boxShadow: `0 0 6px ${style.color}50`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono w-7 text-right">
                    {system.load}%
                  </span>
                </div>
              )}
              <span
                className="text-[10px] px-2 py-1 rounded-md font-medium"
                style={{
                  color: style.color,
                  background: `${style.color}15`,
                  border: `1px solid ${style.color}25`,
                }}
              >
                {style.text}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
