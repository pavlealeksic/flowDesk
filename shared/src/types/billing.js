"use strict";
/**
 * Billing & Licensing Types for Flow Desk
 *
 * Defines comprehensive types for subscriptions, licenses, devices, payments,
 * and billing management following Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LicenseDeviceSchema = exports.LicenseSchema = exports.SubscriptionSchema = void 0;
const zod_1 = require("zod");
// Zod schemas for runtime validation
exports.SubscriptionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    organizationId: zod_1.z.string(),
    userId: zod_1.z.string().optional(),
    stripeSubscriptionId: zod_1.z.string(),
    stripeCustomerId: zod_1.z.string(),
    plan: zod_1.z.enum(['free', 'pro', 'team', 'enterprise']),
    interval: zod_1.z.enum(['monthly', 'yearly', 'lifetime']),
    status: zod_1.z.enum(['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'expired']),
    currentPeriodStart: zod_1.z.date(),
    currentPeriodEnd: zod_1.z.date(),
    trialStart: zod_1.z.date().optional(),
    trialEnd: zod_1.z.date().optional(),
    canceledAt: zod_1.z.date().optional(),
    cancelationReason: zod_1.z.string().optional(),
    cancelAtPeriodEnd: zod_1.z.boolean(),
    pricing: zod_1.z.object({
        basePrice: zod_1.z.number(),
        currency: zod_1.z.string(),
        perSeat: zod_1.z.object({
            price: zod_1.z.number(),
            minSeats: zod_1.z.number(),
            maxSeats: zod_1.z.number().optional()
        }).optional(),
        usage: zod_1.z.array(zod_1.z.object({
            metric: zod_1.z.string(),
            price: zod_1.z.number(),
            unit: zod_1.z.string(),
            tiers: zod_1.z.array(zod_1.z.object({
                upTo: zod_1.z.number(),
                price: zod_1.z.number()
            })).optional()
        })).optional(),
        setupFee: zod_1.z.number().optional(),
        annualDiscount: zod_1.z.number().optional()
    }),
    limits: zod_1.z.object({
        maxMembers: zod_1.z.number(),
        maxWorkspaces: zod_1.z.number(),
        maxConnectedAccounts: zod_1.z.number(),
        maxPlugins: zod_1.z.number(),
        maxStorageGB: zod_1.z.number(),
        maxApiCallsPerMonth: zod_1.z.number(),
        maxAutomations: zod_1.z.number(),
        premiumFeatures: zod_1.z.array(zod_1.z.string()),
        enterpriseFeatures: zod_1.z.array(zod_1.z.string())
    }),
    addOns: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        name: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['storage', 'seats', 'api_calls', 'plugins', 'feature', 'custom']),
        price: zod_1.z.number(),
        quantity: zod_1.z.number(),
        metadata: zod_1.z.record(zod_1.z.any()).optional()
    })),
    discount: zod_1.z.object({
        id: zod_1.z.string(),
        type: zod_1.z.enum(['percentage', 'fixed', 'free_trial']),
        value: zod_1.z.number(),
        duration: zod_1.z.enum(['once', 'repeating', 'forever']),
        durationInMonths: zod_1.z.number().optional(),
        startDate: zod_1.z.date(),
        endDate: zod_1.z.date().optional(),
        promoCode: zod_1.z.string().optional()
    }).optional(),
    tax: zod_1.z.object({
        rate: zod_1.z.number(),
        amount: zod_1.z.number(),
        jurisdiction: zod_1.z.string(),
        type: zod_1.z.string(),
        taxId: zod_1.z.string().optional(),
        vatNumber: zod_1.z.string().optional()
    }),
    metadata: zod_1.z.record(zod_1.z.string()),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.LicenseSchema = zod_1.z.object({
    id: zod_1.z.string(),
    subscriptionId: zod_1.z.string(),
    organizationId: zod_1.z.string(),
    licenseKey: zod_1.z.string(),
    type: zod_1.z.enum(['subscription', 'plugin', 'addon']),
    plan: zod_1.z.enum(['free', 'pro', 'team', 'enterprise']),
    status: zod_1.z.enum(['active', 'suspended', 'expired', 'revoked']),
    limits: zod_1.z.object({
        maxMembers: zod_1.z.number(),
        maxWorkspaces: zod_1.z.number(),
        maxConnectedAccounts: zod_1.z.number(),
        maxPlugins: zod_1.z.number(),
        maxStorageGB: zod_1.z.number(),
        maxApiCallsPerMonth: zod_1.z.number(),
        maxAutomations: zod_1.z.number(),
        premiumFeatures: zod_1.z.array(zod_1.z.string()),
        enterpriseFeatures: zod_1.z.array(zod_1.z.string())
    }),
    features: zod_1.z.array(zod_1.z.string()),
    devices: zod_1.z.object({
        maxDevices: zod_1.z.number(),
        registeredDevices: zod_1.z.number(),
        binding: zod_1.z.enum(['none', 'hardware', 'account', 'hybrid']),
        allowTransfer: zod_1.z.boolean(),
        transferCooldownHours: zod_1.z.number()
    }),
    validity: zod_1.z.object({
        issuedAt: zod_1.z.date(),
        expiresAt: zod_1.z.date(),
        gracePeriodDays: zod_1.z.number()
    }),
    verification: zod_1.z.object({
        lastVerified: zod_1.z.date(),
        nextVerification: zod_1.z.date(),
        verificationFailures: zod_1.z.number(),
        allowOffline: zod_1.z.boolean(),
        offlineGraceHours: zod_1.z.number()
    }),
    metadata: zod_1.z.record(zod_1.z.string()),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.LicenseDeviceSchema = zod_1.z.object({
    id: zod_1.z.string(),
    licenseId: zod_1.z.string(),
    organizationId: zod_1.z.string(),
    userId: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.enum(['desktop', 'mobile', 'web']),
    platform: zod_1.z.object({
        os: zod_1.z.string(),
        version: zod_1.z.string(),
        arch: zod_1.z.string(),
        model: zod_1.z.string().optional(),
        fingerprint: zod_1.z.string()
    }),
    status: zod_1.z.enum(['active', 'inactive', 'suspended', 'revoked']),
    appVersion: zod_1.z.string(),
    lastSeen: zod_1.z.date(),
    ipAddress: zod_1.z.string().optional(),
    location: zod_1.z.object({
        country: zod_1.z.string(),
        region: zod_1.z.string(),
        city: zod_1.z.string()
    }).optional(),
    activation: zod_1.z.object({
        activatedAt: zod_1.z.date(),
        method: zod_1.z.enum(['license_key', 'account_link', 'transfer']),
        token: zod_1.z.string().optional()
    }),
    metadata: zod_1.z.record(zod_1.z.string()),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
//# sourceMappingURL=billing.js.map