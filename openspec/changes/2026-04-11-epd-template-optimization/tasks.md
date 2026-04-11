## 1. Header 精简

- [ ] 1.1 修改 `companion/templates/dashboard.html`：删除 `.time-display` 元素和 `#timeDisplay`，将 `.date-main` 和 `.date-weekday` 合并为单行（如 `2026年4月11日 · 星期六`），`·` 使用 `--epd-blue` 着色
- [ ] 1.2 修改 `companion/templates/dashboard.html` 的 `<style>` 区域：简化 `.header` 为单行居左布局，删除 `.date-section`/`.date-main`/`.date-weekday`/`.time-display` 的旧样式，新增合并后的样式

## 2. 文字颜色纯色化

- [ ] 2.1 修改 `companion/templates/dashboard.html` 的 CSS：`.todo-text.done` 颜色从 `--epd-gray` 改为 `--epd-black` + `opacity: 0.7`
- [ ] 2.2 `.section-count` 颜色从 `--epd-gray` 改为 `--epd-blue`
- [ ] 2.3 `.event-time` 颜色从 `--epd-gray` 改为 `--epd-blue`
- [ ] 2.4 `.weather-placeholder` 文字和边框颜色从 `--epd-gray` 改为 `--epd-blue`
- [ ] 2.5 `.empty-hint` 颜色从 `--epd-gray` 改为 `--epd-blue`
- [ ] 2.6 `.footer` 颜色从 `--epd-light-gray` 改为 `--epd-blue`，border-top 从 `--epd-light-gray` 改为 `--epd-blue`
- [ ] 2.7 `.todo-item` 和 `.event-item` 的 `border-bottom` 从 `--epd-light-gray` 改为移除

## 3. 充分利用黄色和绿色

- [ ] 3.1 `.todo-checkbox.done` 背景从 `--epd-black` 改为 `--epd-green`
- [ ] 3.2 新增今日日程黄色高亮：模板 JS 新增 `isToday()` 判断，event-item 若为今天则添加 `.today` class
- [ ] 3.3 新增 `.event-item.today` CSS：左侧 4px 黄色竖条 + 黄色背景 + 黑色文字

## 4. Section Header 色块条

- [ ] 4.1 修改 HTML：section-header 中将 `.section-icon` 替换为 `.section-bar`（6px 宽色块条）
- [ ] 4.2 待办 section-header 添加 `todo-header` class，日程 section-header 添加 `event-header` class
- [ ] 4.3 CSS：`.todo-header .section-bar { background: var(--epd-blue) }`，`.event-header .section-bar { background: var(--epd-red) }`

## 5. 布局弹性分配

- [ ] 5.1 `.events-list` 添加 `flex: 1; min-height: 0;`，与 `.todo-list` 同等参与空间分配

## 6. Footer 刷新时间

- [ ] 6.1 修改 `companion/electron/data/data-manager.ts`：`DashboardData` 接口新增 `lastRefreshTime: string`，`collect()` 方法中赋值 `new Date().toTimeString().slice(0, 5)`
- [ ] 6.2 修改 `companion/templates/dashboard.html`：Footer 内容改为 `更新于 <span id="refreshTime">--:--</span>`，render() 中从 `data.lastRefreshTime` 读取填充
- [ ] 6.3 删除 render() 中 `document.getElementById('timeDisplay')` 相关代码

## 7. 天气纯色几何图标

- [ ] 7.1 在 `dashboard.html` 的 `<style>` 中新增 `.weather-icon` 及其变体样式（`.sunny`/`.rainy`/`.cloudy`/`.snowy`）
- [ ] 7.2 在模板 JS 中新增 `getWeatherIconClass(text)` 函数，根据 QWeather 天气文本返回对应 CSS class
- [ ] 7.3 修改天气渲染逻辑：当前天气区域左侧新增 `.weather-icon` 元素，预报区域保持不变

## 8. 集成验证

- [ ] 8.1 运行 `npm run build` 确认 TypeScript 编译无错误（data-manager.ts 新增字段可能影响类型）
- [ ] 8.2 运行 `npm run test` 确认所有单元测试通过
- [ ] 8.3 运行 `npm run dev` 启动桌面端，手动验证模板渲染效果：
  - Header 为单行日期+星期，无时间显示
  - 所有文字为 6 色纯色，无灰色文字
  - 已完成待办为绿色 checkbox + 删除线
  - 今日日程有黄色高亮
  - Section Header 有蓝色/红色色块条
  - Footer 显示刷新时间
  - 天气图标为纯色几何形状
  - Todos 和 Events 区域空间分配均衡
- [ ] 8.4 连接墨水屏实际刷屏验证（用户手动执行）
