## Requirements

### Requirement: App layout with split panels
App.vue SHALL render a left-right split layout. The left panel (approximately 40% width) SHALL contain the control components (SerialPanel, TodoEditor, EventEditor, WeatherPanel) in a vertically scrollable area. The right panel (approximately 60% width) SHALL contain the EpdPreview component in a fixed, non-scrollable area.

#### Scenario: App renders split layout
- **WHEN** the Electron window loads
- **THEN** the App SHALL display a left panel with control sections and a right panel with EPD preview

#### Scenario: Left panel scrolls independently
- **WHEN** the left panel content exceeds the window height
- **THEN** the left panel SHALL scroll vertically while the right panel remains fixed

### Requirement: Serial port panel
SerialPanel.vue SHALL provide device scanning, selection, and connection management. It SHALL call `serial:scan` to list available ports, `serial:connect` to connect, `serial:disconnect` to disconnect, and `serial:status` to get the current state. It SHALL listen to `serial:state-changed` events for real-time status updates.

#### Scenario: Scan for devices
- **WHEN** user clicks the "扫描" button
- **THEN** the panel SHALL invoke `serial:scan` and display the list of discovered ports, with ESP32 devices (VID=303A) visually highlighted

#### Scenario: Connect to device
- **WHEN** user selects a port and clicks "连接"
- **THEN** the panel SHALL invoke `serial:connect` with the selected port path and display the connection result (success or error message)

#### Scenario: Disconnect from device
- **WHEN** user clicks "断开" while connected
- **THEN** the panel SHALL invoke `serial:disconnect` and update the UI to reflect disconnected state

#### Scenario: Real-time connection status
- **WHEN** the serial connection state changes (connected, disconnected, error)
- **THEN** the panel SHALL update its status indicator (green = connected, amber = connecting, red = error, gray = disconnected)

### Requirement: Todo editor
TodoEditor.vue SHALL allow creating, toggling, and deleting todo items. It SHALL call `data:get-todos` on mount, `data:add-todo` to create, `data:toggle-todo` to toggle completion, and `data:remove-todo` to delete.

#### Scenario: Load existing todos
- **WHEN** the component mounts
- **THEN** it SHALL invoke `data:get-todos` and display all todo items

#### Scenario: Add a new todo
- **WHEN** user types text in the input field and presses Enter or clicks "添加"
- **THEN** the component SHALL invoke `data:add-todo` with the text and append the returned TodoItem to the list

#### Scenario: Toggle todo completion
- **WHEN** user clicks a todo item's checkbox
- **THEN** the component SHALL invoke `data:toggle-todo` with the item id and update the visual state (strikethrough for completed)

#### Scenario: Delete a todo
- **WHEN** user clicks the delete button on a todo item
- **THEN** the component SHALL invoke `data:remove-todo` with the item id and remove it from the displayed list

### Requirement: Event editor
EventEditor.vue SHALL allow creating and deleting calendar events. It SHALL call `data:get-events` on mount, `data:add-event` to create, and `data:remove-event` to delete.

#### Scenario: Load upcoming events
- **WHEN** the component mounts
- **THEN** it SHALL invoke `data:get-events` and display upcoming events sorted by date

#### Scenario: Add a new event
- **WHEN** user fills in title, date (required), and optionally time, then clicks "添加"
- **THEN** the component SHALL invoke `data:add-event` with {title, date, time} and append the returned CalendarEvent to the list

#### Scenario: Delete an event
- **WHEN** user clicks the delete button on an event
- **THEN** the component SHALL invoke `data:remove-event` with the event id and remove it from the displayed list

### Requirement: Weather settings panel
WeatherPanel.vue SHALL allow configuring the QWeather API key and location ID. It SHALL call `config:get` to load current weather config and `config:set` to save changes.

#### Scenario: Load weather config
- **WHEN** the component mounts
- **THEN** it SHALL invoke `config:get` with key "weather" and populate the API Key and Location ID input fields

#### Scenario: Save weather config
- **WHEN** user edits the API Key or Location ID and clicks "保存"
- **THEN** the component SHALL invoke `config:set` with key "weather" and the updated config object, and display a success indicator

### Requirement: EPD preview and manual refresh
EpdPreview.vue SHALL display the current EPD render output and allow manual refresh. It SHALL call `pipeline:execute` to trigger a full pipeline run, listen to `pipeline:stage-progress` for progress display, and display the rendered preview image.

#### Scenario: Manual refresh trigger
- **WHEN** user clicks the "刷新墨水屏" button
- **THEN** the component SHALL invoke `pipeline:execute` and display a progress indicator showing each pipeline stage (collecting → rendering → enhancing → quantizing → encoding → sending → done)

#### Scenario: Refresh result display
- **WHEN** pipeline execution completes successfully
- **THEN** the component SHALL display the render duration and a success message

#### Scenario: Refresh error handling
- **WHEN** pipeline execution fails (device not connected, render error, etc.)
- **THEN** the component SHALL display the error message and allow user to retry

#### Scenario: Transfer progress display
- **WHEN** the pipeline is in the "sending" stage
- **THEN** the component SHALL listen to `serial:transfer-progress` events and display a progress bar showing chunk transfer percentage
