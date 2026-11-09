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
    intro: '中间包监测系统用于中间包区域的热成像实时监控、温度趋势分析、告警处理与周报查询，帮助现场人员掌握沟体温度状态并及时处置异常。',
    items: [
      { label: '适用场景', desc: '中间包热成像监控现场：多路实时画面、温度报表、告警处置与周报导出。' },
      { label: '主要能力', desc: '13 路热成像实时预览、数字孪生总览、温度趋势报表、告警查询与批量处理、周报查询与下载。' },
      { label: '侧边栏导航', desc: '左侧一级菜单：监控总览、监控中心、报表分析、告警中心、查询周报、用户使用手册。' },
    ],
  },
  {
    id: 'entry',
    title: '登录与进入系统',
    items: [
      { label: '登录', desc: '打开系统地址，在登录页输入账号密码后进入中间包监测系统。' },
      { label: '默认首页', desc: '登录后默认进入监控总览，可查看中间包孪生与关键状态概览。' },
      { label: '业务菜单', desc: '也可直接点击左侧「监控中心 / 报表分析 / 告警中心 / 查询周报」进入对应页面。' },
      { label: '退出登录', desc: '通过顶部用户区域退出后，将返回登录页。' },
    ],
  },
  {
    id: 'dashboard',
    title: '监控总览',
    intro: '总览页以数字孪生与关键指标展示中间包整体运行态势，是进入各业务模块前的入口页。',
    items: [
      { label: '孪生视图', desc: '展示中间包三维/仿真孪生画面，用于对照现场沟体与测温点位布局。' },
      { label: '状态概览', desc: '关注在线设备、温度与告警等摘要信息，发现异常后可进入监控中心或告警中心深入处理。' },
      { label: '功能跳转', desc: '可通过侧栏或页面内入口进入监控中心、报表分析等业务页面。' },
    ],
  },
  {
    id: 'monitor',
    title: '监控中心',
    intro: '集中查看 13 路热成像实时画面，支持按通道开启/关闭预览。',
    items: [
      { label: '通道列表', desc: '页面展示 13 个热成像通道卡片，含通道名称、通道编号与在线状态。' },
      { label: '实时画面', desc: '在线且开启的通道会拉取实时热成像画面；关闭开关后该路停止播流以节省资源。' },
      { label: '统计摘要', desc: '顶部显示通道总数、在线数、待接入数与停用数，便于快速核对接入情况。' },
      { label: '重试', desc: '某路连接失败时可点击「重试」重新建立播流；若多路同时失败，优先检查网络与媒体服务。' },
      { label: '并发说明', desc: '现场部署通过前端同源中转拉流，支持多路同时预览；若个别路长时间连接中，可先关闭部分通道再重试。' },
    ],
  },
  {
    id: 'reports',
    title: '报表分析',
    intro: '按区域与时间范围查询温度趋势，用于回顾中间包温度变化与异常时段。',
    items: [
      { label: '查询条件', desc: '选择区域/测点与时间范围（或使用快捷时间），点击「查询」加载趋势数据。' },
      { label: '趋势图表', desc: '以折线等形式展示所选条件下的温度变化，便于对比峰值与均值走势。' },
      { label: '再次查询', desc: '条件未变时也可再次点击「查询」强制刷新；切换快捷范围后需点查询才会重新请求。' },
    ],
  },
  {
    id: 'alarms',
    title: '告警中心',
    intro: '查询与处理中间包温度相关告警；侧栏「告警中心」上的红色数字表示未读告警数量。',
    items: [
      { label: '筛选条件', desc: '可按区域、已读状态等条件筛选，设置时间范围后点击「查询」应用条件。' },
      { label: '告警列表', desc: '表格展示告警位置、等级、温度、发生时间与已读状态等信息。' },
      { label: '批量处理', desc: '勾选需处理的告警 → 填写处理信息 → 提交批量处理，将选中记录标记为已处理/已读。' },
      { label: '区域统计', desc: '可查看按区域汇总的告警分布，用于定位高频异常区域。' },
      { label: '分页', desc: '列表底部切换页码浏览更多记录。' },
    ],
  },
  {
    id: 'weekly',
    title: '查询周报',
    intro: '按自然周查询中间包监测周报，并支持下载。',
    items: [
      { label: '选择周次', desc: '通过周选择器指定目标周，系统按该周查询周报数据。' },
      { label: '周报列表', desc: '展示各测点/区域在该周的温度与告警等汇总指标。' },
      { label: '下载', desc: '在有数据时可下载周报文件，便于存档或线下汇报。' },
      { label: '空数据', desc: '若查询成功但列表为空，表示该周服务端无记录，可换一周再查或核对后端数据。' },
    ],
  },
];

export default function TroughUserManual() {
  return (
    <section className={styles.shell} aria-label="中间包监测使用手册">
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>
            <BookOpen size={14} aria-hidden="true" /> 操作指南
          </span>
          <h2>使用手册</h2>
          <p>中间包监测系统各功能页面的简要操作说明，供现场操作人员参考。</p>
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
