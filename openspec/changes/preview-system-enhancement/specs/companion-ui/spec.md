## MODIFIED Requirements

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
