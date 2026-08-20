'use client';

import { ArrowLeft, ChevronRight, Radar, Thermometer } from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import workspaceStyles from './MonitoringWorkspace.module.css';
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
      <div className={`${styles.topBar} ${workspaceStyles.topBar}`}>
        <div className={workspaceStyles.topBarInner}>
          <button type="button" className={styles.backButton} onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            返回钢包列表
          </button>
          <div className={styles.titleBlock}>
            <h2>钢包识别</h2>
            <span>{wincc.location} · 功能选择</span>
          </div>
          <span className={styles.status}><i /> 系统运行中</span>
        </div>
      </div>

      <main className={`${styles.workspace} ${workspaceStyles.workspace}`}>
        <section className={styles.modePanel} aria-label="监测功能">
          <div className={styles.panelHeader}>
            <h3>监测功能</h3>
            <span>请选择一个功能继续</span>
          </div>
          <div className={styles.options}>
          <button type="button" className={`${styles.option} ${styles.thermal}`} onClick={onSelectThermal}>
            <div className={styles.sequence}>01</div>
            <div className={styles.icon}><Thermometer size={20} aria-hidden="true" /></div>
            <div className={styles.optionBody}>
              <h3>热成像监控</h3>
              <p>红外测温、包号识别与热图实时画面。</p>
              <span className={styles.capability}>设备：IR-01 / IR-02 / IR-03　·　25fps　·　640×512</span>
            </div>
            <span className={styles.enter}>进入 <ChevronRight size={17} aria-hidden="true" /></span>
          </button>

          <button type="button" className={`${styles.option} ${styles.radar}`} onClick={onSelectRadar}>
            <div className={styles.sequence}>02</div>
            <div className={styles.icon}><Radar size={20} aria-hidden="true" /></div>
            <div className={styles.optionBody}>
              <h3>雷达渣线检测</h3>
              <p>双雷达点云扫描、渣线深度与检测记录。</p>
              <span className={styles.capability}>设备：LR-01 / LR-02　·　360°覆盖　·　测距精度 ±10mm</span>
            </div>
            <span className={styles.enter}>进入 <ChevronRight size={17} aria-hidden="true" /></span>
          </button>
          </div>
        </section>
      </main>
    </section>
  );
}
