/**
 * Jira Plugin Types
 * 
 * Comprehensive types for Jira API integration
 */

export interface JiraUser {
  self: string;
  key: string;
  accountId: string;
  accountType: 'atlassian' | 'app' | 'customer';
  name: string;
  emailAddress: string;
  avatarUrls: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
  displayName: string;
  active: boolean;
  timeZone: string;
  locale: string;
  groups?: {
    size: number;
    items: JiraGroup[];
  };
  applicationRoles?: {
    size: number;
    items: any[];
  };
  expand?: string;
}

export interface JiraGroup {
  name: string;
  self: string;
}

export interface JiraProject {
  self: string;
  id: string;
  key: string;
  name: string;
  description?: string;
  lead: JiraUser;
  components: JiraComponent[];
  issueTypes: JiraIssueType[];
  versions: JiraVersion[];
  roles: Record<string, string>;
  avatarUrls: {
    '16x16': string;
    '24x24': string;
    '32x32': string;
    '48x48': string;
  };
  projectCategory?: {
    self: string;
    id: string;
    name: string;
    description: string;
  };
  projectTypeKey: 'software' | 'service_desk' | 'business';
  simplified: boolean;
  style: 'classic' | 'next-gen';
  isPrivate: boolean;
  properties?: Record<string, any>;
  entityId?: string;
  uuid?: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  expand?: string;
  fields: {
    issuetype: JiraIssueType;
    project: JiraProject;
    fixVersions: JiraVersion[];
    resolution?: JiraResolution;
    resolutiondate?: string;
    workratio: number;
    lastViewed?: string;
    watches: {
      self: string;
      watchCount: number;
      isWatching: boolean;
    };
    created: string;
    priority: JiraPriority;
    labels: string[];
    timeoriginalestimate?: number;
    description?: {
      type: 'doc';
      version: 1;
      content: any[];
    };
    timetracking: {
      originalEstimate?: string;
      remainingEstimate?: string;
      timeSpent?: string;
      originalEstimateSeconds?: number;
      remainingEstimateSeconds?: number;
      timeSpentSeconds?: number;
    };
    security?: any;
    attachment: JiraAttachment[];
    aggregatetimeoriginalestimate?: number;
    summary: string;
    creator: JiraUser;
    subtasks: JiraIssue[];
    reporter: JiraUser;
    aggregateprogress: {
      progress: number;
      total: number;
      percent: number;
    };
    environment?: string;
    duedate?: string;
    progress: {
      progress: number;
      total: number;
      percent: number;
    };
    comment: {
      comments: JiraComment[];
      maxResults: number;
      total: number;
      startAt: number;
    };
    votes: {
      self: string;
      votes: number;
      hasVoted: boolean;
    };
    worklog: {
      startAt: number;
      maxResults: number;
      total: number;
      worklogs: JiraWorklog[];
    };
    assignee?: JiraUser;
    updated: string;
    status: JiraStatus;
    components: JiraComponent[];
    timeestimate?: number;
    aggregatetimeestimate?: number;
    aggregatetimespent?: number;
    timespent?: number;
    versions: JiraVersion[];
    [key: string]: any; // For custom fields
  };
  changelog?: {
    startAt: number;
    maxResults: number;
    total: number;
    histories: JiraChangeHistory[];
  };
}

export interface JiraIssueType {
  self: string;
  id: string;
  description: string;
  iconUrl: string;
  name: string;
  subtask: boolean;
  avatarId: number;
  hierarchyLevel: number;
}

export interface JiraStatus {
  self: string;
  description: string;
  iconUrl: string;
  name: string;
  id: string;
  statusCategory: {
    self: string;
    id: number;
    key: 'new' | 'indeterminate' | 'done';
    colorName: string;
    name: string;
  };
}

export interface JiraPriority {
  self: string;
  iconUrl: string;
  name: string;
  id: string;
  statusColor: string;
  description: string;
}

export interface JiraResolution {
  self: string;
  id: string;
  description: string;
  name: string;
}

export interface JiraComponent {
  self: string;
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  assigneeType: 'PROJECT_DEFAULT' | 'COMPONENT_LEAD' | 'PROJECT_LEAD' | 'UNASSIGNED';
  assignee?: JiraUser;
  realAssigneeType: 'PROJECT_DEFAULT' | 'COMPONENT_LEAD' | 'PROJECT_LEAD' | 'UNASSIGNED';
  realAssignee?: JiraUser;
  isAssigneeTypeValid: boolean;
  project: string;
  projectId: number;
}

export interface JiraVersion {
  self: string;
  id: string;
  name: string;
  description?: string;
  archived: boolean;
  released: boolean;
  startDate?: string;
  releaseDate?: string;
  userStartDate?: string;
  userReleaseDate?: string;
  project: string;
  projectId: number;
  moveUnfixedIssuesTo?: string;
  operations?: any[];
}

