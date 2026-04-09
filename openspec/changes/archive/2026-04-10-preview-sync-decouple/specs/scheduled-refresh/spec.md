## MODIFIED Requirements

### Requirement: Periodic background refresh
The main process SHALL execute the render pipeline at a configurable interval (stored in `config.refresh.intervalMinutes`, default 30 minutes). The refresh timer SHALL only trigger pipeline execution when the serial device is connected. The timer SHALL use `renderPipeline.execute()` which internally calls renderPreview() + syncToDevice().

#### Scenario: Timer starts after device connects
- **WHEN** the serial device connection state changes to "connected"
- **THEN** the main process SHALL start a periodic timer that calls `renderPipeline.execute()` at the configured interval

#### Scenario: Timer stops when device disconnects
- **WHEN** the serial device connection state changes to "disconnected"
- **THEN** the main process SHALL stop the periodic refresh timer

#### Scenario: Interval configuration change
- **WHEN** the user updates `config.refresh.intervalMinutes` via `config:set`
- **THEN** the main process SHALL restart the timer with the new interval

#### Scenario: Concurrent execution protection
- **WHEN** the timer fires while a pipeline execution is already in progress (manual preview, manual sync, or previous timer)
- **THEN** the timer callback SHALL skip execution (RenderPipeline's built-in concurrency guard returns "Pipeline already running")

#### Scenario: Initial refresh on connect
- **WHEN** the device first connects successfully
- **THEN** the main process SHALL execute the pipeline once immediately via `renderPipeline.execute()`, then start the periodic timer
