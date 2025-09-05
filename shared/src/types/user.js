"use strict";
/**
 * User and Organization Types for Flow Desk
 *
 * Defines core types for user management, organizations, teams, and permissions
 * following Clerk auth patterns and Blueprint.md requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvitationSchema = exports.TeamSchema = exports.OrganizationSchema = exports.UserSchema = exports.TEAM_ROLE_PERMISSIONS = exports.ORGANIZATION_ROLE_PERMISSIONS = void 0;
exports.hasOrganizationPermission = hasOrganizationPermission;
exports.hasTeamPermission = hasTeamPermission;
const zod_1 = require("zod");
/**
 * Permission mapping for roles
 */
exports.ORGANIZATION_ROLE_PERMISSIONS = {
    owner: [
        'org:read', 'org:update', 'org:delete', 'org:billing',
        'members:read', 'members:invite', 'members:update', 'members:remove',
        'teams:create', 'teams:read', 'teams:update', 'teams:delete',
        'workspaces:create', 'workspaces:read', 'workspaces:update', 'workspaces:delete',
        'settings:read', 'settings:update',
        'audit:read'
    ],
    admin: [
        'org:read', 'org:update',
        'members:read', 'members:invite', 'members:update', 'members:remove',
        'teams:create', 'teams:read', 'teams:update', 'teams:delete',
        'workspaces:create', 'workspaces:read', 'workspaces:update', 'workspaces:delete',
        'settings:read', 'settings:update',
        'audit:read'
    ],
    manager: [
        'org:read',
        'members:read', 'members:invite', 'members:update',
        'teams:read', 'teams:update',
        'workspaces:create', 'workspaces:read', 'workspaces:update',
        'settings:read'
    ],
    member: [
        'org:read',
        'members:read',
        'teams:read',
        'workspaces:read', 'workspaces:update',
        'settings:read'
    ],
    guest: [
        'org:read',
        'members:read',
        'teams:read',
        'workspaces:read'
    ]
};
/**
 * Permission mapping for team roles
 */
exports.TEAM_ROLE_PERMISSIONS = {
    lead: [
        'team:read', 'team:update', 'team:delete',
        'team:members:invite', 'team:members:remove', 'team:members:update',
        'content:read', 'content:write', 'content:delete',
        'workspaces:read', 'workspaces:write'
    ],
    member: [
        'team:read',
        'content:read', 'content:write',
        'workspaces:read', 'workspaces:write'
    ],
    collaborator: [
        'team:read',
        'content:read', 'content:write',
        'workspaces:read'
    ],
    viewer: [
        'team:read',
        'content:read',
        'workspaces:read'
    ]
};
// Zod schemas for runtime validation
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    name: zod_1.z.string(),
    avatar: zod_1.z.string().url().optional(),
    username: zod_1.z.string().optional(),
    timezone: zod_1.z.string(),
    locale: zod_1.z.string(),
    isActive: zod_1.z.boolean(),
    hasCompletedOnboarding: zod_1.z.boolean(),
    preferences: zod_1.z.object({
        theme: zod_1.z.enum(['light', 'dark', 'auto']),
        emailNotifications: zod_1.z.boolean(),
        pushNotifications: zod_1.z.boolean(),
        desktopNotifications: zod_1.z.boolean(),
        analyticsEnabled: zod_1.z.boolean(),
        autoSaveIntervalMinutes: zod_1.z.number().min(1).max(60),
        defaultWorkspaceId: zod_1.z.string().optional()
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date(),
    lastSeenAt: zod_1.z.date().optional()
});
exports.OrganizationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    slug: zod_1.z.string(),
    logo: zod_1.z.string().url().optional(),
    description: zod_1.z.string().optional(),
    domain: zod_1.z.string().optional(),
    settings: zod_1.z.object({
        allowPublicSignups: zod_1.z.boolean(),
        requireDomainVerification: zod_1.z.boolean(),
        ssoEnabled: zod_1.z.boolean(),
        maxMembers: zod_1.z.number().positive().optional(),
        auditLoggingEnabled: zod_1.z.boolean(),
        dataRetentionDays: zod_1.z.number().positive()
    }),
    billing: zod_1.z.object({
        plan: zod_1.z.enum(['free', 'pro', 'team', 'enterprise']),
        stripeCustomerId: zod_1.z.string().optional(),
        subscriptionStatus: zod_1.z.enum(['active', 'canceled', 'past_due', 'unpaid', 'trialing']),
        licensedSeats: zod_1.z.number().nonnegative(),
        usedSeats: zod_1.z.number().nonnegative(),
        billingCycleStart: zod_1.z.date().optional(),
        billingCycleEnd: zod_1.z.date().optional(),
        trialEndsAt: zod_1.z.date().optional()
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.TeamSchema = zod_1.z.object({
    id: zod_1.z.string(),
    organizationId: zod_1.z.string(),
    name: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    color: zod_1.z.string().optional(),
    avatar: zod_1.z.string().url().optional(),
    isArchived: zod_1.z.boolean(),
    settings: zod_1.z.object({
        isPrivate: zod_1.z.boolean(),
        defaultMemberPermissions: zod_1.z.array(zod_1.z.string()),
        notifyOnMemberChanges: zod_1.z.boolean()
    }),
    createdAt: zod_1.z.date(),
    updatedAt: zod_1.z.date()
});
exports.InvitationSchema = zod_1.z.object({
    id: zod_1.z.string(),
    email: zod_1.z.string().email(),
    organizationId: zod_1.z.string(),
    teamId: zod_1.z.string().optional(),
    role: zod_1.z.string(),
    customPermissions: zod_1.z.array(zod_1.z.string()).optional(),
    invitedBy: zod_1.z.string(),
    message: zod_1.z.string().optional(),
    status: zod_1.z.enum(['pending', 'accepted', 'declined', 'expired']),
    expiresAt: zod_1.z.date(),
    createdAt: zod_1.z.date(),
    respondedAt: zod_1.z.date().optional()
});
/**
 * Permission checking utility functions
 */
function hasOrganizationPermission(membership, permission) {
    // Check custom permissions first
    if (membership.customPermissions?.includes(permission)) {
        return true;
    }
    // Check role-based permissions
    return exports.ORGANIZATION_ROLE_PERMISSIONS[membership.role]?.includes(permission) ?? false;
}
function hasTeamPermission(membership, permission) {
    // Check custom permissions first
    if (membership.customPermissions?.includes(permission)) {
        return true;
    }
    // Check role-based permissions
    return exports.TEAM_ROLE_PERMISSIONS[membership.role]?.includes(permission) ?? false;
}
//# sourceMappingURL=user.js.map