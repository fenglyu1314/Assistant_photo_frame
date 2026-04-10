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
EpdPreview.vue SHALL display the current EPD render output with dual-image comparison (original vs quantized), zoom/pan controls, and separate controls for preview and device sync. It SHALL call `pipeline:render-preview` to trigger preview rendering, `pipeline:sync-device` to sync to device, listen to `pipeline:stage-progress` for progress display, and display both the original and quantized preview images.

#### Scenario: Manual preview trigger
- **WHEN** user clicks the "刷新预览" button
- **THEN** the component SHALL invoke `pipeline:render-preview` and display a progress indicator showing Stage 1-5 stages (collecting → rendering → enhancing → quantizing → encoding → done)

#### Scenario: Preview result display with dual images
- **WHEN** preview rendering completes successfully
- **THEN** the component SHALL display both the original preview image (`previewDataUrl`) and the quantized effect image (`quantizedDataUrl`), defaulting to the quantized image Tab, and show the render duration

#### Scenario: Tab switching between original and quantized
- **WHEN** user clicks the "原图" or "量化图" Tab
- **THEN** the preview area SHALL immediately switch to display the corresponding image without re-rendering

#### Scenario: Zoom control
- **WHEN** user clicks a zoom level button (适应/50%/75%/100%)
- **THEN** the preview image SHALL scale to the selected level. "适应" SHALL fit the image within the preview container. "100%" SHALL display the image at full 480×800 pixel resolution (1:1)

#### Scenario: Ctrl+Scroll zoom
- **WHEN** user holds Ctrl and scrolls the mouse wheel over the preview area
- **THEN** the zoom level SHALL cycle through available levels (zoom in on scroll up, zoom out on scroll down)

#### Scenario: Drag-to-pan when zoomed
- **WHEN** the image is zoomed beyond the container size (overflow)
- **THEN** the user SHALL be able to click and drag to pan the view, or use scrollbars to navigate

#### Scenario: Color statistics display
- **WHEN** preview rendering completes and `colorStats` is available
- **THEN** the component SHALL display the 6-color usage percentages below the preview image (showing each color's pixel count or percentage)

#### Scenario: Preview error handling
- **WHEN** preview rendering fails (render error, etc.)
- **THEN** the component SHALL display the error message and allow user to retry

#### Scenario: Sync to device trigger
- **WHEN** user clicks the "同步到墨水屏" button
- **THEN** the component SHALL invoke `pipeline:sync-device` and display a progress indicator showing the sending stage with transfer progress

#### Scenario: Sync button availability
- **WHEN** no preview has been rendered (no cached buffer) OR the serial device is not connected
- **THEN** the "同步到墨水屏" button SHALL be disabled with appropriate tooltip explaining why

#### Scenario: Sync button enabled
- **WHEN** a preview has been rendered (cached buffer exists) AND the serial device is connected
- **THEN** the "同步到墨水屏" button SHALL be enabled and clickable

#### Scenario: Transfer progress display
- **WHEN** the sync operation is in the "sending" stage
- **THEN** the component SHALL listen to `serial:transfer-progress` events and display a progress bar showing chunk transfer percentage
