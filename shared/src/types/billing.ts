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
export type SubscriptionPlan = 
  | 'free'        // Free tier with limitations
  | 'pro'         // Individual professional plan
  | 'team'        // Team plan with collaboration features
  | 'enterprise'; // Enterprise plan with advanced features

/**
 * Billing intervals
 */
export type BillingInterval = 
  | 'monthly'     // Monthly billing
  | 'yearly'      // Annual billing (discounted)
  | 'lifetime';   // One-time lifetime purchase

/**
 * Subscription status
 */
export type SubscriptionStatus = 
  | 'active'      // Active subscription
  | 'trialing'    // In trial period
  | 'past_due'    // Payment failed, grace period
  | 'canceled'    // Canceled, active until period end
  | 'unpaid'      // Payment failed, subscription suspended
  | 'incomplete'  // Initial payment incomplete
  | 'incomplete_expired' // Initial payment expired
  | 'paused'      // Temporarily paused
  | 'expired';    // Subscription has expired

/**
 * Payment status
 */
export type PaymentStatus = 
  | 'pending'     // Payment is being processed
  | 'succeeded'   // Payment was successful
  | 'failed'      // Payment failed
  | 'canceled'    // Payment was canceled
  | 'refunded'    // Payment was refunded
  | 'disputed'    // Payment is disputed
  | 'processing'; // Payment is processing

/**
 * Invoice status
 */
export type InvoiceStatus = 
  | 'draft'       // Draft invoice
  | 'open'        // Open invoice awaiting payment
  | 'paid'        // Invoice has been paid
  | 'void'        // Invoice was voided
  | 'uncollectible'; // Invoice is uncollectible

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

// Zod schemas for runtime validation
export const SubscriptionSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string().optional(),
  stripeSubscriptionId: z.string(),
  stripeCustomerId: z.string(),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']),
  interval: z.enum(['monthly', 'yearly', 'lifetime']),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'expired']),
  currentPeriodStart: z.date(),
  currentPeriodEnd: z.date(),
  trialStart: z.date().optional(),
  trialEnd: z.date().optional(),
  canceledAt: z.date().optional(),
  cancelationReason: z.string().optional(),
  cancelAtPeriodEnd: z.boolean(),
  pricing: z.object({
    basePrice: z.number(),
    currency: z.string(),
    perSeat: z.object({
      price: z.number(),
      minSeats: z.number(),
      maxSeats: z.number().optional()
    }).optional(),
    usage: z.array(z.object({
      metric: z.string(),
      price: z.number(),
      unit: z.string(),
      tiers: z.array(z.object({
        upTo: z.number(),
        price: z.number()
      })).optional()
    })).optional(),
    setupFee: z.number().optional(),
    annualDiscount: z.number().optional()
  }),
  limits: z.object({
    maxMembers: z.number(),
    maxWorkspaces: z.number(),
    maxConnectedAccounts: z.number(),
    maxPlugins: z.number(),
    maxStorageGB: z.number(),
    maxApiCallsPerMonth: z.number(),
    maxAutomations: z.number(),
    premiumFeatures: z.array(z.string()),
    enterpriseFeatures: z.array(z.string())
  }),
  addOns: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    type: z.enum(['storage', 'seats', 'api_calls', 'plugins', 'feature', 'custom']),
    price: z.number(),
    quantity: z.number(),
    metadata: z.record(z.any()).optional()
  })),
  discount: z.object({
    id: z.string(),
    type: z.enum(['percentage', 'fixed', 'free_trial']),
    value: z.number(),
    duration: z.enum(['once', 'repeating', 'forever']),
    durationInMonths: z.number().optional(),
    startDate: z.date(),
    endDate: z.date().optional(),
    promoCode: z.string().optional()
  }).optional(),
  tax: z.object({
    rate: z.number(),
    amount: z.number(),
    jurisdiction: z.string(),
    type: z.string(),
    taxId: z.string().optional(),
    vatNumber: z.string().optional()
  }),
  metadata: z.record(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const LicenseSchema = z.object({
  id: z.string(),
  subscriptionId: z.string(),
  organizationId: z.string(),
  licenseKey: z.string(),
  type: z.enum(['subscription', 'plugin', 'addon']),
  plan: z.enum(['free', 'pro', 'team', 'enterprise']),
  status: z.enum(['active', 'suspended', 'expired', 'revoked']),
  limits: z.object({
    maxMembers: z.number(),
    maxWorkspaces: z.number(),
    maxConnectedAccounts: z.number(),
    maxPlugins: z.number(),
    maxStorageGB: z.number(),
    maxApiCallsPerMonth: z.number(),
    maxAutomations: z.number(),
    premiumFeatures: z.array(z.string()),
    enterpriseFeatures: z.array(z.string())
  }),
  features: z.array(z.string()),
  devices: z.object({
    maxDevices: z.number(),
    registeredDevices: z.number(),
    binding: z.enum(['none', 'hardware', 'account', 'hybrid']),
    allowTransfer: z.boolean(),
    transferCooldownHours: z.number()
  }),
  validity: z.object({
    issuedAt: z.date(),
    expiresAt: z.date(),
    gracePeriodDays: z.number()
  }),
  verification: z.object({
    lastVerified: z.date(),
    nextVerification: z.date(),
    verificationFailures: z.number(),
    allowOffline: z.boolean(),
    offlineGraceHours: z.number()
  }),
  metadata: z.record(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const LicenseDeviceSchema = z.object({
  id: z.string(),
  licenseId: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  name: z.string(),
  type: z.enum(['desktop', 'mobile', 'web']),
  platform: z.object({
    os: z.string(),
    version: z.string(),
    arch: z.string(),
    model: z.string().optional(),
    fingerprint: z.string()
  }),
  status: z.enum(['active', 'inactive', 'suspended', 'revoked']),
  appVersion: z.string(),
  lastSeen: z.date(),
  ipAddress: z.string().optional(),
  location: z.object({
    country: z.string(),
    region: z.string(),
    city: z.string()
  }).optional(),
  activation: z.object({
    activatedAt: z.date(),
    method: z.enum(['license_key', 'account_link', 'transfer']),
    token: z.string().optional()
  }),
  metadata: z.record(z.string()),
  createdAt: z.date(),
  updatedAt: z.date()
});

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
  nextVerificationIn?: number; // seconds
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