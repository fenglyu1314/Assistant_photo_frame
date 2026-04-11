## Context

当前墨水屏仪表盘模板 `dashboard.html` 基于 Phase 6-9 迭代而来，功能完整但视觉优化空间大。6 色墨水屏的黄色（Index 2）和绿色（Index 6）几乎未使用，灰色中间色被大量用作文字颜色导致 FS 抖动后不清晰。Header 的时间显示在墨水屏刷新延迟下无意义。布局上 Todos 独占 flex:1 而 Events 缺少弹性分配。

## Goals / Non-Goals

**Goals:**
- 去掉时间显示，Header 精简为一行（年月日 · 星期），释放约 60px 给内容区
- 所有文字颜色只用 6 色纯色，禁止灰色/半透明做文字色
- 充分利用黄色和绿色（已完成 checkbox、今日日程高亮、天气图标等）
- Section Header 用色块条标识（蓝色=待办，红色=日程）
- Todos 和 Events 同时 flex:1 参与弹性空间分配
- Footer 改为最后刷新时间
- 天气区域使用纯色几何图标替代文字描述

**Non-Goals:**
- 不实现多模板切换（Phase 12 范畴）
- 不改变渲染管线流程和接口
- 不改变量化算法
- 不修改固件

## Decisions

### D1: Header 精简 — 合并为单行

当前 Header 布局为双栏（左：日期+星期，右：大号时间），占据约 80px 高度。

改为单行：
```html
<div class="header">
  2026年4月11日 · 星期六
</div>
```

样式：
- 字号 `--epd-font-size-xl` (28px)，bold，纯黑色
- `·` 分隔符使用 `--epd-blue` 着色，增加视觉层次
- 去掉 `time-display` 元素及其 48px 大号时间
- 释放约 60px 垂直空间

### D2: 文字颜色纯色化

**原则**：所有文字颜色只用 6 色纯色（black/white/red/blue/yellow/green），禁止 `--epd-gray`/`--epd-light-gray` 等抖动中间色做文字色。

具体变更：
| 元素 | 当前颜色 | 改为 |
|------|---------|------|
| `.todo-text.done` | `--epd-gray` | `--epd-black` + `text-decoration: line-through` |
| `.section-count` | `--epd-gray` | `--epd-blue` |
| `.event-time` | `--epd-gray` | `--epd-blue` |
| `.weather-placeholder` | `--epd-gray` 文字 | `--epd-blue` 文字 |
| `.weather-placeholder` | `--epd-gray` 虚线边框 | `--epd-blue` 虚线边框 |
| `.empty-hint` | `--epd-gray` | `--epd-blue` |
| `.footer` | `--epd-light-gray` | `--epd-blue` |
| `.footer` border-top | `--epd-light-gray` | 移除或改为 `--epd-blue` |
| `.todo-item` border-bottom | `--epd-light-gray` | 移除 |
| `.event-item` border-bottom | `--epd-light-gray` | 移除 |

灰色变量 `--epd-gray`/`--epd-light-gray` 仅保留用于**非文字装饰**（如背景填充），不再用于文字颜色。

### D3: 充分利用黄色和绿色

- **已完成 checkbox**：背景从 `--epd-black` 改为 `--epd-green`，✓ 号保持 `--epd-white`
- **今日日程黄色高亮**：如果 event.date 等于今天，整行左侧加 4px `--epd-yellow` 竖条 + `--epd-yellow` 淡背景 (用 `rgba` 或单独 CSS class)
- **天气晴天图标**：纯色黄色圆 (⬤ 或 CSS 圆形)
- **天气其他图标**：雨=蓝色竖线、雪=蓝色星号、多云=灰色块等（CSS 几何形状）

### D4: Section Header 色块条

当前 Section Header 使用文字图标 + 标题 + 计数。

改为色块条：
```html
<div class="section-header todo-header">
  <span class="section-bar"></span>
  <span class="section-title">待办事项</span>
  <span class="section-count">2/5</span>
</div>
```

CSS：
```css
.section-bar {
  display: inline-block;
  width: 6px;
  height: 20px;
  margin-right: var(--epd-spacing-sm);
}

.todo-header .section-bar {
  background: var(--epd-blue);
}

.event-header .section-bar {
  background: var(--epd-red);
}
```

### D5: 布局弹性分配

