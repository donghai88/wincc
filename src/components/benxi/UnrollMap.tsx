'use client';

import { useEffect, useRef, useState } from 'react';
import { radarGeometry, radarZones } from '@/lib/benxi-ladle-rules';
import { AZ_BINS, H_BINS, depthRgb, diffRgb, type SlagDefect } from '@/lib/slag-analysis';

interface UnrollMapProps {
  grid: Float32Array | null;
  mode?: 'depth' | 'diff';
  defects?: SlagDefect[];
  activeDefectId?: number | null;
  onSelectDefect?: (id: number) => void;
  height?: number;
  showZones?: boolean;
  /** 差值图中绝对值低于该值的格子置灰（mm） */
  insignificantMm?: number;
}

const band = radarGeometry.slagBandTopMm - radarGeometry.slagBandBottomMm;

const markerPos = (defect: SlagDefect, width: number, height: number) => ({
  x: ((defect.azimuth ?? 0) / 360) * width,
  y: (1 - ((defect.height ?? 0) - radarGeometry.slagBandBottomMm) / band) * height,
});

export default function UnrollMap({
  grid,
  mode = 'depth',
  defects = [],
  activeDefectId = null,
  onSelectDefect,
  height = 210,
  showZones = true,
  insignificantMm = radarGeometry.repeatabilityMm * 2,
}: UnrollMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050a11';
    ctx.fillRect(0, 0, width, height);
    if (!grid) return;

    const source = document.createElement('canvas');
    source.width = AZ_BINS;
    source.height = H_BINS;
    const sourceCtx = source.getContext('2d');
    if (!sourceCtx) return;
    const image = sourceCtx.createImageData(AZ_BINS, H_BINS);
    for (let h = 0; h < H_BINS; h += 1) {
      for (let az = 0; az < AZ_BINS; az += 1) {
        const value = grid[h * AZ_BINS + az];
        const [r, g, b] = mode === 'diff'
          ? (Math.abs(value) < insignificantMm ? [58, 66, 82] : diffRgb(value))
          : depthRgb(value);
        const offset = ((H_BINS - 1 - h) * AZ_BINS + az) * 4;
        image.data[offset] = r;
        image.data[offset + 1] = g;
        image.data[offset + 2] = b;
        image.data[offset + 3] = 255;
      }
    }
    sourceCtx.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 0, 0, width, height);

    ctx.strokeStyle = 'rgba(232,240,250,.10)';
    ctx.lineWidth = 1;
    for (let deg = 0; deg <= 360; deg += 45) {
      const x = (deg / 360) * width;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let k = 1; k < 4; k += 1) {
      const y = (k / 4) * height;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    if (showZones) {
      ctx.font = '10px sans-serif';
      radarZones.forEach((zone, index) => {
        ctx.fillStyle = index === 0 ? 'rgba(34,211,238,.18)' : 'rgba(139,92,246,.14)';
        const from = (zone.from / 360) * width;
        const to = (zone.to / 360) * width;
        if (zone.to > zone.from) ctx.fillRect(from, 0, to - from, 14);
        else { ctx.fillRect(from, 0, width - from, 14); ctx.fillRect(0, 0, to, 14); }
        ctx.fillStyle = 'rgba(232,240,250,.78)';
        ctx.fillText(zone.name, zone.to > zone.from ? from + 4 : 4, 10);
      });
    }

    ctx.fillStyle = 'rgba(160,178,204,.9)';
    ctx.font = '10px sans-serif';
    for (let deg = 0; deg <= 360; deg += 45) {
      ctx.fillText(`${deg}°`, (deg / 360) * width + (deg === 0 ? 3 : deg === 360 ? -26 : -10), height - 5);
    }
    if (mode === 'depth') {
      ctx.fillText('渣线上沿', 3, 28);
      ctx.fillText('渣线下沿', 3, height - 18);
    }

    defects.forEach((defect) => {
      if (defect.azimuth === null || defect.height === null) return;
      const { x, y } = markerPos(defect, width, height);
      const active = defect.id === activeDefectId;
      ctx.beginPath();
      ctx.arc(x, y, active ? 13 : 10, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(34,211,238,.22)' : 'rgba(239,68,68,.18)';
      ctx.fill();
      ctx.strokeStyle = active ? '#22d3ee' : defect.level === 2 ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = active ? 2.4 : 1.6;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(defect.id), x, y + 3.5);
      ctx.textAlign = 'left';
    });
  }, [activeDefectId, defects, grid, height, insignificantMm, mode, showZones, width]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectDefect) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = defects
      .filter((defect) => defect.azimuth !== null)
      .map((defect) => {
        const pos = markerPos(defect, width, height);
        return { defect, distance: Math.hypot(pos.x - x, pos.y - y) };
      })
      .sort((a, b) => a.distance - b.distance)[0];
    if (hit && hit.distance <= 18) onSelectDefect(hit.defect.id);
  };

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <canvas ref={canvasRef} onClick={handleClick} style={{ cursor: onSelectDefect ? 'pointer' : 'default', width: '100%' }} />
    </div>
  );
}

export function ColorScale({ mode = 'depth' }: { mode?: 'depth' | 'diff' }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 180;
    canvas.height = 9;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    for (let x = 0; x < 180; x += 1) {
      const t = x / 180;
      const [r, g, b] = mode === 'diff' ? diffRgb(-40 + t * 120) : depthRgb(t * 200);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, 9);
    }
  }, [mode]);
  return <canvas ref={ref} />;
}
