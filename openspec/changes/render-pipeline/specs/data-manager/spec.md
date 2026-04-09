## ADDED Requirements

### Requirement: 数据聚合接口
DataManager 必须提供统一的 `collect()` 方法，聚合所有仪表盘所需数据。

#### Scenario: 收集完整数据
- **WHEN** 调用 `DataManager.collect()`
- **THEN** 必须返回 `DashboardData` 对象，包含 `{ todos, events, weather, dateTime }` 四个字段

#### Scenario: 天气获取失败时的降级
- **WHEN** 天气 API 调用失败（网络错误或无 API Key）
- **THEN** `weather` 字段必须为 `null`，其他字段正常返回，不影响整体流程

### Requirement: 待办事项管理
DataManager 必须支持待办事项的 CRUD 操作，数据持久化到 electron-store。

#### Scenario: 添加待办
- **WHEN** 调用 `addTodo(text)` 传入待办文本
- **THEN** 必须创建带唯一 ID 的待办记录，`done` 默认为 `false`，持久化并返回新记录

#### Scenario: 切换完成状态
- **WHEN** 调用 `toggleTodo(id)` 传入待办 ID
- **THEN** 必须翻转该待办的 `done` 状态并持久化

#### Scenario: 删除待办
- **WHEN** 调用 `removeTodo(id)` 传入待办 ID
- **THEN** 必须删除该待办并持久化

#### Scenario: 获取全部待办
- **WHEN** 调用 `getTodos()`
- **THEN** 必须返回所有待办记录数组，按创建时间排序

### Requirement: 日程管理
DataManager 必须支持日程的 CRUD 操作，数据持久化到 electron-store。

#### Scenario: 添加日程
- **WHEN** 调用 `addEvent(title, date, time?)` 传入日程标题、日期和可选时间
- **THEN** 必须创建带唯一 ID 的日程记录，持久化并返回新记录

#### Scenario: 删除日程
- **WHEN** 调用 `removeEvent(id)` 传入日程 ID
- **THEN** 必须删除该日程并持久化

#### Scenario: 获取即将到来的日程
- **WHEN** 调用 `getUpcomingEvents(days?)`
- **THEN** 必须返回从今天起 N 天内（默认 7 天）的日程，按日期升序排序

### Requirement: QWeather 天气 API 封装
系统必须封装和风天气 API，支持获取实时天气和短期预报。

#### Scenario: 获取实时天气
- **WHEN** 调用 `WeatherApi.getCurrent(location, apiKey)`
- **THEN** 必须请求 QWeather 实时天气接口，返回 `{ temp, text, icon }` 等信息

#### Scenario: 获取 3 日预报
- **WHEN** 调用 `WeatherApi.getForecast(location, apiKey)`
- **THEN** 必须请求 QWeather 3 天预报接口，返回每日 `{ date, tempMin, tempMax, textDay, iconDay }` 数组

#### Scenario: API 错误处理
- **WHEN** API 返回非 200 状态码或 code 字段不为 200
- **THEN** 必须抛出包含错误码和描述的异常，调用方可以捕获

#### Scenario: 网络超时
- **WHEN** HTTP 请求超过 10 秒未响应
- **THEN** 必须抛出超时异常

### Requirement: 配置持久化
系统必须使用 electron-store 保存用户配置和应用数据。

#### Scenario: 默认配置
- **WHEN** 应用首次启动，没有配置文件
- **THEN** 必须使用默认配置：天气 API Key 为空、刷新间隔 30 分钟、空待办列表、空日程列表

#### Scenario: 读写配置
- **WHEN** 调用 `ConfigStore.get(key)` 或 `ConfigStore.set(key, value)`
- **THEN** 必须正确读写配置值，写入后立即持久化

#### Scenario: 配置损坏恢复
- **WHEN** 配置文件被损坏无法解析
- **THEN** 必须回退到默认配置，不崩溃
