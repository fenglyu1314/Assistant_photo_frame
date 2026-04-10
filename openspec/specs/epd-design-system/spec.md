## Requirements

### Requirement: EPD 六色 CSS 变量
CSS 设计系统必须定义与硬件调色板精确对应的 CSS 自定义属性。

#### Scenario: 六色变量定义
- **WHEN** HTML 模板引用 CSS 设计系统
- **THEN** 必须提供以下 CSS 变量：`--epd-black: #000000`, `--epd-white: #ffffff`, `--epd-yellow: #ffff00`, `--epd-red: #ff0000`, `--epd-blue: #0000ff`, `--epd-green: #00ff00`

#### Scenario: 辅助色（抖动友好的中间色）
- **WHEN** 模板需要使用灰色、浅黄等中间色
- **THEN** CSS 必须提供通过 FS 抖动可良好呈现的推荐色值作为辅助变量（如 `--epd-gray`, `--epd-light-yellow`）

### Requirement: 排版基础规范
CSS 设计系统必须提供适合墨水屏显示的排版基础样式，并强化抗杂色措施。

#### Scenario: 禁用抗锯齿
- **WHEN** 任何文字在离屏窗口中渲染
- **THEN** CSS 必须设置 `-webkit-font-smoothing: none` 和 `text-rendering: optimizeSpeed`，避免半透明像素

#### Scenario: 字体栈
- **WHEN** 模板使用默认字体
- **THEN** 必须使用通用系统字体栈（`system-ui, 'Microsoft YaHei', Arial, sans-serif`），确保中文显示

#### Scenario: 图片渲染模式
- **WHEN** 模板包含图片或图标
- **THEN** CSS 必须设置 `image-rendering: pixelated`，避免图片被抗锯齿模糊

#### Scenario: 禁用阴影和滤镜
- **WHEN** 任何元素在离屏窗口中渲染
- **THEN** CSS 必须全局设置 `text-shadow: none !important`、`box-shadow: none !important`、`filter: none !important`，防止阴影/滤镜效果引入非调色板的半透明像素

#### Scenario: 补充 font-smooth 属性
- **WHEN** 任何文字在离屏窗口中渲染
- **THEN** CSS 必须额外设置 `font-smooth: never` 和 `-moz-osx-font-smoothing: unset`，进一步抑制浏览器字体平滑

### Requirement: 仪表盘 HTML 模板
系统必须提供一个开箱即用的仪表盘 HTML 模板，尺寸精确 480×800 像素。模板中小尺寸装饰元素（≤ 10px）应避免使用会产生抗锯齿像素的形状属性。

#### Scenario: 小圆形元素改用方形或菱形
- **WHEN** 模板包含小于 10px 的圆形装饰元素（如 `.event-dot` 的 `border-radius: 50%`）
- **THEN** 应改用方形或菱形（45° 旋转方形），消除小半径圆弧在低分辨率下的灰色抗锯齿像素

#### Scenario: 模板布局
- **WHEN** 仪表盘模板被渲染
- **THEN** 必须包含以下区域：顶部日期时间区、天气信息区、待办事项列表、日程列表

#### Scenario: 视口尺寸
- **WHEN** 模板在离屏窗口中加载
- **THEN** `<body>` 必须设置为精确 480px 宽 × 800px 高，无滚动条，`overflow: hidden`

#### Scenario: 数据解析
- **WHEN** 模板通过 URL query 接收到 `data` 参数
- **THEN** 模板内的 JavaScript 必须解析 JSON 数据，并将待办、日程、天气、日期时间填充到对应的 DOM 区域

#### Scenario: 空数据状态
- **WHEN** 某些数据字段为空（如无待办或无天气）
- **THEN** 模板必须优雅显示空状态提示，不出现布局错乱

### Requirement: 墨水屏颜色策略
模板的视觉设计必须针对六色墨水屏量化后的效果优化。

#### Scenario: UI 骨架使用纯六色
- **WHEN** 模板渲染文字、边框、分隔线等 UI 骨架元素
- **THEN** 必须仅使用六色调色板中的纯色，避免量化后的颜色漂移

#### Scenario: 背景色
- **WHEN** 仪表盘模板渲染背景
- **THEN** 必须使用 `--epd-white`（#ffffff）作为主背景色，确保与墨水屏白底一致
