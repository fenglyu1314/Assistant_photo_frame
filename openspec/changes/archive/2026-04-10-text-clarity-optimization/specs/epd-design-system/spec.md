## CHANGED Requirements

### Requirement: 排版基础规范 — 强化抗杂色
CSS 设计系统除现有的 `-webkit-font-smoothing: none` 和 `text-rendering: optimizeSpeed` 外，必须额外禁用所有可能产生非调色板像素的视觉效果。

#### Scenario: 禁用阴影和滤镜
- **WHEN** 任何元素在离屏窗口中渲染
- **THEN** CSS 必须全局设置 `text-shadow: none !important`、`box-shadow: none !important`、`filter: none !important`，防止阴影/滤镜效果引入非调色板的半透明像素

#### Scenario: 补充 font-smooth 属性
- **WHEN** 任何文字在离屏窗口中渲染
- **THEN** CSS 必须额外设置 `font-smooth: never` 和 `-moz-osx-font-smoothing: unset`，进一步抑制浏览器字体平滑

### Requirement: 仪表盘 HTML 模板 — 低分辨率元素优化
模板中小尺寸装饰元素（≤ 10px）应避免使用会产生抗锯齿像素的形状属性。

#### Scenario: 小圆形元素改用方形或菱形
- **WHEN** 模板包含小于 10px 的圆形装饰元素（如 `.event-dot` 的 `border-radius: 50%`）
- **THEN** 应改用方形或菱形（45° 旋转方形），消除小半径圆弧在低分辨率下的灰色抗锯齿像素
