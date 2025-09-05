/**
 * User and Organization Types for Flow Desk
 *
 * Defines core types for user management, organizations, teams, and permissions
 * following Clerk auth patterns and Blueprint.md requirements.
 */
import { z } from 'zod';
/**
 * Core User entity
 */
export interface User {
    /** Unique identifier for the user */
    id: string;
    /** Primary email address */
    email: string;
    /** Display name */
    name: string;
    /** Optional profile image URL */
    avatar?: string;
    /** Optional username for mentions/searches */
    username?: string;
    /** User timezone identifier (e.g., 'America/New_York') */
    timezone: string;
    /** User locale (e.g., 'en-US') */
    locale: string;
    /** Whether the user account is active */
    isActive: boolean;
    /** Whether the user has completed onboarding */
    hasCompletedOnboarding: boolean;
    /** User preferences */
    preferences: UserPreferences;
    /** Account creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
    /** Last seen timestamp */
    lastSeenAt?: Date;
}
/**
 * User preferences configuration
 */
export interface UserPreferences {
    /** UI theme preference */
    theme: 'light' | 'dark' | 'auto';
    /** Email notification preferences */
    emailNotifications: boolean;
    /** Push notification preferences */
    pushNotifications: boolean;
    /** Desktop notification preferences */
    desktopNotifications: boolean;
    /** Analytics and usage tracking consent */
    analyticsEnabled: boolean;
    /** Auto-save interval in minutes */
    autoSaveIntervalMinutes: number;
    /** Default workspace ID */
    defaultWorkspaceId?: string;
}
/**
 * Organization entity - top level container for teams and workspaces
 */
export interface Organization {
    /** Unique identifier */
    id: string;
    /** Organization name */
    name: string;
    /** Organization slug for URLs */
    slug: string;
    /** Optional logo URL */
    logo?: string;
    /** Optional description */
    description?: string;
    /** Organization domain (for email matching) */
    domain?: string;
    /** Organization settings */
    settings: OrganizationSettings;
    /** Billing information */
    billing: OrganizationBilling;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Organization settings
 */
export interface OrganizationSettings {
    /** Whether to allow public signups with organization domain */
    allowPublicSignups: boolean;
    /** Whether to require email domain verification */
    requireDomainVerification: boolean;
    /** Whether to enable single sign-on */
    ssoEnabled: boolean;
    /** Maximum number of team members allowed */
    maxMembers?: number;
    /** Whether to enable audit logging */
    auditLoggingEnabled: boolean;
    /** Data retention policy in days */
    dataRetentionDays: number;
}
/**
 * Organization billing information
 */
export interface OrganizationBilling {
    /** Current subscription plan */
    plan: 'free' | 'pro' | 'team' | 'enterprise';
    /** Stripe customer ID */
    stripeCustomerId?: string;
    /** Current subscription status */
    subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
    /** Number of licensed seats */
    licensedSeats: number;
    /** Number of used seats */
    usedSeats: number;
    /** Billing cycle start date */
    billingCycleStart?: Date;
    /** Billing cycle end date */
    billingCycleEnd?: Date;
    /** Trial end date if in trial */
    trialEndsAt?: Date;
}
/**
 * Team entity - groups within organizations
 */
export interface Team {
    /** Unique identifier */
    id: string;
    /** Organization ID this team belongs to */
    organizationId: string;
    /** Team name */
    name: string;
    /** Team description */
    description?: string;
    /** Team color for UI */
    color?: string;
    /** Team avatar/icon URL */
    avatar?: string;
    /** Whether the team is archived */
    isArchived: boolean;
    /** Team settings */
    settings: TeamSettings;
    /** Creation timestamp */
    createdAt: Date;
    /** Last update timestamp */
    updatedAt: Date;
}
/**
 * Team settings
 */
export interface TeamSettings {
    /** Whether team is private (invite-only) */
    isPrivate: boolean;
    /** Default permissions for new members */
    defaultMemberPermissions: TeamPermission[];
    /** Whether to notify on member changes */
    notifyOnMemberChanges: boolean;
}
/**
 * Organization membership - links users to organizations with roles
 */
export interface OrganizationMembership {
    /** Unique identifier */
    id: string;
    /** User ID */
    userId: string;
    /** Organization ID */
    organizationId: string;
    /** User's role in the organization */
    role: OrganizationRole;
    /** Custom permissions (overrides role defaults) */
    customPermissions?: OrganizationPermission[];
    /** Whether membership is active */
    isActive: boolean;
    /** Join date */
    joinedAt: Date;
    /** Invitation date */
    invitedAt?: Date;
    /** Who invited this user */
    invitedBy?: string;
}
/**
 * Team membership - links users to teams with roles
 */
export interface TeamMembership {
    /** Unique identifier */
    id: string;
    /** User ID */
    userId: string;
    /** Team ID */
    teamId: string;
    /** User's role in the team */
    role: TeamRole;
    /** Custom permissions (overrides role defaults) */
    customPermissions?: TeamPermission[];
    /** Whether membership is active */
    isActive: boolean;
    /** Join date */
    joinedAt: Date;
    /** Invitation date */
    invitedAt?: Date;
    /** Who invited this user */
    invitedBy?: string;
}
/**
 * Organization roles with hierarchical permissions
 */
export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'member' | 'guest';
/**
 * Team roles within teams
 */
export type TeamRole = 'lead' | 'member' | 'collaborator' | 'viewer';
/**
 * Organization-level permissions
 */
export type OrganizationPermission = 'org:read' | 'org:update' | 'org:delete' | 'org:billing' | 'members:read' | 'members:invite' | 'members:update' | 'members:remove' | 'teams:create' | 'teams:read' | 'teams:update' | 'teams:delete' | 'workspaces:create' | 'workspaces:read' | 'workspaces:update' | 'workspaces:delete' | 'settings:read' | 'settings:update' | 'audit:read';
/**
 * Team-level permissions
 */
export type TeamPermission = 'team:read' | 'team:update' | 'team:delete' | 'team:members:invite' | 'team:members:remove' | 'team:members:update' | 'content:read' | 'content:write' | 'content:delete' | 'workspaces:read' | 'workspaces:write';
/**
 * Permission mapping for roles
 */
export declare const ORGANIZATION_ROLE_PERMISSIONS: Record<OrganizationRole, OrganizationPermission[]>;
/**
 * Permission mapping for team roles
 */
export declare const TEAM_ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]>;
/**
 * Invitation entity for pending user invitations
 */
