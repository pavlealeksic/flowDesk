# Flow Desk Operations Guide

## Overview

This guide covers operational procedures for maintaining Flow Desk in production environments, including monitoring, performance optimization, error handling, backup strategies, security practices, and incident response procedures.

---

## Application Monitoring and Health Checks

### 1. Health Check Endpoints

Flow Desk includes several built-in monitoring endpoints:

#### Basic Health Check
```bash
curl https://flowdesk.com/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-28T14:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "environment": "production"
}
```

#### Detailed Health Check
```bash
curl https://flowdesk.com/api/health/detailed
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-28T14:00:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "connections": {
        "active": 5,
        "idle": 10,
        "total": 15
      }
    },
    "redis": {
      "status": "healthy",
      "responseTime": 12,
      "memory": "250MB"
    },
    "storage": {
      "status": "healthy",
      "responseTime": 23,
      "usage": "45GB"
    }
  },
  "metrics": {
    "activeUsers": 1250,
    "requestsPerMinute": 45,
    "errorRate": 0.001,
    "averageResponseTime": 180
  }
}
```

#### Admin Metrics Endpoint
```bash
curl -H "Authorization: Bearer admin-token" https://flowdesk.com/api/admin/metrics
```

### 2. Key Performance Indicators (KPIs)

#### Application Performance Metrics
- **Response Time:** < 500ms average (95th percentile < 1s)
- **Error Rate:** < 0.1% of all requests
- **Availability:** > 99.9% uptime
- **Database Query Time:** < 100ms average
- **Memory Usage:** < 85% of allocated memory
- **CPU Usage:** < 70% average

#### Business Metrics
- **Active Users:** Daily and monthly active users
- **Plugin Usage:** Most used plugins and features
- **Subscription Metrics:** Conversion rates, churn, MRR
- **Support Tickets:** Volume, resolution time, satisfaction

### 3. Alerting Configuration

#### Critical Alerts (Immediate Response Required)
```yaml
alerts:
  - name: "Application Down"
    condition: "health_check_failed > 2m"
    severity: "critical"
    channels: ["pagerduty", "slack-critical"]
    
  - name: "Database Connection Failed"
    condition: "db_connections_failed > 5"
    severity: "critical"
    channels: ["pagerduty", "slack-critical"]
    
  - name: "High Error Rate"
    condition: "error_rate > 1% for 5m"
    severity: "critical"
    channels: ["pagerduty", "slack-critical"]
```

#### Warning Alerts (Monitor Closely)
```yaml
  - name: "High Response Time"
    condition: "avg_response_time > 1s for 10m"
    severity: "warning"
    channels: ["slack-alerts"]
    
  - name: "Memory Usage High"
    condition: "memory_usage > 85% for 15m"
    severity: "warning"
    channels: ["slack-alerts"]
    
  - name: "Disk Space Low"
    condition: "disk_usage > 90%"
    severity: "warning"
    channels: ["slack-alerts"]
```

### 4. Monitoring Dashboard Setup

#### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "Flow Desk Production Overview",
    "panels": [
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_users_total"
          }
        ]
      }
    ]
  }
}
```

---

## Performance Monitoring and Optimization

### 1. Application Performance Monitoring (APM)

#### Sentry Performance Monitoring
```typescript
// Configure performance monitoring
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.BrowserTracing({
      // Performance monitoring configuration
      tracePropagationTargets: ['localhost', 'flowdesk.com']
    })
  ],
  tracesSampleRate: 1.0, // 100% sampling in production
  environment: process.env.NODE_ENV
})
```

#### Custom Performance Metrics
```typescript
// lib/metrics.ts
import { performance } from 'perf_hooks'

export class PerformanceMetrics {
  private static instance: PerformanceMetrics

  static getInstance(): PerformanceMetrics {
    if (!PerformanceMetrics.instance) {
      PerformanceMetrics.instance = new PerformanceMetrics()
    }
    return PerformanceMetrics.instance
  }

  measureDatabaseQuery<T>(queryName: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    return fn().finally(() => {
      const duration = performance.now() - start
      this.recordMetric('db_query_duration', duration, { query: queryName })
    })
  }

