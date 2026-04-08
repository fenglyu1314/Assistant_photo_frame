# Assistant Photo Frame — 开发指南

> **文档版本**: 1.0  
> **创建日期**: 2026-04-09  
> **最后更新**: 2026-04-09

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 项目目录结构](#2-项目目录结构)
- [3. 构建与开发流程](#3-构建与开发流程)
- [4. 实现路线图](#4-实现路线图)
- [5. OpenSpec 工作流策略](#5-openspec-工作流策略)
- [6. 测试策略](#6-测试策略)
- [7. 关键技术决策](#7-关键技术决策)

---

## 1. 项目概述

### 定位

墨水屏桌面助手：ESP32-S3 固件 + Electron 桌面伴侣应用。

### 核心架构

ESP32 做「帧缓冲区显示器」，PC 端做所有渲染和智能：

```
Electron App ──(二进制帧协议/USB CDC)──→ ESP32 固件
  HTML/CSS渲染 → 截屏 → 6色量化+FS抖动     接收 → PSRAM → SPI刷屏
  → 编码192KB → 分块传输(47块×4KB)
```

### 硬件规格

| 参数 | 值 |
|------|------|
| MCU | ESP32-S3 (240MHz 双核, 16MB Flash QIO, 8MB PSRAM OPI) |
| 屏幕 | Waveshare 7.3" 7色 e-Paper (EPD_7IN3F) |
| 物理分辨率 | 800×480, 逻辑分辨率 480×800 (竖屏, rotation=3) |
| 帧缓冲区 | 192,000 字节 (4-bit packed, PSRAM) |
| 通信 | USB CDC 串口 115200 baud |

### 技术栈

- **固件**: PlatformIO + Arduino Framework, C/C++
- **桌面应用**: Electron 28+ / TypeScript / Vue 3 / electron-vite / serialport / Tailwind CSS
- **通信协议**: 二进制帧协议 (MAGIC 0xEB0D)

---

## 2. 项目目录结构

```
Assistant_photo_frame/
├── firmware/                  # ESP32 固件 (PlatformIO)
│   ├── src/
│   │   └── main.cpp
│   ├── lib/
│   │   ├── EPaperDriver/     # 墨水屏 SPI 驱动 (来自官方仓库)
│   │   └── SerialProtocol/   # 串口协议 (二进制帧)
│   │       └── BinaryProtocol.h/.cpp
│   ├── include/
│   │   ├── board_config.h    # 硬件引脚配置
│   │   └── protocol.h        # 协议常量 (MAGIC, CMD 等)
│   ├── platformio.ini
│   └── README.md
│
├── companion/                 # Electron 桌面应用
│   ├── electron/             # 主进程 (Node.js)
│   │   ├── main.ts           # 入口: 窗口管理 + 托盘 + 定时任务
│   │   ├── preload.ts        # contextBridge IPC 桥接
│   │   ├── serial/           # 串口模块
│   │   │   ├── serial-manager.ts
│   │   │   └── binary-protocol.ts
│   │   ├── renderer/         # 离屏渲染模块
│   │   │   └── offscreen.ts
│   │   └── data/             # 数据管理模块
│   │       ├── config-store.ts
│   │       ├── data-manager.ts
│   │       └── weather-api.ts
│   ├── src/                  # 渲染进程 (Vue 3 UI)
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── components/       # UI 组件
│   │   │   ├── SerialPanel.vue
│   │   │   ├── TodoEditor.vue
│   │   │   ├── EventEditor.vue
│   │   │   ├── WeatherPanel.vue
│   │   │   └── EpdPreview.vue
│   │   └── core/             # 共享核心模块
│   │       ├── palette.ts
│   │       ├── quantizer.ts
│   │       ├── buffer-encoder.ts
│   │       └── types.ts
│   ├── templates/            # 墨水屏 HTML 模板
│   │   ├── dashboard.html
│   │   └── epd-design-system.css
│   ├── resources/            # 打包资源 (图标等)
│   ├── tests/                # 核心模块单元测试
│   ├── package.json
│   ├── tsconfig.json
│   ├── electron.vite.config.ts
│   ├── electron-builder.yml
│   ├── tailwind.config.ts
│   └── postcss.config.js
│
├── docs/                      # 项目文档
│   ├── development-guide.md  # 本文件 — 开发指南
│   └── design-architecture.md # 架构设计文档 (待创建)
│
├── openspec/                  # 项目规格管理
│   ├── config.yaml
│   ├── specs/                # 稳定的功能规格
│   └── changes/              # 活跃的变更提案
│       └── archive/          # 已归档的变更
│
├── Reference/                 # 参考资料 (不参与构建)
│   ├── ESP32-S3-PhotoPainter-main/  # 官方仓库 (首要代码参考)
│   ├── ESP32-S3-PhotoPainter/       # 旧探索项目 (仅参考协议设计)
│   └── 7.3inch-e-Paper-(E)-user-manual.pdf
│
└── README.md                  # 项目总说明
```

---

## 3. 构建与开发流程

### 3.1 固件 (firmware/)

```bash
cd firmware
pio run                    # 编译 (用户手动)
pio run -t upload          # 烧录 (用户手动)
pio device monitor          # 串口监视
```

**注意**: 编译和烧录操作由用户手动执行，AI 不执行这些命令。

### 3.2 桌面应用 (companion/)

```bash
cd companion
npm install                 # 安装依赖
npm run dev                 # 开发模式 (electron-vite dev)
npm run build               # 构建生产版本
npm run test                # 运行测试
npm run package             # 打包安装程序
```

### 3.3 开发约定

- 固件遵循 Arduino 风格 (setup/loop)
- 颜色索引必须与 Waveshare 官方枚举一致 (索引4为空位)
- 墨水屏驱动代码以官方仓库 (`Reference/ESP32-S3-PhotoPainter-main/`) 为准
- `Reference/` 下的代码仅参考，不直接包含进构建
- 旧探索项目的墨水屏驱动代码存在颜色异常，不可直接复用

---

## 4. 实现路线图

### Phase 1: 固件骨架

创建 `firmware/` 目录，移植 EPaperDriver，搭建最小 main.cpp。

| 任务 | 预估 |
|------|------|
| 创建 firmware/ 目录 + platformio.ini | 0.5h |
| 移植 EPaperDriver (官方仓库) | 1h |
| board_config.h 引脚配置 | 0.5h |
| 最小 main.cpp (初始化屏幕 + 清屏) | 1h |

**产出**: ESP32 能启动、初始化墨水屏、清屏为白色。

### Phase 2: 固件二进制协议

实现 BinaryProtocol 状态机，支持二进制帧收发和分块传输。

| 任务 | 预估 |
|------|------|
| protocol.h 协议常量定义 | 0.5h |
| CRC-16/CCITT 工具函数 | 1h |
| BinaryProtocol 接收状态机 | 2.5h |
| 分块传输处理 (BEGIN→DATA→END) | 2h |
| PING/PONG 心跳 | 1h |

**产出**: ESP32 能接收二进制帧，写入 PSRAM，触发刷屏。PING/PONG 心跳正常。

**依赖**: Phase 1

### Phase 3: Companion 脚手架

搭建 Electron 应用框架，基础主进程 + 窗口管理 + 托盘。

| 任务 | 预估 |
|------|------|
| 从参考项目复制并初始化 electron-vite 项目 | 1h |
| 主进程 + 窗口管理 + preload | 1.5h |
| 系统托盘实现 | 1h |
| 开机自启 | 0.5h |
| 自动更新 (electron-updater) | 1h |

**产出**: Electron 应用能启动、显示窗口、最小化到托盘。

**依赖**: Phase 2 (协议定义稳定后开发串口模块才有意义)

### Phase 4: 量化引擎

移植 Python img2epd.py 的核心算法到 TypeScript，编写单元测试。

| 任务 | 预估 |
|------|------|
| palette.ts 调色板定义 | 0.5h |
| quantizer.ts 最近邻量化 | 0.5h |
| quantizer.ts Floyd-Steinberg 抖动 | 1.5h |
| 饱和度预处理 (enhanceSaturation) | 0.5h |
| buffer-encoder.ts 物理缓冲区编码 | 1h |
| 单元测试 (对比 Python 基准输出) | 1.5h |

**产出**: TypeScript 量化引擎输出与 Python 版逐字节一致 (允许 ≤0.1% 像素偏差)。

**依赖**: 无 (可与 Phase 2/3 并行)

### Phase 5: 串口通信

实现串口管理和二进制协议编码端。

| 任务 | 预估 |
|------|------|
| serial-manager.ts 自动扫描 + 连接管理 | 2h |
| binary-protocol.ts 帧编码器 + CRC | 1.5h |
| 帧缓冲区分块发送 + ACK/NAK | 1.5h |
| 设备状态监听 + 自动重连 | 1h |

**产出**: Electron 应用能发现 ESP32、建立连接、发送帧缓冲区数据。

**依赖**: Phase 2 (协议定义), Phase 3 (Electron 框架)

### Phase 6: 渲染管线

实现离屏渲染、HTML 模板、完整数据流。

| 任务 | 预估 |
|------|------|
| offscreen.ts 离屏渲染窗口 | 1.5h |
| epd-design-system.css CSS 设计系统 | 1h |
| dashboard.html 仪表盘模板 | 2h |
| data-manager.ts 数据管理 | 1.5h |
| weather-api.ts 天气 API | 1h |
| config-store.ts 配置持久化 | 0.5h |
| 完整渲染管线集成 | 1.5h |

**产出**: 数据 → HTML 渲染 → 截屏 → 量化 → 编码 → 发送 → ESP32 刷屏 的完整链路。

**依赖**: Phase 4 (量化引擎), Phase 5 (串口通信)

### Phase 7: UI 与打包

实现用户界面、编辑器、打包发布。

| 任务 | 预估 |
|------|------|
| App.vue 左右分栏布局 | 1h |
| SerialPanel.vue 串口面板 | 1h |
| TodoEditor.vue + EventEditor.vue | 2h |
| WeatherPanel.vue 天气设置 | 1h |
| EpdPreview.vue 墨水屏预览 | 1h |
| IPC 通信集成 | 1h |
| 定时后台刷新 | 0.5h |
| electron-builder 打包配置 | 1h |
| 端到端联调验证 | 2h |

**产出**: 完整可安装的桌面应用。

**依赖**: Phase 6

### 依赖关系

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 5 ──→ Phase 6 ──→ Phase 7
                 │                                    ↑
                 └────────────────────────────────────┘
                       (Phase 4 可与 2/3 并行)
```

---

## 5. OpenSpec 工作流策略

### 核心原则：每次只创建一个 Change，用路线图保证连续性

```
┌─────────────────────────────────────────────────────┐
│                 推荐的工作流                          │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ① 在 specs/ 下维护路线图 (roadmap spec)            │
│     → 记录 Phase 1-7 的整体计划和依赖关系            │
│     → 这是"指南针"，不是"铁律"                       │
│                                                     │
│  ② 每次只 propose 一个 Change (当前 Phase)          │
│     → 聚焦、可验证、2小时内可完成                     │
│     → 完成后 archive                                │
│                                                     │
│  ③ 每完成一个 Change，回顾路线图                     │
│     → 下一阶段是否需要调整？                         │
│     → 更新 roadmap spec                             │
│     → 再 propose 下一个 Change                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 为什么不一次创建多个 Change？

- **锁定僵化**: Phase 1 的实现可能暴露 Phase 3 的假设错误
- **上下文过载**: 多个活跃 Change 让后续 AI 对话混乱
- **反馈断裂**: 没有实现反馈的纯设计容易脱离实际
- **协议可能变**: 固件协议确定后，companion 的设计可能需要调整

### 路线图维护

路线图存放在 `openspec/specs/roadmap/spec.md`，每次 Phase 完成后更新状态：

```markdown
## Phase 1: 固件骨架 — ✅ 已完成
- [x] 创建 firmware/ 目录
- [x] 移植 EPaperDriver
- ...

## Phase 2: 固件二进制协议 — 🔄 当前
- [ ] BinaryProtocol 状态机
- ...

## 变更记录
- 2026-04-09: 初始路线图
```

### 计划变更的处理流程

```
发现需要调整
    │
    ▼
① 更新 roadmap/spec.md
   → 记录变更原因和新方向
   → 标注哪些 Phase 受影响

② 已有的 specs/ 规格是否受影响？
   → 是: 更新对应 spec.md
   → 否: 保持不动

③ 当前活跃 Change 是否需要调整？
   → 小调整: 更新 design.md / tasks.md
   → 大调整: archive 当前 Change, 重新 propose

④ 未来的 Change: 没创建就不存在，零成本
   → 只需在 roadmap 中更新预期即可
```

---

## 6. 测试策略

### 6.1 Companion 核心模块 (单元测试)

| 模块 | 测试内容 | 工具 |
|------|---------|------|
| palette.ts | 调色板定义完整性，索引4为null | Vitest |
| quantizer.ts | 已知输入 → 验证量化/抖动效果 | Vitest |
| buffer-encoder.ts | 坐标变换 + 4-bit 打包正确性 | Vitest |
| binary-protocol.ts | 帧构建/解析/CRC 校验 | Vitest |

### 6.2 固件 (手动 + 脚本)

| 测试方式 | 内容 |
|---------|------|
| 串口模拟脚本 | Python 脚本模拟 PC 端发送二进制帧 |
| 手动验证 | 实际刷屏效果检查 |
| PING/PONG | 心跳响应验证 |

### 6.3 端到端联调

Electron → ESP32 实际传输刷屏，验证完整渲染管线。

---

## 7. 关键技术决策

### 7.1 固件起点：从官方仓库移植

| 方案 | 结论 |
|------|------|
| A: 从官方仓库移植 EPaperDriver，新建其余代码 | ✅ 选用 |
| B: 从旧项目复制再改造 | ❌ 旧项目驱动有颜色异常 |

理由：新架构下 ESP32 只是「帧缓冲区显示器」，旧项目的 ASCII 渲染、JSON 解析等不再需要。

### 7.2 Companion 起点：从参考项目复制

| 方案 | 结论 |
|------|------|
| A: 复制参考项目 epd-companion/ 作为起点 | ✅ 选用 |
| B: 全新初始化 | ❌ 重复工作太多 |

理由：参考项目的目录结构、依赖、配置已与设计文档高度一致，复制后审查修正即可。

### 7.3 波特率：初始保持 115200

115200 baud 传输 192KB 需要 ~17-20 秒，这是已知瓶颈。但初始版本保持稳定，后续作为优化项探索更高波特率。

### 7.4 版本号

- 固件和 companion 分别独立版本号
- 固件版本: `platformio.ini` 的 `build_flags` 定义
- Companion 版本: `package.json` 的 `version`
- 协议版本: BEGIN 帧元数据中携带，便于将来兼容性检查

---

## 参考资料

| 文档 | 位置 |
|------|------|
| 架构设计文档 | `Reference/ESP32-S3-PhotoPainter/docs/design-electron-epd-companion.md` |
| 官方仓库代码 | `Reference/ESP32-S3-PhotoPainter-main/` |
| 旧探索项目 | `Reference/ESP32-S3-PhotoPainter/` (仅参考协议设计) |
| 屏幕用户手册 | `Reference/7.3inch-e-Paper-(E)-user-manual.pdf` |
| 二进制协议规格 | `.codebuddy/rules/binary-protocol/RULE.mdc` |
| 项目总览规则 | `.codebuddy/rules/project-overview/RULE.mdc` |
