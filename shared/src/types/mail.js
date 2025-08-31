"use strict";
/**
 * Mail System Types for Flow Desk
 *
 * Defines comprehensive types for email accounts, messages, folders, filters,
 * signatures, and mail provider integrations following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailAccountSchema = exports.EmailMessageSchema = exports.EmailAddressSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.EmailAddressSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    address: zod_1.z.string().email()
});
exports.EmailMessageSchema = zod_1.z.object({
    id: zod_1.z.string(),
    accountId: zod_1.z.string(),
    providerId: zod_1.z.string(),
    threadId: zod_1.z.string(),
    subject: zod_1.z.string(),
    bodyHtml: zod_1.z.string().optional(),
    bodyText: zod_1.z.string().optional(),
    snippet: zod_1.z.string(),
    from: exports.EmailAddressSchema,
    to: zod_1.z.array(exports.EmailAddressSchema),
    cc: zod_1.z.array(exports.EmailAddressSchema),
    bcc: zod_1.z.array(exports.EmailAddressSchema),
    replyTo: zod_1.z.array(exports.EmailAddressSchema),
    date: zod_1.z.date(),
    flags: zod_1.z.object({
        isRead: zod_1.z.boolean(),
        isStarred: zod_1.z.boolean(),
        isTrashed: zod_1.z.boolean(),
        isSpam: zod_1.z.boolean(),
        isImportant: zod_1.z.boolean(),
        isArchived: zod_1.z.boolean(),
        isDraft: zod_1.z.boolean(),
        isSent: zod_1.z.boolean(),
        hasAttachments: zod_1.z.boolean()
    }),
    labels: zod_1.z.array(zod_1.z.string()),
    folder: zod_1.z.string(),
    importance: zod_1.z.enum(['low', 'normal', 'high']),
    priority: zod_1.z.enum(['low', 'normal', 'high']),
    size: zod_1.z.number().nonnegative(),
    attachments: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        filename: zod_1.z.string(),
        mimeType: zod_1.z.string(),
        size: zod_1.z.number().nonnegative(),
        contentId: zod_1.z.string().optional(),
        isInline: zod_1.z.boolean(),
        downloadUrl: zod_1.z.string().url().optional(),
        localPath: zod_1.z.string().optional()
    })),
    headers: zod_1.z.record(zod_1.z.string()),
    messageId: zod_1.z.string(),
    inReplyTo: zod_1.z.string().optional(),
    references: zod_1.z.array(zod_1.z.string()),
    encryption: zod_1.z.object({
        type: zod_1.z.enum(['smime', 'pgp']),
        isEncrypted: zod_1.z.boolean(),
        isSigned: zod_1.z.boolean(),
        signatureValid: zod_1.z.boolean().optional(),
        certificateInfo: zod_1.z.object({
            issuer: zod_1.z.string(),
            subject: zod_1.z.string(),
            validFrom: zod_1.z.date(),
            validTo: zod_1.z.date()
        }).optional()
    }).optional(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.MailAccountSchema = zod_1.z.object({
    id: zod_1.z.string(),
    userId: zod_1.z.string(),
    name: zod_1.z.string(),
    email: zod_1.z.string().email(),
    provider: zod_1.z.enum(['gmail', 'outlook', 'exchange', 'imap', 'fastmail', 'proton', 'yahoo', 'aol']),
    config: zod_1.z.any(), // Union type too complex for Zod
    credentials: zod_1.z.object({
        accessToken: zod_1.z.string().optional(),
        refreshToken: zod_1.z.string().optional(),
        tokenExpiresAt: zod_1.z.date().optional(),
        password: zod_1.z.string().optional(),
        additionalTokens: zod_1.z.record(zod_1.z.string()).optional()
    }).optional(),
    status: zod_1.z.enum(['active', 'auth_error', 'quota_exceeded', 'suspended', 'disabled', 'error']),
    lastSyncAt: zod_1.z.date().optional(),
    nextSyncAt: zod_1.z.date().optional(),
    syncIntervalMinutes: zod_1.z.number().positive(),
    isEnabled: zod_1.z.boolean(),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
//# sourceMappingURL=mail.js.map