  measureAPICall<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    return fn().finally(() => {
      const duration = performance.now() - start
      this.recordMetric('api_call_duration', duration, { endpoint })
    })
  }

  private recordMetric(name: string, value: number, labels: Record<string, string>) {
    // Send to monitoring service (Datadog, New Relic, etc.)
    console.log(`Metric: ${name}=${value}`, labels)
  }
}
```

### 2. Database Performance Optimization

#### Query Performance Monitoring
```sql
-- PostgreSQL slow query monitoring
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h ';
SELECT pg_reload_conf();
```

#### Index Optimization
```typescript
// Monitor and optimize database indexes
export async function analyzeQueryPerformance() {
  const slowQueries = await prisma.$queryRaw`
    SELECT 
      query,
      mean_exec_time,
      calls,
      total_exec_time
    FROM pg_stat_statements 
    WHERE mean_exec_time > 1000
    ORDER BY mean_exec_time DESC
    LIMIT 20
  `
  
  return slowQueries
}

// Automated index suggestions
export async function suggestIndexes() {
  const missedIndexes = await prisma.$queryRaw`
    SELECT 
      schemaname,
      tablename,
      attname,
      n_distinct,
      correlation
    FROM pg_stats
    WHERE n_distinct > 100
    AND correlation < 0.1
  `
  
  return missedIndexes
}
```

#### Connection Pool Optimization
```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection pool settings
  connection_limit = 20
  pool_timeout = 30
}
```

### 3. Frontend Performance Optimization

#### Next.js Performance Configuration
```javascript
// next.config.js
module.exports = {
  // Enable experimental features
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  
  // Image optimization
  images: {
    domains: ['images.clerk.dev', 'clerk.com'],
    formats: ['image/webp', 'image/avif']
  },
  
  // Bundle analyzer (development)
  webpack: (config, { dev, isServer }) => {
    if (process.env.ANALYZE) {
      const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
      config.plugins.push(new BundleAnalyzerPlugin())
    }
    return config
  }
}
```

#### Performance Budgets
```json
{
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "500kb",
      "maximumError": "1mb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "2kb",
      "maximumError": "4kb"
    }
  ]
}
```

### 4. CDN and Caching Strategy

#### Cloudflare Configuration
```json
{
  "caching": {
    "level": "aggressive",
    "rules": [
      {
        "pattern": "*.js",
        "ttl": 86400,
        "cache_level": "cache_everything"
      },
      {
        "pattern": "*.css", 
        "ttl": 86400,
        "cache_level": "cache_everything"
      },
      {
        "pattern": "/api/*",
        "ttl": 0,
        "cache_level": "bypass"
      }
    ]
  }
}
```

#### Redis Caching Implementation
```typescript
// lib/cache.ts
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

export class CacheManager {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) : null
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value))
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  }
}

// Usage in API routes
export default async function handler(req, res) {
  const cacheKey = `user:${userId}:profile`
  const cached = await cache.get(cacheKey)
  
  if (cached) {
    return res.json(cached)
  }
  
  const data = await fetchUserProfile(userId)
  await cache.set(cacheKey, data, 1800) // 30 minutes
  
  res.json(data)
}
```

---

## Error Handling and Debugging

### 1. Error Monitoring and Alerting

#### Sentry Error Tracking
```typescript
// lib/error-handler.ts
import * as Sentry from '@sentry/nextjs'

export class ErrorHandler {
  static captureException(error: Error, context?: Record<string, any>) {
    Sentry.captureException(error, {
      tags: {
        component: 'api',
        severity: 'error'
      },
      extra: context
    })
  }

  static captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    Sentry.captureMessage(message, level)
  }

  static setUser(user: { id: string; email: string }) {
    Sentry.setUser({
      id: user.id,
      email: user.email
    })
  }
}

// API error handling middleware
export function withErrorHandling(handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      ErrorHandler.captureException(error as Error, {
        url: req.url,
        method: req.method,
        headers: req.headers
      })
      
      res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}
