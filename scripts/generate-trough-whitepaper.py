#!/usr/bin/env python3
"""Generate 铁水沟监测系统软件白皮书 (customer delivery .docx)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "output" / "whitepaper"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Songti.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size, index=0)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_box(draw: ImageDraw.ImageDraw, box, fill, outline, width=2, radius=16):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def center_text(draw, box, text, fnt, fill):
    x0, y0, x1, y1 = box
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((x0 + x1 - tw) / 2, (y0 + y1 - th) / 2), text, font=fnt, fill=fill)


def draw_arrow(draw, start, end, fill=(70, 90, 120)):
    draw.line([start, end], fill=fill, width=3)
    x1, y1 = end
    x0, y0 = start
    # simple arrow head
    if abs(x1 - x0) >= abs(y1 - y0):
        direction = 1 if x1 > x0 else -1
        draw.polygon(
            [(x1, y1), (x1 - 10 * direction, y1 - 6), (x1 - 10 * direction, y1 + 6)],
            fill=fill,
        )
    else:
        direction = 1 if y1 > y0 else -1
        draw.polygon(
            [(x1, y1), (x1 - 6, y1 - 10 * direction), (x1 + 6, y1 - 10 * direction)],
            fill=fill,
        )


def make_system_arch() -> Path:
    w, h = 1400, 900
    img = Image.new("RGB", (w, h), (248, 250, 252))
    draw = ImageDraw.Draw(img)
    title_f = font(36, True)
    box_f = font(26)
    small_f = font(20)

    draw.text((48, 28), "图 1  系统逻辑架构", font=title_f, fill=(20, 40, 70))

    # Layers
    layers = [
        ("展示层", "浏览器工作站\n监控总览 / 监控中心 / 报表 / 告警 / 周报", (60, 110, 760, 250), (227, 242, 253), (25, 118, 210)),
        ("接入层", "前端服务（静态页面 + 同源代理）\nAPI / WebSocket / 热成像拉流中转", (60, 310, 760, 450), (232, 245, 233), (46, 125, 50)),
        ("业务层", "业务后端服务\n设备 / 温度 / 告警 / 周报接口", (60, 510, 420, 700), (255, 243, 224), (239, 108, 0)),
        ("媒体层", "热成像媒体服务\n多路实时热成像流", (400, 510, 760, 700), (243, 229, 245), (123, 31, 162)),
        ("现场层", "热像仪设备与测温采集链路", (60, 760, 760, 860), (252, 228, 236), (194, 24, 91)),
    ]

    for title, body, box, fill, outline in layers:
        rounded_box(draw, box, fill, outline)
        draw.text((box[0] + 24, box[1] + 18), title, font=box_f, fill=outline)
        draw.multiline_text((box[0] + 24, box[1] + 60), body, font=small_f, fill=(40, 50, 65), spacing=8)

    # right notes
    note_box = (820, 110, 1340, 860)
    rounded_box(draw, note_box, (255, 255, 255), (120, 144, 156), radius=18)
    draw.text((850, 140), "能力要点", font=box_f, fill=(55, 71, 79))
    notes = [
        "• 铁水沟视觉仿真数字孪生总览",
        "• 最多 16 路热成像实时预览",
        "• 温度趋势查询与图表分析",
        "• 告警查询、未读提示与批量处理",
        "• 周报查询与文件下载",
        "• 内置现场使用手册",
        "",
        "数据流示意：",
        "现场采集 → 业务/媒体服务",
        "→ 前端同源接入 → 浏览器展示",
    ]
    y = 200
    for line in notes:
        draw.text((850, y), line, font=small_f, fill=(55, 71, 79))
        y += 42

    # arrows between layers
    draw_arrow(draw, (410, 250), (410, 310))
    draw_arrow(draw, (410, 450), (240, 510))
    draw_arrow(draw, (410, 450), (580, 510))
    draw_arrow(draw, (240, 700), (240, 760))
    draw_arrow(draw, (580, 700), (580, 760))

    path = OUT_DIR / "arch-system.png"
    img.save(path)
    return path


def make_deploy_arch() -> Path:
    w, h = 1400, 820
    img = Image.new("RGB", (w, h), (248, 250, 252))
    draw = ImageDraw.Draw(img)
    title_f = font(36, True)
    box_f = font(26)
    small_f = font(20)

    draw.text((48, 28), "图 2  部署架构示意", font=title_f, fill=(20, 40, 70))

    boxes = [
        ((80, 120, 360, 280), (227, 242, 253), (25, 118, 210), "操作终端", "浏览器访问系统\n现场值班 / 管理人员"),
        ((520, 120, 980, 420), (232, 245, 233), (46, 125, 50), "应用服务器", "前端静态服务\n同源代理：\n· /api 业务接口\n· /ws 实时推送\n· 热成像拉流中转"),
        ((1120, 120, 1340, 280), (255, 243, 224), (239, 108, 0), "业务后端", "REST / WebSocket\n默认 8080"),
        ((1120, 360, 1340, 520), (243, 229, 245), (123, 31, 162), "媒体服务", "热成像实时流\n播流鉴权"),
        ((520, 520, 980, 720), (252, 228, 236), (194, 24, 91), "现场侧", "热像仪等采集设备\n测温与告警数据来源"),
    ]

    for box, fill, outline, title, body in boxes:
        rounded_box(draw, box, fill, outline)
        draw.text((box[0] + 22, box[1] + 18), title, font=box_f, fill=outline)
        draw.multiline_text((box[0] + 22, box[1] + 64), body, font=small_f, fill=(40, 50, 65), spacing=6)

    draw_arrow(draw, (360, 200), (520, 200))
    draw_arrow(draw, (980, 200), (1120, 200))
    draw_arrow(draw, (980, 320), (1120, 420))
    draw_arrow(draw, (1230, 520), (860, 520))
    draw.text((430, 150), "HTTPS/HTTP", font=small_f, fill=(70, 90, 120))
    draw.text((1000, 150), "业务请求", font=small_f, fill=(70, 90, 120))
    draw.text((1000, 330), "媒体拉流", font=small_f, fill=(70, 90, 120))

    footer = "说明：浏览器仅访问应用服务器同源地址；业务与媒体能力由服务端代理接入，降低跨域与并发限制影响。"
    draw.text((80, 760), footer, font=small_f, fill=(90, 100, 110))

    path = OUT_DIR / "arch-deploy.png"
    img.save(path)
    return path


def set_run_font(run, size=11, bold=False, color=(30, 30, 30)):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = RGBColor(*color)
    run.font.name = "Microsoft YaHei"
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.get_or_add_rFonts()
    rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")


def add_heading_cn(doc: Document, text: str, level: int = 1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        set_run_font(run, size=16 if level == 1 else 13, bold=True, color=(20, 60, 100))
    return p


def add_para(doc: Document, text: str, *, size=11, bold=False, center=False, space_after=8):
    p = doc.add_paragraph()
    if center:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.35
    run = p.add_run(text)
    set_run_font(run, size=size, bold=bold)
    return p


def add_bullets(doc: Document, items: list[str]):
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.3
        run = p.add_run(item)
        set_run_font(run, size=11)


def build_docx(system_img: Path, deploy_img: Path) -> Path:
    doc = Document()

    section = doc.sections[0]
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)

    # Cover
    for _ in range(3):
        doc.add_paragraph()
    add_para(doc, "铁水沟监测系统", size=28, bold=True, center=True, space_after=12)
    add_para(doc, "软件白皮书", size=22, bold=True, center=True, space_after=28)
    add_para(doc, "视觉仿真数字孪生 · 热成像实时监控 · 告警与周报", size=12, center=True, space_after=40)
    add_para(doc, "交付文档", size=12, center=True, space_after=8)
    add_para(doc, "版本：V1.0", size=11, center=True, space_after=4)
    add_para(doc, "适用范围：铁水沟监测产品", size=11, center=True, space_after=4)

    doc.add_page_break()

    add_heading_cn(doc, "1. 文档说明", 1)
    add_para(doc, "本文档面向系统交付与客户验收，介绍铁水沟监测系统的产品定位、功能组成、逻辑架构与部署方式，便于使用方理解系统能力与交付边界。")
    add_bullets(doc, [
        "产品范围：仅铁水沟监测（不含钢包监测等其他产品线）。",
        "文档性质：软件白皮书 / 交付说明，不涉及合同商务条款。",
        "表述原则：以系统已实现能力为准，不承诺未经现场验证的精度指标。",
    ])

    add_heading_cn(doc, "2. 产品概述", 1)
    add_para(doc, "铁水沟监测系统是面向钢铁冶金铁水沟场景的可视化监测软件，围绕“看得见、查得到、处置得了”构建能力闭环：")
    add_bullets(doc, [
        "看得见：铁水沟视觉仿真数字孪生总览 + 多路热成像实时预览。",
        "查得到：温度趋势报表与周报汇总，支持历史回看与下载。",
        "处置得了：告警查询、未读提示与批量处理，支撑现场异常闭环。",
    ])
    add_para(doc, "系统以 Web 方式交付，用户通过浏览器登录后即可使用，适合现场值班与管理人员日常巡检、异常复核与周度汇总。")

    add_heading_cn(doc, "3. 应用场景与价值", 1)
    add_heading_cn(doc, "3.1 典型场景", 2)
    add_bullets(doc, [
        "铁水沟区域多点热成像集中监视。",
        "沟体测温状态与孪生模型对照查看。",
        "温度异常告警的查询、确认与处理留痕。",
        "按周汇总温度与告警情况，用于班组/车间汇报。",
    ])
    add_heading_cn(doc, "3.2 使用价值", 2)
    add_bullets(doc, [
        "统一入口：总览、实时画面、报表、告警、周报集中在同一系统。",
        "降低切换成本：浏览器访问，减少多软件来回切换。",
        "提升响应效率：未读告警可见，支持批量处理。",
        "便于交付运维：同源代理部署，现场网络策略更清晰。",
    ])

    add_heading_cn(doc, "4. 功能模块", 1)
    add_heading_cn(doc, "4.1 监控总览", 2)
    add_para(doc, "以铁水沟视觉仿真数字孪生展示整体态势，结合测温点位状态，帮助用户快速理解沟体布局与当前运行情况，并作为进入各业务模块的入口。")

    add_heading_cn(doc, "4.2 监控中心", 2)
    add_para(doc, "提供最多 16 路热成像实时预览能力，支持按通道开启/关闭播流、查看在线与待接入状态，并在连接异常时重试。适用于值班人员对重点通道进行持续监视。")

    add_heading_cn(doc, "4.3 报表分析", 2)
    add_para(doc, "按测点/区域与时间范围查询温度趋势，支持常用快捷时间窗，并以图表方式展示温度变化，便于回顾异常时段与对比走势。")

    add_heading_cn(doc, "4.4 告警中心", 2)
    add_para(doc, "支持告警列表查询、条件筛选、详情查看、未读提示、批量处理以及按区域统计，形成“发现—确认—处理”的基本闭环。")

    add_heading_cn(doc, "4.5 查询周报", 2)
    add_para(doc, "按自然周查询周报数据，展示均温、最高温及告警次数等汇总信息，并支持下载，便于存档与线下汇报。")

    add_heading_cn(doc, "4.6 使用手册", 2)
    add_para(doc, "系统内置面向现场操作人员的使用手册，覆盖登录进入、各功能页面操作要点，降低培训与交接成本。")

    add_heading_cn(doc, "5. 系统架构", 1)
    add_para(doc, "系统采用“展示层—接入层—业务/媒体层—现场层”的分层结构。浏览器负责交互与展示；前端服务提供页面并完成同源接入；业务后端提供设备、温度、告警、周报等接口；媒体服务提供热成像实时流；现场侧负责采集与推送。")
    doc.add_picture(str(system_img), width=Cm(15.5))
    add_para(doc, "图 1 系统逻辑架构", size=10, center=True, space_after=12)

    add_heading_cn(doc, "6. 部署架构", 1)
    add_para(doc, "推荐将前端服务与业务后端部署于同一现场服务器或同一内网区域。浏览器仅访问前端服务地址；业务接口、实时推送与热成像拉流通过同源代理进入，避免浏览器直连后端端口带来的跨域与策略复杂性。")
    doc.add_picture(str(deploy_img), width=Cm(15.5))
    add_para(doc, "图 2 部署架构示意", size=10, center=True, space_after=12)
    add_bullets(doc, [
        "前端服务：静态页面托管，并代理业务 API、WebSocket 与热成像拉流。",
        "业务后端：提供设备列表、温度趋势、告警处理、周报等接口（常见监听本机 8080）。",
        "媒体服务：提供热成像实时流，播放前按平台约定进行鉴权。",
        "操作终端：现场电脑通过浏览器登录使用。",
    ])

    add_heading_cn(doc, "7. 技术特点", 1)
    add_bullets(doc, [
        "Web 化交付：标准浏览器即可使用，便于推广与远程协助。",
        "孪生 + 热成像联动：总览把握全局，监控中心查看细节。",
        "实时与历史兼顾：WebSocket 推送实时状态，报表/周报支撑回溯。",
        "告警闭环：列表、未读、批量处理与区域统计一体化。",
        "同源接入：接口与媒体访问路径统一，利于现场网络落地。",
    ])

    add_heading_cn(doc, "8. 运行环境与交付说明", 1)
    add_heading_cn(doc, "8.1 建议运行环境", 2)
    add_bullets(doc, [
        "服务器：可运行 Node.js 前端服务与 Java 业务后端的 Windows/Linux 主机。",
        "网络：操作终端可访问前端服务；前端服务可访问业务后端与媒体服务。",
        "客户端：Chrome / Edge 等现代浏览器。",
    ])
    add_heading_cn(doc, "8.2 交付内容（一般）", 2)
    add_bullets(doc, [
        "铁水沟监测前端程序及启动脚本。",
        "与现场业务后端、媒体服务的对接配置说明。",
        "系统使用手册（系统内置页面，亦可单独导出）。",
        "本软件白皮书。",
    ])
    add_heading_cn(doc, "8.3 边界说明", 2)
    add_bullets(doc, [
        "热像仪安装、标定、网络布线等现场工程条件由现场实施配合完成。",
        "业务后端与媒体平台的账号、流地址、告警规则等需按现场环境配置。",
        "具体测温精度、检出率等指标以现场设备与标定结果为准，不在本文承诺范围。",
    ])

    add_heading_cn(doc, "9. 总结", 1)
    add_para(doc, "铁水沟监测系统围绕铁水沟场景提供孪生总览、多路热成像监控、温度趋势分析、告警处理与周报查询等能力，以 Web 方式交付，适合作为现场日常监测与异常处置的统一工作台。后续可在既有架构上按现场需求继续扩展展示内容与报表维度。")

    add_para(doc, "— 文档结束 —", size=11, center=True, space_after=4)

    out = OUT_DIR / "铁水沟监测系统-软件白皮书-V1.0.docx"
    doc.save(out)
    return out


def main():
    system_img = make_system_arch()
    deploy_img = make_deploy_arch()
    docx_path = build_docx(system_img, deploy_img)
    print(docx_path)
    print(system_img)
    print(deploy_img)


if __name__ == "__main__":
    main()
