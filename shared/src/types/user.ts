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
export type OrganizationRole = 
  | 'owner'        // Full control, billing, can delete org
  | 'admin'        // Manage members, teams, settings (no billing)
  | 'manager'      // Manage team members and projects
  | 'member'       // Standard user access
  | 'guest';       // Limited read-only access

/**
 * Team roles within teams
 */
export type TeamRole = 
  | 'lead'         // Manage team, members, settings
  | 'member'       // Standard team member
  | 'collaborator' // External collaborator with limited access
  | 'viewer';      // Read-only access

/**
 * Organization-level permissions
 */
export type OrganizationPermission = 
  // Organization management
  | 'org:read'
  | 'org:update' 
  | 'org:delete'
  | 'org:billing'
  // Member management
  | 'members:read'
  | 'members:invite'
  | 'members:update'
  | 'members:remove'
  // Team management
  | 'teams:create'
  | 'teams:read'
  | 'teams:update'
  | 'teams:delete'
  // Workspace management
  | 'workspaces:create'
  | 'workspaces:read'
  | 'workspaces:update'
  | 'workspaces:delete'
  // Settings
  | 'settings:read'
  | 'settings:update'
  // Audit logs
  | 'audit:read';

/**
 * Team-level permissions
 */
export type TeamPermission = 
  // Team management
  | 'team:read'
  | 'team:update'
  | 'team:delete'
  // Member management
  | 'team:members:invite'
  | 'team:members:remove'
  | 'team:members:update'
  // Content access
  | 'content:read'
  | 'content:write'
  | 'content:delete'
  // Workspace access
  | 'workspaces:read'
  | 'workspaces:write';

/**
 * Permission mapping for roles
 */
export const ORGANIZATION_ROLE_PERMISSIONS: Record<OrganizationRole, OrganizationPermission[]> = {
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
export const TEAM_ROLE_PERMISSIONS: Record<TeamRole, TeamPermission[]> = {
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

// Zod schemas for runtime validation
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().url().optional(),
  username: z.string().optional(),
  timezone: z.string(),
  locale: z.string(),
  isActive: z.boolean(),
  hasCompletedOnboarding: z.boolean(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']),
    emailNotifications: z.boolean(),
    pushNotifications: z.boolean(),
    desktopNotifications: z.boolean(),
    analyticsEnabled: z.boolean(),
    autoSaveIntervalMinutes: z.number().min(1).max(60),
    defaultWorkspaceId: z.string().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastSeenAt: z.date().optional()
});

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().url().optional(),
  description: z.string().optional(),
  domain: z.string().optional(),
  settings: z.object({
    allowPublicSignups: z.boolean(),
    requireDomainVerification: z.boolean(),
    ssoEnabled: z.boolean(),
    maxMembers: z.number().positive().optional(),
    auditLoggingEnabled: z.boolean(),
    dataRetentionDays: z.number().positive()
  }),
  billing: z.object({
    plan: z.enum(['free', 'pro', 'team', 'enterprise']),
    stripeCustomerId: z.string().optional(),
    subscriptionStatus: z.enum(['active', 'canceled', 'past_due', 'unpaid', 'trialing']),
    licensedSeats: z.number().nonnegative(),
    usedSeats: z.number().nonnegative(),
    billingCycleStart: z.date().optional(),
    billingCycleEnd: z.date().optional(),
    trialEndsAt: z.date().optional()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const TeamSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
  avatar: z.string().url().optional(),
  isArchived: z.boolean(),
  settings: z.object({
    isPrivate: z.boolean(),
    defaultMemberPermissions: z.array(z.string()),
    notifyOnMemberChanges: z.boolean()
  }),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const InvitationSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  organizationId: z.string(),
  teamId: z.string().optional(),
  role: z.string(),
  customPermissions: z.array(z.string()).optional(),
  invitedBy: z.string(),
  message: z.string().optional(),
  status: z.enum(['pending', 'accepted', 'declined', 'expired']),
  expiresAt: z.date(),
  createdAt: z.date(),
  respondedAt: z.date().optional()
});

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
export function hasOrganizationPermission(
  membership: OrganizationMembership,
  permission: OrganizationPermission
): boolean {
  // Check custom permissions first
  if (membership.customPermissions?.includes(permission)) {
    return true;
  }
  
  // Check role-based permissions
  return ORGANIZATION_ROLE_PERMISSIONS[membership.role]?.includes(permission) ?? false;
}

export function hasTeamPermission(
  membership: TeamMembership,
  permission: TeamPermission
): boolean {
  // Check custom permissions first
  if (membership.customPermissions?.includes(permission)) {
    return true;
  }
  
  // Check role-based permissions
  return TEAM_ROLE_PERMISSIONS[membership.role]?.includes(permission) ?? false;
}

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