```

#### Custom Error Classes
```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR')
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR')
  }
}
```

### 2. Logging Strategy

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
  defaultMeta: {
    service: 'flow-desk',
    environment: process.env.NODE_ENV
  },
  transports: [
    // Console output for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File output for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
})

export default logger

// Usage examples
logger.info('User logged in', { userId: '123', email: 'user@example.com' })
logger.warn('Rate limit approaching', { userId: '123', requests: 95, limit: 100 })
logger.error('Database connection failed', { error: error.message, stack: error.stack })
```

#### Request Logging Middleware
```typescript
// middleware/logging.ts
import logger from '../lib/logger'

export function requestLogger(req: NextRequest) {
  const start = Date.now()
  
  return new Response(req.body, {
    status: 200,
    headers: {
      'X-Request-ID': crypto.randomUUID()
    }
  }).then((response) => {
    const duration = Date.now() - start
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: response.status,
      duration,
      userAgent: req.headers.get('user-agent'),
      ip: req.ip
    })
    
    return response
  })
}
```

### 3. Debugging Procedures

#### Production Debugging Checklist
```bash
# 1. Check application health
curl https://flowdesk.com/api/health/detailed

# 2. Review recent logs
tail -f logs/combined.log | jq '.'

# 3. Check error rates in Sentry
# Go to Sentry dashboard for recent errors

# 4. Monitor database performance
psql $DATABASE_URL -c "
  SELECT 
    datname, 
    numbackends as connections,
    xact_commit + xact_rollback as transactions,
    blks_read + blks_hit as blocks_accessed
  FROM pg_stat_database 
  WHERE datname = 'flowdesk_production'
"

# 5. Check Redis performance
redis-cli INFO memory
redis-cli INFO stats

# 6. Monitor system resources
top -p $(pgrep -f "next-server")
df -h
```

#### Debug Mode Configuration
```typescript
// Enable debug mode in development
if (process.env.NODE_ENV === 'development') {
  process.env.DEBUG = 'flow-desk:*'
}

// Debug logging
import debug from 'debug'
const debugAuth = debug('flow-desk:auth')
const debugDB = debug('flow-desk:database')

debugAuth('User authentication attempt', { userId })
debugDB('Query executed', { query, duration })
```

---

## Backup and Disaster Recovery

### 1. Database Backup Strategy

#### Automated Daily Backups
```bash
#!/bin/bash
# scripts/backup-database.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="flowdesk_backup_$TIMESTAMP.sql"
S3_BUCKET="flowdesk-backups"

# Create database backup
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE.gz s3://$S3_BUCKET/database/

# Clean up local files older than 7 days
find . -name "flowdesk_backup_*.sql.gz" -mtime +7 -delete

# Verify backup integrity
if aws s3 ls s3://$S3_BUCKET/database/$BACKUP_FILE.gz; then
  echo "Backup completed successfully: $BACKUP_FILE.gz"
else
  echo "Backup failed!" | mail -s "Flow Desk Backup Failed" admin@flowdesk.com
fi
```

#### Backup Verification Script
```bash
#!/bin/bash
# scripts/verify-backup.sh

LATEST_BACKUP=$(aws s3 ls s3://flowdesk-backups/database/ | sort | tail -n 1 | awk '{print $4}')

# Download and test backup
aws s3 cp s3://flowdesk-backups/database/$LATEST_BACKUP /tmp/
gunzip /tmp/$LATEST_BACKUP

# Create test database
createdb flowdesk_backup_test

# Restore backup
psql flowdesk_backup_test < /tmp/${LATEST_BACKUP%.gz}

# Verify data integrity
psql flowdesk_backup_test -c "SELECT COUNT(*) FROM users;" > /tmp/user_count.txt
psql flowdesk_backup_test -c "SELECT COUNT(*) FROM plugins;" > /tmp/plugin_count.txt

# Clean up test database
dropdb flowdesk_backup_test
rm /tmp/${LATEST_BACKUP%.gz}

echo "Backup verification completed"
```

#### Point-in-Time Recovery Setup
```sql
-- Enable point-in-time recovery
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'aws s3 cp %p s3://flowdesk-backups/wal/%f';
ALTER SYSTEM SET max_wal_senders = 3;

-- Reload configuration
SELECT pg_reload_conf();
```

