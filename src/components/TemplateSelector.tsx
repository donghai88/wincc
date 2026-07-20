'use client';

import { LayoutGrid, Factory, Cpu, Gauge, Waves, Zap, type LucideIcon } from 'lucide-react';
import type { TemplateConfig } from '@/types/template';

interface TemplateSelectorProps {
  templates: TemplateConfig[];
  activeTemplate: string;
  onSelect: (id: string) => void;
}

const iconMap: Record<string, LucideIcon> = {
  'layout-grid': LayoutGrid,
  'factory': Factory,
  'cpu': Cpu,
  'gauge': Gauge,
  'waves': Waves,
  'zap': Zap,
};

export default function TemplateSelector({
  templates,
  activeTemplate,
  onSelect,
}: TemplateSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {templates.map((template) => {
        const Icon = iconMap[template.icon] || LayoutGrid;
        const isActive = template.id === activeTemplate;

        return (
          <button
            key={template.id}
            onClick={() => onSelect(template.id)}
            className="group relative overflow-hidden"
            title={template.description}
          >
            {/* Glow effect for active */}
            {isActive && (
              <div
                className="absolute inset-0 opacity-20 blur-lg"
                style={{ background: template.color }}
              />
            )}

            <div
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-xl
                transition-all duration-300
                ${isActive ? 'bg-white/10' : 'bg-white/[0.03] hover:bg-white/[0.06]'}
              `}
              style={{
                border: isActive
                  ? `1px solid ${template.color}40`
                  : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isActive ? `0 0 20px ${template.color}20` : 'none',
              }}
            >
              {/* Icon container */}
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300"
                style={{
                  background: isActive ? `${template.color}20` : 'transparent',
                }}
              >
                <Icon
                  size={14}
                  style={{
                    color: isActive ? template.color : '#6b7280',
                    filter: isActive ? `drop-shadow(0 0 4px ${template.color})` : 'none',
                  }}
                />
              </div>

              {/* Label */}
              <span
                className="text-xs font-medium tracking-wide transition-all duration-300"
                style={{
                  color: isActive ? '#fff' : '#6b7280',
                }}
              >
                {template.name}
              </span>

              {/* Active indicator dot */}
              {isActive && (
                <div
                  className="w-1.5 h-1.5 rounded-full ml-1 animate-pulse"
                  style={{
                    background: template.color,
                    boxShadow: `0 0 6px ${template.color}`,
                  }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
