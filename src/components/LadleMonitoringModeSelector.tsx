'use client';

import { ArrowLeft, ChevronRight, Radar, Thermometer } from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import styles from './LadleMonitoringModeSelector.module.css';

interface LadleMonitoringModeSelectorProps {
  wincc: WinCCInstance;
  onBack: () => void;
  onSelectThermal: () => void;
  onSelectRadar: () => void;
}

export default function LadleMonitoringModeSelector({
  wincc,
  onBack,
  onSelectThermal,
  onSelectRadar,
}: LadleMonitoringModeSelectorProps) {
  return (
    <section className={styles.shell} aria-label="钢包监测功能选择">
      <div className={styles.topBar}>
        <button type="button" className={styles.backButton} onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          返回钢包列表
        </button>
        <span className={styles.status}><i /> 系统运行中</span>
      </div>

      <div className={styles.content}>
        <div className={styles.heading}>
          <p>钢包智能监测</p>
          <h2>{wincc.name}</h2>
          <span>{wincc.location} · 请选择监测方式进入下钻分析</span>
        </div>

        <div className={styles.options}>
          <button type="button" className={`${styles.option} ${styles.thermal}`} onClick={onSelectThermal}>
            <div className={styles.icon}><Thermometer size={30} aria-hidden="true" /></div>
            <div className={styles.optionBody}>
              <span className={styles.eyebrow}>THERMAL IMAGING</span>
              <h3>热成像</h3>
              <p>进入红外测温、包号识别与实时热图监控页面。</p>
              <span className={styles.capability}>三路热像仪 · 25fps · 640×512</span>
            </div>
            <ChevronRight className={styles.arrow} size={24} aria-hidden="true" />
          </button>

          <button type="button" className={`${styles.option} ${styles.radar}`} onClick={onSelectRadar}>
            <div className={styles.icon}><Radar size={30} aria-hidden="true" /></div>
            <div className={styles.optionBody}>
              <span className={styles.eyebrow}>RADAR DETECTION</span>
              <h3>雷达探测</h3>
              <p>进入双雷达渣线检测、点云查看与侵蚀深度分析页面。</p>
              <span className={styles.capability}>RH-LR1540 × 2 · 360°覆盖 · ±10mm</span>
            </div>
            <ChevronRight className={styles.arrow} size={24} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
