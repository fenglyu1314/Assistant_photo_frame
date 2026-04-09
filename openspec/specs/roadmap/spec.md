# 实现路线图

> 记录 Assistant Photo Frame 的分阶段实现计划和当前状态。

---

## Phase 1: 固件骨架

**状态**: ✅ 已完成  
**依赖**: 无  
**预估**: 3h

创建 `firmware/` 目录，移植 EPaperDriver，搭建最小 main.cpp。

- [x] 创建 firmware/ 目录 + platformio.ini
- [x] 移植 EPaperDriver (官方仓库 Reference/ESP32-S3-PhotoPainter-main/)
- [x] board_config.h 引脚配置
- [x] 最小 main.cpp (初始化屏幕 + 清屏)

**验收标准**: ESP32 能启动、初始化墨水屏、清屏为白色。

---

## Phase 2: 固件二进制协议

**状态**: ✅ 已完成  
**依赖**: Phase 1  
**预估**: 7h

实现 BinaryProtocol 状态机，支持二进制帧收发和分块传输。

- [x] protocol.h 协议常量定义 (MAGIC, CMD, 帧结构)
- [x] CRC-16/CCITT 工具函数
- [x] BinaryProtocol 接收状态机
- [x] 分块传输处理 (BEGIN→DATA×47→END)
- [x] PING/PONG 心跳

**验收标准**: ESP32 能接收二进制帧写入 PSRAM 并刷屏；PING/PONG 心跳正常。

---

## Phase 3: Companion 脚手架

**状态**: ✅ 已完成  
**依赖**: Phase 2 (协议定义稳定)  
**预估**: 5h

搭建 Electron 应用框架，基础主进程 + 窗口管理 + 托盘。

- [x] 从参考项目复制并初始化 electron-vite 项目
- [x] 主进程 + 窗口管理 + preload
- [x] 系统托盘实现
- [x] 开机自启
- [x] 自动更新 (electron-updater)

**验收标准**: Electron 应用能启动、显示窗口、最小化到托盘、开机自启。

---

## Phase 4: 量化引擎

**状态**: ✅ 已完成  
**依赖**: 无 (可与 Phase 2/3 并行)  
**预估**: 5.5h

实现 TypeScript 量化引擎 (参考 Python img2epd.py 算法思路)，编写单元测试。

- [x] palette.ts 调色板定义
- [x] quantizer.ts 最近邻量化
- [x] quantizer.ts Floyd-Steinberg 抖动
- [x] 饱和度预处理 (enhanceSaturation)
- [x] buffer-encoder.ts 物理缓冲区编码 (rotation=3)
- [x] 单元测试 (验证量化/编码正确性, 54 tests passed)

**验收标准**: TypeScript 量化引擎对标准测试图片的输出视觉正确，6色量化+抖动效果符合预期。

---

## Phase 5: 串口通信

**状态**: ✅ 已完成  
**依赖**: Phase 2, Phase 3  
**预估**: 6h

实现串口管理和二进制协议编码端。

- [x] serial-manager.ts 自动扫描 ESP32 (VID=0x303A) + 连接管理
- [x] binary-protocol.ts 帧编码器 + CRC
- [x] 帧缓冲区分块发送 + ACK/NAK 逐块确认
- [x] 设备状态监听 + 自动重连

**验收标准**: Electron 能发现 ESP32、建立连接、发送帧缓冲区、ESP32 正确刷屏。

---

## Phase 6: 渲染管线

**状态**: ✅ 已完成  
**依赖**: Phase 4, Phase 5  
**预估**: 9h

实现离屏渲染、HTML 模板、完整数据流。

- [x] offscreen.ts 离屏渲染窗口 (480×800, capturePage)
- [x] epd-design-system.css CSS 设计系统 (六色精确 + 抖动色)
- [x] dashboard.html 仪表盘模板
- [x] data-manager.ts 数据管理 (todos/events/日期)
- [x] weather-api.ts QWeather API 封装
- [x] config-store.ts 配置持久化 (electron-store)
- [x] 完整渲染管线集成 (数据→渲染→截屏→量化→编码→发送→刷屏)

**验收标准**: 完整链路跑通，墨水屏显示仪表盘画面。

---

## Phase 7: UI 与打包

**状态**: ✅ 已完成  
**依赖**: Phase 6  
**预估**: 10.5h

实现用户界面、编辑器、打包发布。

- [x] App.vue 左右分栏布局
- [x] SerialPanel.vue 串口选择 + 连接状态
- [x] TodoEditor.vue 待办编辑器
- [x] EventEditor.vue 日程编辑器
- [x] WeatherPanel.vue 天气设置
- [x] EpdPreview.vue 墨水屏预览（已知问题：预览图显示 bug 待后续修复）
- [x] IPC 通信集成
- [x] 定时后台刷新
- [x] electron-builder 打包配置 (NSIS 安装器)
- [x] 端到端联调验证（核心功能验证通过：串口连接、待办/日程 CRUD、手动刷屏、数据同步到墨水屏）

