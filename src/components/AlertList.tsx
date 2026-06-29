'use client';

import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

interface Alert {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  time: string;
}

interface AlertListProps {
  alerts: Alert[];
}

export default function AlertList({ alerts }: AlertListProps) {
  const getAlertStyle = (type: string) => {
    switch (type) {
      case 'success':
        return {
          gradient: 'linear-gradient(135deg, #00f5a0, #00d9f5)',
          color: '#00f5a0',
          bgColor: 'rgba(0,245,160,0.08)',
          borderColor: 'rgba(0,245,160,0.2)',
          icon: CheckCircle,
        };
      case 'warning':
        return {
          gradient: 'linear-gradient(135deg, #f5a623, #f093fb)',
          color: '#f5a623',
          bgColor: 'rgba(245,166,35,0.08)',
          borderColor: 'rgba(245,166,35,0.2)',
          icon: AlertTriangle,
        };
      case 'error':
        return {
          gradient: 'linear-gradient(135deg, #f5515f, #9f041b)',
          color: '#f5515f',
          bgColor: 'rgba(245,81,95,0.08)',
          borderColor: 'rgba(245,81,95,0.2)',
          icon: XCircle,
        };
      default:
        return {
          gradient: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
          color: '#60a5fa',
          bgColor: 'rgba(96,165,250,0.08)',
          borderColor: 'rgba(96,165,250,0.2)',
          icon: Info,
        };
    }
  };

  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
      {alerts.map((alert, index) => {
        const style = getAlertStyle(alert.type);
        const Icon = style.icon;

        return (
          <div
            key={alert.id}
            className="relative flex items-start gap-3 p-3 rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.01]"
            style={{
              background: style.bgColor,
              border: `1px solid ${style.borderColor}`,
            }}
          >
            {/* Left accent line */}
            <div
              className="absolute left-0 top-0 bottom-0 w-0.5"
              style={{ background: style.gradient }}
            />

            {/* Icon */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `${style.color}15`,
              }}
            >
              <Icon size={14} style={{ color: style.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-300 leading-relaxed">{alert.message}</p>
              <p className="text-[10px] text-gray-500 mt-1.5 font-mono">{alert.time}</p>
            </div>

            {/* Pulse indicator for recent alerts */}
            {index === 0 && (
              <div
                className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: style.gradient }}
              />
            )}
          </div>
        );
      })}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.02);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.15);
        }
      `}</style>
    </div>
  );
}
