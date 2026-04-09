## Requirements

### Requirement: 离屏渲染窗口创建
系统必须能创建一个不可见的 BrowserWindow（480×800, offscreen 模式, deviceScaleFactor=1），用于加载 HTML 模板并截屏。

#### Scenario: 创建离屏窗口
- **WHEN** 调用 `OffscreenRenderer.render(data)` 并传入仪表盘数据
- **THEN** 系统必须创建一个 `{ show: false, width: 480, height: 800, webPreferences: { offscreen: true } }` 的 BrowserWindow

#### Scenario: 窗口销毁
- **WHEN** 截屏完成（成功或失败）
- **THEN** 系统必须销毁离屏窗口释放资源，不留驻后台

### Requirement: HTML 模板加载与数据注入
离屏窗口必须加载指定的 HTML 模板文件，并将数据以 URL query 方式注入。

#### Scenario: 数据注入
- **WHEN** 渲染仪表盘时传入 `{ todos, events, weather, dateTime }` 数据
- **THEN** 系统必须将数据 JSON 序列化后通过 URL query 的 `data` 参数传递给模板

#### Scenario: 模板文件不存在
- **WHEN** 指定的模板文件路径不存在
- **THEN** 系统必须返回包含错误信息的结果，不崩溃

### Requirement: 截屏为 RGBA 像素数据
离屏窗口渲染完成后必须截屏并返回原始 RGBA 像素数据。

#### Scenario: 成功截屏
- **WHEN** HTML 模板渲染完成
- **THEN** 系统必须调用 `capturePage()` 获取 NativeImage，并通过 `toBitmap()` 返回 RGBA Uint8Array（长度 = 480 × 800 × 4 = 1,536,000）

#### Scenario: 截图尺寸验证
- **WHEN** 截屏完成
- **THEN** 系统必须验证截图尺寸为精确 480×800 像素，尺寸不匹配时返回错误

### Requirement: 等待渲染完成
系统必须在 HTML 完全渲染后再截屏，包括等待字体加载和 DOM 布局完成。

#### Scenario: 等待页面就绪
- **WHEN** 离屏窗口加载 HTML 模板
- **THEN** 系统必须等待 `did-finish-load` 事件后再执行 `capturePage()`，并额外等待一个短暂延迟（如 100ms）以确保 CSS 完全生效

#### Scenario: 渲染超时
- **WHEN** 页面加载超过 10 秒未完成
- **THEN** 系统必须超时返回错误，并销毁离屏窗口
