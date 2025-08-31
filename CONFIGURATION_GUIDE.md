# Flow Desk Configuration Guide

## Overview

This guide provides comprehensive configuration instructions for all Flow Desk components, including environment variables, third-party service integrations, and security settings. Follow this guide to properly configure your Flow Desk deployment for development, staging, and production environments.

---

## Environment Variables and Secrets Management

### Required Environment Variables

Flow Desk requires the following environment variables for proper operation:

#### Database Configuration
```env
# Primary database connection
DATABASE_URL="postgresql://username:password@host:port/database?schema=public&sslmode=require"

# Example configurations:
# Local development:
DATABASE_URL="postgresql://flowdesk:password@localhost:5432/flowdesk_dev"

# Production (managed service):
DATABASE_URL="postgresql://username:password@prod-db.amazonaws.com:5432/flowdesk?sslmode=require"
```

#### Application Settings
```env
# Base application URL (used for redirects, webhooks)
NEXT_PUBLIC_APP_URL="https://flowdesk.com"

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-super-secret-nextauth-secret-here"

# For local development:
NEXTAUTH_URL="http://localhost:3000"
```

#### Clerk Authentication
```env
# Public key (safe to expose in frontend)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"

# Secret key (server-side only)
CLERK_SECRET_KEY="sk_test_abcd1234efgh5678ijkl90mn"

# Webhook secret for Clerk events
CLERK_WEBHOOK_SECRET="whsec_abcd1234efgh5678"

# URL configuration (optional, uses defaults if not set)
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/dashboard"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/dashboard"
```

#### Stripe Payment Processing
```env
# Stripe API keys
STRIPE_PUBLISHABLE_KEY="pk_test_abcd1234efgh5678"
STRIPE_SECRET_KEY="sk_test_abcd1234efgh5678"

# Webhook endpoint secret
STRIPE_WEBHOOK_SECRET="whsec_abcd1234efgh5678"
```

#### License Signing
```env
# RSA private key for signing licenses (Base64 encoded)
LICENSE_PRIVATE_KEY="LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ=="

# RSA public key for license verification (Base64 encoded)
LICENSE_PUBLIC_KEY="LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0="
```

#### Plugin Registry
```env
# S3 bucket for plugin packages
PLUGIN_REGISTRY_BUCKET="flowdesk-plugins"

# Private key for plugin signing (Base64 encoded)
PLUGIN_SIGNING_KEY="LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ=="
```

#### File Storage (AWS S3)
```env
# AWS credentials
AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
AWS_REGION="us-east-1"

# Primary storage bucket
AWS_S3_BUCKET="flowdesk-uploads"
```

#### Optional Services
```env
# Error monitoring
SENTRY_DSN="https://abcd1234@sentry.io/1234567"

# Analytics
VERCEL_ANALYTICS_ID="your-analytics-id"

# Transactional emails
RESEND_API_KEY="re_abcd1234_efgh5678"
FROM_EMAIL="noreply@flowdesk.com"

# Rate limiting (Redis)
UPSTASH_REDIS_REST_URL="https://your-redis.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"
```

### Environment-Specific Configuration

#### Development (.env.local)
```env
NODE_ENV=development
DATABASE_URL="postgresql://flowdesk:password@localhost:5432/flowdesk_dev"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
```

#### Staging (.env.staging)
```env
NODE_ENV=production
DATABASE_URL="postgresql://username:password@staging-db:5432/flowdesk_staging"
NEXT_PUBLIC_APP_URL="https://staging.flowdesk.com"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
```

#### Production (.env.production)
```env
NODE_ENV=production
DATABASE_URL="postgresql://username:password@prod-db:5432/flowdesk_production"
NEXT_PUBLIC_APP_URL="https://flowdesk.com"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
```

### Secrets Management Best Practices

#### Local Development
- Use `.env.local` files (never commit to git)
- Use tools like `direnv` for automatic environment loading
- Store sensitive keys in password managers

#### Staging/Production
- **Vercel:** Use Vercel dashboard or CLI to set environment variables
- **AWS:** Use AWS Systems Manager Parameter Store or Secrets Manager
- **Docker:** Use Docker secrets or external secret management
- **Kubernetes:** Use Kubernetes secrets and ConfigMaps

