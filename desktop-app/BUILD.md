# Flow Desk Desktop App Build Process

This document describes the complete build process for the Flow Desk desktop application, including Rust CLI binary compilation and distribution packaging.

## Overview

The Flow Desk desktop app is built using Electron and includes a Rust CLI binary that provides core functionality for mail, calendar, and search operations. The build process ensures that the Rust binary is properly compiled and included in the final distribution packages for all supported platforms.

## Prerequisites

### Required Software

- **Node.js**: Version 16 or higher
- **npm**: Version 7 or higher
- **Rust**: Latest stable version (install via [rustup.rs](https://rustup.rs/))
- **Cargo**: Included with Rust installation

### Platform-Specific Requirements

#### macOS
- Xcode Command Line Tools: `xcode-select --install`

#### Windows
- Microsoft Visual Studio Build Tools or Visual Studio Community
- Windows 10 SDK

#### Linux
- build-essential package: `sudo apt-get install build-essential`
- Additional dependencies may be required based on distribution

## Project Structure

```
desktop-app/
├── src/                           # Electron app source code
│   ├── main/                     # Main process (Node.js)
│   ├── renderer/                 # Renderer process (React)
│   └── lib/                      # Libraries and integrations
│       └── rust-engine/          # Copied Rust library source
├── dist/                         # Build output directory
│   ├── main/                     # Compiled main process
│   ├── renderer/                 # Compiled renderer process
│   ├── lib/                      # Compiled libraries
│   └── binaries/                 # Platform-specific Rust binaries
│       ├── darwin-x64/
│       ├── darwin-arm64/
│       ├── win32-x64/
│       ├── win32-ia32/
│       └── linux-x64/
├── scripts/                      # Build and utility scripts
├── build/                        # Electron Builder output
└── package.json                  # Build configuration
```

## Build Scripts

### Core Build Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Complete build process (Rust + Electron) |
| `npm run build:rust` | Build Rust CLI binary for current platform |
| `npm run build:renderer` | Build React renderer process |
| `npm run build:main` | Build Electron main process |

### Platform-Specific Scripts

| Script | Purpose |
|--------|---------|
| `npm run build:rust:all-platforms` | Build Rust binaries for all platforms |
| `npm run dist:mac` | Create macOS distribution packages |
| `npm run dist:win` | Create Windows distribution packages |
| `npm run dist:linux` | Create Linux distribution packages |

### Utility Scripts

| Script | Purpose |
|--------|---------|
| `npm run verify:build` | Verify build integrity and binary functionality |
| `npm run test:distribution` | Test distribution structure and configuration |
| `npm run clean` | Clean build artifacts |

## Build Process

### 1. Development Build

For development and testing:

```bash
# Install dependencies
npm install

# Build for current platform
npm run build

# The build process will:
# 1. Clean previous binaries
# 2. Copy Rust library source
# 3. Compile Rust CLI binary
# 4. Build React renderer
# 5. Build Electron main process
# 6. Copy binaries to distribution folder
# 7. Verify build integrity
```

### 2. Production Build

For production release:

```bash
# Build for all supported platforms (requires cross-compilation setup)
npm run build:production

# Or build for specific platforms
npm run dist:mac      # macOS packages (.dmg)
npm run dist:win      # Windows packages (.exe installer)
npm run dist:linux    # Linux packages (.AppImage)
```

## Rust Binary Integration

### Binary Compilation

The Rust CLI binary (`flow_desk_cli`) is compiled from the shared Rust library located at `../shared/rust-lib`. The build process:

1. **Copy Source**: Rust source is copied to `src/lib/rust-engine/`
2. **Compile Binary**: `cargo build --release --bin flow_desk_cli`
3. **Copy Binary**: Binary is copied to `dist/binaries/{platform}/`
4. **Set Permissions**: Executable permissions are set (Unix-like systems)

### Platform Targets

| Platform | Target Triple | Binary Name |
|----------|---------------|-------------|
| macOS x64 | `x86_64-apple-darwin` | `flow_desk_cli` |
| macOS ARM64 | `aarch64-apple-darwin` | `flow_desk_cli` |
| Windows x64 | `x86_64-pc-windows-gnu` | `flow_desk_cli.exe` |
| Windows x86 | `i686-pc-windows-gnu` | `flow_desk_cli.exe` |
| Linux x64 | `x86_64-unknown-linux-gnu` | `flow_desk_cli` |

### Cross-Platform Compilation

To build for multiple platforms, install Rust targets:

```bash
# Install all supported targets
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
rustup target add x86_64-pc-windows-gnu
rustup target add i686-pc-windows-gnu
rustup target add x86_64-unknown-linux-gnu
```

Note: Cross-compilation may require additional setup depending on your host platform.

## Electron Builder Configuration

### File Inclusion

The build configuration specifies which files to include/exclude:

```json
{
  "files": [
    "dist/**/*",
    "assets/**/*",
    "node_modules/**/*",
    "!dist/lib/rust-engine/target/**/*",
    "!dist/lib/rust-engine/src/**/*",
    "!dist/lib/rust-engine/Cargo.lock"
  ]
}
```

### Binary Distribution

Rust binaries are included as extra resources:

```json
{
  "extraResources": [
    {
      "from": "dist/binaries/",
      "to": "binaries/",
      "filter": ["**/*"]
    }
  ]
}
```

### ASAR Unpacking

Binaries are unpacked from the ASAR archive for runtime access:

```json
{
  "asarUnpack": ["**/binaries/**/*"]
}
```

## Runtime Binary Access

In the packaged application, binaries are accessible at:

```javascript
const { app } = require('electron');
const path = require('path');

// Get the correct binary path
function getRustBinaryPath() {
  const platform = `${process.platform}-${process.arch}`;
  const binaryName = process.platform === 'win32' ? 'flow_desk_cli.exe' : 'flow_desk_cli';
  
  if (app.isPackaged) {
    // In packaged app: resources/binaries/{platform}/{binary}
    return path.join(process.resourcesPath, 'binaries', platform, binaryName);
  } else {
    // In development: dist/binaries/{platform}/{binary}
    return path.join(__dirname, '../../dist/binaries', platform, binaryName);
  }
}
```

## Build Verification

### Automated Verification

The build process includes automated verification:

```bash
npm run verify:build
```

This checks:
- ✅ Distribution structure integrity
- ✅ Binary presence and permissions
- ✅ Binary functionality (execution test)
- ✅ Electron Builder configuration
- ✅ Build script availability

### Manual Testing

Test the distribution structure:

```bash
npm run test:distribution
```

This simulates the packaging process and shows:
- File inclusion patterns
- Resource copying configuration
- Platform-specific settings
- Expected final app structure

## Troubleshooting

### Common Issues

#### 1. Rust Binary Not Found
```
Error: Binary not found at expected location
```
**Solution**: Ensure Rust is properly installed and `cargo build --release` succeeds.

#### 2. Permission Denied (Unix)
```
Error: Binary execution failed (permission denied)
```
**Solution**: The build process automatically sets executable permissions. If issues persist, manually run:
```bash
chmod +x dist/binaries/*/flow_desk_cli
```

#### 3. Cross-Compilation Failures
```
Error: linker not found for target
```
**Solution**: Install required cross-compilation toolchains for target platforms.

#### 4. Electron Version Mismatch
```
Error: Cannot compute electron version
```
**Solution**: Ensure Electron is installed as a dependency:
```bash
npm install electron@^33.4.11
```

### Debug Build Process

Enable verbose logging:

```bash
# Debug Rust compilation
RUST_LOG=debug npm run build:rust

# Debug Electron Builder
DEBUG=electron-builder npm run dist
```

## Performance Optimization

### Build Time Optimization

1. **Incremental Rust Builds**: Use `cargo build --release` only when needed
2. **Parallel Builds**: Utilize multi-core compilation with `CARGO_BUILD_JOBS`
3. **Cache Dependencies**: Use `sccache` for Rust compilation caching

### Binary Size Optimization

1. **Strip Debug Symbols**: Automatically done in release builds
2. **Link-Time Optimization**: Enabled in Cargo.toml
3. **Dependency Minimization**: Only include required Rust crates

## Security Considerations

### Code Signing

For production releases, configure code signing:

```json
{
  "mac": {
    "identity": "Developer ID Application: Your Name",
    "hardenedRuntime": true,
    "entitlements": "build/entitlements.mac.plist"
  },
  "win": {
    "certificateFile": "path/to/certificate.p12",
    "certificatePassword": "password"
  }
}
```

### Binary Verification

Binaries are verified during build:
- ✅ Execution test confirms functionality
- ✅ File permissions are correctly set
- ✅ Size validation prevents corrupted binaries

## Deployment

### Automated Release

For CI/CD integration:

```bash
# Build and package for all platforms
npm run build:production
npm run dist:mac
npm run dist:win
npm run dist:linux

# Upload artifacts from build/ directory
```

### Distribution Channels

- **macOS**: `.dmg` files via Mac App Store or direct distribution
- **Windows**: `.exe` installers via Microsoft Store or direct distribution
- **Linux**: `.AppImage` files via package managers or direct distribution

## Support

For build issues:

1. Check this documentation
2. Run verification scripts: `npm run verify:build`
3. Check the GitHub issues for known problems
4. Contact the development team

---

**Last Updated**: September 2025
**Build System Version**: 0.1.0