/**
 * Email Provider Configuration System
 * 
 * Defines server settings and auto-discovery for major email providers
 */

export interface EmailServerConfig {
  imap: {
    host: string
    port: number
    secure: boolean // true for 993, false for 143
    requireTLS?: boolean
    auth?: {
      type?: 'oauth2' | 'password' | 'xoauth2'
    }
  }
  smtp: {
    host: string
    port: number
    secure: boolean // true for 465, false for 587/25
    requireTLS?: boolean
    auth?: {
      type?: 'oauth2' | 'password' | 'xoauth2'
    }
  }
  oauth?: {
    clientId?: string
    scopes: string[]
    authUrl: string
    tokenUrl: string
  }
  specialFolders?: {
    inbox?: string
    sent?: string
    drafts?: string
    trash?: string
    spam?: string
    archive?: string
  }
}

export interface ProviderCapabilities {
  supportsOAuth: boolean
  supportsIdle: boolean
  supportsPush: boolean
  supportsSearch: boolean
  supportsLabels: boolean
  supportsThreads: boolean
  maxAttachmentSize: number // in bytes
  rateLimit?: {
    requests: number
    window: number // in seconds
  }
}

export interface EmailProvider {
  id: string
  name: string
  domains: string[]
  config: EmailServerConfig
  capabilities: ProviderCapabilities
  autoDiscovery?: {
    imapHostPatterns: string[]
    smtpHostPatterns: string[]
  }
}

// Provider configurations
export const EMAIL_PROVIDERS: Record<string, EmailProvider> = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    domains: ['gmail.com', 'googlemail.com'],
    config: {
      imap: {
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { type: 'oauth2' }
      },
      smtp: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { type: 'oauth2' }
      },
      oauth: {
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.compose',
          'https://www.googleapis.com/auth/gmail.modify'
        ],
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token'
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: '[Gmail]/Sent Mail',
        drafts: '[Gmail]/Drafts',
        trash: '[Gmail]/Trash',
        spam: '[Gmail]/Spam',
        archive: '[Gmail]/All Mail'
      }
    },
    capabilities: {
      supportsOAuth: true,
      supportsIdle: true,
      supportsPush: true,
      supportsSearch: true,
      supportsLabels: true,
      supportsThreads: true,
      maxAttachmentSize: 25 * 1024 * 1024, // 25MB
      rateLimit: {
        requests: 250,
        window: 60
      }
    }
  },

  outlook: {
    id: 'outlook',
    name: 'Outlook/Hotmail',
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    config: {
      imap: {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
        auth: { type: 'oauth2' }
      },
      smtp: {
        host: 'smtp-mail.outlook.com',
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { type: 'oauth2' }
      },
      oauth: {
        scopes: [
          'https://outlook.office.com/IMAP.AccessAsUser.All',
          'https://outlook.office.com/SMTP.Send',
          'offline_access'
        ],
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: 'Sent Items',
        drafts: 'Drafts',
        trash: 'Deleted Items',
        spam: 'Junk Email',
        archive: 'Archive'
      }
    },
    capabilities: {
      supportsOAuth: true,
      supportsIdle: true,
      supportsPush: false,
      supportsSearch: true,
      supportsLabels: false,
      supportsThreads: false,
      maxAttachmentSize: 20 * 1024 * 1024, // 20MB
      rateLimit: {
        requests: 100,
        window: 60
      }
    }
  },

  yahoo: {
    id: 'yahoo',
    name: 'Yahoo Mail',
    domains: ['yahoo.com', 'ymail.com', 'rocketmail.com'],
    config: {
      imap: {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true
      },
      smtp: {
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: 'Sent',
        drafts: 'Drafts',
        trash: 'Trash',
        spam: 'Bulk Mail',
        archive: 'Archive'
      }
    },
    capabilities: {
      supportsOAuth: false,
      supportsIdle: true,
      supportsPush: false,
      supportsSearch: true,
      supportsLabels: false,
      supportsThreads: false,
      maxAttachmentSize: 25 * 1024 * 1024, // 25MB
    }
  },

  fastmail: {
    id: 'fastmail',
    name: 'Fastmail',
    domains: ['fastmail.com', 'fastmail.fm', 'messagingengine.com'],
    config: {
      imap: {
        host: 'imap.fastmail.com',
        port: 993,
        secure: true
      },
      smtp: {
        host: 'smtp.fastmail.com',
        port: 465,
        secure: true
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: 'Sent Items',
        drafts: 'Drafts',
        trash: 'Trash',
        spam: 'Spam',
        archive: 'Archive'
      }
    },
    capabilities: {
      supportsOAuth: false,
      supportsIdle: true,
      supportsPush: false,
      supportsSearch: true,
      supportsLabels: true,
      supportsThreads: false,
      maxAttachmentSize: 50 * 1024 * 1024, // 50MB
    }
  },

  icloud: {
    id: 'icloud',
    name: 'iCloud Mail',
    domains: ['icloud.com', 'me.com', 'mac.com'],
    config: {
      imap: {
        host: 'imap.mail.me.com',
        port: 993,
        secure: true
      },
      smtp: {
        host: 'smtp.mail.me.com',
        port: 587,
        secure: false,
        requireTLS: true
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: 'Sent Messages',
        drafts: 'Drafts',
        trash: 'Deleted Messages',
        spam: 'Junk',
        archive: 'Archive'
      }
    },
    capabilities: {
      supportsOAuth: false,
      supportsIdle: true,
      supportsPush: false,
      supportsSearch: true,
      supportsLabels: false,
      supportsThreads: false,
      maxAttachmentSize: 20 * 1024 * 1024, // 20MB
    }
  },

  exchange: {
    id: 'exchange',
    name: 'Microsoft Exchange',
    domains: [], // Will be determined by domain detection
    config: {
      imap: {
        host: '', // Will be auto-discovered
        port: 993,
        secure: true
      },
      smtp: {
        host: '', // Will be auto-discovered
        port: 587,
        secure: false,
        requireTLS: true
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: 'Sent Items',
        drafts: 'Drafts',
        trash: 'Deleted Items',
        spam: 'Junk Email',
        archive: 'Archive'
      }
    },
    capabilities: {
      supportsOAuth: true,
      supportsIdle: true,
      supportsPush: false,
      supportsSearch: true,
      supportsLabels: false,
      supportsThreads: false,
      maxAttachmentSize: 150 * 1024 * 1024, // 150MB (configurable)
    },
    autoDiscovery: {
      imapHostPatterns: ['mail.%domain%', 'imap.%domain%', 'exchange.%domain%'],
      smtpHostPatterns: ['mail.%domain%', 'smtp.%domain%', 'exchange.%domain%']
    }
  },

  generic: {
    id: 'generic',
    name: 'Generic IMAP/SMTP',
    domains: [],
    config: {
      imap: {
        host: '', // User provided
        port: 993,
        secure: true
      },
      smtp: {
        host: '', // User provided
        port: 587,
        secure: false,
        requireTLS: true
      },
      specialFolders: {
        inbox: 'INBOX',
        sent: 'Sent',
        drafts: 'Drafts',
        trash: 'Trash',
        spam: 'Spam',
        archive: 'Archive'
      }
    },
    capabilities: {
      supportsOAuth: false,
      supportsIdle: true,
      supportsPush: false,
      supportsSearch: true,
      supportsLabels: false,
      supportsThreads: false,
      maxAttachmentSize: 25 * 1024 * 1024, // 25MB (default)
    }
  }
}

