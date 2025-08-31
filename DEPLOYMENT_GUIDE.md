# Flow Desk Production Deployment Guide

## Overview

Flow Desk is a privacy-first, cross-platform work OS with Mail + Calendar functionality and a secure plugin ecosystem. This guide covers the complete deployment process for all components: Next.js server, Electron desktop app, React Native mobile app, and shared services.

## Architecture

```
Flow Desk Production Environment
├── Server (Next.js)           # Website, API, licensing, plugin registry
├── Desktop App (Electron)     # macOS, Windows, Linux applications
├── Mobile App (React Native)  # iOS and Android applications
├── Shared Services (Rust)     # Mail, calendar, search engines
└── Infrastructure             # Database, storage, monitoring
```

---

## System Requirements

### Server Requirements (Next.js)

**Minimum Production Requirements:**
- **CPU:** 2 vCPUs (4+ recommended for high traffic)
- **RAM:** 2GB (4GB+ recommended)
- **Storage:** 20GB SSD (50GB+ for plugin registry)
- **OS:** Ubuntu 20.04+, CentOS 8+, or compatible Linux distribution
- **Node.js:** v18.0.0 or higher
- **Database:** PostgreSQL 13+ (managed service recommended)

**Recommended Cloud Providers:**
- **Vercel** (Primary recommendation - zero-config deployment)
- **AWS** (EC2 + RDS + S3)
- **Google Cloud Platform** (Compute Engine + Cloud SQL + Cloud Storage)
- **DigitalOcean** (Droplets + Managed Database + Spaces)
- **Railway** (Alternative for smaller deployments)

### Development Machine Requirements

**For Building and Development:**
- **OS:** macOS 11+, Windows 10+, or Ubuntu 18.04+
- **Node.js:** v18.0.0+
- **Rust:** 1.70.0+ (for shared package compilation)
- **Python:** 3.8+ (for native module compilation)
- **Xcode:** Latest (for iOS builds on macOS)
- **Android Studio:** Latest (for Android builds)
- **Memory:** 16GB+ RAM recommended for full builds
- **Storage:** 50GB+ free space for dependencies and build artifacts

---

## Prerequisites

### 1. Third-Party Service Accounts

Before starting deployment, ensure you have accounts and API keys for:

