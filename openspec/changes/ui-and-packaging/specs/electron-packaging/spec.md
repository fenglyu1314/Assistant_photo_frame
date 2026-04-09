## ADDED Requirements

### Requirement: Electron-builder packaging configuration
The project SHALL include an electron-builder configuration in `package.json` that produces a Windows NSIS installer (`.exe`). The configuration SHALL properly handle native modules (serialport) via electron-rebuild.

#### Scenario: Build produces NSIS installer
- **WHEN** user runs `npm run build:dist` (or equivalent packaging command)
- **THEN** electron-builder SHALL produce a `.exe` NSIS installer in the `dist/` directory

#### Scenario: Native module compatibility
- **WHEN** the packaged application runs on a user's Windows machine
- **THEN** the serialport native module SHALL load correctly and function identically to development mode

#### Scenario: Application metadata
- **WHEN** the installer runs
- **THEN** it SHALL display the application name "Assistant Photo Frame", version from package.json, and install to the user's Program Files directory

### Requirement: Build script configuration
The package.json SHALL include a `build:dist` script that runs `electron-vite build` followed by `electron-builder` to produce the installer. Template files (`templates/`) SHALL be included in the packaged application's extraResources.

#### Scenario: Templates bundled in package
- **WHEN** the application is installed and runs
- **THEN** the `templates/dashboard.html` and `templates/epd-design-system.css` files SHALL be accessible to the OffscreenRenderer at the expected path

#### Scenario: Resources included
- **WHEN** the application is packaged
- **THEN** the `resources/` directory (containing icons) SHALL be included in the package