#### Key Generation
```bash
# Generate NextAuth secret
openssl rand -base64 32

# Generate RSA keypair for license signing
openssl genrsa -out private_key.pem 4096
openssl rsa -in private_key.pem -pubout -out public_key.pem

# Convert to Base64 for environment variables
base64 -i private_key.pem | tr -d '\n'
base64 -i public_key.pem | tr -d '\n'
```

---

## OAuth2 Provider Setup (15+ Services)

### Google Workspace Integration

#### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing project
3. Enable APIs:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - People API

#### 2. OAuth2 Credentials
```bash
# Create OAuth2 client ID
# Application type: Web application
# Authorized redirect URIs:
# - http://localhost:3000/auth/google/callback (development)
# - https://flowdesk.com/auth/google/callback (production)
```

#### 3. Environment Configuration
```env
GOOGLE_CLIENT_ID="123456789-abcdef.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-abcd1234efgh5678"

# Scopes (configured in application):
# - https://www.googleapis.com/auth/gmail.readonly
# - https://www.googleapis.com/auth/gmail.send
# - https://www.googleapis.com/auth/calendar
# - https://www.googleapis.com/auth/drive.readonly
```

### Microsoft 365 Integration

#### 1. Azure App Registration
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to Azure Active Directory > App Registrations
3. Create new registration:
   - Name: "Flow Desk"
   - Redirect URI: `https://flowdesk.com/auth/microsoft/callback`

#### 2. API Permissions
Required permissions:
- **Microsoft Graph:**
  - `Mail.Read`
  - `Mail.Send`
  - `Calendars.ReadWrite`
  - `Files.Read.All`
  - `User.Read`

#### 3. Configuration
```env
MICROSOFT_CLIENT_ID="12345678-1234-1234-1234-123456789012"
MICROSOFT_CLIENT_SECRET="abcd~1234.efgh5678-ijkl90mn"
MICROSOFT_TENANT_ID="common"  # or specific tenant ID
```

### Slack Integration

