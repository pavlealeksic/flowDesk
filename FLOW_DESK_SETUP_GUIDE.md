# Flow Desk Complete Setup Guide

> **THE ULTIMATE GUIDE TO GETTING FLOW DESK RUNNING**
> 
> This comprehensive guide will get you from zero to a fully functional Flow Desk deployment. Follow every step carefully to ensure all components work together seamlessly.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Prerequisites Installation](#prerequisites-installation)
3. [Repository Setup](#repository-setup)
4. [Rust Engine Compilation](#rust-engine-compilation)
5. [OAuth Provider Configuration](#oauth-provider-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Database Setup](#database-setup)
8. [Desktop Application Setup](#desktop-application-setup)
9. [Mobile Application Setup](#mobile-application-setup)
10. [Plugin System Setup](#plugin-system-setup)
11. [Server Deployment](#server-deployment)
12. [Running Integration Tests](#running-integration-tests)
13. [Troubleshooting](#troubleshooting)
14. [Production Deployment](#production-deployment)

---

## System Requirements

### Minimum Requirements
- **OS**: macOS 12+, Ubuntu 20.04+, Windows 10+
- **CPU**: Intel i5 or AMD Ryzen 5 (4 cores)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 5GB free space (20GB for development)
- **Network**: Stable internet connection

### Recommended Development Setup
- **OS**: macOS 13+ or Ubuntu 22.04+
- **CPU**: Intel i7/M1 Pro or AMD Ryzen 7 (8+ cores)
- **RAM**: 32GB
- **Storage**: 50GB+ SSD
- **Network**: High-speed internet for OAuth testing

---

## Prerequisites Installation

### 1. Install Core Development Tools

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install core dependencies
brew install node npm git rust postgresql sqlite3
brew install --cask docker
```

#### Ubuntu/Debian
```bash
# Update package lists
sudo apt update

# Install core dependencies
sudo apt install -y nodejs npm git build-essential curl sqlite3 postgresql postgresql-contrib

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

#### Windows
```powershell
# Install using Chocolatey (run as Administrator)
Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

# Install core dependencies
choco install nodejs git rust postgresql sqlite docker-desktop -y

# Or manually download and install:
# - Node.js: https://nodejs.org/
# - Git: https://git-scm.com/
# - Rust: https://rustup.rs/
# - PostgreSQL: https://www.postgresql.org/download/windows/
```

### 2. Verify Installations

```bash
# Check versions
node --version    # Should be 18.0.0+
npm --version     # Should be 8.0.0+
git --version     # Should be 2.0.0+
rustc --version   # Should be 1.70.0+
cargo --version   # Should be 1.70.0+
```

### 3. Install Additional Tools

```bash
# Install global npm packages
npm install -g turbo@latest @expo/cli@latest

# Install Rust targets for mobile (if building mobile)
rustup target add aarch64-apple-ios x86_64-apple-ios
rustup target add aarch64-linux-android armv7-linux-androideabi
```

---

## Repository Setup

### 1. Clone the Repository

```bash
# Clone the main repository
git clone https://github.com/your-org/flow-desk.git
cd flow-desk

# Verify repository structure
ls -la
# Should see: desktop-app/, mobile-app/, server/, shared/, plugins/
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# Verify turbo workspace setup
npx turbo run build --dry-run
```

---

## Rust Engine Compilation

### 1. Compile Rust Libraries

```bash
# Navigate to Rust shared library
cd shared/rust-lib

# Build in release mode (required for production)
cargo build --release

# Verify build succeeded
ls -la target/release/
# Should see: libflow_desk_rust.dylib (macOS) or libflow_desk_rust.so (Linux) or flow_desk_rust.dll (Windows)
```

### 2. Test Rust Engine

```bash
# Run Rust engine tests
cargo test --release

# Run the Rust engine integration test
cd ../..
node rust-engine-test.js
```

**Expected Output:**
```
🦀 RUST ENGINE INTEGRATION TEST
==================================================
📦 Loading Rust library...
   Found library: 15.23MB
   ✅ Rust library loaded successfully

📧 Testing Mail Engine...
   ✅ Mail engine operational (245.67ms)

📅 Testing Calendar Engine...
   ✅ Calendar engine operational (198.34ms)

🔍 Testing Search Engine...
   ✅ Search engine operational (156.78ms)

🔒 Testing Crypto Engine...  
   ✅ Crypto engine operational (203.45ms)

🎯 Rust engine test completed successfully!
```

---

## OAuth Provider Configuration

### 1. Google OAuth Setup (Gmail & Calendar)

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Create a new project** or select existing
3. **Enable APIs:**
   - Gmail API
   - Google Calendar API
4. **Create OAuth 2.0 Credentials:**
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/auth/google/callback`
     - `https://yourdomain.com/auth/google/callback` (production)
5. **Copy Client ID and Client Secret**

### 2. Microsoft OAuth Setup (Outlook & Calendar)

1. **Go to [Azure Portal](https://portal.azure.com/)**
2. **Navigate to Azure Active Directory → App registrations**
3. **Create new registration:**
   - Name: Flow Desk
   - Supported accounts: Personal Microsoft accounts
4. **Configure API permissions:**
   - Microsoft Graph → Delegated permissions:
     - `Mail.Read`, `Mail.Send`, `Mail.ReadWrite`
     - `Calendars.Read`, `Calendars.ReadWrite`
5. **Add redirect URI:** `http://localhost:3000/auth/microsoft/callback`
6. **Generate client secret**

### 3. Slack Integration Setup

1. **Go to [Slack API](https://api.slack.com/apps)**
2. **Create new Slack app:**
   - From scratch
   - Choose development workspace
3. **Configure OAuth & Permissions:**
   - Scopes needed:
     - `channels:read`, `chat:write`, `users:read`
     - `im:read`, `mpim:read`, `groups:read`
4. **Set redirect URL:** `http://localhost:3000/auth/slack/callback`
5. **Install app to workspace**

### 4. Additional Provider Setup

Repeat similar OAuth setup for:
- **GitHub** → Developer settings → OAuth Apps
- **Jira** → Atlassian Developer Console
- **Notion** → My integrations
- **Teams** → Azure App Registration (similar to Outlook)
- **Discord** → Developer Portal → Applications

---

## Environment Configuration

### 1. Create Environment File

```bash
# Copy the example environment file
cp .env.example .env

# Edit with your actual values
nano .env  # or code .env or vim .env
```

### 2. Configure Core Settings

```bash
# Generate encryption keys
openssl rand -base64 64  # Use for ENCRYPTION_KEY
openssl rand -base64 32  # Use for JWT_SECRET

# Update .env file with generated keys
ENCRYPTION_KEY=your_generated_64_char_key
JWT_SECRET=your_generated_32_char_key
```

### 3. Add OAuth Credentials

Update `.env` with your OAuth credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Microsoft OAuth  
MICROSOFT_CLIENT_ID=your_microsoft_client_id
MICROSOFT_CLIENT_SECRET=your_microsoft_client_secret

# Slack OAuth
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token

# ... continue for all providers
```

### 4. Validate Environment

```bash
# Run environment validation
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const required = ['ENCRYPTION_KEY', 'JWT_SECRET', 'GOOGLE_CLIENT_ID'];
required.forEach(key => {
  if (!env.includes(key)) console.error('Missing:', key);
  else console.log('✅', key);
});
"
```

---

## Database Setup

### 1. Development Database (SQLite)

```bash
# SQLite is used by default for development
# Database will be created automatically at: ./data/flowdesk.db

# Create data directory
mkdir -p data

# Test database connection
sqlite3 data/flowdesk.db "CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY);"
sqlite3 data/flowdesk.db ".tables"
```

### 2. Production Database (PostgreSQL)

```bash
# Start PostgreSQL service
# macOS: brew services start postgresql
# Ubuntu: sudo systemctl start postgresql

# Create database and user
sudo -u postgres psql

CREATE DATABASE flowdesk_production;
CREATE USER flowdesk WITH PASSWORD 'secure_password_123';
GRANT ALL PRIVILEGES ON DATABASE flowdesk_production TO flowdesk;
\q

# Update .env for production
DATABASE_URL=postgresql://flowdesk:secure_password_123@localhost:5432/flowdesk_production
```

---

## Desktop Application Setup

### 1. Install Desktop Dependencies

```bash
# Navigate to desktop app
cd desktop-app

# Install dependencies
npm install

# Verify Electron installation
npx electron --version
```

### 2. Build Desktop Application

```bash
# Build for development
npm run build

# Start desktop app
npm run dev
```

**Expected Output:**
```
⚡ [vite] building for production...
✓ built in 2.34s
🖥️  Starting Flow Desk Desktop...
✅ Rust engines loaded successfully
✅ IPC layer initialized
✅ Application ready at http://localhost:3000
```

### 3. Test Desktop Features

1. **Launch application**
2. **Verify main window opens**
3. **Check that all tabs are accessible:**
   - Mail
   - Calendar  
   - Search
   - Settings
   - Plugins
4. **Test Rust engine connection** (should show in console)

---

## Mobile Application Setup

### 1. Install Mobile Dependencies

```bash
# Navigate to mobile app
cd mobile-app

# Install dependencies
npm install

# Install iOS dependencies (macOS only)
cd ios && pod install && cd ..
```

### 2. Setup Development Environment

#### iOS Setup (macOS only)
```bash
# Install Xcode from App Store
# Install iOS Simulator

# Setup development team
open ios/FlowDesk.xcworkspace
# Configure signing & capabilities in Xcode
```

#### Android Setup
```bash
# Install Android Studio
# Install Android SDK
# Setup Android emulator or connect physical device

# Verify Android setup
npx react-native doctor
```

### 3. Run Mobile Application

```bash
# Start Metro bundler
npm start

# Run on iOS (macOS only)
npm run ios

# Run on Android
npm run android
```

---

## Plugin System Setup

### 1. Install Plugin Dependencies

```bash
# Navigate to plugins directory
cd plugins

# Install dependencies for each plugin
for dir in */; do
  echo "Installing $dir..."
  cd "$dir" && npm install && cd ..
done
```

### 2. Test Plugin Loading

```bash
# Run plugin validation test
cd ..
node -e "
const fs = require('fs');
const plugins = fs.readdirSync('plugins');
console.log('Available plugins:', plugins.length);
plugins.forEach(plugin => {
  const manifest = require(\`./plugins/\${plugin}/plugin.json\`);
  console.log('✅', plugin, '-', manifest.name);
});
"
```

### 3. Configure Plugin Sandbox

```bash
# Verify plugin sandboxing
cd desktop-app/src/main/plugin-runtime
ls -la
# Should see: PluginSandboxManager.ts, PluginSecurityManager.ts
```

---

## Server Deployment

### 1. Setup Server Environment

```bash
# Navigate to server
cd server

# Install dependencies
npm install

# Setup database
npx prisma generate
npx prisma db push
```

### 2. Configure Production Server

```bash
# Create production environment
cp .env.example .env.production

# Update production settings
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=production_secret
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

**Expected Output:**
```
🚀 Flow Desk Server starting...
📊 Database connected successfully
🔐 Authentication configured
🌐 Server running at http://localhost:3000
✅ All services operational
```

---

## Running Integration Tests

### 1. Prepare Test Environment

```bash
# Ensure all services are running
# Desktop app: npm run dev (in desktop-app/)
# Server: npm run dev (in server/)
# Database: running and accessible

# Copy test environment
cp .env .env.test
```

### 2. Run Individual Test Suites

```bash
# Test Rust engines
node rust-engine-test.js

# Test error handling
node error-handling-test.js

# Test performance validation
node performance-validation-test.js

# Test security validation  
node security-validation-test.js

# Test cross-platform sync
node cross-platform-sync-test.js
```

### 3. Run Master Integration Test

```bash
# This is the ultimate proof that Flow Desk works
node master-integration-test.js
```

**Expected Success Output:**
```
🚀 FLOW DESK MASTER INTEGRATION TEST
================================================================================
Proving Flow Desk is a complete, production-ready platform
================================================================================

🔍 PHASE: SYSTEM FOUNDATION
--------------------------------------------------
🦀 Validating Rust engines...
   📦 Rust library found: 15.23MB
   ✅ Rust library loaded successfully
   🔍 Testing mail engine...
   ✅ mail engine: operational
   ... (all engines pass)
✅ System Foundation completed successfully

... (all phases pass) ...

🏆 FLOW DESK MASTER INTEGRATION TEST RESULTS
================================================================================

🏆 CERTIFIED PRODUCTION READY
Status: PRODUCTION_READY
Deployment: APPROVED
Message: All systems operational. Flow Desk is ready for immediate production deployment.

📊 SUMMARY
------------------------------
Total Test Phases: 10
Passed: 10 ✅
Failed: 0 ✅
Success Rate: 100.0%
Total Duration: 45.7s

🎉 FLOW DESK INTEGRATION TEST: COMPLETE SUCCESS

Flow Desk has been definitively proven to be a complete, integrated, 
production-ready productivity platform that delivers on ALL its promises.
```

### 4. Run Comprehensive Test Suite

```bash
# Run all tests in sequence
chmod +x run-integration-test.sh
./run-integration-test.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Rust Compilation Fails

**Error**: `cargo build` fails with linking errors

**Solution**:
```bash
# macOS: Install Xcode Command Line Tools
xcode-select --install

# Ubuntu: Install build essentials
sudo apt install build-essential

# Windows: Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Clean and rebuild
cargo clean
cargo build --release
```

#### 2. OAuth Provider Issues

**Error**: "OAuth redirect URI mismatch"

**Solution**:
1. Verify redirect URIs in provider console match exactly
2. Check for trailing slashes
3. Ensure http vs https matches
4. For development, use `http://localhost:3000/auth/{provider}/callback`

#### 3. Desktop App Won't Start

**Error**: Electron fails to load

**Solution**:
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild native dependencies
npm rebuild

# Check Electron installation
npx electron --version
```

#### 4. Mobile App Build Fails

**Error**: iOS/Android build errors

**Solution**:
```bash
# iOS: Clean build
cd ios
rm -rf build/
xcodebuild clean
pod install
cd ..

# Android: Clean project
cd android
./gradlew clean
cd ..

# Restart Metro bundler
npx react-native start --reset-cache
```

#### 5. Database Connection Issues

**Error**: Cannot connect to database

**Solution**:
```bash
# Check database service status
# PostgreSQL: sudo systemctl status postgresql
# SQLite: check file permissions

# Verify connection string
node -e "console.log(process.env.DATABASE_URL)"

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

#### 6. Plugin Loading Failures

**Error**: Plugins fail to load or execute

**Solution**:
```bash
# Verify plugin manifest files
find plugins/ -name "plugin.json" -exec cat {} \;

# Check plugin dependencies
cd plugins/slack && npm install && cd ../..

# Test plugin sandboxing
node -e "
const sandbox = require('./desktop-app/src/main/plugin-runtime/PluginSandboxManager');
console.log('Sandbox available:', typeof sandbox);
"
```

---

## Production Deployment

### 1. Pre-Deployment Checklist

- [ ] All integration tests pass (100% success rate)
- [ ] Environment variables configured for production
- [ ] Database setup and migrated
- [ ] SSL certificates installed
- [ ] OAuth providers configured with production URLs
- [ ] Monitoring and logging configured
- [ ] Backup strategy in place

### 2. Desktop Application Distribution

```bash
# Build for distribution
cd desktop-app
npm run build:prod

# Package for each platform
npm run package:mac    # Creates .dmg
npm run package:win    # Creates .exe
npm run package:linux  # Creates .AppImage

# Sign applications (production)
# Configure code signing certificates
```

### 3. Mobile Application Distribution

```bash
# iOS App Store
cd mobile-app
npm run build:ios:release
# Upload to App Store Connect

# Android Play Store
npm run build:android:release
# Upload to Google Play Console
```

### 4. Server Deployment

```bash
# Using Docker (recommended)
docker build -t flow-desk-server .
docker run -d -p 3000:3000 --env-file .env.production flow-desk-server

# Or using PM2
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 5. Monitoring and Maintenance

```bash
# Setup monitoring
npm install -g @datadog/datadog-ci  # or preferred monitoring
# Configure alerts for:
# - Application errors
# - Performance degradation
# - OAuth token expiration
# - Database connectivity
# - Sync failures

# Regular maintenance tasks
# - Update OAuth tokens
# - Rotate encryption keys
# - Update dependencies
# - Monitor resource usage
# - Review security logs
```

---

## Verification Checklist

### Final Deployment Verification

Run through this checklist to ensure complete functionality:

#### Core Functionality
- [ ] Desktop application launches successfully
- [ ] Mobile application connects and syncs
- [ ] All Rust engines initialize properly
- [ ] Database connections are stable

#### Mail Integration
- [ ] Gmail OAuth flow works
- [ ] Outlook OAuth flow works
- [ ] IMAP connections successful
- [ ] Mail sync operates correctly
- [ ] Compose and send functionality works

#### Calendar Integration
- [ ] Google Calendar sync works
- [ ] Microsoft Calendar sync works
- [ ] Event creation and modification sync
- [ ] Privacy sync operates correctly

#### Plugin System
- [ ] Slack plugin loads and functions
- [ ] Teams plugin authentication works
- [ ] Plugin sandbox security is enforced
- [ ] Multiple plugins can run simultaneously

#### Automation System
- [ ] Rules can be created and modified
- [ ] Triggers fire correctly
- [ ] Actions execute as expected
- [ ] Cross-system automation works

#### Cross-Platform Sync
- [ ] Configuration changes sync between platforms
- [ ] Mail account settings sync
- [ ] Calendar events sync
- [ ] Offline/online sync works
- [ ] Conflict resolution operates correctly

#### Security and Performance
- [ ] All data is encrypted at rest
- [ ] OAuth tokens are securely stored
- [ ] Performance meets defined thresholds
- [ ] Error handling and recovery work

---

## Support and Community

### Getting Help
- **Documentation**: Check this guide and inline code comments
- **Issues**: Create GitHub issues for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Community**: Join our Discord server (link in README)

### Contributing
- **Pull Requests**: Follow the contributing guide
- **Testing**: Ensure all integration tests pass
- **Documentation**: Update docs for any changes
- **Security**: Report security issues privately

---

## Success Criteria

**You have successfully deployed Flow Desk when:**

1. ✅ **Master Integration Test passes with 100% success rate**
2. ✅ **All OAuth providers authenticate successfully**  
3. ✅ **Mail and calendar sync works on both desktop and mobile**
4. ✅ **Plugins load and execute properly**
5. ✅ **Automation rules create and trigger correctly**
6. ✅ **Cross-platform sync maintains data consistency**
7. ✅ **Security validations pass**
8. ✅ **Performance meets specified thresholds**

**When all criteria are met, Flow Desk is production-ready and approved for real-world use.**

---

*This guide provides complete instructions for deploying Flow Desk from development to production. Follow each section carefully, and you'll have a fully functional, integrated productivity platform.*