export interface Invitation {
    /** Unique identifier */
    id: string;
    /** Email address of invitee */
    email: string;
    /** Organization ID */
    organizationId: string;
    /** Optional team ID if inviting to specific team */
    teamId?: string;
    /** Role being offered */
    role: OrganizationRole | TeamRole;
    /** Custom permissions if any */
    customPermissions?: (OrganizationPermission | TeamPermission)[];
    /** Who sent the invitation */
    invitedBy: string;
    /** Invitation message */
    message?: string;
    /** Invitation status */
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    /** Expiration date */
    expiresAt: Date;
    /** Creation timestamp */
    createdAt: Date;
    /** Acceptance/decline timestamp */
    respondedAt?: Date;
}
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    name: z.ZodString;
    avatar: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodString>;
    timezone: z.ZodString;
    locale: z.ZodString;
    isActive: z.ZodBoolean;
    hasCompletedOnboarding: z.ZodBoolean;
    preferences: z.ZodObject<{
        theme: z.ZodEnum<["light", "dark", "auto"]>;
        emailNotifications: z.ZodBoolean;
        pushNotifications: z.ZodBoolean;
        desktopNotifications: z.ZodBoolean;
        analyticsEnabled: z.ZodBoolean;
        autoSaveIntervalMinutes: z.ZodNumber;
        defaultWorkspaceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        theme: "light" | "dark" | "auto";
        emailNotifications: boolean;
        pushNotifications: boolean;
        desktopNotifications: boolean;
        analyticsEnabled: boolean;
        autoSaveIntervalMinutes: number;
        defaultWorkspaceId?: string | undefined;
    }, {
        theme: "light" | "dark" | "auto";
        emailNotifications: boolean;
        pushNotifications: boolean;
        desktopNotifications: boolean;
        analyticsEnabled: boolean;
        autoSaveIntervalMinutes: number;
        defaultWorkspaceId?: string | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    lastSeenAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    name: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    locale: string;
    hasCompletedOnboarding: boolean;
    preferences: {
        theme: "light" | "dark" | "auto";
        emailNotifications: boolean;
        pushNotifications: boolean;
        desktopNotifications: boolean;
        analyticsEnabled: boolean;
        autoSaveIntervalMinutes: number;
        defaultWorkspaceId?: string | undefined;
    };
    username?: string | undefined;
    avatar?: string | undefined;
    lastSeenAt?: Date | undefined;
}, {
    id: string;
    email: string;
    name: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean;
    locale: string;
    hasCompletedOnboarding: boolean;
    preferences: {
        theme: "light" | "dark" | "auto";
        emailNotifications: boolean;
        pushNotifications: boolean;
        desktopNotifications: boolean;
        analyticsEnabled: boolean;
        autoSaveIntervalMinutes: number;
        defaultWorkspaceId?: string | undefined;
    };
    username?: string | undefined;
    avatar?: string | undefined;
    lastSeenAt?: Date | undefined;
}>;
export declare const OrganizationSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    logo: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    domain: z.ZodOptional<z.ZodString>;
    settings: z.ZodObject<{
        allowPublicSignups: z.ZodBoolean;
        requireDomainVerification: z.ZodBoolean;
        ssoEnabled: z.ZodBoolean;
        maxMembers: z.ZodOptional<z.ZodNumber>;
        auditLoggingEnabled: z.ZodBoolean;
        dataRetentionDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        allowPublicSignups: boolean;
        requireDomainVerification: boolean;
        ssoEnabled: boolean;
        auditLoggingEnabled: boolean;
        dataRetentionDays: number;
        maxMembers?: number | undefined;
    }, {
        allowPublicSignups: boolean;
        requireDomainVerification: boolean;
        ssoEnabled: boolean;
        auditLoggingEnabled: boolean;
        dataRetentionDays: number;
        maxMembers?: number | undefined;
    }>;
    billing: z.ZodObject<{
        plan: z.ZodEnum<["free", "pro", "team", "enterprise"]>;
        stripeCustomerId: z.ZodOptional<z.ZodString>;
        subscriptionStatus: z.ZodEnum<["active", "canceled", "past_due", "unpaid", "trialing"]>;
        licensedSeats: z.ZodNumber;
        usedSeats: z.ZodNumber;
        billingCycleStart: z.ZodOptional<z.ZodDate>;
        billingCycleEnd: z.ZodOptional<z.ZodDate>;
        trialEndsAt: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        plan: "free" | "pro" | "team" | "enterprise";
        subscriptionStatus: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
        licensedSeats: number;
        usedSeats: number;
        stripeCustomerId?: string | undefined;
        billingCycleStart?: Date | undefined;
        billingCycleEnd?: Date | undefined;
        trialEndsAt?: Date | undefined;
    }, {
        plan: "free" | "pro" | "team" | "enterprise";
        subscriptionStatus: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
        licensedSeats: number;
        usedSeats: number;
        stripeCustomerId?: string | undefined;
        billingCycleStart?: Date | undefined;
        billingCycleEnd?: Date | undefined;
        trialEndsAt?: Date | undefined;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    settings: {
        allowPublicSignups: boolean;
        requireDomainVerification: boolean;
        ssoEnabled: boolean;
        auditLoggingEnabled: boolean;
        dataRetentionDays: number;
        maxMembers?: number | undefined;
    };
    createdAt: Date;
    updatedAt: Date;
    slug: string;
    billing: {
        plan: "free" | "pro" | "team" | "enterprise";
        subscriptionStatus: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
        licensedSeats: number;
        usedSeats: number;
        stripeCustomerId?: string | undefined;
        billingCycleStart?: Date | undefined;
        billingCycleEnd?: Date | undefined;
        trialEndsAt?: Date | undefined;
    };
    description?: string | undefined;
    logo?: string | undefined;
    domain?: string | undefined;
}, {
    id: string;
    name: string;
    settings: {
        allowPublicSignups: boolean;
        requireDomainVerification: boolean;
        ssoEnabled: boolean;
        auditLoggingEnabled: boolean;
        dataRetentionDays: number;
        maxMembers?: number | undefined;
    };
    createdAt: Date;
    updatedAt: Date;
    slug: string;
    billing: {
        plan: "free" | "pro" | "team" | "enterprise";
        subscriptionStatus: "active" | "canceled" | "past_due" | "unpaid" | "trialing";
        licensedSeats: number;
        usedSeats: number;
        stripeCustomerId?: string | undefined;
        billingCycleStart?: Date | undefined;
        billingCycleEnd?: Date | undefined;
        trialEndsAt?: Date | undefined;
    };
    description?: string | undefined;
    logo?: string | undefined;
    domain?: string | undefined;
}>;
export declare const TeamSchema: z.ZodObject<{
    id: z.ZodString;
    organizationId: z.ZodString;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    avatar: z.ZodOptional<z.ZodString>;
    isArchived: z.ZodBoolean;
    settings: z.ZodObject<{
        isPrivate: z.ZodBoolean;
        defaultMemberPermissions: z.ZodArray<z.ZodString, "many">;
        notifyOnMemberChanges: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        isPrivate: boolean;
        defaultMemberPermissions: string[];
        notifyOnMemberChanges: boolean;
    }, {
        isPrivate: boolean;
        defaultMemberPermissions: string[];
        notifyOnMemberChanges: boolean;
    }>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    settings: {
        isPrivate: boolean;
        defaultMemberPermissions: string[];
        notifyOnMemberChanges: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    isArchived: boolean;
    description?: string | undefined;
    color?: string | undefined;
    avatar?: string | undefined;
}, {
    id: string;
    name: string;
    settings: {
        isPrivate: boolean;
        defaultMemberPermissions: string[];
        notifyOnMemberChanges: boolean;
    };
    createdAt: Date;
    updatedAt: Date;
    organizationId: string;
    isArchived: boolean;
    description?: string | undefined;
    color?: string | undefined;
    avatar?: string | undefined;
}>;
export declare const InvitationSchema: z.ZodObject<{
    id: z.ZodString;
    email: z.ZodString;
    organizationId: z.ZodString;
    teamId: z.ZodOptional<z.ZodString>;
    role: z.ZodString;
    customPermissions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    invitedBy: z.ZodString;
    message: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<["pending", "accepted", "declined", "expired"]>;
    expiresAt: z.ZodDate;
    createdAt: z.ZodDate;
    respondedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    id: string;
    email: string;
    expiresAt: Date;
    createdAt: Date;
    status: "declined" | "accepted" | "pending" | "expired";
    role: string;
    organizationId: string;
    invitedBy: string;
    message?: string | undefined;
    teamId?: string | undefined;
    customPermissions?: string[] | undefined;
    respondedAt?: Date | undefined;
}, {
    id: string;
    email: string;
    expiresAt: Date;
    createdAt: Date;
    status: "declined" | "accepted" | "pending" | "expired";
    role: string;
    organizationId: string;
    invitedBy: string;
    message?: string | undefined;
    teamId?: string | undefined;
    customPermissions?: string[] | undefined;
    respondedAt?: Date | undefined;
}>;
/**
 * Utility types for user operations
 */
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>;
export type UpdateUserInput = Partial<Pick<User, 'name' | 'avatar' | 'username' | 'timezone' | 'locale' | 'preferences'>>;
export type CreateOrganizationInput = Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateOrganizationInput = Partial<Pick<Organization, 'name' | 'logo' | 'description' | 'domain' | 'settings'>>;
export type CreateTeamInput = Omit<Team, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateTeamInput = Partial<Pick<Team, 'name' | 'description' | 'color' | 'avatar' | 'settings'>>;
export type CreateInvitationInput = Omit<Invitation, 'id' | 'status' | 'createdAt' | 'respondedAt'>;
/**
 * Permission checking utility functions
 */
export declare function hasOrganizationPermission(membership: OrganizationMembership, permission: OrganizationPermission): boolean;
export declare function hasTeamPermission(membership: TeamMembership, permission: TeamPermission): boolean;
/**
 * User context for authenticated requests
 */
export interface UserContext {
    /** Current user */
    user: User;
    /** Organization memberships */
    organizationMemberships: OrganizationMembership[];
    /** Team memberships */
    teamMemberships: TeamMembership[];
    /** Current organization (if any) */
    currentOrganization?: Organization;
    /** Current team (if any) */
    currentTeam?: Team;
}
//# sourceMappingURL=user.d.ts.map