#### Required Services
- **Clerk** (Authentication) - [clerk.com](https://clerk.com)
- **Stripe** (Payments) - [stripe.com](https://stripe.com)
- **PostgreSQL Database** (Production database)
- **AWS S3** or compatible storage (Plugin registry, file uploads)

#### OAuth Provider Accounts (15+ integrations)
- **Google Workspace** (Gmail, Calendar, Drive)
- **Microsoft 365** (Outlook, Teams, OneDrive)
- **Slack** (Workspace integration)
- **GitHub** (Developer tools)
- **Notion** (Productivity)
- **Zoom** (Meetings)
- **Asana** (Project management)
- **Jira** (Issue tracking)
- **Discord** (Communication)
- **Linear** (Project management)
- **ClickUp** (Productivity)
- **Trello** (Project management)
- **Monday.com** (Workspace management)
- **WhatsApp Business** (Communication)
- **Telegram** (Communication)

#### Optional Services
- **Sentry** (Error monitoring)
- **Vercel Analytics** (Usage analytics)
- **Resend** (Transactional emails)
- **Upstash Redis** (Rate limiting and caching)

### 2. Domain and SSL Setup

- **Production domain** (e.g., flowdesk.com)
- **API subdomain** (e.g., api.flowdesk.com)
- **Plugin registry subdomain** (e.g., plugins.flowdesk.com)
- **SSL certificates** (Let's Encrypt or commercial)

### 3. Code Signing Certificates

- **macOS:** Apple Developer account + code signing certificate
- **Windows:** Code signing certificate (DigiCert, Sectigo, etc.)
- **Plugin signing:** RSA keypair for plugin package verification

---

## Environment Setup

### Development Environment

1. **Clone Repository**
```bash
git clone https://github.com/your-org/flow-desk.git
cd flow-desk
```

2. **Install Dependencies**
```bash
npm install
```

3. **Setup Rust Toolchain**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add x86_64-apple-darwin # macOS
rustup target add x86_64-pc-windows-gnu # Windows
rustup target add x86_64-unknown-linux-gnu # Linux
```

4. **Build Shared Package**
```bash
npm run build:shared
```

5. **Setup Environment Variables**
```bash
cp server/.env.example server/.env.local
# Edit server/.env.local with your configuration
```

### Staging Environment

**Recommended Setup:**
- **Server:** Deploy to Vercel preview branch or staging server
- **Database:** Separate PostgreSQL instance with production-like data
- **Storage:** Separate S3 bucket for staging assets
- **Domain:** staging.flowdesk.com

### Production Environment

**Infrastructure Checklist:**
- [ ] Production server provisioned and configured
- [ ] PostgreSQL database created with proper backups
- [ ] S3 bucket created with proper permissions
- [ ] CDN configured for static assets
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Monitoring tools configured
- [ ] Log aggregation setup

---

## Database Setup and Configuration

### 1. PostgreSQL Database Setup

#### Using Managed Services (Recommended)

**Vercel Postgres:**
```bash
# Install Vercel CLI
npm install -g vercel

# Create database
vercel postgres create flow-desk-production

# Get connection string
vercel postgres connect flow-desk-production
```

**AWS RDS:**
```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier flowdesk-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.4 \
  --allocated-storage 20 \
  --master-username flowdesk \
  --master-user-password YOUR_SECURE_PASSWORD \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name your-subnet-group
```

#### Self-Managed Setup

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE flowdesk_production;
CREATE USER flowdesk WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE flowdesk_production TO flowdesk;
\q
```

### 2. Database Migration and Seeding

```bash
cd server

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Seed database (optional)
npx prisma db seed
```

### 3. Database Configuration

**Connection String Format:**
```
postgresql://username:password@host:port/database?schema=public&sslmode=require
```

**Environment Variables:**
```env
DATABASE_URL="postgresql://flowdesk:password@your-db-host:5432/flowdesk_production?schema=public&sslmode=require"
```

---

## Server Deployment (Next.js with Clerk + Stripe)

### Option 1: Vercel Deployment (Recommended)

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Deploy to Vercel**
```bash
cd server
vercel --prod

# Or connect GitHub repository for automatic deployments
vercel git connect
```

3. **Configure Environment Variables**
```bash
# Set all required environment variables
vercel env add DATABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add STRIPE_SECRET_KEY
# ... (see Configuration Guide for complete list)
```

### Option 2: Docker Deployment

1. **Create Dockerfile** (server/Dockerfile):
```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

2. **Build and Deploy**
```bash
# Build Docker image
docker build -t flow-desk-server .

# Run container
docker run -d \
  --name flow-desk-server \
  -p 3000:3000 \
  --env-file .env.production \
  flow-desk-server
```

### Option 3: Traditional VPS Deployment

1. **Server Setup (Ubuntu 22.04)**
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Setup nginx reverse proxy
sudo apt install nginx
```

2. **Deploy Application**
```bash
# Clone repository
git clone https://github.com/your-org/flow-desk.git
cd flow-desk/server

# Install dependencies and build
npm ci --production
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

3. **Nginx Configuration** (/etc/nginx/sites-available/flowdesk):
```nginx
server {
    listen 80;
    server_name flowdesk.com www.flowdesk.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name flowdesk.com www.flowdesk.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Desktop App Packaging and Distribution

### macOS Application

1. **Setup Code Signing**
```bash
# Install certificates in Keychain
# Export Developer ID Application certificate
security find-identity -v -p codesigning
```

2. **Build and Package**
```bash
cd desktop-app

# Install dependencies
npm install

# Build application
npm run build:mac

# Sign and notarize (automated)
npm run build:mac:sign
```

3. **Distribution Options**
- **Direct Download:** Host .dmg file on website
- **Auto-updater:** Integrated Electron updater with GitHub releases
- **Mac App Store:** Submit through App Store Connect (additional requirements)

### Windows Application

1. **Setup Code Signing Certificate**
```bash
# Install certificate in Windows Certificate Store
# Or use environment variables for CI/CD
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"
```

2. **Build and Package**
```bash
cd desktop-app

# Build Windows application
npm run build:win

# Create installer
npm run build:win:installer
```

3. **Distribution Options**
- **Direct Download:** Host .exe installer on website
- **Auto-updater:** GitHub releases integration
- **Microsoft Store:** Submit through Partner Center

### Linux Application

1. **Build AppImage**
```bash
cd desktop-app

# Build Linux application
npm run build:linux

# Create AppImage, snap, or deb package
npm run build:linux:appimage
npm run build:linux:snap
npm run build:linux:deb
```

2. **Distribution Options**
- **Direct Download:** Host AppImage on website
- **Snap Store:** Publish to Ubuntu Snap Store
- **Flathub:** Publish Flatpak package

### Automated Build Pipeline

**GitHub Actions Workflow** (.github/workflows/build-desktop.yml):
```yaml
name: Build Desktop Applications

on:
  push:
    tags: ['v*']

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install
      - run: npm run build:desktop:mac
        env:
          CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install
      - run: npm run build:desktop:win
        env:
          CSC_LINK: ${{ secrets.WIN_CERTIFICATE }}
          CSC_KEY_PASSWORD: ${{ secrets.WIN_CERTIFICATE_PASSWORD }}

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install
      - run: npm run build:desktop:linux
```

---

## Mobile App Build and Store Submission

### iOS Application (React Native/Expo)

1. **Prerequisites**
- **Apple Developer Account** ($99/year)
- **Xcode** latest version
- **iOS Simulator** for testing

2. **Build Configuration**
```bash
cd mobile-app

# Install EAS CLI
npm install -g @expo/eas-cli

# Configure EAS Build
eas build:configure

# Create iOS build
eas build --platform ios --profile production
```

3. **App Store Submission**
```bash
# Submit to App Store Connect
eas submit --platform ios --profile production

# Or manual submission via Xcode
# 1. Download IPA from EAS
# 2. Upload via Xcode Organizer
# 3. Submit through App Store Connect
```

### Android Application

1. **Prerequisites**
- **Google Play Developer Account** ($25 one-time)
- **Android Studio** with SDK
- **Keystore** for app signing

2. **Build Configuration**
```bash
cd mobile-app

# Create Android build
eas build --platform android --profile production

# Create App Bundle (recommended)
eas build --platform android --profile production:aab
```

3. **Google Play Store Submission**
```bash
# Submit to Google Play
eas submit --platform android --profile production

# Or manual upload via Play Console
```

### Cross-Platform Build Automation

**EAS Build Configuration** (eas.json):
```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "resourceClass": "medium"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@email.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json",
        "track": "production"
      }
    }
  }
}
```

---

## CI/CD Pipeline Configuration

### GitHub Actions Complete Pipeline

**.github/workflows/deploy.yml:**
```yaml
name: Deploy Flow Desk

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      # Install Rust
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          override: true
      
      # Cache dependencies
      - uses: actions/cache@v3
        with:
          path: ~/.npm
          key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
      
      # Install and test
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run build

  deploy-server:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      # Deploy to Vercel
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: ./server

  build-desktop:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - run: npm ci
      - run: npm run build:desktop
        env:
          # Code signing secrets
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
      
      # Upload artifacts
      - uses: actions/upload-artifact@v3
        with:
          name: desktop-${{ matrix.os }}
          path: desktop-app/dist/

  build-mobile:
    needs: test
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - uses: expo/expo-github-action@v8
        with:
          expo-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      # Build for both platforms
      - run: eas build --platform all --non-interactive --profile production
        working-directory: ./mobile-app

  release:
    needs: [build-desktop, build-mobile]
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      # Download all artifacts
      - uses: actions/download-artifact@v3
      
      # Create GitHub Release
      - uses: softprops/action-gh-release@v1
        with:
          files: |
            desktop-macos-latest/*
            desktop-windows-latest/*
            desktop-ubuntu-latest/*
          generate_release_notes: true
```

### Deployment Environments

**Branch Strategy:**
- **main** → Production deployments
- **develop** → Staging deployments  
- **feature/** → Preview deployments
- **v*** tags → Release builds

**Environment Configuration:**
```yaml
environments:
  development:
    url: localhost:3000
    database: development
    
  staging:
    url: staging.flowdesk.com
    database: staging
    
  production:
    url: flowdesk.com
    database: production
```

---

## Security Best Practices

### 1. Environment Security
- **Never commit secrets** to version control
- Use **encrypted secret storage** (GitHub Secrets, Vercel Environment Variables)
- **Rotate secrets regularly** (quarterly recommended)
- **Principle of least privilege** for service accounts

### 2. Database Security
- **Enable SSL/TLS** for all database connections
- **Regular backups** with encryption
- **Connection pooling** with proper limits
- **Database user permissions** restricted to minimum required

### 3. Application Security
- **HTTPS everywhere** with HSTS headers
- **Content Security Policy** (CSP) headers
- **Input validation** and sanitization
- **Rate limiting** on API endpoints
- **Security headers** configuration

### 4. Code Signing and Distribution
- **Sign all executables** with valid certificates
- **Verify plugin packages** with cryptographic signatures
- **Notarize macOS applications** with Apple
- **Use official app stores** when possible

---

## Health Checks and Monitoring

### Application Health Endpoints

The server includes built-in health check endpoints:

```typescript
// GET /api/health - Basic health check
{
  "status": "healthy",
  "timestamp": "2025-08-28T14:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600
}

// GET /api/health/detailed - Detailed system status
{
  "status": "healthy",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "storage": "healthy"
  },
  "metrics": {
    "activeUsers": 1250,
    "requestsPerMinute": 45,
    "errorRate": 0.01
  }
}
```

### Monitoring Setup

**Recommended Monitoring Stack:**
- **Application Performance:** Sentry for error tracking
- **Infrastructure:** Datadog, New Relic, or Grafana
- **Uptime:** UptimeRobot or Pingdom
- **Log Aggregation:** Logflare, Papertrail, or ELK stack

---

## Scaling and Performance

### Horizontal Scaling
- **Load balancers** (Nginx, Cloudflare, AWS ALB)
- **Multiple server instances** with session storage
- **Database read replicas** for improved read performance
- **CDN integration** for static assets

### Performance Optimization
- **Image optimization** with Next.js Image component
- **Code splitting** and lazy loading
- **Database query optimization** with proper indexing
- **Caching strategies** (Redis, CDN, browser caching)

### Resource Monitoring
- **CPU usage** alerts (>80% sustained)
- **Memory usage** alerts (>85% sustained)  
- **Disk space** alerts (>90% full)
- **Response time** alerts (>2s average)

---

## Disaster Recovery

### Backup Strategy
- **Database backups:** Daily automated with 30-day retention
- **File storage backups:** Weekly with versioning
- **Configuration backups:** Version controlled and encrypted
- **Code repository:** Multiple remote repositories

### Recovery Procedures
1. **Database restoration:** Point-in-time recovery capability
2. **Application deployment:** Blue-green deployment strategy
3. **DNS failover:** Automated failover to backup infrastructure
4. **Monitoring alerts:** Immediate notification of system failures

---

## Post-Deployment Checklist

### Server Deployment Verification
- [ ] Application loads successfully at production URL
- [ ] Database connections working
- [ ] Authentication flow (Clerk) functional
- [ ] Payment processing (Stripe) operational
- [ ] All environment variables configured
- [ ] SSL certificates valid and auto-renewing
- [ ] Health check endpoints responding
- [ ] Monitoring and alerts configured

### Desktop App Verification
- [ ] Applications install successfully on all platforms
- [ ] Code signing certificates valid
- [ ] Auto-updater functionality working
- [ ] Plugin system operational
- [ ] Cross-platform sync functional
- [ ] Performance benchmarks met

### Mobile App Verification
- [ ] Apps available in respective app stores
- [ ] Push notifications working
- [ ] In-app purchases functional (if applicable)
- [ ] Offline functionality operational
- [ ] Cross-platform sync working
- [ ] Performance acceptable on target devices

### Security Verification
- [ ] Security scan completed
- [ ] Penetration testing performed
- [ ] Code signing verified
- [ ] HTTPS/TLS configuration tested
- [ ] Data encryption verified
- [ ] Access controls functioning

---

This deployment guide provides a comprehensive foundation for deploying Flow Desk in production environments. For specific implementation details, refer to the Configuration Guide and Operations Guide sections.