当前 `.todo-list` 为 `flex: 1`，`.events-list` 无弹性。

改为两者都 `flex: 1`，共同参与空间分配：
```css
.todo-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.events-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

### D6: Footer 刷新时间

当前 Footer 显示固定文字 "Assistant Photo Frame"。

改为最后刷新时间：
```html
<div class="footer" id="footer">更新于 --:--</div>
```

需要在模板数据 `DashboardData` 中新增 `lastRefreshTime` 字段（格式：`HH:mm`），由 DataManager.collect() 生成。

### D7: 天气纯色几何图标

用 CSS 几何形状替代文字天气描述图标：

```css
.weather-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  vertical-align: middle;
}

.weather-icon.sunny {
  background: var(--epd-yellow);
  border-radius: 50%;
}

.weather-icon.rainy {
  /* 蓝色竖线条纹 */
  background: repeating-linear-gradient(
    90deg,
    var(--epd-blue) 0px, var(--epd-blue) 2px,
    transparent 2px, transparent 5px
  );
}

.weather-icon.snowy {
  /* 蓝色星号 — 用伪元素画 + 字符 */
  color: var(--epd-blue);
  font-size: 20px;
  line-height: 24px;
  text-align: center;
}

.weather-icon.cloudy {
  background: var(--epd-gray);
  border-radius: 50%;
  width: 20px;
  height: 16px;
}
```

天气类型到图标的映射在模板 JS 中完成，基于 QWeather 的 `icon` 字段或 `text` 字段。

### D8: 已完成待办视觉分离

```css
.todo-checkbox.done {
  background: var(--epd-green);  /* 从 black 改为 green */
  position: relative;
}

.todo-checkbox.done::after {
  content: '✓';
  color: var(--epd-white);
  font-size: 12px;
  position: absolute;
  top: -2px;
  left: 1px;
}

.todo-text.done {
  text-decoration: line-through;
  color: var(--epd-black);  /* 从 gray 改为 black，保持可读性 */
  opacity: 0.7;             /* 用透明度降低视觉权重，而非灰色 */
}
```

> 注意：`opacity: 0.7` 在截屏后会产生浅色像素，FS 抖动后会呈现为黑色+白色的稀疏抖动图案，比纯灰色抖动效果更清晰，因为每像素都接近纯黑或纯白。

### D9: 今日日程黄色高亮

模板 JS 中判断 event.date 是否为今天，如果是则添加 `today` class：

```javascript
const isToday = (dateStr) => {
  const today = new Date()
  return dateStr === `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
}
```

```css
.event-item.today {
  border-left: 4px solid var(--epd-yellow);
  padding-left: var(--epd-spacing-sm);
  background: var(--epd-yellow);  /* 黄色背景 */
}

.event-item.today .event-title {
  color: var(--epd-black);  /* 黄底黑字，确保对比度 */
}
```

### D10: DashboardData 新增 lastRefreshTime

在 `data-manager.ts` 的 `DashboardData` 接口中新增：
```typescript
lastRefreshTime: string  // HH:mm 格式
```

在 `collect()` 方法中：
```typescript
lastRefreshTime: new Date().toTimeString().slice(0, 5)
```

模板 JS 读取 `data.lastRefreshTime` 填充 footer。

## Risks / Trade-offs

### R1: opacity: 0.7 用于已完成待办
- **风险**：opacity 在截屏后产生中间灰度像素，FS 抖动可能产生微弱杂色
- **缓解**：0.7 opacity 的黑色文字在白色背景上 RGB 值约为 (77,77,77)，距黑色 distSq=17875，远超阈值 24000/3000，会被正常抖动；抖动图案为黑多白少的稀疏点阵，视觉上比纯灰色更清晰

### R2: 黄色背景在日光下可读性
- **风险**：墨水屏黄色在强光下可能偏淡，黄底黑字的对比度低于白底黑字
- **缓解**：仅在"今日日程"条目使用黄色高亮，面积小、信息密度低；其他区域保持白底黑字

### R3: 去掉边框分隔线后列表层次感
- **风险**：移除 todo-item/event-item 的浅灰色底部分隔线后，列表项可能缺乏视觉分隔
- **缓解**：每个列表项之间仍有行间距（padding），且文字纯色化后整体清晰度提升，间距本身足以区分条目；如果实测不够，可保留分隔线但改为 `--epd-blue` 纯色细线
