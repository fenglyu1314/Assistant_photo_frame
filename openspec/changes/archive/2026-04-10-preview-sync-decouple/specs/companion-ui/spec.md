## MODIFIED Requirements

### Requirement: EPD preview and manual refresh
EpdPreview.vue SHALL display the current EPD render output with separate controls for preview and device sync. It SHALL call `pipeline:render-preview` to trigger preview rendering, `pipeline:sync-device` to sync to device, listen to `pipeline:stage-progress` for progress display, and display the rendered preview image.

#### Scenario: Manual preview trigger
- **WHEN** user clicks the "刷新预览" button
- **THEN** the component SHALL invoke `pipeline:render-preview` and display a progress indicator showing Stage 1-5 stages (collecting → rendering → enhancing → quantizing → encoding → done)

#### Scenario: Preview result display
- **WHEN** preview rendering completes successfully
- **THEN** the component SHALL immediately display the rendered preview image (previewDataUrl) and show the render duration

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

#### Scenario: Preview click shortcut
- **WHEN** user clicks on the preview image area (not on buttons)
- **THEN** the component SHALL trigger a preview refresh (same as clicking "刷新预览")
