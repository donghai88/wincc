'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  Compass,
  Database,
  Download,
  FileSearch,
  LogIn,
  Monitor,
  Radar,
  ScanText,
  Search,
  ShieldCheck,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import styles from './UserManual.module.css';

interface ManualItem {
  title: string;
  description: string;
  steps?: string[];
  note?: string;
}

interface ManualChapter {
  id: string;
  index: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tone: 'blue' | 'cyan' | 'orange' | 'red' | 'slate';
  items: ManualItem[];
}

interface UserManualProps {
  onOpenLadle?: () => void;
}

const chapters: ManualChapter[] = [
  {
    id: 'common',
    index: '01',
    title: '公共模块与快速开始',
    description: '适用于平台登录、总览、导航和通用页面操作。',
    icon: Compass,
    tone: 'blue',
    items: [
      {
        title: '登录与退出',
        description: '打开系统地址后输入分配的账号和密码。登录成功后进入监控总览；点击页面右上角用户区域中的退出图标可安全退出。',
        steps: ['输入用户名和密码', '点击登录并等待进入平台', '工作结束后点击右上角退出按钮'],
      },
      {
        title: '平台总览',
        description: '监控总览展示当前可用的业务系统入口。点击“钢包识别”卡片后进入钢包监测功能选择页。',
        steps: ['在一级导航点击“监控总览”', '找到“钢包识别”业务卡片', '点击卡片进入功能选择'],
      },
      {
        title: '通用页面操作',
        description: '列表类页面通常包含筛选、查询、刷新、分页和导出操作。修改筛选条件后应再次点击查询；分页切换不会自动清空当前条件。',
        note: '时间范围过大可能导致查询等待时间增加，建议先缩小时间范围定位数据。',
      },
    ],
  },
  {
    id: 'entry',
    index: '02',
    title: '进入钢包监测',
    description: '钢包监测包含热成像监控和雷达渣线检测两类功能。',
    icon: ScanText,
    tone: 'cyan',
    items: [
      {
        title: '热成像监控',
        description: '用于查看红外测温、OCR 包号识别、历史数据、温度曲线、报警记录和钢包档案。进入后左侧会切换为钢包智能监测专用导航。',
        steps: ['进入“钢包识别”功能选择页', '点击“热成像监控”', '通过左侧导航选择所需业务模块'],
      },
      {
        title: '雷达渣线检测',
        description: '用于查看双雷达点云扫描、渣线深度分布、历史检测记录和安全等级判断。',
        steps: ['进入“钢包识别”功能选择页', '点击“雷达渣线检测”', '选择钢包并开始检测或查看历史结果'],
      },
      {
        title: '返回与切换',
        description: '钢包业务页面中的“返回功能选择”可回到热成像与雷达选择页；功能选择页中的“返回平台总览”可回到系统首页。',
      },
    ],
  },
  {
    id: 'realtime',
    index: '03',
    title: '实时监控',
    description: '查看设备在线状态、当前包号、红外温度和 OCR 识别结果。',
    icon: Monitor,
    tone: 'cyan',
    items: [
      {
        title: '设备状态总览',
        description: '页面顶部展示热像仪、OCR 相机和雷达设备状态。在线设备显示正常状态；异常或中断设备需要现场检查网络、电源和采集服务。',
      },
      {
        title: '当前识别包号',
        description: '页面突出显示 OCR 当前识别到的钢包号，并同步展示今日识别次数和识别准确率。未识别到钢包时会显示等待识别状态。',
      },
      {
        title: '红外测温',
        description: '三路热成像区域显示实时画面以及最高温、平均温和最低温。操作时应同时核对设备名称、测温位置和当前包号。',
        note: '温度显示异常时，先确认设备是否在线，再尝试对应设备的重连操作。',
      },
      {
        title: '识别与测温记录',
        description: 'OCR 记录区用于查看最近识别结果；测温截图区用于核对最近一次采集画面、温度和时间。',
      },
    ],
  },
  {
    id: 'data',
    index: '04',
    title: '数据查询与曲线分析',
    description: '检索钢包历史数据、查看原始热成像记录并分析温度变化趋势。',
    icon: BarChart3,
    tone: 'blue',
    items: [
      {
        title: '数据查询',
        description: '可按钢包号、设备、温度和时间范围筛选历史记录。点击查询后，结果表格显示钢包号、设备和最高/最低/平均温度等信息。',
        steps: ['设置钢包号或其他筛选条件', '选择开始和结束时间', '点击“查询”查看结果'],
      },
      {
        title: '查看原图',
        description: '在查询结果中点击“原图”可查看该次测温对应的设备明细和原始热成像记录，用于复核异常温度。',
      },
      {
        title: '导出数据',
        description: '点击“导出数据”会按照当前筛选条件导出记录。导出前应确认钢包号和时间范围，避免导出无关数据。',
      },
      {
        title: '曲线分析',
        description: '选择钢包编号和时间范围后，可查看最高温、平均温和最低温趋势。通过曲线变化判断温度是否持续升高、降低或出现异常波动。',
      },
    ],
  },
  {
    id: 'alarm',
    index: '05',
    title: '报警管理',
    description: '查询钢包温度报警并完成业务处理闭环。',
    icon: Bell,
    tone: 'red',
    items: [
      {
        title: '查看未读报警',
        description: '一级导航或钢包侧边栏中的红色数字表示未读报警数量。进入报警管理后，可按钢包号、报警等级和已读状态筛选。',
      },
      {
        title: '核对报警信息',
        description: '处理前应核对钢包号、设备、规则类型、报警等级、温度和发生时间，必要时结合实时监控和原始热成像记录复核。',
      },
      {
        title: '批量处理',
        description: '勾选需要处理的报警，填写处理人和处理内容后点击“批量处理”。提交成功后，所选记录更新为已读或已处理状态。',
        steps: ['筛选并确认报警记录', '勾选需要处理的记录', '填写处理人与处理内容', '点击“批量处理”并确认结果'],
        note: '处理内容应记录现场核查结论和采取的措施，不建议只填写“已处理”。',
      },
    ],
  },
  {
    id: 'ladles',
    index: '06',
    title: '钢包管理',
    description: '维护钢包档案、寿命、温度、检修和使用状态。',
    icon: ClipboardList,
    tone: 'orange',
    items: [
      {
        title: '查询钢包档案',
        description: '通过钢包编号搜索或按状态筛选。列表显示累计使用次数、最近温度和上次检修时间，点击记录可查看完整档案。',
      },
      {
        title: '新建钢包',
        description: '点击“新建钢包”，填写钢包号、投产日期、计划寿命、最近温度、累计使用次数、检修信息和当前状态后保存。',
        note: '钢包号是关键业务标识，保存前应重点核对，避免重复或录入错误。',
      },
      {
        title: '编辑与删除',
        description: '选中钢包后可在详情区域编辑档案。删除操作会移除记录，执行前应确认所选钢包号和业务状态。',
      },
      {
        title: '状态说明',
        description: '使用中表示正常运行；需关注表示温度、寿命或其他指标需要关注；待检修和检修中表示钢包处于维护流程。',
      },
    ],
  },
  {
    id: 'radar',
    index: '07',
    title: '雷达渣线检测',
    description: '通过点云和深度曲线评估钢包渣线区域状态。',
    icon: Radar,
    tone: 'orange',
    items: [
      {
        title: '选择钢包与检测记录',
        description: '先选择目标钢包，再查看该钢包历史检测记录。记录通常包含检测时间、最大深度、缺陷数量和安全等级。',
      },
      {
        title: '开始新检测',
        description: '点击“开始新检测”触发扫描流程。扫描期间不要重复操作，等待进度完成后查看检测结果。',
      },
      {
        title: '查看点云',
        description: '点云区域支持等轴测、俯视、侧视和剖面视图，用于从不同角度观察渣线区域。',
      },
      {
        title: '理解检测结论',
        description: '深度曲线展示钢包一周的渣线变化；系统根据阈值给出安全、预警或危险结论。预警和危险结果应结合现场标准安排复核或检修。',
      },
    ],
  },
  {
    id: 'faq',
    index: '08',
    title: '状态说明与常见问题',
    description: '遇到页面无数据、设备离线或导出失败时的基本排查方法。',
    icon: CircleHelp,
    tone: 'slate',
    items: [
      {
        title: '页面没有实时数据',
        description: '先查看设备状态和页面数据状态；确认浏览器网络正常后刷新页面。若只有单台设备异常，可尝试设备重连；持续无数据时联系维护人员检查采集服务。',
      },
      {
        title: '查询不到历史记录',
        description: '检查钢包号是否正确、开始时间是否早于结束时间，并适当扩大时间范围。清空非必要筛选条件后重新查询。',
      },
      {
        title: '导出没有反应',
        description: '确认浏览器允许下载文件，并检查当前查询是否有结果。若数据量较大，可缩小时间范围后再次导出。',
      },
      {
        title: '报警数量与列表不一致',
        description: '侧边栏数字通常统计未读报警，列表可能包含已读报警或应用了不同筛选条件。请统一时间范围和已读状态后再比较。',
      },
      {
        title: '安全操作原则',
        description: '系统结果用于辅助判断。涉及危险、检修或设备停用时，应同时遵守现场安全规程和岗位审批流程。',
      },
    ],
  },
];