### 2. File Storage Backup

#### S3 Cross-Region Replication
```json
{
  "Rules": [
    {
      "ID": "ReplicateUploads",
      "Status": "Enabled",
      "Prefix": "uploads/",
      "Destination": {
        "Bucket": "arn:aws:s3:::flowdesk-uploads-backup",
        "StorageClass": "STANDARD_IA"
      }
    }
  ]
}
```

#### Application Data Backup
```bash
#!/bin/bash
# scripts/backup-app-data.sh

# Backup environment configuration
kubectl get secret app-secrets -o yaml > backups/app-secrets-$(date +%Y%m%d).yaml

# Backup persistent volumes
kubectl get pv -o yaml > backups/persistent-volumes-$(date +%Y%m%d).yaml

# Backup application manifests
kubectl get deployment,service,ingress -o yaml > backups/app-manifests-$(date +%Y%m%d).yaml
```

### 3. Disaster Recovery Procedures

#### Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)
- **Database RTO:** 1 hour
- **Database RPO:** 15 minutes
- **Application RTO:** 30 minutes
- **File Storage RPO:** 4 hours

#### Database Recovery Procedure
```bash
#!/bin/bash
# scripts/restore-database.sh

RESTORE_POINT=$1  # e.g., "2025-08-28 14:00:00"
BACKUP_FILE=$2    # e.g., "flowdesk_backup_20250828_120000.sql.gz"

# Stop application
kubectl scale deployment flowdesk-server --replicas=0

# Create new database
createdb flowdesk_recovery

# Restore base backup
gunzip -c $BACKUP_FILE | psql flowdesk_recovery

# Apply WAL files up to restore point
pg_waldump --start=000000010000000000000001 --end=recovery_target | psql flowdesk_recovery

# Update connection strings
kubectl set env deployment/flowdesk-server DATABASE_URL="postgresql://user:pass@host/flowdesk_recovery"

# Restart application
kubectl scale deployment flowdesk-server --replicas=3

echo "Database recovery completed"
```

#### Application Recovery Procedure
```bash
#!/bin/bash
# scripts/recover-application.sh

# Deploy to backup region
vercel deploy --prod --env production-backup

# Update DNS to point to backup
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456789 \
  --change-batch file://dns-failover.json

# Monitor application health
while ! curl -f https://flowdesk.com/api/health; do
  echo "Waiting for application to be ready..."
  sleep 10
done

echo "Application recovery completed"
```

#### Communication Template
```markdown
# Incident Communication Template

**Subject:** Flow Desk Service Incident - [SEVERITY] - [BRIEF DESCRIPTION]

**Status:** [INVESTIGATING/IDENTIFIED/MONITORING/RESOLVED]

**Summary:** 
Brief description of the incident and its impact.

**Impact:**
- Services affected: [List]
- Users affected: [Number/Percentage]
- Functionality impacted: [Description]

**Timeline:**
- [Time] - Issue first reported
- [Time] - Investigation began
- [Time] - Root cause identified
- [Time] - Fix implemented
- [Time] - Service restored

**Next Steps:**
- [Action items and responsible parties]
- Post-mortem scheduled for [Date/Time]

**Contact:**
For questions, contact: operations@flowdesk.com
```

---

## Scaling and Load Balancing

### 1. Horizontal Scaling Configuration

#### Load Balancer Setup (Nginx)
```nginx
upstream flowdesk_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name flowdesk.com;
    
    location / {
        proxy_pass http://flowdesk_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_next_upstream error timeout http_502 http_503 http_504;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }
    
    # Health check endpoint for load balancer
    location /health {
        access_log off;
        proxy_pass http://flowdesk_backend/api/health;
    }
}
```

#### Auto-Scaling Configuration (Kubernetes)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: flowdesk-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: flowdesk-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

### 2. Database Scaling

