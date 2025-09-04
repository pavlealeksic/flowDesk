# Flow Desk - Cross-Platform Deployment Guide

This guide covers deploying Flow Desk across Windows, macOS, and Linux platforms with full feature compatibility.

## 🎯 Platform Support Matrix

| Platform | Architecture | Status | Notes |
|----------|-------------|---------|-------|
| **macOS** | Intel (x64) | ✅ Full | Native build on Intel Macs |
| **macOS** | Apple Silicon (ARM64) | ✅ Full | Native build on M1/M2 Macs |
| **Windows** | x64 | ✅ Full | Windows 10/11 support |
| **Windows** | x86 (32-bit) | ✅ Full | Legacy Windows support |
| **Linux** | x64 | ✅ Full | Ubuntu, Debian, RHEL, etc. |
| **Linux** | ARM64 | ⚠️ Experimental | Raspberry Pi 4+, ARM servers |

## 🔧 Prerequisites by Platform

### All Platforms
- **Node.js**: 18+ required (LTS recommended)
- **npm**: 8+ or **pnpm**: 7+ 
- **Rust**: Latest stable (required for native performance modules)

### Windows
```powershell
# Install via Chocolatey (recommended)
choco install nodejs rust git

# Or install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

**Required Components:**
- Visual Studio Build Tools 2019/2022
- Windows SDK (latest)
- MSVC compiler toolchain

### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install via Homebrew
brew install node rust git

# For universal builds (Intel + Apple Silicon)
rustup target add x86_64-apple-darwin aarch64-apple-darwin
```

**Required Components:**
- Xcode Command Line Tools
- macOS SDK (automatically included)

### Linux (Ubuntu/Debian)
```bash
# Update package lists
sudo apt update

# Install build dependencies
sudo apt install -y curl git build-essential pkg-config libsecret-1-dev \
  libgtk-3-dev libdrm2 libxss1 libasound2-dev

# Install Node.js (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

### Linux (RHEL/CentOS/Fedora)
```bash
# For RHEL/CentOS 8+
sudo dnf install -y curl git gcc gcc-c++ make pkgconfig libsecret-devel \
  gtk3-devel libdrm-devel libXScrnSaver alsa-lib-devel

# For older versions, use yum instead of dnf

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

## 🚀 Building Flow Desk

### 1. Platform Validation
Before building, validate your environment:

```bash
# Check platform compatibility
npm run validate:prebuild

# Full platform validation (recommended)
npm run validate:platform
```

### 2. Development Build

```bash
# Clone repository
git clone https://github.com/your-org/flowdesk.git
cd flowdesk/desktop-app

# Install dependencies
npm install

# Build for development (current platform only)
npm run build:core

# Build with Rust components
npm run build:full

# Run in development mode
npm run dev:core
```

### 3. Production Build

```bash
# Build for current platform
npm run build:production

# Build for all platforms (requires cross-compilation setup)
npm run build:rust:all-platforms

# Create distribution packages
npm run dist:production
```

### 4. Platform-Specific Distribution

```bash
# macOS (runs on macOS only)
npm run dist:mac

# Windows (can run on Linux with Wine)
npm run dist:win

# Linux (runs on Linux only)
npm run dist:linux
```

## 📦 Distribution Packages

### macOS
- **DMG**: Drag-and-drop installer (`FlowDesk-{version}-{arch}.dmg`)
- **ZIP**: Portable app bundle (`FlowDesk-{version}-{arch}-mac.zip`)

**Code Signing:** Requires Apple Developer account and certificates.

### Windows
- **NSIS Installer**: Full installer with shortcuts (`FlowDesk-{version}-{arch}-setup.exe`)
- **ZIP**: Portable version (`FlowDesk-{version}-{arch}-win.zip`)

**Code Signing:** Requires valid code signing certificate.

### Linux
- **AppImage**: Universal Linux app (`FlowDesk-{version}-{arch}.AppImage`)
- **DEB**: Debian/Ubuntu package (`FlowDesk-{version}-{arch}.deb`)
- **RPM**: RHEL/Fedora package (`FlowDesk-{version}-{arch}.rpm`)
- **TAR.GZ**: Archive for manual installation

## 🔒 Security & Code Signing

### macOS Notarization
```bash
# Set environment variables
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"

# Build with notarization
npm run dist:mac
```

### Windows Code Signing
```bash
# Set certificate information
export CSC_LINK="path-to-certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

# Build with code signing
npm run dist:win
```

### Linux Package Signing
```bash
# Set GPG key for package signing
export GPG_PRIVATE_KEY="your-gpg-private-key"
export GPG_PASSPHRASE="gpg-passphrase"

# Build signed packages
npm run dist:linux
```

## 🗂️ Cross-Platform File System

Flow Desk automatically handles platform-specific paths:

| Data Type | Windows | macOS | Linux |
|-----------|---------|--------|--------|
| **App Data** | `%APPDATA%\FlowDesk` | `~/Library/Application Support/FlowDesk` | `~/.config/flowdesk` |
| **Cache** | `%LOCALAPPDATA%\FlowDesk\Cache` | `~/Library/Caches/FlowDesk` | `~/.cache/flowdesk` |
| **Logs** | `%LOCALAPPDATA%\FlowDesk\Logs` | `~/Library/Logs/FlowDesk` | `~/.local/state/flowdesk/logs` |
| **Temp** | `%TEMP%\flowdesk-*` | `/tmp/flowdesk-*` | `/tmp/flowdesk-*` |

