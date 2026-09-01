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
    intro: '钢包智能监测系统用于热修位钢包的红外测温、OCR 包号识别与雷达渣线检测，帮助操作人员实时掌握钢包状态、查询历史数据并处理报警。',
    items: [
      { label: '适用场景', desc: '炼钢二厂热修位，对钢包进行温度监测、包号识别与渣线检测。' },
      { label: '主要能力', desc: '三路红外实时测温、OCR 自动识别包号、双雷达渣线扫描、历史数据查询与导出、温度曲线分析、报警处理、钢包档案管理。' },
      { label: '侧边栏导航', desc: '进入「热成像监控」后，左侧显示 6 个功能入口：实时监控、数据查询、曲线分析、报警管理、钢包管理、使用手册。' },
    ],
  },
  {
    id: 'entry',
    title: '登录与进入系统',
    items: [
      { label: '登录', desc: '打开系统地址，在登录页输入账号密码后进入平台。' },
      { label: '选择钢包识别', desc: '在监控总览页点击「钢包识别」卡片，进入功能选择页。' },
      { label: '功能选择', desc: '点击「热成像监控」进入完整业务模块（实时监控、数据查询、曲线分析、报警管理、钢包管理、使用手册）。' },
      { label: '返回', desc: '页面顶部「返回功能选择」可回到功能选择页；功能选择页左上角「返回平台总览」可回到系统首页。' },
    ],
  },
  {
    id: 'monitor',
    title: '实时监控',
    intro: '查看设备运行状态、三路红外热图、当前包号与 OCR 识别记录，并可对设备进行重连操作。',
    items: [
      { label: '设备状态总览', desc: '页面顶部展示 6 台设备卡片：3 路热像仪（出钢位 / 浇铸位 / 热修位）、OCR 包号相机、2 台雷达。绿色圆点表示在线。' },
      { label: '当前识别包号', desc: '中部横条显示 OCR 当前识别到的钢包号、识别状态，以及今日识别次数与准确率。' },
      { label: '三路红外热图', desc: '实时显示 IR-01 / IR-02 / IR-03 三路热成像画面，叠加当前包号与温度。下方卡片展示最高温、平均温、最低温。' },
      { label: '设备重连', desc: '若某路热像仪数据中断，点击对应「重连 1-1 / 2-1 / 3-1」按钮尝试重新建立连接。' },
      { label: '测温截图', desc: '展示最近一次测温的三路截图缩略图，含设备名、温度与时间。' },
      { label: '渣线检测区', desc: '页面下方可切换包号、点击「开始新检测」触发扫描进度条，查看点云示意与渣线深度曲线。' },
      { label: 'OCR 识别记录', desc: '右侧列表展示最近识别历史，点击某条可切换当前关注的包号。' },
    ],
  },
  {
    id: 'query',
    title: '数据查询',
    intro: '按条件检索历史温度记录，支持分页浏览、导出 CSV 及查看原始热成像明细。',
    items: [
      { label: '查询条件', desc: '选择钢包号、设备（全部或单路）、开始时间与结束时间，点击「查询」刷新结果。默认查询最近 24 小时。' },
      { label: '结果列表', desc: '表格展示钢包号、设备名、最高温 / 最低温 / 平均温及记录时间。同一钢包号 + 记录时间会聚合 3 路热成像数据。' },
      { label: '查看原图', desc: '点击某行右侧「原图」按钮，展开该次记录的 3 路设备温度明细。' },
      { label: '分页', desc: '列表底部「上一页 / 下一页」切换分页。' },
      { label: '导出数据', desc: '点击右上角「导出数据」，按当前筛选条件下载 CSV 文件（或触发服务端导出）。' },
    ],
  },
  {
    id: 'curves',
    title: '曲线分析',
    intro: '查看单个钢包在指定时间范围内的温度变化趋势。',
    items: [
      { label: '筛选条件', desc: '选择钢包编号、开始时间与结束时间，条件变更后自动加载曲线。' },
      { label: '指标卡片', desc: '顶部展示当前最高温、周期峰值、平均温度及关联钢包号。' },
      { label: '趋势图', desc: '折线图同时显示最高温度、平均温度、最低温度三条曲线，图例可区分颜色。' },
      { label: '刷新', desc: '点击右上角「刷新」手动重新加载数据。' },
    ],
  },
  {
    id: 'alarms',
    title: '报警管理',
    intro: '查询与处理钢包相关温度报警，侧栏「报警管理」上的红色数字表示未读报警数量。',
    items: [
      { label: '筛选条件', desc: '可按钢包号、报警等级（一级 / 二级）、已读状态（未读 / 已读）筛选，点击「查询」应用条件。默认展示近 7 天。' },
      { label: '报警列表', desc: '表格展示钢包号、设备、规则类型、等级、温度、发生时间与已读状态。' },
      { label: '批量处理', desc: '勾选需处理的报警 → 填写处理人与处理内容 → 点击「批量处理」，将选中记录标记为已读。' },
      { label: '统计卡片', desc: '顶部显示查询总数、本页未读数、已选条数等信息。' },
      { label: '分页', desc: '列表底部切换页码浏览更多记录。' },
    ],
  },
  {
    id: 'manage',
    title: '钢包管理',
    intro: '维护钢包基础档案，包括新建、编辑、删除及按状态筛选。',
    items: [
      { label: '档案列表', desc: '左侧表格展示在册钢包：包号、状态、累计使用次数、最近温度、上次检修时间。点击某行可在右侧查看详情。' },
      { label: '搜索与筛选', desc: '输入钢包编号搜索；下拉框按状态筛选：使用中、需关注、待检修、正在检修。' },
      { label: '新建钢包', desc: '点击右上角「新建钢包」，填写包号、投产时间、计划寿命、剩余寿命、最近温度、累计使用、上次检修、状态等，保存即可。' },
      { label: '编辑 / 删除', desc: '选中钢包后，右侧详情区点击「编辑档案」修改信息，或「删除档案」移除记录。' },
      { label: '状态说明', desc: '使用中（正常）、需关注（温度或寿命预警）、待检修 / 正在检修（维护状态）。顶部统计卡片汇总各状态数量。' },
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
          <p>钢包智能监测系统各功能页面的简要操作说明，供现场操作人员参考。</p>
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