#### 1. Slack App Creation
1. Go to [Slack API](https://api.slack.com/apps)
2. Create new Slack app
3. Configure OAuth & Permissions:
   - Redirect URLs: `https://flowdesk.com/auth/slack/callback`

#### 2. Bot Token Scopes
```
channels:read
chat:write
files:read
users:read
users:read.email
```

#### 3. Configuration
```env
SLACK_CLIENT_ID="123456789012.123456789012"
SLACK_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
SLACK_SIGNING_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
```

### GitHub Integration

#### 1. GitHub OAuth App
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App:
   - Authorization callback URL: `https://flowdesk.com/auth/github/callback`

#### 2. Configuration
```env
GITHUB_CLIENT_ID="Iv1.abcd1234efgh5678"
GITHUB_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv12345678"
```

### Additional Provider Configurations

#### Notion
```env
NOTION_CLIENT_ID="12345678-1234-1234-1234-123456789012"
NOTION_CLIENT_SECRET="secret_abcd1234efgh5678ijkl90mn"
```

#### Zoom
```env
ZOOM_CLIENT_ID="abcd1234efgh5678ijkl90mn"
ZOOM_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
```

#### Asana
```env
ASANA_CLIENT_ID="123456789012345"
ASANA_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
```

#### Jira (Atlassian)
```env
ATLASSIAN_CLIENT_ID="abcd1234-efgh-5678-ijkl-90mnopqrstuv"
ATLASSIAN_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuvwxyz1234567890"
```

#### Discord
```env
DISCORD_CLIENT_ID="123456789012345678"
DISCORD_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
```

#### Linear
```env
LINEAR_CLIENT_ID="abcd1234-efgh-5678-ijkl-90mnopqrstuv"
LINEAR_CLIENT_SECRET="lin_api_abcd1234efgh5678ijkl90mn"
```

#### ClickUp
```env
CLICKUP_CLIENT_ID="abcd1234-efgh-5678-ijkl-90mnopqrstuv"
CLICKUP_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
```

#### Trello (Atlassian)
```env
TRELLO_API_KEY="abcd1234efgh5678ijkl90mnopqrstuv"
TRELLO_API_SECRET="abcd1234efgh5678ijkl90mnopqrstuvwxyz1234567890"
```

#### Monday.com
```env
MONDAY_CLIENT_ID="abcd1234efgh5678ijkl90mn"
MONDAY_CLIENT_SECRET="abcd1234efgh5678ijkl90mnopqrstuv"
```

#### WhatsApp Business
```env
WHATSAPP_BUSINESS_PHONE_ID="123456789012345"
WHATSAPP_ACCESS_TOKEN="EAAabcd1234efgh5678..."
WHATSAPP_WEBHOOK_SECRET="abcd1234efgh5678"
```

#### Telegram
```env
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrSTUvwxyz"
```

---

## Clerk Authentication Configuration

### 1. Clerk Dashboard Setup

#### Account Creation
1. Sign up at [clerk.com](https://clerk.com)
2. Create new application
3. Configure authentication methods:
   - Email/Password
   - OAuth providers (Google, Microsoft, GitHub)
   - Phone number (optional)
   - Magic links

#### Application Settings
```json
{
  "name": "Flow Desk",
  "theme": {
    "primaryColor": "#000000",
    "logo": "https://flowdesk.com/logo.png"
  },
  "pages": {
    "signIn": "/sign-in",
    "signUp": "/sign-up",
    "afterSignIn": "/dashboard",
    "afterSignUp": "/dashboard"
  }
}
```

### 2. Social Connections (OAuth)

#### Google OAuth
```json
{
  "provider": "google",
  "clientId": "123456789-abcdef.apps.googleusercontent.com",
  "clientSecret": "GOCSPX-abcd1234efgh5678",
  "scopes": ["email", "profile"]
}
```

#### Microsoft OAuth
```json
{
  "provider": "microsoft",
  "clientId": "12345678-1234-1234-1234-123456789012",
  "clientSecret": "abcd~1234.efgh5678-ijkl90mn",
  "scopes": ["User.Read"]
}
```

#### GitHub OAuth
```json
{
  "provider": "github", 
  "clientId": "Iv1.abcd1234efgh5678",
  "clientSecret": "abcd1234efgh5678ijkl90mnopqrstuv12345678",
  "scopes": ["user:email"]
}
```

### 3. Webhook Configuration

#### Webhook Endpoint
```
POST https://flowdesk.com/api/webhooks/clerk
```

#### Required Events
- `user.created`
- `user.updated`
- `user.deleted`
- `organization.created`
- `organization.updated`
- `organization.deleted`
- `organizationMembership.created`
- `organizationMembership.updated`
- `organizationMembership.deleted`

#### Webhook Verification
```typescript
import { Webhook } from 'svix'

const webhook = new Webhook(process.env.CLERK_WEBHOOK_SECRET!)
const payload = webhook.verify(body, headers) as ClerkWebhookPayload
```

### 4. Organization Settings

#### Enable Organizations
```json
{
  "organizations": {
    "enabled": true,
    "maxMemberships": 10,
    "roles": ["admin", "member"]
  }
}
```

#### Custom Fields
```json
{
  "customFields": {
    "companySize": {
      "type": "select",
      "options": ["1-10", "11-50", "51-200", "200+"]
    },
    "industry": {
      "type": "text",
      "required": false
    }
  }
}
```

---

## Stripe Billing Integration Setup

### 1. Stripe Dashboard Configuration

#### Account Setup
1. Create Stripe account at [stripe.com](https://stripe.com)
2. Complete business verification
3. Configure tax settings
4. Set up payout methods

#### Products and Pricing
```json
{
  "products": [
    {
      "name": "Flow Desk Starter",
      "description": "Individual productivity suite",
      "prices": [
        {
          "unitAmount": 1900,
          "currency": "usd",
          "recurring": { "interval": "month" }
        }
      ]
    },
    {
      "name": "Flow Desk Pro", 
      "description": "Advanced features and integrations",
      "prices": [
        {
          "unitAmount": 4900,
          "currency": "usd", 
          "recurring": { "interval": "month" }
        }
      ]
    },
    {
      "name": "Flow Desk Team",
      "description": "Team collaboration features",
      "prices": [
        {
          "unitAmount": 9900,
          "currency": "usd",
          "recurring": { "interval": "month" }
        }
      ]
    }
  ]
}
```

### 2. Webhook Configuration

#### Webhook Endpoint
```
POST https://flowdesk.com/api/webhooks/stripe
```

#### Required Events
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

#### Webhook Implementation
```typescript
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

// Verify webhook signature
const signature = headers['stripe-signature']
const event = stripe.webhooks.constructEvent(
  body,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
)
```

### 3. Customer Portal Configuration

#### Portal Settings
```json
{
  "businessProfile": {
    "headline": "Flow Desk Billing Portal",
    "privacyPolicyUrl": "https://flowdesk.com/privacy",
    "termsOfServiceUrl": "https://flowdesk.com/terms"
  },
  "features": {
    "customerUpdate": {
      "enabled": true,
      "allowedUpdates": ["email", "tax_id"]
    },
    "subscriptionCancel": {
      "enabled": true,
      "mode": "at_period_end",
      "cancellationReason": {
        "enabled": true,
        "options": ["too_expensive", "missing_features", "switched_service", "unused", "other"]
      }
    },
    "subscriptionPause": {
      "enabled": false
    },
    "subscriptionUpdate": {
      "enabled": true,
      "defaultAllowedUpdates": ["price", "quantity"],
      "proration_behavior": "create_prorations"
    },
    "paymentMethodUpdate": {
      "enabled": true
    },
    "invoiceHistory": {
      "enabled": true
    }
  }
}
```

### 4. Tax Configuration

#### Tax Settings
```typescript
// Enable automatic tax calculation
const taxSettings = {
  defaults: {
    taxBehavior: 'exclusive',
    taxCode: 'txcd_10000000' // Software as a Service
  },
  headOffice: {
    address: {
      line1: 'Your Business Address',
      city: 'City',
      state: 'State',
      postal_code: '12345',
      country: 'US'
    }
  }
}
```

---

## Database Migrations and Seeding

### 1. Initial Database Setup

#### Run Migrations
```bash
cd server

# Generate Prisma client
npx prisma generate

# Run all migrations
npx prisma migrate deploy

# Alternative: Reset and migrate (development only)
npx prisma migrate reset
```

#### Migration Commands
```bash
# Create new migration
npx prisma migrate dev --name add_new_feature

# View migration status
npx prisma migrate status

# Resolve migration conflicts
npx prisma migrate resolve --applied 20231201000000_migration_name
```

### 2. Database Seeding

#### Seed Configuration (prisma/seed.ts)
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed plan types
  await prisma.user.upsert({
    where: { email: 'admin@flowdesk.com' },
    update: {},
    create: {
      email: 'admin@flowdesk.com',
      clerkId: 'user_admin_seed',
      firstName: 'Admin',
      lastName: 'User'
    }
  })

  // Seed plugins
  const plugins = [
    {
      name: 'Gmail',
      slug: 'gmail',
      description: 'Gmail integration for Flow Desk',
      author: 'Flow Desk',
      authorEmail: 'plugins@flowdesk.com',
      category: 'MAIL',
      verified: true,
      published: true
    }
    // ... more plugins
  ]

  for (const plugin of plugins) {
    await prisma.plugin.upsert({
      where: { slug: plugin.slug },
      update: {},
      create: plugin
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

#### Run Seeding
```bash
# Run seed script
npx prisma db seed

# Custom seed command
npm run db:seed
```

### 3. Production Migration Strategy

#### Blue-Green Deployment
```bash
# 1. Create new database version
createdb flowdesk_production_new

# 2. Run migrations on new database
DATABASE_URL="postgresql://user:pass@host/flowdesk_production_new" npx prisma migrate deploy

# 3. Test application with new database
# 4. Switch traffic to new database
# 5. Keep old database as backup
```

#### Zero-Downtime Migrations
```bash
# For backward-compatible changes
npx prisma migrate deploy

# For breaking changes, use staged approach:
# 1. Add new columns (optional)
# 2. Deploy application code
# 3. Backfill data
# 4. Remove old columns in next release
```

---

## SSL Certificates and Domain Configuration

### 1. Domain Setup

#### DNS Configuration
```dns
# A Records
@           3600    IN  A       192.168.1.100
www         3600    IN  CNAME   @
api         3600    IN  CNAME   @
plugins     3600    IN  CNAME   @

# MX Records (if handling email)
@           3600    IN  MX  10  mail.flowdesk.com

# Security Headers
_dmarc      3600    IN  TXT     "v=DMARC1; p=quarantine; rua=mailto:dmarc@flowdesk.com"
```

#### Subdomain Strategy
- `flowdesk.com` - Main application
- `www.flowdesk.com` - Redirect to main
- `api.flowdesk.com` - API endpoints
- `plugins.flowdesk.com` - Plugin registry
- `staging.flowdesk.com` - Staging environment

### 2. SSL Certificate Setup

#### Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d flowdesk.com -d www.flowdesk.com

# Auto-renewal setup
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Commercial SSL Certificate
```bash
# Generate private key
openssl genrsa -out flowdesk.com.key 4096

# Generate certificate signing request
openssl req -new -key flowdesk.com.key -out flowdesk.com.csr

# Submit CSR to certificate authority
# Install received certificate
```

#### Cloudflare SSL (Alternative)
```json
{
  "ssl": "flexible", // or "full" or "strict"
  "edgeCertificates": true,
  "minTlsVersion": "1.2",
  "opportunisticEncryption": true,
  "tls13": "on"
}
```

### 3. Security Headers Configuration

#### Nginx Configuration
```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

#### Next.js Configuration
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options', 
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}
```

---

## Monitoring and Logging Setup

### 1. Application Monitoring

#### Sentry Error Tracking
```bash
# Install Sentry SDK
npm install @sentry/nextjs @sentry/node

# Configure Sentry (sentry.client.config.js)
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  release: process.env.npm_package_version
})
```

#### Vercel Analytics
```typescript
// Add to _app.tsx
import { Analytics } from '@vercel/analytics/react'

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}
```

### 2. Infrastructure Monitoring

#### Health Check Endpoints
```typescript
// pages/api/health.ts
export default function handler(req, res) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  }
  
  res.status(200).json(health)
}

// pages/api/health/detailed.ts
export default async function handler(req, res) {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkRedis(),
    checkStorage()
  ])
  
  const health = {
    status: checks.every(c => c.status === 'fulfilled') ? 'healthy' : 'unhealthy',
    services: {
      database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
      storage: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy'
    }
  }
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health)
}
```

### 3. Log Aggregation

#### Structured Logging
```typescript
// lib/logger.ts
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
})

export default logger
```

#### Log Shipping
```yaml
# docker-compose.yml (with log driver)
version: '3.8'
services:
  app:
    build: .
    logging:
      driver: "fluentd"
      options:
        fluentd-address: "localhost:24224"
        tag: "flowdesk.app"
```

---

## Environment-Specific Settings

### Development Environment
```env
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_ANALYTICS=false
ENABLE_MONITORING=false
RATE_LIMITING=false
```

### Staging Environment
```env
NODE_ENV=production
LOG_LEVEL=info
ENABLE_ANALYTICS=true
ENABLE_MONITORING=true
RATE_LIMITING=true
REDIS_URL=redis://staging-redis:6379
```

### Production Environment
```env
NODE_ENV=production
LOG_LEVEL=warn
ENABLE_ANALYTICS=true
ENABLE_MONITORING=true
RATE_LIMITING=true
REDIS_URL=redis://prod-redis:6379
```

---

## Validation and Testing

### Environment Validation Script
```typescript
// scripts/validate-env.ts
import { env } from '../src/lib/env'

async function validateEnvironment() {
  try {
    // Validate all required environment variables
    console.log('✅ Environment validation passed')
    console.log(`Database: ${env.DATABASE_URL.split('@')[1]}`)
    console.log(`App URL: ${env.NEXT_PUBLIC_APP_URL}`)
    
    // Test database connection
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    await prisma.$connect()
    console.log('✅ Database connection successful')
    
    // Test external services
    // ... additional validations
    
  } catch (error) {
    console.error('❌ Environment validation failed:', error)
    process.exit(1)
  }
}

validateEnvironment()
```

### Configuration Test Suite
```bash
# Run configuration tests
npm run test:config

# Validate environment
npm run validate:env

# Test integrations
npm run test:integrations
```

---

This configuration guide provides all necessary settings to properly deploy and operate Flow Desk in production. Ensure all environment variables are properly set and all third-party integrations are correctly configured before going live.
