'use client';

import { AlertTriangle, LoaderCircle, Play, RotateCw, VideoOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isMockOnly } from '@/lib/api-config';

type PlayerStatus = 'connecting' | 'playing' | 'error' | 'unavailable' | 'mock';

interface ZlMediaKitWebRtcPlayerProps {
  active: boolean;
  streamUrl: string;
  streamName: string;
}

const waitForIceGatheringComplete = (peerConnection: RTCPeerConnection) => {
  if (peerConnection.iceGatheringState === 'complete') return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(finish, 1500);

    function finish() {
      window.clearTimeout(timeout);
      peerConnection.removeEventListener('icegatheringstatechange', onStateChange);
      resolve();
    }

    function onStateChange() {
      if (peerConnection.iceGatheringState === 'complete') finish();
    }

    peerConnection.addEventListener('icegatheringstatechange', onStateChange);
  });
};

const decodePossiblyEscapedText = (value: string) => (
  value.includes('\\u')
    ? value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    : value
);

const localizeMediaError = (rawMessage: string, code?: number) => {
  const message = decodePossiblyEscapedText(rawMessage).trim();
  const lower = message.toLowerCase();

  if (lower.includes('auth failed') || code === 1) {
    return '媒体鉴权失败，请确认播流地址已带授权信息';
  }
  if (lower.includes('not found') || lower.includes('no such stream') || (code === -400 && lower.includes('stream'))) {
    return '媒体流不存在或未推流';
  }
  if (message) return message;
  if (code !== undefined) return `媒体服务返回错误（${code}）`;
  return '实时流连接失败';
};

const getAnswerSdp = (body: string) => {
  const trimmedBody = body.trim();

  if (trimmedBody.startsWith('v=')) return trimmedBody;

  try {
    const payload = JSON.parse(trimmedBody) as { code?: number; msg?: string; data?: { sdp?: string }; sdp?: string };
    const sdp = payload.sdp ?? payload.data?.sdp;

    if (payload.code !== undefined && payload.code !== 0) {
      throw new Error(localizeMediaError(payload.msg || '', payload.code));
    }
    if (sdp) return sdp;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('媒体服务未返回有效应答');
    }
    throw error;
  }

  throw new Error('媒体应答中缺少视频描述');
};

export default function ZlMediaKitWebRtcPlayer({ active, streamUrl, streamName }: ZlMediaKitWebRtcPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<PlayerStatus>(() => {
    if (!active || !streamUrl) return 'unavailable';
    return isMockOnly ? 'mock' : 'connecting';
  });
  const [message, setMessage] = useState('正在建立实时连接…');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || !streamUrl || isMockOnly) {
      return undefined;
    }

    let disposed = false;
    const peerConnection = new RTCPeerConnection();
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

    const start = async () => {
      try {
        setStatus('connecting');
        setMessage('正在建立实时连接…');
        peerConnection.addTransceiver('video', { direction: 'recvonly' });
        peerConnection.addTransceiver('audio', { direction: 'recvonly' });

        peerConnection.addEventListener('track', (event) => {
          if (disposed || !video) return;

          const stream = event.streams[0] ?? new MediaStream([event.track]);
          video.srcObject = stream;
          void video.play().catch(() => {
            // The video stays muted; a manual gesture may still be required by a browser policy.
          });
        });

        peerConnection.addEventListener('connectionstatechange', () => {
          if (disposed) return;
          if (peerConnection.connectionState === 'failed') {
            fail(new Error('视频连接失败'));
          } else if (peerConnection.connectionState === 'disconnected') {
            setStatus('error');
            setMessage('视频连接已断开');
          }
        });

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        await waitForIceGatheringComplete(peerConnection);

        const response = await fetch(streamUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/sdp, text/plain, application/json',
            'Content-Type': 'text/plain;charset=UTF-8',
          },
          body: peerConnection.localDescription?.sdp,
        });

        const responseBody = await response.text();
        if (!response.ok) {
          throw new Error(`视频信令失败（${response.status}）`);
        }

        await peerConnection.setRemoteDescription({ type: 'answer', sdp: getAnswerSdp(responseBody) });
      } catch (error) {
        fail(error);
      }
    };

    if (video) {
      video.addEventListener('loadeddata', () => {
        if (!disposed) {
          setStatus('playing');
          setMessage('实时播放中');
        }
      }, { once: true });
    }

    void start();

    return () => {
      disposed = true;
      peerConnection.close();
      if (video) video.srcObject = null;
    };
  }, [active, attempt, streamUrl]);

  const displayStatus = active && streamUrl ? (isMockOnly ? 'mock' : status) : 'unavailable';
  const displayMessage = active
    ? streamUrl
      ? isMockOnly ? '演示预览' : message
      : '未配置实时流'
    : streamUrl
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
          {displayStatus === 'connecting' ? <LoaderCircle size={26} className="webrtc-player-spinner" /> : isError ? <AlertTriangle size={26} /> : <VideoOff size={26} />}
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
        .webrtc-player-spinner { animation: webrtcPlayerSpin 1s linear infinite; }
        @keyframes webrtcPlayerSpin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