**验收标准**: 完整可安装的桌面应用，双击即用。

**已知问题**: UI 右侧预览图不显示（数据已正确渲染并传输到墨水屏，仅 UI 预览回显未生效）。

---

## Phase 8: 预览与同步解耦

**状态**: 🔲 未开始  
**依赖**: Phase 7  
**预估**: 5h

修复 UI 预览 Bug，将「预览」和「同步到设备」解耦为两个独立操作。

- [ ] 修复 EpdPreview.vue 预览图不显示的 Bug
- [ ] RenderPipeline 拆分：`renderPreview()` (Stage 1-5) + `syncToDevice()` (Stage 6)
- [ ] 缓存渲染结果，避免同步时重复渲染
- [ ] 新增 IPC 通道：`pipeline:render-preview` + `pipeline:sync-device`
- [ ] EpdPreview.vue 拆分为「刷新预览」和「同步到相框」两个按钮
- [ ] 预览在渲染完成后立即显示（不等待设备同步）
- [ ] 「同步到相框」按钮仅在预览完成且设备已连接时可用
- [ ] 定时刷新逻辑适配：定时触发预览 + 可选自动同步

**验收标准**: 点击「刷新预览」仅渲染并显示预览图，点击「同步到相框」才将帧数据发送到设备；两个操作完全独立。

---

## Phase 9: 文字清晰度优化

**状态**: 🔲 未开始  
**依赖**: Phase 8  
**预估**: 4h

优化量化算法，解决 Floyd-Steinberg 抖动导致文字笔画中出现杂色的问题。

- [ ] 文字区域保护：对接近纯黑/纯白的像素直接映射，跳过抖动误差扩散
- [ ] 阈值判断：像素到 BLACK/WHITE 的色差 < threshold 时直接量化，不参与 FS 扩散
- [ ] 可选：CIELab 色差替代 RGB 欧氏距离，提升感知准确性
- [ ] 可选：调色板 RGB 值微调（匹配实际墨水屏显示效果）
- [ ] 新增文字保护相关单元测试

**验收标准**: 纯黑/白文字笔画清晰无杂色，非文字区域（图标、色块）仍保持正常的抖动混色效果。

---

## 依赖关系

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 5 ──→ Phase 6 ──→ Phase 7 ──→ Phase 8 ──→ Phase 9
                 │                                    ↑
                 └────────────────────────────────────┘
                       (Phase 4 可与 2/3 并行)
```

---

## 变更记录

| 日期 | 变更 |
|------|------|
| 2026-04-09 | 初始路线图，Phase 1-7 |
| 2026-04-09 | Phase 1 固件骨架完成：EPD 驱动移植、清屏验证通过 |
| 2026-04-09 | 去除旧兼容性负担：删除 TextProtocol、协议自动识别、旧 Python companion 兼容目标；量化引擎验收改为视觉正确而非逐字节匹配 Python |
| 2026-04-09 | Phase 2 固件二进制协议完成：BinaryProtocol 状态机 + 分块传输 + 心跳验证通过 |
| 2026-04-09 | Phase 3 Companion 脚手架完成：Electron 应用骨架、窗口管理、系统托盘、开机自启、自动更新 |
| 2026-04-09 | Phase 4 量化引擎完成：palette.ts 6色调色板、quantizer.ts 最近邻/FS抖动/饱和度增强、buffer-encoder.ts 坐标变换+打包，54 个单元测试全部通过 |
| 2026-04-09 | Phase 5 串口通信完成：binary-protocol.ts CRC/帧构建、response-parser.ts 响应解析状态机、serial-manager.ts 串口管理/自动重连/帧传输、IPC 桥接层，89 个单元测试全部通过 |
| 2026-04-10 | Phase 6 渲染管线完成：DataManager 数据层、OffscreenRenderer 离屏渲染、EPD CSS 设计系统与仪表盘模板、RenderPipeline 管线编排、固件 EPD_DisplayRaw() 修复双重旋转，完整链路验证通过 |
| 2026-04-10 | Phase 7 UI 与打包完成：App.vue 分栏布局、SerialPanel/TodoEditor/EventEditor/WeatherPanel/EpdPreview 五大 UI 组件、定时后台刷新、electron-builder NSIS 打包、DISPLAY_DONE 超时修复、天气 API Host 支持，89 个单元测试全部通过。已知问题：UI 预览图不显示 |
| 2026-04-10 | 新增 Phase 8 (预览与同步解耦) + Phase 9 (文字清晰度优化) |