/**
 * Auto-discover email provider based on email address
 */
export function detectProvider(email: string): EmailProvider | null {
  const domain = email.split('@')[1]?.toLowerCase()
  
  if (!domain) return null
  
  // Check exact domain matches
  for (const provider of Object.values(EMAIL_PROVIDERS)) {
    if (provider.domains.includes(domain)) {
      return provider
    }
  }
  
  // Check for common patterns
  if (domain.includes('outlook') || domain.includes('office365')) {
    return EMAIL_PROVIDERS.outlook
  }
  
  if (domain.includes('exchange')) {
    return EMAIL_PROVIDERS.exchange
  }
  
  return null
}

/**
 * Auto-discover server settings for a domain
 */
export async function discoverServerSettings(domain: string): Promise<Partial<EmailServerConfig> | null> {
  const commonPorts = {
    imap: [993, 143],
    smtp: [465, 587, 25]
  }
  
  const hostPatterns = [
    'mail.%domain%',
    'imap.%domain%',
    'smtp.%domain%',
    '%domain%',
    'mx.%domain%'
  ]
  
  const results: Partial<EmailServerConfig> = {}
  
  try {
    // Try to discover IMAP settings
    for (const pattern of hostPatterns) {
      const host = pattern.replace('%domain%', domain)
      
      for (const port of commonPorts.imap) {
        try {
          const isSecure = port === 993
          // Test connection (simplified - in real implementation, use actual socket test)
          results.imap = {
            host,
            port,
            secure: isSecure
          }
          break
        } catch (error) {
          // Continue trying
        }
      }
      
      if (results.imap) break
    }
    
    // Try to discover SMTP settings
    for (const pattern of hostPatterns) {
      const host = pattern.replace('%domain%', domain)
      
      for (const port of commonPorts.smtp) {
        try {
          const isSecure = port === 465
          const requireTLS = port === 587
          
          results.smtp = {
            host,
            port,
            secure: isSecure,
            requireTLS
          }
          break
        } catch (error) {
          // Continue trying
        }
      }
      
      if (results.smtp) break
    }
    
    return Object.keys(results).length > 0 ? results : null
  } catch (error) {
    return null
  }
}

/**
 * Validate server configuration by testing connection
 */
export async function validateServerConfig(config: EmailServerConfig, credentials: { email: string, password: string }): Promise<boolean> {
  try {
    // This would implement actual connection testing
    // For now, return true as placeholder
    return true
  } catch (error) {
    return false
  }
}

/**
 * Get OAuth configuration for a provider
 */
export function getOAuthConfig(providerId: string): EmailProvider['config']['oauth'] | null {
  const provider = EMAIL_PROVIDERS[providerId]
  return provider?.config.oauth || null
}

/**
 * Get special folder mappings for a provider
 */
export function getSpecialFolders(providerId: string): Record<string, string> {
  const provider = EMAIL_PROVIDERS[providerId]
  return provider?.config.specialFolders || {}
}

/**
 * Check if provider supports a specific capability
 */
export function hasCapability(providerId: string, capability: keyof ProviderCapabilities): boolean {
  const provider = EMAIL_PROVIDERS[providerId]
  return Boolean(provider?.capabilities[capability])
}

/**
 * Get rate limit information for a provider
 */
export function getRateLimit(providerId: string): { requests: number, window: number } | null {
  const provider = EMAIL_PROVIDERS[providerId]
  return provider?.capabilities.rateLimit || null
}