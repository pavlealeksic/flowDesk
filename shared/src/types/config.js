"use strict";
/**
 * Config Sync Types for Flow Desk
 *
 * Defines comprehensive types for local-first config synchronization,
 * workspace configs, encryption keys, and sync states following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncStateSchema = exports.WorkspaceConfigSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.WorkspaceConfigSchema = zod_1.z.object({
    version: zod_1.z.string(),
    workspace: zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        icon: zod_1.z.string().optional(),
        type: zod_1.z.enum(['personal', 'team', 'organization']),
        organizationId: zod_1.z.string().optional(),
        teamId: zod_1.z.string().optional(),
        ownerId: zod_1.z.string(),
        members: zod_1.z.array(zod_1.z.object({
            userId: zod_1.z.string(),
            role: zod_1.z.enum(['owner', 'admin', 'member', 'viewer']),
            joinedAt: zod_1.z.date(),
            invitedBy: zod_1.z.string().optional(),
            permissions: zod_1.z.array(zod_1.z.string())
        })).optional(),
        createdAt: zod_1.z.date(),
        tags: zod_1.z.array(zod_1.z.string())
    }),
    preferences: zod_1.z.object({
        theme: zod_1.z.object({
            mode: zod_1.z.enum(['light', 'dark', 'auto']),
            accentColor: zod_1.z.string(),
            customTheme: zod_1.z.string().optional(),
            fontFamily: zod_1.z.string(),
            fontSize: zod_1.z.enum(['small', 'medium', 'large']),
            highContrast: zod_1.z.boolean(),
            colorBlindFriendly: zod_1.z.boolean()
        }),
        language: zod_1.z.object({
            locale: zod_1.z.string(),
            dateFormat: zod_1.z.string(),
            timeFormat: zod_1.z.enum(['12h', '24h']),
            numberFormat: zod_1.z.string(),
            currency: zod_1.z.string(),
            timezone: zod_1.z.string(),
            firstDayOfWeek: zod_1.z.number().min(0).max(6)
        }),
        privacy: zod_1.z.object({
            analytics: zod_1.z.boolean(),
            crashReporting: zod_1.z.boolean(),
            usageData: zod_1.z.boolean(),
            telemetry: zod_1.z.boolean(),
            showOnlineStatus: zod_1.z.boolean(),
            showLastSeen: zod_1.z.boolean(),
            readReceipts: zod_1.z.boolean()
        }),
        accessibility: zod_1.z.object({
            reducedMotion: zod_1.z.boolean(),
            screenReader: zod_1.z.boolean(),
            keyboardNavigation: zod_1.z.boolean(),
            focusIndicators: zod_1.z.boolean(),
            textScaling: zod_1.z.number().min(0.8).max(2.0),
            voiceCommands: zod_1.z.boolean()
        }),
        notifications: zod_1.z.object({
            desktop: zod_1.z.boolean(),
            sound: zod_1.z.boolean(),
            emailDigest: zod_1.z.boolean(),
            push: zod_1.z.boolean(),
            soundFile: zod_1.z.string(),
            doNotDisturb: zod_1.z.object({
                enabled: zod_1.z.boolean(),
                startTime: zod_1.z.string(),
                endTime: zod_1.z.string(),
                days: zod_1.z.array(zod_1.z.number().min(0).max(6))
            })
        }),
        startup: zod_1.z.object({
            autoStart: zod_1.z.boolean(),
            restoreWorkspace: zod_1.z.boolean(),
            defaultApps: zod_1.z.array(zod_1.z.string()),
            layout: zod_1.z.string(),
            autoSync: zod_1.z.boolean(),
            checkUpdates: zod_1.z.boolean()
        })
    }),
    apps: zod_1.z.record(zod_1.z.any()),
    plugins: zod_1.z.object({
        plugins: zod_1.z.record(zod_1.z.object({
            pluginId: zod_1.z.string(),
            version: zod_1.z.string(),
            enabled: zod_1.z.boolean(),
            settings: zod_1.z.record(zod_1.z.any()),
            permissions: zod_1.z.array(zod_1.z.string()),
            data: zod_1.z.record(zod_1.z.any()),
            lastUpdateCheck: zod_1.z.date().optional(),
            autoUpdate: zod_1.z.boolean()
        })),
        global: zod_1.z.object({
            autoUpdate: zod_1.z.boolean(),
            updateCheckInterval: zod_1.z.number(),
            allowBeta: zod_1.z.boolean(),
            dataDirectory: zod_1.z.string()
        })
    }),
    keybindings: zod_1.z.object({
        global: zod_1.z.record(zod_1.z.object({
            key: zod_1.z.string(),
            command: zod_1.z.string(),
            args: zod_1.z.any().optional(),
            when: zod_1.z.string().optional(),
            description: zod_1.z.string().optional()
        })),
        apps: zod_1.z.record(zod_1.z.record(zod_1.z.object({
            key: zod_1.z.string(),
            command: zod_1.z.string(),
            args: zod_1.z.any().optional(),
            when: zod_1.z.string().optional(),
            description: zod_1.z.string().optional()
        }))),
        plugins: zod_1.z.record(zod_1.z.record(zod_1.z.object({
            key: zod_1.z.string(),
            command: zod_1.z.string(),
            args: zod_1.z.any().optional(),
            when: zod_1.z.string().optional(),
            description: zod_1.z.string().optional()
        })))
    }),
    ui: zod_1.z.record(zod_1.z.any()),
    sync: zod_1.z.object({
        enabled: zod_1.z.boolean(),
        transport: zod_1.z.any(),
        intervalMinutes: zod_1.z.number(),
        autoSync: zod_1.z.boolean(),
        conflictResolution: zod_1.z.enum(['manual', 'latest', 'merge']),
        encryption: zod_1.z.object({
            algorithm: zod_1.z.enum(['chacha20poly1305', 'aes256gcm']),
            kdf: zod_1.z.enum(['argon2id', 'pbkdf2']),
            workspaceSyncKey: zod_1.z.string(),
            deviceKey: zod_1.z.object({
                publicKey: zod_1.z.string(),
                privateKey: zod_1.z.string(),
                algorithm: zod_1.z.enum(['x25519'])
            }),
            keyRotation: zod_1.z.object({
                enabled: zod_1.z.boolean(),
                intervalDays: zod_1.z.number(),
                lastRotation: zod_1.z.date().optional()
            })
        }),
        excludePatterns: zod_1.z.array(zod_1.z.string()),
        backup: zod_1.z.object({
            enabled: zod_1.z.boolean(),
            frequency: zod_1.z.enum(['hourly', 'daily', 'weekly']),
            retentionCount: zod_1.z.number(),
            location: zod_1.z.string(),
            compress: zod_1.z.boolean(),
            encrypt: zod_1.z.boolean()
        })
    }),
    // automations: removed to simplify the app,
    notifications: zod_1.z.record(zod_1.z.any()),
    lastModified: zod_1.z.object({
        timestamp: zod_1.z.date(),
        deviceId: zod_1.z.string(),
        userId: zod_1.z.string()
    })
});
exports.SyncStateSchema = zod_1.z.object({
    status: zod_1.z.enum(['idle', 'syncing', 'error', 'paused']),
    lastSync: zod_1.z.date().optional(),
    lastError: zod_1.z.object({
        message: zod_1.z.string(),
        timestamp: zod_1.z.date(),
        code: zod_1.z.string()
    }).optional(),
    stats: zod_1.z.object({
        totalSyncs: zod_1.z.number(),
        successfulSyncs: zod_1.z.number(),
        failedSyncs: zod_1.z.number(),
        lastSyncDuration: zod_1.z.number(),
        avgSyncDuration: zod_1.z.number()
    }),
    pendingChanges: zod_1.z.number(),
    conflicts: zod_1.z.number(),
    vectorClock: zod_1.z.record(zod_1.z.number())
});
//# sourceMappingURL=config.js.map