#### Read Replica Configuration
```typescript
// lib/database.ts
import { PrismaClient } from '@prisma/client'

// Primary database (read/write)
export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_WRITE_URL
    }
  }
})

// Read replica (read-only)
export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_READ_URL
    }
  }
})

// Smart query router
export function getDatabase(operation: 'read' | 'write' = 'read') {
  return operation === 'write' ? prismaWrite : prismaRead
}

// Usage in API routes
export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Use read replica for queries
    const data = await getDatabase('read').user.findMany()
    return res.json(data)
  }
  
  if (req.method === 'POST') {
    // Use primary database for writes
    const data = await getDatabase('write').user.create({
      data: req.body
    })
    return res.json(data)
  }
}
```

#### Connection Pool Optimization
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

declare global {
  var __prisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__prisma ||
  new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
```

### 3. CDN and Static Asset Optimization

#### Cloudflare Workers Configuration
```javascript
// cloudflare-worker.js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Cache static assets aggressively
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$/)) {
    const cache = caches.default
    const cacheKey = new Request(url.toString(), request)
    const response = await cache.match(cacheKey)
    
    if (response) {
      return response
    }
    
    const freshResponse = await fetch(request)
    const responseToCache = freshResponse.clone()
    
    responseToCache.headers.set('Cache-Control', 'public, max-age=86400')
    event.waitUntil(cache.put(cacheKey, responseToCache))
    
    return freshResponse
  }
  
  // Forward other requests
  return fetch(request)
}
```

---

## Security Best Practices

### 1. Security Headers and Configuration

#### Next.js Security Headers
```javascript
// next.config.js
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.clerk.dev https://js.stripe.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://images.clerk.dev https://clerk.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim()
          }
        ]
      }
    ]
  }
}
```

### 2. API Security

#### Rate Limiting Implementation
```typescript
// lib/rate-limiter.ts
import { Redis } from 'ioredis'
import { NextRequest } from 'next/server'

const redis = new Redis(process.env.REDIS_URL)

export class RateLimiter {
  async isAllowed(
    key: string,
    limit: number,
    window: number
  ): Promise<{ allowed: boolean; remaining: number; reset: Date }> {
    const now = Date.now()
    const windowStart = now - window * 1000
    
    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart)
    
    // Count current requests
    const current = await redis.zcard(key)
    
    if (current >= limit) {
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES')
      const reset = new Date(oldest[1] + window * 1000)
      
      return {
        allowed: false,
        remaining: 0,
        reset
      }
    }
    
    // Add current request
    await redis.zadd(key, now, now)
    await redis.expire(key, window)
    
    return {
      allowed: true,
      remaining: limit - current - 1,
      reset: new Date(now + window * 1000)
    }
  }
}

// Middleware usage
export async function rateLimitMiddleware(req: NextRequest) {
  const limiter = new RateLimiter()
  const ip = req.ip ?? '127.0.0.1'
  const key = `rate_limit:${ip}`
  
  const result = await limiter.isAllowed(key, 100, 3600) // 100 requests per hour
  
  if (!result.allowed) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': result.reset.toISOString()
      }
    })
  }
  
  return new Response(null, {
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.reset.toISOString()
    }
  })
}
```

#### Input Validation and Sanitization
```typescript
// lib/validation.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

// Schema validation
export const userSchema = z.object({
  email: z.string().email().max(255),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100)
})

export const pluginSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000),
  category: z.enum(['COMMUNICATION', 'PRODUCTIVITY', 'DEVELOPER_TOOLS'])
})

// Input sanitization
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}

// API validation middleware
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return (req: NextRequest) => {
    try {
      const body = req.json()
      const validated = schema.parse(body)
      return validated
    } catch (error) {
      throw new ValidationError('Invalid request data')
    }
  }
}
```

### 3. Security Monitoring

#### Security Event Logging
```typescript
// lib/security-logger.ts
import logger from './logger'

export class SecurityLogger {
  static logAuthenticationAttempt(
    email: string,
    success: boolean,
    ip: string,
    userAgent: string
  ) {
    logger.info('Authentication attempt', {
      email,
      success,
      ip,
      userAgent,
      type: 'auth_attempt'
    })
  }

  static logSuspiciousActivity(
    userId: string,
    activity: string,
    details: Record<string, any>,
    ip: string
  ) {
    logger.warn('Suspicious activity detected', {
      userId,
      activity,
      details,
      ip,
      type: 'suspicious_activity'
    })
  }

