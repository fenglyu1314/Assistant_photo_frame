# Assistant Photo Frame

墨水屏桌面助手：ESP32-S3 固件 + Electron 桌面端。

## 核心理念

墨水屏做「帧缓冲区显示器」，桌面端做所有渲染和智能。

```
桌面端 ──(帧协议/USB CDC)──→ 墨水屏（固件）
  HTML/CSS渲染 → 截屏 → 6色量化+FS抖动     接收 → PSRAM → SPI刷屏
  → 编码192KB → 分块传输(47块×4KB)
```

## 硬件

| 参数 | 值 |
|------|------|
| MCU | ESP32-S3 (240MHz 双核, 16MB Flash, 8MB PSRAM) |
| 屏幕 | Waveshare 7.3" 6色 e-Paper (EPD_7IN3F) |
| 分辨率 | 物理 800×480, 逻辑 480×800 (竖屏, rotation=3) |
| 通信 | USB CDC 串口 115200 baud |

6色调色板：BLACK=0, WHITE=1, YELLOW=2, RED=3, (4=空位), BLUE=5, GREEN=6

## 项目结构

```
Assistant_photo_frame/
├── firmware/          # ESP32 固件 (PlatformIO + Arduino)
├── companion/         # 桌面端 (Electron + Vue 3 + TypeScript)
├── docs/              # 项目文档
├── openspec/          # 项目规格管理
└── Reference/         # 参考资料 (不参与构建)
```

## 技术栈

- **固件**: PlatformIO + Arduino Framework, C/C++
- **桌面端**: Electron 28+ / TypeScript / Vue 3 / electron-vite / Tailwind CSS
- **串口通信**: node-serialport + 帧协议 (MAGIC 0xEB0D)

## 快速开始

### 固件

```bash
cd firmware
pio run                # 编译
pio run -t upload      # 烧录
pio device monitor     # 串口监视
```

### 桌面端

```bash
cd companion
npm install            # 安装依赖
npm run dev            # 开发模式
npm run build          # 构建
npm run test           # 运行测试
npm run package        # 打包安装程序
```

## 文档

- [开发指南](docs/development-guide.md) — 目录结构、路线图、工作流策略
- [Git 工作流](docs/git-workflow.md) — 分支策略、合入规则、Commit 规范
- [架构设计](Reference/ESP32-S3-PhotoPainter/docs/design-electron-epd-companion.md) — 详细架构设计文档

## 参考资料

| 来源 | 说明 |
|------|------|
| `Reference/ESP32-S3-PhotoPainter-main/` | 官方仓库，首要代码参考 |
| `Reference/ESP32-S3-PhotoPainter/` | 旧探索项目，仅参考协议设计（驱动有颜色异常，不可复用） |
| `Reference/7.3inch-e-Paper-(E)-user-manual.pdf` | 屏幕用户手册 |

## License

MIT
