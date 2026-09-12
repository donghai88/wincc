'use client';

import { BookOpen } from 'lucide-react';
import styles from './LadleManagement.module.css';
import manualStyles from './LadleUserManual.module.css';

interface ManualSection {
  id: string;
  title: string;
  intro?: string;
  items: Array<{ label: string; desc: string }>;
}

const sections: ManualSection[] = [
  {
    id: 'overview',
    title: '系统概述',
    intro: '钢包监测系统由西安豪克电子有限公司提供，用于热修位钢包的红外测温与包号识别，帮助现场人员实时掌握钢包状态、查询历史数据并处理报警。',
    items: [
      { label: '适用场景', desc: '热修位钢包监测现场：四路红外测温、包号识别、历史查询与报警处理。' },
      { label: '主要能力', desc: '四路红外实时测温（设备 ID 由现场实时推送，可动态变更）、包号识别展示、历史数据查询与导出、温度曲线分析、报警处理、钢包档案管理。' },
      { label: '侧边栏导航', desc: '左侧一级菜单：监控总览、实时监控、数据查询、曲线分析、报警管理、钢包管理、使用手册。' },
    ],
  },
  {
    id: 'entry',
    title: '登录与进入系统',
    items: [
      { label: '登录', desc: '打开系统地址，在登录页输入账号密码后进入钢包监测系统。' },
      { label: '监控总览', desc: '登录后默认进入监控总览，可从卡片进入钢包识别相关功能。' },
      { label: '业务菜单', desc: '也可直接点击左侧「实时监控 / 数据查询 / 曲线分析 / 报警管理 / 钢包管理」进入对应页面。' },
      { label: '返回', desc: '实时监控等页面顶部提供返回入口，可回到上一层功能选择或总览（以当前页面按钮为准）。' },
    ],
  },
  {
    id: 'monitor',
    title: '实时监控',
    intro: '查看四路热像仪状态、红外画面、实时温度与最近测温截图；设备离线时可在对应画面标题栏重连。',
    items: [
      { label: '设备状态总览', desc: '顶部固定 4 路 HHW-TN460D-ACS 工位槽。设备名称以实时推送的 deviceId 为准（如南1_1），改名后界面会自动跟随。' },
      { label: '当前识别包号', desc: '中部横条显示当前识别到的钢包号、识别状态，以及今日识别次数等信息。' },
      { label: '四路红外实时监控', desc: '按 4 路 HHW-TN460D-ACS 展示红外画面与叠加温度；标题中的设备 ID 来自实时推送。下方卡片给出最高温、平均温、最低温。' },
      { label: '在线判定', desc: '依据实时推送的最高温 / 平均温 / 最低温：任一为负数或空值时判定为离线（上游热像仪掉线），该路画面停止播放。' },
      { label: '设备重连', desc: '某路离线时，在该路画面标题栏「离线」左侧出现「重连」按钮，点击后调用 /ladle/modbus/reconnect/{当前设备ID}，并重新拉取播流。' },
      { label: '测温截图', desc: '展示最近一次测温截图（按热像仪路数），含温度与记录时间；图片来自接口返回的截图路径。' },
    ],
  },
  {
    id: 'query',
    title: '数据查询',
    intro: '按条件检索历史温度记录，支持分页浏览、导出及查看明细。',
    items: [
      { label: '查询条件', desc: '可按钢包号、设备、开始时间与结束时间筛选，点击「查询」刷新结果。' },
      { label: '结果列表', desc: '表格展示钢包号、设备名、最高温 / 最低温 / 平均温及记录时间。' },
      { label: '查看明细', desc: '点击行内操作可查看该次记录对应设备温度明细。' },
      { label: '分页', desc: '列表底部「上一页 / 下一页」切换分页。' },
      { label: '导出数据', desc: '点击「导出数据」，按当前筛选条件下载或触发服务端导出。' },
    ],
  },
  {
    id: 'curves',
    title: '曲线分析',
    intro: '查看单个钢包在指定时间范围内的温度变化趋势。',
    items: [
      { label: '筛选条件', desc: '选择钢包编号、开始时间与结束时间，条件变更后加载曲线。' },
      { label: '指标卡片', desc: '顶部展示当前最高温、周期峰值、平均温度及关联钢包号。' },
      { label: '趋势图', desc: '折线图同时显示最高温度、平均温度、最低温度三条曲线。' },
      { label: '刷新', desc: '点击「刷新」手动重新加载数据。' },
    ],
  },
  {
    id: 'alarms',
    title: '报警管理',
    intro: '查询与处理钢包相关温度报警；侧栏「报警管理」上的红色数字表示未读报警数量。',
    items: [
      { label: '筛选条件', desc: '可按钢包号、报警等级、已读状态筛选，点击「查询」应用条件。' },
      { label: '报警列表', desc: '表格展示钢包号、设备、规则类型、等级、温度、发生时间与已读状态。' },
      { label: '批量处理', desc: '勾选需处理的报警 → 填写处理人与处理内容 → 点击「批量处理」，将选中记录标记为已读。' },
      { label: '统计与分页', desc: '顶部显示查询总数、未读数、已选条数；底部切换页码浏览更多记录。' },
    ],
  },
  {
    id: 'manage',
    title: '钢包管理',
    intro: '维护钢包基础档案，包括新建、编辑、删除及按状态筛选。',
    items: [
      { label: '档案列表', desc: '表格展示在册钢包：包号、状态、累计使用次数、最近温度、上次检修时间等；选中可查看详情。' },
      { label: '搜索与筛选', desc: '可按钢包编号搜索，并按状态筛选：使用中、需关注、待检修、正在检修。' },
      { label: '新建钢包', desc: '点击「新建钢包」，填写包号、投产时间、计划寿命、剩余寿命、最近温度、累计使用、上次检修、状态等后保存。' },
      { label: '编辑 / 删除', desc: '选中钢包后，可编辑档案信息或删除记录。' },
      { label: '状态说明', desc: '使用中（正常）、需关注（温度或寿命预警）、待检修 / 正在检修（维护状态）。' },
    ],
  },
];

export default function LadleUserManual() {
  return (
    <section className={styles.shell} aria-label="钢包监测使用手册">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>
            <BookOpen size={14} aria-hidden="true" /> 操作指南
          </span>
          <h2>使用手册</h2>
          <p>钢包监测系统各功能页面的简要操作说明，供现场操作人员参考。系统由西安豪克电子有限公司提供。</p>
        </div>
      </header>

      <nav className={manualStyles.toc} aria-label="目录">
        {sections.map((section) => (
          <a key={section.id} href={`#${section.id}`} className={manualStyles.tocLink}>
            {section.title}
          </a>
        ))}
      </nav>

      <div className={manualStyles.sections}>
        {sections.map((section) => (
          <article key={section.id} id={section.id} className={manualStyles.section}>
            <h3>{section.title}</h3>
            {section.intro && <p className={manualStyles.intro}>{section.intro}</p>}
            <dl className={manualStyles.items}>
              {section.items.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.desc}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