  static logPermissionDenied(
    userId: string,
    resource: string,
    action: string,
    ip: string
  ) {
    logger.warn('Permission denied', {
      userId,
      resource,
      action,
      ip,
      type: 'permission_denied'
    })
  }
}
```

#### Automated Security Scanning
```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
      
      - name: Run OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'https://staging.flowdesk.com'
```

---

## Incident Response Procedures

### 1. Incident Classification

#### Severity Levels
- **P0 - Critical:** Complete service outage affecting all users
- **P1 - High:** Major functionality impacted affecting >50% users
- **P2 - Medium:** Minor functionality impacted affecting <50% users
- **P3 - Low:** Individual user issues or minor bugs

#### Response Times
- **P0:** Immediate response (5 minutes), resolve within 1 hour
- **P1:** Response within 15 minutes, resolve within 4 hours
- **P2:** Response within 1 hour, resolve within 24 hours
- **P3:** Response within 24 hours, resolve within 72 hours

### 2. Incident Response Playbook

#### P0 - Service Outage Response
```bash
# 1. Immediate Assessment
curl -f https://flowdesk.com/api/health || echo "Service is down"

# 2. Check Infrastructure Status
kubectl get pods -n flowdesk
kubectl get services -n flowdesk
kubectl describe pod <failing-pod>

# 3. Check Recent Deployments
kubectl rollout history deployment/flowdesk-server
vercel deployments list --scope flowdesk

# 4. Rollback if Necessary
kubectl rollout undo deployment/flowdesk-server
# OR
vercel rollback <deployment-id>

# 5. Monitor Recovery
watch curl -s https://flowdesk.com/api/health
```

#### Communication Protocol
```bash
# 1. Create incident in PagerDuty
curl -X POST https://api.pagerduty.com/incidents \
  -H "Authorization: Token token=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "incident": {
      "type": "incident",
      "title": "Flow Desk Service Outage",
      "service": {"id": "SERVICE_ID", "type": "service_reference"},
      "urgency": "high",
      "body": {"type": "incident_body", "details": "Service health check failing"}
    }
  }'

# 2. Post to Status Page
curl -X POST https://api.statuspage.io/v1/pages/PAGE_ID/incidents \
  -H "Authorization: OAuth YOUR_API_KEY" \
  -d 'incident[name]=Service Outage' \
  -d 'incident[status]=investigating' \
  -d 'incident[impact_override]=critical'

# 3. Notify Team
slack-cli send "#incidents" "🚨 P0 Incident: Flow Desk service outage detected. Investigation in progress."
```

### 3. Post-Incident Review

#### Post-Mortem Template
```markdown
# Post-Mortem Report

**Incident ID:** INC-2025-001
**Date:** 2025-08-28
**Duration:** 45 minutes
**Severity:** P0 - Critical

## Summary
Brief description of what went wrong and the customer impact.

## Timeline
- **14:00** - Issue first detected by monitoring
- **14:05** - Investigation began
- **14:15** - Root cause identified
- **14:30** - Fix deployed
- **14:45** - Service fully restored

## Root Cause
Detailed technical explanation of what caused the incident.

## Impact
- **Users Affected:** 100% of active users
- **Services Down:** Web application, mobile app
- **Revenue Impact:** $X estimated lost revenue

## What Went Well
- Fast detection through monitoring
- Effective team communication
- Quick resolution

## What Could Be Improved
- Earlier detection possible
- Faster rollback process needed
- Better runbook documentation

## Action Items
1. [ ] Improve monitoring alerting (Owner: DevOps, Due: 2025-09-01)
2. [ ] Create automated rollback scripts (Owner: Engineering, Due: 2025-09-05)
3. [ ] Update incident response documentation (Owner: SRE, Due: 2025-08-30)

## Lessons Learned
Key takeaways and how they will be applied going forward.
```

---

This operations guide provides comprehensive procedures for maintaining Flow Desk in production. Regular review and updates of these procedures ensure optimal performance and quick incident resolution.
