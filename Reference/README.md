# 参考资料

本目录通过 **Git Submodule** 引用外部参考仓库，**不参与构建**。

## 初始化

克隆本项目后，需要初始化 submodule 才能看到参考代码：

```bash
# 克隆时自动初始化
git clone --recurse-submodules <repo-url>

# 或在已有仓库中初始化
git submodule update --init --recursive
```

## 目录说明

| 目录 | 说明 | 来源 |
|------|------|------|
| `ESP32-S3-PhotoPainter-main/` | Waveshare 官方仓库 — **首要代码参考** | [GitHub](https://github.com/MarsTechHUB/ESP32-S3-PhotoPainter) |
| `ESP32-S3-PhotoPainter/` | 旧探索项目 — 仅参考协议设计，**驱动有颜色异常不可复用** | [GitHub](https://github.com/fenglyu1314/ESP32-S3-PhotoPainter) |
| `7.3inch-e-Paper-(E)-user-manual.pdf` | 屏幕用户手册 | [Waveshare Wiki](https://www.waveshare.com/wiki/7.3inch_e-Paper_(E)) |

## 关键参考文件索引

### 官方仓库 (ESP32-S3-PhotoPainter-main/)

| 文件 | 用途 |
|------|------|
| `05_ArduinoExample/` | Arduino 示例代码，含 EPD 驱动 |
| `03_Firmware/ESP32-S3-PhotoPainter-Fac.bin` | 出厂固件 |

### 旧探索项目 (ESP32-S3-PhotoPainter/)

| 文件 | 用途 |
|------|------|
| `src/main.cpp` | 固件主程序（参考页面系统架构，不直接复用） |
| `lib/EPaperDriver/` | EPD 驱动（有颜色异常，以官方仓库为准） |
| `lib/SerialProtocol/` | 旧 STX/ETX 文本协议（参考协议设计思路） |
| `include/board_config.h` | 硬件引脚配置 |
| `tools/img2epd.py` | Python 量化工具（JS 移植的参考基准） |
| `docs/design-electron-epd-companion.md` | Electron 伴侣架构设计文档 |
| `epd-companion/` | Electron 应用参考实现（目录结构、模块划分参考） |
| `platformio.ini` | PlatformIO 配置参考 |

## 更新 Submodule

当参考仓库有新提交时：

```bash
# 更新到最新 main 分支
git submodule update --remote

# 或更新特定 submodule
git submodule update --remote Reference/ESP32-S3-PhotoPainter-main
```

## 开发规则

- `Reference/` 下的代码仅参考，不直接包含进构建
- 墨水屏驱动代码以官方仓库实现为准
- 旧项目的 EPaperDriver 存在颜色显示异常，不可直接复用驱动/显示相关代码
