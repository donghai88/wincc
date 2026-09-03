'use client';

import { AlertTriangle, LoaderCircle, Play, RotateCw, VideoOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isMockOnly } from '@/lib/api-config';
import {
  buildAuthenticatedStreamUrl,
  getMediaAccessToken,
  invalidateMediaAccessToken,
} from '@/lib/media-auth';

type PlayerStatus = 'connecting' | 'playing' | 'error' | 'unavailable' | 'mock';

interface ZlMediaKitFlvPlayerProps {
  active: boolean;
  flvUrl: string;
  wsFlvUrl: string;
  streamName: string;
}

type MpegtsPlayer = {
  attachMediaElement: (media: HTMLMediaElement) => void;
  load: () => void;
  play: () => Promise<void>;
  destroy: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
};

type MpegtsModule = {
  getFeatureList: () => { mseLivePlayback?: boolean };
  createPlayer: (
    mediaDataSource: Record<string, unknown>,
    config?: Record<string, unknown>,
  ) => MpegtsPlayer;
  Events: {
    ERROR: string;
  };
};

const pickFlvSource = (flvUrl: string, wsFlvUrl: string) => {
  // Doc uses HTTP(S)-FLV: .../xxx.live.flv?Bearer <token>
  // WS-FLV (.live.flv over websocket) returned 404 in field; keep as fallback only.
  if (flvUrl) return flvUrl;
  return wsFlvUrl;
};

export default function ZlMediaKitFlvPlayer({
  active,
  flvUrl,
  wsFlvUrl,
  streamName,
}: ZlMediaKitFlvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>(() => {
    if (!active || (!flvUrl && !wsFlvUrl)) return 'unavailable';
    return isMockOnly ? 'mock' : 'connecting';
  });
  const [message, setMessage] = useState('正在建立实时连接…');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const sourceUrl = pickFlvSource(flvUrl, wsFlvUrl);
    if (!active || !sourceUrl || isMockOnly) {
      return undefined;
    }

    let disposed = false;
    let player: MpegtsPlayer | null = null;
    const video = videoRef.current;

    const fail = (error: unknown) => {
      if (disposed) return;
      let detail = '实时流连接失败';
      if (error instanceof TypeError) {
        detail = '无法连接媒体服务（地址不可达、证书或跨域）';
      } else if (error instanceof Error && error.message) {
        detail = error.message;
      }
      setStatus('error');
      setMessage(detail);
    };

    const destroyPlayer = () => {
      if (!player) return;
      try {
        player.destroy();
      } catch {
        // ignore destroy races on unmount
      }
      player = null;
    };

    const onPlaying = () => {
      if (!disposed) {
        setStatus('playing');
        setMessage('实时播放中');
      }
    };

    if (video) {
      video.addEventListener('playing', onPlaying);
      video.addEventListener('loadeddata', onPlaying);
    }

    const start = async () => {
      try {
        setStatus('connecting');
        setMessage('正在建立实时连接…');

        const mpegts = (await import('mpegts.js')).default as unknown as MpegtsModule;
        if (disposed) return;

        if (!mpegts.getFeatureList().mseLivePlayback) {
          throw new Error('当前浏览器不支持 FLV 直播播放');
        }

        let token = await getMediaAccessToken();
        if (disposed) return;

        const createAndPlay = (accessToken: string) => {
          destroyPlayer();
          const playUrl = buildAuthenticatedStreamUrl(sourceUrl, accessToken);
          const nextPlayer = mpegts.createPlayer(
            {
              type: 'flv',
              isLive: true,
              url: playUrl,
              hasAudio: false,
              hasVideo: true,
            },
            {
              enableStashBuffer: false,
              stashInitialSize: 128,
              liveBufferLatencyChasing: true,
              autoCleanupSourceBuffer: true,
            },
          );

          nextPlayer.on(mpegts.Events.ERROR, (...args: unknown[]) => {
            const detail = args
              .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
              .filter(Boolean)
              .join(' / ');
            fail(new Error(detail || 'FLV 播放失败'));
          });

          if (!video) {
            throw new Error('视频节点未就绪');
          }

          nextPlayer.attachMediaElement(video);
          nextPlayer.load();
          void nextPlayer.play().catch(() => {
            // Autoplay may require a gesture; muted + playsInline usually allows it.
          });
          player = nextPlayer;
        };

        try {
          createAndPlay(token);
        } catch (error) {
          invalidateMediaAccessToken();
          token = await getMediaAccessToken({ forceRefresh: true });
          if (disposed) return;
          createAndPlay(token);
        }
      } catch (error) {
        fail(error);
      }
    };

    void start();

    return () => {
      disposed = true;
      if (video) {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('loadeddata', onPlaying);
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      }
      destroyPlayer();
    };
  }, [active, attempt, flvUrl, wsFlvUrl]);

  const hasSource = Boolean(flvUrl || wsFlvUrl);
  const displayStatus = active && hasSource ? (isMockOnly ? 'mock' : status) : 'unavailable';
  const displayMessage = active
    ? hasSource
      ? isMockOnly ? '演示预览' : message
      : '未配置实时流'
    : hasSource
      ? '监控已关闭'
      : '等待接入';
  const isPlaying = displayStatus === 'playing';
  const isError = displayStatus === 'error';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#020405', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', opacity: isPlaying ? 1 : 0 }}
        aria-label={`${streamName} 实时画面`}
      />

      {!isPlaying && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 8,
            padding: 16,
            color: isError ? 'var(--status-error)' : 'var(--text-secondary)',
            background: 'radial-gradient(circle at center, rgba(10, 132, 255, 0.1), transparent 62%)',
            textAlign: 'center',
          }}
        >
          {displayStatus === 'connecting' ? <LoaderCircle size={26} className="flv-player-spinner" /> : isError ? <AlertTriangle size={26} /> : <VideoOff size={26} />}
          <span style={{ fontSize: 12 }}>{displayMessage}</span>
          {isError && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 8px',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                borderRadius: 5,
                background: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-primary)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <RotateCw size={12} /> 重试
            </button>
          )}
        </div>
      )}

      {isPlaying && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 6px',
            borderRadius: 4,
            background: 'rgba(0, 0, 0, 0.52)',
            color: 'var(--status-online)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <Play size={10} fill="currentColor" /> 直播
        </div>
      )}

      <style jsx>{`
        .flv-player-spinner { animation: flvPlayerSpin 1s linear infinite; }
        @keyframes flvPlayerSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
