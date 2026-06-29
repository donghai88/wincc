'use client';

import { Video, Maximize2, Volume2, VolumeX, Circle, Scan } from 'lucide-react';
import { useState } from 'react';

interface CameraFeedProps {
  cameraId: string;
  cameraName: string;
  location: string;
  streamUrl?: string;
  status?: 'online' | 'offline' | 'connecting';
  size?: 'normal' | 'large';
}

export default function CameraFeed({
  cameraId,
  cameraName,
  location,
  streamUrl,
  status = 'online',
  size = 'normal',
}: CameraFeedProps) {
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const statusGradient = status === 'online'
    ? 'linear-gradient(135deg, #00f5a0, #00d9f5)'
    : status === 'connecting'
    ? 'linear-gradient(135deg, #f5a623, #f093fb)'
    : 'linear-gradient(135deg, #f5515f, #9f041b)';

  const statusColor = status === 'online'
    ? '#00f5a0'
    : status === 'connecting'
    ? '#f5a623'
    : '#f5515f';

  const statusText = status === 'online'
    ? '在线'
    : status === 'connecting'
    ? '连接中'
    : '离线';

  const minHeight = size === 'large' ? '280px' : '180px';

  return (
    <div
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(18,18,24,0.95), rgba(12,12,16,0.98))',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Top accent glow line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${statusColor}50 50%, transparent 100%)`,
        }}
      />

      {/* Camera Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `${statusColor}15`,
              border: `1px solid ${statusColor}30`,
            }}
          >
            <Video size={14} style={{ color: statusColor }} />
          </div>
          <div>
            <div className="text-xs text-white font-medium">{cameraName}</div>
            <div className="text-[10px] text-gray-500">{location}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Live Indicator */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'animate-pulse' : ''}`}
              style={{ background: statusGradient }}
            />
            <span className="text-[10px] text-gray-400">{statusText}</span>
          </div>
        </div>
      </div>

      {/* Video Container */}
      <div
        className="relative bg-black/40 flex items-center justify-center"
        style={{ minHeight, aspectRatio: '16/9' }}
      >
        {streamUrl ? (
          <video
            src={streamUrl}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          /* Placeholder with cyber effect */
          <div className="relative flex flex-col items-center gap-3 text-gray-600">
            {/* Scan line effect */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"
                style={{
                  animation: 'scanLine 3s linear infinite',
                }}
              />
            </div>

            {/* Corner decorations */}
            <div className="absolute top-3 left-3 w-4 h-4 border-l border-t border-white/20" />
            <div className="absolute top-3 right-3 w-4 h-4 border-r border-t border-white/20" />
            <div className="absolute bottom-12 left-3 w-4 h-4 border-l border-b border-white/20" />
            <div className="absolute bottom-12 right-3 w-4 h-4 border-r border-b border-white/20" />

            <Scan size={size === 'large' ? 48 : 36} strokeWidth={1} className="text-gray-600" />
            <span className="text-xs text-gray-500">等待视频信号</span>
            <span
              className="text-[10px] font-mono px-2 py-0.5 rounded"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#666',
              }}
            >
              {cameraId}
            </span>
          </div>
        )}

        {/* Overlay Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            {/* Timestamp */}
            <div
              className="text-[10px] font-mono px-2 py-1 rounded"
              style={{
                background: 'rgba(0,0,0,0.5)',
                color: statusColor,
              }}
            >
              {new Date().toLocaleString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {isMuted ? (
                  <VolumeX size={12} className="text-gray-500" />
                ) : (
                  <Volume2 size={12} style={{ color: statusColor }} />
                )}
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Maximize2 size={12} className="text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Recording Indicator */}
        {status === 'online' && (
          <div
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{
              background: 'rgba(245,81,95,0.15)',
              border: '1px solid rgba(245,81,95,0.3)',
            }}
          >
            <Circle size={5} fill="#f5515f" className="text-red-400 animate-pulse" />
            <span className="text-[10px] text-red-400 font-medium font-mono">REC</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scanLine {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
