'use client';

import { ArrowLeft, ChevronRight, Thermometer } from 'lucide-react';
import type { WinCCInstance } from '@/types/template';
import workspaceStyles from './MonitoringWorkspace.module.css';
import styles from './LadleMonitoringModeSelector.module.css';

interface LadleMonitoringModeSelectorProps {
  wincc: WinCCInstance;
  onBack: () => void;
  onSelectThermal: () => void;
}

export default function LadleMonitoringModeSelector({
  onBack,
  onSelectThermal,
}: LadleMonitoringModeSelectorProps) {
  return (
    <section className={styles.shell} aria-label="钢包监测功能选择">
      <div className={`${styles.topBar} ${workspaceStyles.topBar}`}>
        <div className={workspaceStyles.topBarInner}>
          <button type="button" className={styles.backButton} onClick={onBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            返回平台总览
          </button>
          <div className={styles.titleBlock}>
            <h2>钢包识别</h2>
          </div>
          <span className={styles.status}><i /> 系统运行中</span>
        </div>
      </div>

      <main className={`${styles.workspace} ${workspaceStyles.workspace}`}>
        <section className={styles.modePanel} aria-label="监测功能">
          <div className={styles.panelHeader}>
            <h3>监测功能</h3>
            <span>点击进入热成像监控</span>
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
          </div>
        </section>
      </main>
    </section>
  );
}