const quickLinks = [
  { label: '登录与进入', target: 'common', icon: LogIn },
  { label: '实时监控', target: 'realtime', icon: Thermometer },
  { label: '数据查询', target: 'data', icon: FileSearch },
  { label: '报警处理', target: 'alarm', icon: AlertTriangle },
  { label: '钢包档案', target: 'ladles', icon: Database },
  { label: '雷达检测', target: 'radar', icon: Radar },
];

export default function UserManual({ onOpenLadle }: UserManualProps) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const visibleChapters = useMemo(() => {
    if (!normalizedQuery) return chapters;

    return chapters
      .map((chapter) => {
        const chapterMatches = `${chapter.title} ${chapter.description}`.toLowerCase().includes(normalizedQuery);
        const items = chapterMatches
          ? chapter.items
          : chapter.items.filter((item) => (
              `${item.title} ${item.description} ${item.steps?.join(' ') ?? ''} ${item.note ?? ''}`
                .toLowerCase()
                .includes(normalizedQuery)
            ));

        return items.length > 0 ? { ...chapter, items } : null;
      })
      .filter((chapter): chapter is ManualChapter => chapter !== null);
  }, [normalizedQuery]);

  const scrollToChapter = (chapterId: string) => {
    document.getElementById(`manual-${chapterId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className={styles.page} aria-label="钢包监测用户使用手册">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><BookOpen size={15} aria-hidden="true" /> OPERATION GUIDE</span>
          <h2>用户使用手册</h2>
          <p>面向钢包监测现场操作人员，覆盖公共操作、热成像与 OCR、数据分析、报警处理、钢包档案和雷达渣线检测。</p>
          <div className={styles.heroMeta}>
            <span><ShieldCheck size={14} aria-hidden="true" /> 适用：钢包智能监测</span>
            <span><CheckCircle2 size={14} aria-hidden="true" /> 更新：2026-08-31</span>
          </div>
        </div>
        {onOpenLadle && (
          <button type="button" className={styles.enterButton} onClick={onOpenLadle}>
            进入钢包监测 <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
      </header>

      <div className={styles.searchBar}>
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索功能或操作，例如：导出、报警、雷达、钢包档案"
          aria-label="搜索使用手册"
        />
        <span>{visibleChapters.length} 个章节</span>
      </div>

      {!normalizedQuery && (
        <div className={styles.quickGrid} aria-label="快捷目录">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button type="button" key={link.target} onClick={() => scrollToChapter(link.target)}>
                <Icon size={17} aria-hidden="true" />
                <span>{link.label}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.manualLayout}>
        <aside className={styles.catalog} aria-label="手册目录">
          <div className={styles.catalogTitle}>目录</div>
          {chapters.map((chapter) => {
            const Icon = chapter.icon;
            return (
              <button type="button" key={chapter.id} onClick={() => scrollToChapter(chapter.id)}>
                <span>{chapter.index}</span>
                <Icon size={15} aria-hidden="true" />
                {chapter.title}
              </button>
            );
          })}
        </aside>

        <main className={styles.content}>
          {visibleChapters.length === 0 ? (
            <div className={styles.emptyState}>
              <Search size={28} aria-hidden="true" />
              <strong>没有找到相关说明</strong>
              <p>请尝试搜索“报警”“导出”“温度”或“雷达”等关键词。</p>
              <button type="button" onClick={() => setQuery('')}>清除搜索</button>
            </div>
          ) : (
            visibleChapters.map((chapter) => {
              const Icon = chapter.icon;
              return (
                <article
                  key={chapter.id}
                  id={`manual-${chapter.id}`}
                  className={styles.chapter}
                  data-tone={chapter.tone}
                >
                  <header className={styles.chapterHeader}>
                    <span className={styles.chapterIndex}>{chapter.index}</span>
                    <span className={styles.chapterIcon}><Icon size={19} aria-hidden="true" /></span>
                    <div>
                      <h3>{chapter.title}</h3>
                      <p>{chapter.description}</p>
                    </div>
                  </header>

                  <div className={styles.itemGrid}>
                    {chapter.items.map((item) => (
                      <section className={styles.itemCard} key={item.title}>
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                        {item.steps && (
                          <ol>
                            {item.steps.map((step) => <li key={step}>{step}</li>)}
                          </ol>
                        )}
                        {item.note && (
                          <div className={styles.note}>
                            <AlertTriangle size={14} aria-hidden="true" />
                            <span>{item.note}</span>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                </article>
              );
            })
          )}

          <footer className={styles.footerNote}>
            <Download size={16} aria-hidden="true" />
            <div>
              <strong>现场使用提示</strong>
              <p>本手册说明系统界面操作。涉及设备检修、危险处置和生产决策时，请以现场安全规程及岗位流程为准。</p>
            </div>
          </footer>
        </main>
      </div>
    </section>
  );
}