## 🔐 Secure Storage

### Platform-Specific Credential Storage

| Platform | Storage Method | Fallback |
|----------|----------------|----------|
| **Windows** | Windows Credential Manager | Encrypted file |
| **macOS** | Keychain Services | Encrypted file |
| **Linux** | Secret Service (libsecret) | Encrypted file |

### Encryption Keys
- **Automatic Generation**: Keys generated on first launch
- **Platform Storage**: Stored in secure platform keychain
- **Rotation**: 90-day automatic rotation (configurable)

## 🌐 Network Configuration

### Proxy Support
- **Auto-detection**: System proxy settings
- **Manual Configuration**: Via environment variables
- **Platform-specific**: Uses OS network stack

### Email/Calendar Protocols
- **IMAP/SMTP**: Universal email protocol support
- **CalDAV**: Cross-platform calendar synchronization
- **OAuth2**: Google, Microsoft, Yahoo authentication

## 🔧 Troubleshooting

### Common Build Issues

#### Native Module Compilation Failures
```bash
# Rebuild native modules
npm run rebuild:native

# Check specific module
npm rebuild better-sqlite3
```

#### Rust Compilation Issues
```bash
# Check Rust installation
rustc --version
cargo --version

# Install required targets
rustup target add x86_64-apple-darwin  # macOS Intel
rustup target add aarch64-apple-darwin # macOS ARM
rustup target add x86_64-pc-windows-gnu # Windows
rustup target add x86_64-unknown-linux-gnu # Linux
```

#### Windows-Specific Issues
- **Node-gyp errors**: Ensure Visual Studio Build Tools installed
- **Permission errors**: Run as Administrator
- **Path length**: Enable long path support in Windows

#### Linux-Specific Issues
- **Missing libsecret**: `sudo apt install libsecret-1-dev`
- **AppImage permissions**: `chmod +x FlowDesk-*.AppImage`
- **GTK themes**: Install appropriate theme packages

#### macOS-Specific Issues
- **Gatekeeper**: App may need to be signed and notarized
- **Quarantine**: Remove with `xattr -cr FlowDesk.app`
- **ARM64 vs Intel**: Ensure correct architecture build

### Environment Variables

```bash
# Development
NODE_ENV=development
DEBUG=flow-desk:*

# Production
NODE_ENV=production
DEBUG=

# Build configuration
ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true
CSC_IDENTITY_AUTO_DISCOVERY=false  # Disable auto code signing
```

## 🚢 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Cross-Platform Build

on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        arch: [x64]
        include:
          - os: macos-latest
            arch: arm64

    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          
      - name: Install dependencies
        run: npm ci
        
      - name: Platform validation
        run: npm run validate:prebuild
        
      - name: Build application
        run: npm run build:production
        
      - name: Create distribution
        run: npm run dist
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: flow-desk-${{ matrix.os }}-${{ matrix.arch }}
          path: build/*
```

## 📋 Testing Across Platforms

### Automated Testing
```bash
# Platform compatibility test
npm run validate:platform

# Full test suite
npm test

# Security audit
npm run security:check
```

### Manual Testing Checklist

#### All Platforms
- [ ] Application launches successfully
- [ ] Database initialization works
- [ ] Email account setup functional
- [ ] Calendar synchronization works
- [ ] File operations (create, read, write, delete)
- [ ] Network connectivity
- [ ] Secure credential storage
- [ ] Application updates

#### Windows Specific
- [ ] Windows Credential Manager integration
- [ ] File system permissions
- [ ] Windows Defender compatibility
- [ ] Multiple user accounts support

#### macOS Specific
- [ ] Keychain Services integration
- [ ] macOS permissions (contacts, calendar)
- [ ] Gatekeeper compatibility
- [ ] ARM64 and Intel compatibility

#### Linux Specific
- [ ] libsecret integration
- [ ] XDG directory compliance
- [ ] Different desktop environments (GNOME, KDE, XFCE)
- [ ] Package manager installations

## 🔄 Updates and Maintenance

### Auto-Updates
- **Electron Updater**: Cross-platform update system
- **Code Signing**: Required for auto-updates on Windows/macOS
- **Staged Rollouts**: Gradual deployment across platforms

### Platform-Specific Considerations
- **Windows**: Microsoft Store deployment option
- **macOS**: Mac App Store submission process
- **Linux**: Repository maintenance for DEB/RPM packages

## 📞 Support and Documentation

### Platform-Specific Issues
- **Windows**: [Windows Development Guide](./docs/windows-development.md)
- **macOS**: [macOS Development Guide](./docs/macos-development.md)
- **Linux**: [Linux Development Guide](./docs/linux-development.md)

### Community Resources
- **GitHub Issues**: Platform-specific bug reports
- **Discussions**: Cross-platform compatibility questions
- **Wiki**: Community-maintained deployment guides

---

For additional help, please refer to:
- [Development Setup](./docs/development-setup.md)
- [Architecture Overview](./docs/architecture.md)
- [Security Guide](./docs/security.md)