export interface JiraComment {
  self: string;
  id: string;
  author: JiraUser;
  body: {
    type: 'doc';
    version: 1;
    content: any[];
  };
  updateAuthor: JiraUser;
  created: string;
  updated: string;
  visibility?: {
    type: 'group' | 'role';
    value: string;
  };
}

export interface JiraWorklog {
  self: string;
  author: JiraUser;
  updateAuthor: JiraUser;
  comment?: {
    type: 'doc';
    version: 1;
    content: any[];
  };
  created: string;
  updated: string;
  visibility?: {
    type: 'group' | 'role';
    value: string;
  };
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  id: string;
  issueId: string;
}

export interface JiraAttachment {
  self: string;
  id: string;
  filename: string;
  author: JiraUser;
  created: string;
  size: number;
  mimeType: string;
  content: string;
  thumbnail?: string;
}

export interface JiraChangeHistory {
  id: string;
  author: JiraUser;
  created: string;
  items: JiraChangeItem[];
}

export interface JiraChangeItem {
  field: string;
  fieldtype: string;
  fieldId?: string;
  from?: string;
  fromString?: string;
  to?: string;
  toString?: string;
}

export interface JiraSprint {
  id: number;
  self: string;
  state: 'closed' | 'active' | 'future';
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId: number;
  goal?: string;
}

export interface JiraBoard {
  id: number;
  self: string;
  name: string;
  type: 'scrum' | 'kanban' | 'simple';
  admins?: {
    users: JiraUser[];
    groups: JiraGroup[];
  };
  location: {
    type: 'project';
    key: string;
    id: string;
    self: string;
    name: string;
  };
  canEdit: boolean;
  isPrivate: boolean;
  favourite: boolean;
}

export interface JiraEpic {
  id: number;
  key: string;
  self: string;
  name: string;
  summary: string;
  color: {
    key: string;
  };
  done: boolean;
}

export interface JiraFilter {
  self: string;
  id: string;
  name: string;
  description?: string;
  owner: JiraUser;
  jql: string;
  viewUrl: string;
  searchUrl: string;
  favourite: boolean;
  favouritedCount: number;
  sharePermissions: JiraSharePermission[];
  subscriptions: JiraFilterSubscription[];
}

export interface JiraSharePermission {
  id: number;
  type: 'global' | 'project' | 'group' | 'projectRole' | 'user';
  project?: {
    self: string;
    id: string;
    key: string;
    name: string;
  };
  role?: {
    self: string;
    name: string;
    id: string;
  };
  group?: {
    name: string;
    self: string;
  };
  user?: JiraUser;
}

export interface JiraFilterSubscription {
  id: number;
  user: JiraUser;
  group?: JiraGroup;
}

export interface JiraWebhook {
  name: string;
  url: string;
  events: string[];
  filters?: {
    'issue-related-events-section': string;
  };
  excludeBody?: boolean;
}

export interface JiraPluginConfig {
  jiraUrl: string;
  enableNotifications: boolean;
  trackedProjects: string[];
  updateInterval: number;
  notificationTypes: Array<'issues' | 'comments' | 'assignments' | 'sprints'>;
  jqlFilters: string[];
  syncHistoryDays: number;
  enableTimeTracking: boolean;
  defaultBoard?: number;
}

export interface JiraAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope: string;
}

export interface JiraSearchResult {
  id: string;
  title: string;
  description: string;
  url?: string;
  contentType: 'issue' | 'project' | 'user' | 'comment' | 'attachment';
  projectKey?: string;
  issueKey?: string;
  issueType?: string;
  status?: string;
  priority?: string;
  assignee?: JiraUser;
  reporter?: JiraUser;
  timestamp: Date;
  score: number;
  metadata: Record<string, any>;
}

export interface JiraApiResponse<T> {
  data?: T;
  expand?: string;
  startAt?: number;
  maxResults?: number;
  total?: number;
  values?: T[];
  issues?: JiraIssue[];
  projects?: JiraProject[];
  users?: JiraUser[];
  error?: {
    errorMessages: string[];
    errors: Record<string, string>;
    status: number;
  };
}

export interface JiraAutomationTrigger {
  type: 'issue-created' | 'issue-updated' | 'issue-assigned' | 'comment-added' | 'sprint-started' | 'sprint-completed';
  projectKey?: string;
  issueType?: string;
  priority?: string;
  assignee?: string;
  reporter?: string;
  status?: string;
  components?: string[];
  labels?: string[];
  jql?: string;
  conditions?: Record<string, any>;
}

export interface JiraAutomationAction {
  type: 'create-issue' | 'update-issue' | 'assign-issue' | 'add-comment' | 'transition-issue' | 'log-work' | 'send-notification';
  projectKey?: string;
  issueKey?: string;
  summary?: string;
  description?: string;
  issueType?: string;
  assignee?: string;
  priority?: string;
  components?: string[];
  labels?: string[];
  comment?: string;
  transitionId?: string;
  worklogTime?: string;
  templateData?: Record<string, any>;
  options?: Record<string, any>;
}