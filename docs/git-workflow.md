# Git 开发工作流

> **文档版本**: 1.0  
> **创建日期**: 2026-04-09  
> **最后更新**: 2026-04-09

---

## 核心原则

**所有代码变更都走分支，主干 (`main`) 只接收合入，不直接写代码。**

---

## 分支策略

### 分支命名

| 类型 | 格式 | 示例 |
|------|------|------|
| 新功能 | `feat/<描述>` | `feat/firmware-skeleton` |
| 修复 | `fix/<描述>` | `fix/quantizer-color-drift` |
| 重构 | `refactor/<描述>` | `refactor/protocol-handler` |

### 分支与 OpenSpec Change 关联

每个 Phase 对应一个 OpenSpec Change，也对应一个分支，三者一一映射：

```
OpenSpec Change  ←→  Git Branch  ←→  Phase

例:
Change: firmware-skeleton  ←→  Branch: feat/firmware-skeleton  ←→  Phase 1
Change: binary-protocol    ←→  Branch: feat/firmware-binary-protocol  ←→  Phase 2
```

---

## 开发流程

```
① 创建分支
   git checkout main
   git pull
   git checkout -b feat/xxx

② 开发 + 小步提交 (分支上可随意提交)
   git add ...
   git commit -m "feat: 实现XXX"
   git commit -m "fix: 修正XXX"
   ...

③ 自测验证
   固件: pio run 编译通过
   桌面: npm run build + npm run test 通过
   端到端: 手动验证核心功能

④ 合入主干 (Squash Merge)
   git checkout main
   git merge --squash feat/xxx
   git commit -m "feat: xxx — 完整描述"

⑤ 收尾
   更新 openspec/specs/roadmap/spec.md 状态
   删除开发分支: git branch -d feat/xxx
```

---

## 合入规则

### Squash Merge

开发分支上的所有提交压缩为一个干净 commit 合入主干：

```
feat/firmware-skeleton  (5 commits, 可能有试错)
         │
         ▼  squash merge
main  ───●  (1 clean commit: "feat: 固件骨架 — EPaperDriver + 最小main")
```

**好处**:
- 主干历史干净，每个 Phase 一个 commit
- 开发分支上可以随意小步试错
- 方便 revert 整个 Phase

### 合入前必须满足

| 检查项 | 说明 |
|--------|------|
| 编译通过 | 固件 `pio run`，桌面 `npm run build` |
| 测试通过 | `npm run test` 全部通过 |
| 功能验证 | 手动验证核心功能正常 |
| 无遗留 TODO | 临时调试代码已清理 |

### 合入后必须完成

| 操作 | 说明 |
|------|------|
| 更新路线图 | `openspec/specs/roadmap/spec.md` 状态标记 ⏳→✅ |
| 删除开发分支 | `git branch -d feat/xxx` |
| Archive OpenSpec Change | 归档对应的 Change 提案 |

---

## Commit 消息规范

### 格式

```
<type>: <简短描述>
```

### Type 列表

| Type | 用途 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 实现二进制帧接收状态机` |
| `fix` | 修复 | `fix: 修正 CRC 校验字节序错误` |
| `refactor` | 重构 | `refactor: 提取协议解析为独立模块` |
| `test` | 测试 | `test: 添加量化引擎单元测试` |
| `docs` | 文档 | `docs: 更新开发指南路线图状态` |
| `chore` | 构建/配置 | `chore: 配置 electron-builder 打包` |

### Squash Merge 后的 Commit 消息

合入主干时使用更完整的描述：

```
feat: 固件骨架 — EPaperDriver + 最小main

- 创建 firmware/ 目录 + platformio.ini
- 移植 EPaperDriver (官方仓库)
- board_config.h 引脚配置
- 最小 main.cpp (初始化屏幕 + 清屏)
```

---

## 禁止事项

| 禁止 | 原因 |
|------|------|
| 在 `main` 上直接写代码 | 主干必须保持稳定可发布 |
| 一个分支做多个不相关功能 | 保持变更原子性，方便 review 和 revert |
| 合入未编译/未测试的代码 | 保证主干始终可用 |
| Force push 到 `main` | 不可逆，破坏历史 |
| 在开发分支上长时间不合并 | 减少冲突，保持节奏 |

---

## 典型场景

### 场景 1: 开始一个新 Phase

```bash
git checkout main
git pull
git checkout -b feat/firmware-skeleton
# 开始开发...
```

### 场景 2: 开发中发现需要修一个 bug

```bash
# 如果 bug 与当前分支相关，直接在当前分支修
git commit -m "fix: 修正引脚配置错误"

# 如果 bug 无关，先 stash 当前改动，切新分支修
git stash
git checkout -b fix/serial-timeout main
# 修完后合并，再回来继续
git checkout feat/firmware-skeleton
git stash pop
```

### 场景 3: Phase 完成，准备合入

```bash
# 自测
cd companion && npm run build && npm run test
cd firmware && pio run

# 合入
git checkout main
git merge --squash feat/firmware-skeleton
git commit -m "feat: 固件骨架 — EPaperDriver + 最小main"
git branch -d feat/firmware-skeleton

# 更新路线图
# 编辑 openspec/specs/roadmap/spec.md
```

### 场景 4: 合入后发现严重问题

```bash
# Revert 整个 Phase
git revert <squash-merge-commit-hash>
# 在新分支上修复后重新合入
```
