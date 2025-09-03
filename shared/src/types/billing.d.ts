/**
 * Billing & Licensing Types for Flow Desk
 *
 * Defines comprehensive types for subscriptions, licenses, devices, payments,
 * and billing management following Blueprint.md requirements.
 */
import { z } from 'zod';
/**
 * Subscription plans
 */
export type SubscriptionPlan = 'free' | 'pro' | 'team' | 'enterprise';
/**
 * Billing intervals
 */
export type BillingInterval = 'monthly' | 'yearly' | 'lifetime';
/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused' | 'expired';
/**
 * Payment status
 */
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded' | 'disputed' | 'processing';
/**
 * Invoice status
 */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
/**
 * Subscription entity
 */
export interface Subscription {
    /** Subscription ID */
    id: string;
    /** Organization ID */
    organizationId: string;
    /** User ID (for individual plans) */
    userId?: string;
    /** Stripe subscription ID */
    stripeSubscriptionId: string;
    /** Stripe customer ID */
    stripeCustomerId: string;
    /** Subscription plan */
    plan: SubscriptionPlan;
    /** Billing interval */
    interval: BillingInterval;
    /** Subscription status */
    status: SubscriptionStatus;
    /** Current period start */
    currentPeriodStart: Date;
    /** Current period end */
    currentPeriodEnd: Date;
    /** Trial start date */
    trialStart?: Date;
    /** Trial end date */
    trialEnd?: Date;
    /** Cancellation date */
    canceledAt?: Date;
    /** Cancellation reason */
    cancelationReason?: string;
    /** Cancel at period end */
    cancelAtPeriodEnd: boolean;
    /** Price details */
    pricing: SubscriptionPricing;
    /** License limits */
    limits: SubscriptionLimits;
    /** Add-ons */
    addOns: SubscriptionAddOn[];
    /** Discount/coupon */
    discount?: SubscriptionDiscount;
    /** Tax information */
    tax: SubscriptionTax;
    /** Subscription metadata */
    metadata: Record<string, string>;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Subscription pricing details
 */
export interface SubscriptionPricing {
    /** Base price in cents */
    basePrice: number;
    /** Currency code */
    currency: string;
    /** Per-seat pricing */
    perSeat?: {
        price: number;
        minSeats: number;
        maxSeats?: number;
    };
    /** Usage-based pricing */
    usage?: Array<{
        metric: string;
        price: number;
        unit: string;
        tiers?: Array<{
            upTo: number;
            price: number;
        }>;
    }>;
    /** Setup fee */
    setupFee?: number;
    /** Annual discount percentage */
    annualDiscount?: number;
}
/**
 * Subscription limits
 */
export interface SubscriptionLimits {
    /** Maximum number of team members */
    maxMembers: number;
    /** Maximum number of workspaces */
    maxWorkspaces: number;
    /** Maximum number of connected accounts */
    maxConnectedAccounts: number;
    /** Maximum number of plugins */
    maxPlugins: number;
    /** Maximum storage in GB */
    maxStorageGB: number;
    /** Maximum API calls per month */
    maxApiCallsPerMonth: number;
    /** Maximum automations */
    maxAutomations: number;
    /** Premium features enabled */
    premiumFeatures: string[];
    /** Enterprise features enabled */
    enterpriseFeatures: string[];
}
/**
 * Subscription add-on
 */
export interface SubscriptionAddOn {
    /** Add-on ID */
    id: string;
    /** Add-on name */
    name: string;
    /** Add-on description */
    description?: string;
    /** Add-on type */
    type: 'storage' | 'seats' | 'api_calls' | 'plugins' | 'feature' | 'custom';
    /** Add-on price in cents */
    price: number;
    /** Add-on quantity */
    quantity: number;
    /** Add-on metadata */
    metadata?: Record<string, any>;
}
/**
 * Subscription discount
 */
export interface SubscriptionDiscount {
    /** Coupon/discount ID */
    id: string;
    /** Discount type */
    type: 'percentage' | 'fixed' | 'free_trial';
    /** Discount value */
    value: number;
    /** Discount duration */
    duration: 'once' | 'repeating' | 'forever';
    /** Duration in months (for repeating) */
    durationInMonths?: number;
    /** Discount start date */
    startDate: Date;
    /** Discount end date */
    endDate?: Date;
    /** Promotional code */
    promoCode?: string;
}
/**
 * Subscription tax information
 */
export interface SubscriptionTax {
    /** Tax rate percentage */
    rate: number;
    /** Tax amount in cents */
    amount: number;
    /** Tax jurisdiction */
    jurisdiction: string;
    /** Tax type */
    type: string;
    /** Tax ID number */
    taxId?: string;
    /** VAT number */
    vatNumber?: string;
}
/**
 * License entity for offline verification
 */
export interface License {
    /** License ID */
    id: string;
    /** Subscription ID */
    subscriptionId: string;
    /** Organization ID */
    organizationId: string;
    /** License key (JWT signed token) */
    licenseKey: string;
    /** License type */
    type: 'subscription' | 'plugin' | 'addon';
    /** Licensed plan */
    plan: SubscriptionPlan;
    /** License status */
    status: 'active' | 'suspended' | 'expired' | 'revoked';
    /** License limits */
    limits: SubscriptionLimits;
    /** Licensed features */
    features: string[];
    /** Device limitations */
    devices: LicenseDeviceLimits;
    /** License validity */
    validity: {
        /** Issue date */
        issuedAt: Date;
        /** Expiry date */
        expiresAt: Date;
        /** Grace period days */
        gracePeriodDays: number;
    };
    /** License verification */
    verification: {
        /** Last verification */
        lastVerified: Date;
        /** Next verification due */
        nextVerification: Date;
        /** Verification failures */
        verificationFailures: number;
        /** Offline verification allowed */
        allowOffline: boolean;
        /** Offline grace period hours */
        offlineGraceHours: number;
    };
    /** License metadata */
    metadata: Record<string, string>;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * License device limitations
 */
export interface LicenseDeviceLimits {
    /** Maximum number of devices */
    maxDevices: number;
    /** Currently registered devices */
    registeredDevices: number;
    /** Device binding strategy */
    binding: 'none' | 'hardware' | 'account' | 'hybrid';
    /** Allow device transfer */
    allowTransfer: boolean;
    /** Transfer cooldown period (hours) */
    transferCooldownHours: number;
}
/**
 * Device registration for licensing
 */
export interface LicenseDevice {
    /** Device ID */
    id: string;
    /** License ID */
    licenseId: string;
    /** Organization ID */
    organizationId: string;
    /** User ID */
    userId: string;
    /** Device name */
    name: string;
    /** Device type */
    type: 'desktop' | 'mobile' | 'web';
    /** Platform information */
    platform: {
        /** Operating system */
        os: string;
        /** OS version */
        version: string;
        /** Architecture */
        arch: string;
        /** Device model */
        model?: string;
        /** Hardware fingerprint */
        fingerprint: string;
    };
    /** Device status */
    status: 'active' | 'inactive' | 'suspended' | 'revoked';
    /** Application version */
    appVersion: string;
    /** Last seen timestamp */
    lastSeen: Date;
    /** IP address (last known) */
    ipAddress?: string;
    /** Location (last known) */
    location?: {
        country: string;
        region: string;
        city: string;
    };
    /** Device activation */
    activation: {
        /** Activation date */
        activatedAt: Date;
        /** Activation method */
        method: 'license_key' | 'account_link' | 'transfer';
        /** Activation token */
        token?: string;
    };
    /** Device metadata */
    metadata: Record<string, string>;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Payment entity
 */
export interface Payment {
    /** Payment ID */
    id: string;
    /** Subscription ID */
    subscriptionId: string;
    /** Organization ID */
    organizationId: string;
    /** Stripe payment intent ID */
    stripePaymentIntentId?: string;
    /** Payment method */
    paymentMethod: PaymentMethod;
    /** Payment amount in cents */
    amount: number;
    /** Payment currency */
    currency: string;
    /** Payment status */
    status: PaymentStatus;
    /** Payment description */
    description: string;
    /** Payment metadata */
    metadata: Record<string, string>;
    /** Failure reason */
    failureReason?: string;
    /** Failure code */
    failureCode?: string;
    /** Refund information */
    refund?: {
        /** Refund amount in cents */
        amount: number;
        /** Refund reason */
        reason: string;
        /** Refund date */
        refundedAt: Date;
        /** Stripe refund ID */
        stripeRefundId: string;
    };
    /** Payment processing dates */
    processing: {
        /** Payment initiated */
        initiatedAt: Date;
        /** Payment confirmed */
        confirmedAt?: Date;
        /** Payment failed */
        failedAt?: Date;
    };
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Payment method information
 */
export interface PaymentMethod {
    /** Payment method ID */
    id: string;
    /** Payment type */
    type: 'card' | 'bank_transfer' | 'digital_wallet' | 'crypto' | 'invoice';
    /** Card information (if applicable) */
    card?: {
        /** Last 4 digits */
        last4: string;
        /** Card brand */
        brand: string;
        /** Expiry month */
        expMonth: number;
        /** Expiry year */
        expYear: number;
        /** Country */
        country: string;
    };
    /** Bank transfer information */
    bankTransfer?: {
        /** Bank name */
        bankName: string;
        /** Account type */
        accountType: string;
        /** Country */
        country: string;
    };
    /** Digital wallet information */
    digitalWallet?: {
        /** Wallet type */
        type: 'paypal' | 'apple_pay' | 'google_pay' | 'stripe';
        /** Wallet account */
        account?: string;
    };
    /** Whether method is default */
    isDefault: boolean;
    /** Payment method status */
    status: 'active' | 'inactive' | 'expired';
    /** Creation timestamp */
    createdAt: Date;
}
/**
 * Invoice entity
 */
export interface Invoice {
    /** Invoice ID */
    id: string;
    /** Subscription ID */
    subscriptionId: string;
    /** Organization ID */
    organizationId: string;
    /** Stripe invoice ID */
    stripeInvoiceId?: string;
    /** Invoice number */
    invoiceNumber: string;
    /** Invoice status */
    status: InvoiceStatus;
    /** Invoice currency */
    currency: string;
    /** Invoice line items */
    lineItems: InvoiceLineItem[];
    /** Subtotal in cents */
    subtotal: number;
    /** Tax amount in cents */
    taxAmount: number;
    /** Discount amount in cents */
    discountAmount: number;
    /** Total amount in cents */
    total: number;
    /** Amount paid in cents */
    amountPaid: number;
    /** Amount due in cents */
    amountDue: number;
    /** Invoice period */
    period: {
        /** Period start */
        start: Date;
        /** Period end */
        end: Date;
    };
    /** Invoice dates */
    dates: {
        /** Invoice date */
        invoiceDate: Date;
        /** Due date */
        dueDate: Date;
        /** Paid date */
        paidDate?: Date;
        /** Voided date */
        voidedDate?: Date;
    };
    /** Invoice URLs */
    urls: {
        /** PDF download URL */
        pdf?: string;
        /** Hosted page URL */
        hostedPage?: string;
    };
    /** Invoice metadata */
    metadata: Record<string, string>;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Invoice line item
 */
export interface InvoiceLineItem {
    /** Line item ID */
    id: string;
    /** Item description */
    description: string;
    /** Item type */
    type: 'subscription' | 'addon' | 'usage' | 'one_time';
    /** Quantity */
    quantity: number;
    /** Unit price in cents */
    unitPrice: number;
    /** Line total in cents */
    amount: number;
    /** Discount amount in cents */
    discountAmount?: number;
    /** Tax amount in cents */
    taxAmount?: number;
    /** Proration information */
    proration?: {
        /** Proration reason */
        reason: string;
        /** Proration period */
        period: {
            start: Date;
            end: Date;
        };
    };
    /** Line item metadata */
    metadata?: Record<string, string>;
}
/**
 * Billing address
 */
export interface BillingAddress {
    /** Address line 1 */
    line1: string;
    /** Address line 2 */
    line2?: string;
    /** City */
    city: string;
    /** State/province */
    state: string;
    /** Postal code */
    postalCode: string;
    /** Country code */
    country: string;
}
/**
 * Customer billing information
 */
export interface BillingCustomer {
    /** Customer ID */
    id: string;
    /** Organization ID */
    organizationId: string;
    /** Stripe customer ID */
    stripeCustomerId: string;
    /** Customer name */
    name: string;
    /** Customer email */
    email: string;
    /** Phone number */
    phone?: string;
    /** Billing address */
    address?: BillingAddress;
    /** Tax information */
    tax: {
        /** Tax ID */
        taxId?: string;
        /** VAT number */
        vatNumber?: string;
        /** Tax jurisdiction */
        jurisdiction: string;
        /** Tax exempt */
        taxExempt: boolean;
    };
    /** Customer metadata */
    metadata: Record<string, string>;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Usage tracking for metered billing
 */
export interface UsageRecord {
    /** Usage record ID */
    id: string;
    /** Subscription ID */
    subscriptionId: string;
    /** Usage metric */
    metric: string;
    /** Usage quantity */
    quantity: number;
    /** Usage timestamp */
    timestamp: Date;
    /** Usage metadata */
    metadata?: Record<string, string>;
}
/**
 * Coupon/discount code
 */
export interface Coupon {
    /** Coupon ID */
    id: string;
    /** Coupon code */
    code: string;
    /** Coupon name */
    name: string;
    /** Coupon description */
    description?: string;
    /** Discount type */
    type: 'percentage' | 'fixed' | 'free_trial';
    /** Discount value */
    value: number;
    /** Discount currency (for fixed) */
    currency?: string;
    /** Coupon duration */
    duration: 'once' | 'repeating' | 'forever';
    /** Duration in months (for repeating) */
    durationInMonths?: number;
    /** Usage limits */
    limits: {
        /** Maximum redemptions */
        maxRedemptions?: number;
        /** Redemptions per customer */
        maxRedemptionsPerCustomer?: number;
        /** Minimum order amount */
        minOrderAmount?: number;
    };
    /** Coupon validity */
    validity: {
        /** Valid from */
        validFrom: Date;
        /** Valid until */
        validUntil?: Date;
    };
    /** Applicable plans */
    applicablePlans?: SubscriptionPlan[];
    /** Coupon status */
    status: 'active' | 'inactive' | 'expired';
    /** Usage statistics */
    stats: {
        /** Times redeemed */
        timesRedeemed: number;
        /** Total discount amount */
        totalDiscountAmount: number;
    };
    /** Coupon metadata */
    metadata: Record<string, string>;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Billing analytics
 */
export interface BillingAnalytics {
    /** Analytics period */
    period: {
        start: Date;
        end: Date;
    };
    /** Revenue metrics */
    revenue: {
        /** Monthly recurring revenue */
        mrr: number;
        /** Annual recurring revenue */
        arr: number;
        /** Total revenue */
        total: number;
        /** Revenue growth rate */
        growthRate: number;
        /** Revenue by plan */
        byPlan: Record<SubscriptionPlan, number>;
    };
    /** Subscription metrics */
    subscriptions: {
        /** Total active subscriptions */
        active: number;
        /** New subscriptions */
        new: number;
        /** Canceled subscriptions */
        canceled: number;
        /** Churn rate */
        churnRate: number;
        /** Retention rate */
        retentionRate: number;
    };
    /** Customer metrics */
    customers: {
        /** Total customers */
        total: number;
        /** New customers */
        new: number;
        /** Customer lifetime value */
        ltv: number;
        /** Average revenue per user */
        arpu: number;
    };
    /** Payment metrics */
    payments: {
        /** Successful payments */
        successful: number;
        /** Failed payments */
        failed: number;
        /** Payment success rate */
        successRate: number;
        /** Total payment volume */
        volume: number;
    };
}
export declare const SubscriptionSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    userId: z.ZodOptional<z.ZodString>;
    stripeSubscriptionId: z.ZodString;
    stripeCustomerId: z.ZodString;
    plan: z.ZodEnum<["free", "pro", "team", "enterprise"]>;
    interval: z.ZodEnum<["monthly", "yearly", "lifetime"]>;
    status: z.ZodEnum<["active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused", "expired"]>;
    currentPeriodStart: z.ZodDate;
    currentPeriodEnd: z.ZodDate;
    trialStart: z.ZodOptional<z.ZodDate>;
    trialEnd: z.ZodOptional<z.ZodDate>;
    canceledAt: z.ZodOptional<z.ZodDate>;
    cancelationReason: z.ZodOptional<z.ZodString>;
    cancelAtPeriodEnd: z.ZodBoolean;
    pricing: z.ZodObject<{
        basePrice: z.ZodNumber;
        currency: z.ZodString;
        perSeat: z.ZodOptional<z.ZodObject<{
            price: z.ZodNumber;
            minSeats: z.ZodNumber;
            maxSeats: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            price: number;
            minSeats: number;
            maxSeats?: number | undefined;
        }, {
            price: number;
            minSeats: number;
            maxSeats?: number | undefined;
        }>>;
        usage: z.ZodOptional<z.ZodArray<z.ZodObject<{
            metric: z.ZodString;
            price: z.ZodNumber;
            unit: z.ZodString;
            tiers: z.ZodOptional<z.ZodArray<z.ZodObject<{
                upTo: z.ZodNumber;
                price: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                price: number;
                upTo: number;
            }, {
                price: number;
                upTo: number;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            price: number;
            metric: string;
            unit: string;
            tiers?: {
                price: number;
                upTo: number;
            }[] | undefined;
        }, {
            price: number;
            metric: string;
            unit: string;
            tiers?: {
                price: number;
                upTo: number;
            }[] | undefined;
        }>, "many">>;
        setupFee: z.ZodOptional<z.ZodNumber>;
        annualDiscount: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        currency: string;
        basePrice: number;
        usage?: {
            price: number;
            metric: string;
            unit: string;
            tiers?: {
                price: number;
                upTo: number;
            }[] | undefined;
        }[] | undefined;
        perSeat?: {
            price: number;
            minSeats: number;
            maxSeats?: number | undefined;
        } | undefined;
        setupFee?: number | undefined;
        annualDiscount?: number | undefined;
    }, {
        currency: string;
        basePrice: number;
        usage?: {
            price: number;
            metric: string;
            unit: string;
            tiers?: {
                price: number;
                upTo: number;
            }[] | undefined;
        }[] | undefined;
        perSeat?: {
            price: number;
            minSeats: number;
            maxSeats?: number | undefined;
        } | undefined;
        setupFee?: number | undefined;
        annualDiscount?: number | undefined;
    }>;
    limits: z.ZodObject<{
        maxMembers: z.ZodNumber;
        maxWorkspaces: z.ZodNumber;
        maxConnectedAccounts: z.ZodNumber;
        maxPlugins: z.ZodNumber;
        maxStorageGB: z.ZodNumber;
        maxApiCallsPerMonth: z.ZodNumber;
        maxAutomations: z.ZodNumber;
        premiumFeatures: z.ZodArray<z.ZodString, "many">;
        enterpriseFeatures: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    }, {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    }>;
    addOns: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<["storage", "seats", "api_calls", "plugins", "feature", "custom"]>;
        price: z.ZodNumber;
        quantity: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        name: string;
        type: "custom" | "storage" | "feature" | "seats" | "api_calls" | "plugins";
        price: number;
        quantity: number;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }, {
        id: string;
        name: string;
        type: "custom" | "storage" | "feature" | "seats" | "api_calls" | "plugins";
        price: number;
        quantity: number;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }>, "many">;
    discount: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["percentage", "fixed", "free_trial"]>;
        value: z.ZodNumber;
        duration: z.ZodEnum<["once", "repeating", "forever"]>;
        durationInMonths: z.ZodOptional<z.ZodNumber>;
        startDate: z.ZodDate;
        endDate: z.ZodOptional<z.ZodDate>;
        promoCode: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "percentage" | "fixed" | "free_trial";
        value: number;
        duration: "once" | "repeating" | "forever";
        startDate: Date;
        durationInMonths?: number | undefined;
        endDate?: Date | undefined;
        promoCode?: string | undefined;
    }, {
        id: string;
        type: "percentage" | "fixed" | "free_trial";
        value: number;
        duration: "once" | "repeating" | "forever";
        startDate: Date;
        durationInMonths?: number | undefined;
        endDate?: Date | undefined;
        promoCode?: string | undefined;
    }>>;
    tax: z.ZodObject<{
        rate: z.ZodNumber;
        amount: z.ZodNumber;
        jurisdiction: z.ZodString;
        type: z.ZodString;
        taxId: z.ZodOptional<z.ZodString>;
        vatNumber: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        rate: number;
        amount: number;
        jurisdiction: string;
        taxId?: string | undefined;
        vatNumber?: string | undefined;
    }, {
        type: string;
        rate: number;
        amount: number;
        jurisdiction: string;
        taxId?: string | undefined;
        vatNumber?: string | undefined;
    }>;
    metadata: z.ZodRecord<z.ZodString, z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "expired" | "paused" | "incomplete" | "incomplete_expired";
    plan: "free" | "pro" | "team" | "enterprise";
    stripeCustomerId: string;
    organizationId: string;
    interval: "monthly" | "yearly" | "lifetime";
    pricing: {
        currency: string;
        basePrice: number;
        usage?: {
            price: number;
            metric: string;
            unit: string;
            tiers?: {
                price: number;
                upTo: number;
            }[] | undefined;
        }[] | undefined;
        perSeat?: {
            price: number;
            minSeats: number;
            maxSeats?: number | undefined;
        } | undefined;
        setupFee?: number | undefined;
        annualDiscount?: number | undefined;
    };
    stripeSubscriptionId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    limits: {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    };
    addOns: {
        id: string;
        name: string;
        type: "custom" | "storage" | "feature" | "seats" | "api_calls" | "plugins";
        price: number;
        quantity: number;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }[];
    metadata: Record<string, string>;
    tax: {
        type: string;
        rate: number;
        amount: number;
        jurisdiction: string;
        taxId?: string | undefined;
        vatNumber?: string | undefined;
    };
    userId?: string | undefined;
    trialStart?: Date | undefined;
    trialEnd?: Date | undefined;
    canceledAt?: Date | undefined;
    cancelationReason?: string | undefined;
    discount?: {
        id: string;
        type: "percentage" | "fixed" | "free_trial";
        value: number;
        duration: "once" | "repeating" | "forever";
        startDate: Date;
        durationInMonths?: number | undefined;
        endDate?: Date | undefined;
        promoCode?: string | undefined;
    } | undefined;
}, {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: "active" | "canceled" | "past_due" | "unpaid" | "trialing" | "expired" | "paused" | "incomplete" | "incomplete_expired";
    plan: "free" | "pro" | "team" | "enterprise";
    stripeCustomerId: string;
    organizationId: string;
    interval: "monthly" | "yearly" | "lifetime";
    pricing: {
        currency: string;
        basePrice: number;
        usage?: {
            price: number;
            metric: string;
            unit: string;
            tiers?: {
                price: number;
                upTo: number;
            }[] | undefined;
        }[] | undefined;
        perSeat?: {
            price: number;
            minSeats: number;
            maxSeats?: number | undefined;
        } | undefined;
        setupFee?: number | undefined;
        annualDiscount?: number | undefined;
    };
    stripeSubscriptionId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    limits: {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    };
    addOns: {
        id: string;
        name: string;
        type: "custom" | "storage" | "feature" | "seats" | "api_calls" | "plugins";
        price: number;
        quantity: number;
        description?: string | undefined;
        metadata?: Record<string, any> | undefined;
    }[];
    metadata: Record<string, string>;
    tax: {
        type: string;
        rate: number;
        amount: number;
        jurisdiction: string;
        taxId?: string | undefined;
        vatNumber?: string | undefined;
    };
    userId?: string | undefined;
    trialStart?: Date | undefined;
    trialEnd?: Date | undefined;
    canceledAt?: Date | undefined;
    cancelationReason?: string | undefined;
    discount?: {
        id: string;
        type: "percentage" | "fixed" | "free_trial";
        value: number;
        duration: "once" | "repeating" | "forever";
        startDate: Date;
        durationInMonths?: number | undefined;
        endDate?: Date | undefined;
        promoCode?: string | undefined;
    } | undefined;
}>;
export declare const LicenseSchema: z.ZodObject<{
    id: z.ZodString;
    subscriptionId: z.ZodString;
    organizationId: z.ZodString;
    licenseKey: z.ZodString;
    type: z.ZodEnum<["subscription", "plugin", "addon"]>;
    plan: z.ZodEnum<["free", "pro", "team", "enterprise"]>;
    status: z.ZodEnum<["active", "suspended", "expired", "revoked"]>;
    limits: z.ZodObject<{
        maxMembers: z.ZodNumber;
        maxWorkspaces: z.ZodNumber;
        maxConnectedAccounts: z.ZodNumber;
        maxPlugins: z.ZodNumber;
        maxStorageGB: z.ZodNumber;
        maxApiCallsPerMonth: z.ZodNumber;
        maxAutomations: z.ZodNumber;
        premiumFeatures: z.ZodArray<z.ZodString, "many">;
        enterpriseFeatures: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    }, {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    }>;
    features: z.ZodArray<z.ZodString, "many">;
    devices: z.ZodObject<{
        maxDevices: z.ZodNumber;
        registeredDevices: z.ZodNumber;
        binding: z.ZodEnum<["none", "hardware", "account", "hybrid"]>;
        allowTransfer: z.ZodBoolean;
        transferCooldownHours: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        maxDevices: number;
        registeredDevices: number;
        binding: "none" | "hardware" | "account" | "hybrid";
        allowTransfer: boolean;
        transferCooldownHours: number;
    }, {
        maxDevices: number;
        registeredDevices: number;
        binding: "none" | "hardware" | "account" | "hybrid";
        allowTransfer: boolean;
        transferCooldownHours: number;
    }>;
    validity: z.ZodObject<{
        issuedAt: z.ZodDate;
        expiresAt: z.ZodDate;
        gracePeriodDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        expiresAt: Date;
        issuedAt: Date;
        gracePeriodDays: number;
    }, {
        expiresAt: Date;
        issuedAt: Date;
        gracePeriodDays: number;
    }>;
    verification: z.ZodObject<{
        lastVerified: z.ZodDate;
        nextVerification: z.ZodDate;
        verificationFailures: z.ZodNumber;
        allowOffline: z.ZodBoolean;
        offlineGraceHours: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lastVerified: Date;
        nextVerification: Date;
        verificationFailures: number;
        allowOffline: boolean;
        offlineGraceHours: number;
    }, {
        lastVerified: Date;
        nextVerification: Date;
        verificationFailures: number;
        allowOffline: boolean;
        offlineGraceHours: number;
    }>;
    metadata: z.ZodRecord<z.ZodString, z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    type: "subscription" | "plugin" | "addon";
    createdAt: Date;
    updatedAt: Date;
    status: "active" | "expired" | "suspended" | "revoked";
    plan: "free" | "pro" | "team" | "enterprise";
    organizationId: string;
    features: string[];
    limits: {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    };
    metadata: Record<string, string>;
    subscriptionId: string;
    licenseKey: string;
    devices: {
        maxDevices: number;
        registeredDevices: number;
        binding: "none" | "hardware" | "account" | "hybrid";
        allowTransfer: boolean;
        transferCooldownHours: number;
    };
    validity: {
        expiresAt: Date;
        issuedAt: Date;
        gracePeriodDays: number;
    };
    verification: {
        lastVerified: Date;
        nextVerification: Date;
        verificationFailures: number;
        allowOffline: boolean;
        offlineGraceHours: number;
    };
}, {
    id: string;
    type: "subscription" | "plugin" | "addon";
    createdAt: Date;
    updatedAt: Date;
    status: "active" | "expired" | "suspended" | "revoked";
    plan: "free" | "pro" | "team" | "enterprise";
    organizationId: string;
    features: string[];
    limits: {
        maxMembers: number;
        maxWorkspaces: number;
        maxConnectedAccounts: number;
        maxPlugins: number;
        maxStorageGB: number;
        maxApiCallsPerMonth: number;
        maxAutomations: number;
        premiumFeatures: string[];
        enterpriseFeatures: string[];
    };
    metadata: Record<string, string>;
    subscriptionId: string;
    licenseKey: string;
    devices: {
        maxDevices: number;
        registeredDevices: number;
        binding: "none" | "hardware" | "account" | "hybrid";
        allowTransfer: boolean;
        transferCooldownHours: number;
    };
    validity: {
        expiresAt: Date;
        issuedAt: Date;
        gracePeriodDays: number;
    };
    verification: {
        lastVerified: Date;
        nextVerification: Date;
        verificationFailures: number;
        allowOffline: boolean;
        offlineGraceHours: number;
    };
}>;
export declare const LicenseDeviceSchema: z.ZodObject<{
    id: z.ZodString;
    licenseId: z.ZodString;
    organizationId: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["desktop", "mobile", "web"]>;
    platform: z.ZodObject<{
        os: z.ZodString;
        version: z.ZodString;
        arch: z.ZodString;
        model: z.ZodOptional<z.ZodString>;
        fingerprint: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        version: string;
        os: string;
        arch: string;
        fingerprint: string;
        model?: string | undefined;
    }, {
        version: string;
        os: string;
        arch: string;
        fingerprint: string;
        model?: string | undefined;
    }>;
    status: z.ZodEnum<["active", "inactive", "suspended", "revoked"]>;
    appVersion: z.ZodString;
    lastSeen: z.ZodDate;
    ipAddress: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodObject<{
        country: z.ZodString;
        region: z.ZodString;
        city: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        city: string;
        country: string;
        region: string;
    }, {
        city: string;
        country: string;
        region: string;
    }>>;
    activation: z.ZodObject<{
        activatedAt: z.ZodDate;
        method: z.ZodEnum<["license_key", "account_link", "transfer"]>;
        token: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: "license_key" | "account_link" | "transfer";
        activatedAt: Date;
        token?: string | undefined;
    }, {
        method: "license_key" | "account_link" | "transfer";
        activatedAt: Date;
        token?: string | undefined;
    }>;
    metadata: z.ZodRecord<z.ZodString, z.ZodString>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    type: "desktop" | "mobile" | "web";
    createdAt: Date;
    updatedAt: Date;
    status: "active" | "suspended" | "revoked" | "inactive";
    organizationId: string;
    userId: string;
    metadata: Record<string, string>;
    licenseId: string;
    platform: {
        version: string;
        os: string;
        arch: string;
        fingerprint: string;
        model?: string | undefined;
    };
    appVersion: string;
    lastSeen: Date;
    activation: {
        method: "license_key" | "account_link" | "transfer";
        activatedAt: Date;
        token?: string | undefined;
    };
    location?: {
        city: string;
        country: string;
        region: string;
    } | undefined;
    ipAddress?: string | undefined;
}, {
    id: string;
    name: string;
    type: "desktop" | "mobile" | "web";
    createdAt: Date;
    updatedAt: Date;
    status: "active" | "suspended" | "revoked" | "inactive";
    organizationId: string;
    userId: string;
    metadata: Record<string, string>;
    licenseId: string;
    platform: {
        version: string;
        os: string;
        arch: string;
        fingerprint: string;
        model?: string | undefined;
    };
    appVersion: string;
    lastSeen: Date;
    activation: {
        method: "license_key" | "account_link" | "transfer";
        activatedAt: Date;
        token?: string | undefined;
    };
    location?: {
        city: string;
        country: string;
        region: string;
    } | undefined;
    ipAddress?: string | undefined;
}>;
/**
 * Utility types for billing operations
 */
export type CreateSubscriptionInput = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateSubscriptionInput = Partial<Pick<Subscription, 'status' | 'cancelAtPeriodEnd' | 'limits' | 'addOns' | 'metadata'>>;
export type CreateLicenseInput = Omit<License, 'id' | 'licenseKey' | 'verification' | 'createdAt' | 'updatedAt'>;
export type UpdateLicenseInput = Partial<Pick<License, 'status' | 'limits' | 'features' | 'devices'>>;
export type CreateLicenseDeviceInput = Omit<LicenseDevice, 'id' | 'status' | 'lastSeen' | 'activation' | 'createdAt' | 'updatedAt'>;
export type UpdateLicenseDeviceInput = Partial<Pick<LicenseDevice, 'name' | 'status' | 'appVersion'>>;
/**
 * License verification result
 */
export interface LicenseVerificationResult {
    /** Whether license is valid */
    valid: boolean;
    /** License status */
    status: 'active' | 'suspended' | 'expired' | 'revoked' | 'invalid';
    /** License details */
    license?: License;
    /** Error message */
    error?: string;
    /** Verification timestamp */
    verifiedAt: Date;
    /** Time until next verification required */
    nextVerificationIn?: number;
    /** Whether offline verification was used */
    offlineVerification: boolean;
}
/**
 * Plan comparison
 */
export interface PlanComparison {
    /** Plan ID */
    plan: SubscriptionPlan;
    /** Plan name */
    name: string;
    /** Plan description */
    description: string;
    /** Plan pricing */
    pricing: {
        monthly: number;
        yearly: number;
        yearlyDiscount: number;
    };
    /** Plan features */
    features: Array<{
        name: string;
        included: boolean;
        limit?: number;
        note?: string;
    }>;
    /** Popular plan */
    popular?: boolean;
    /** Recommended for */
    recommendedFor: string[];
}
/**
 * Billing portal session
 */
export interface BillingPortalSession {
    /** Session ID */
    id: string;
    /** Customer ID */
    customerId: string;
    /** Portal URL */
    url: string;
    /** Return URL */
    returnUrl: string;
    /** Session expiry */
    expiresAt: Date;
    /** Creation timestamp */
    createdAt: Date;
}
//# sourceMappingURL=billing.d.ts.map