/**
 * Comprehensive Slack API Types
 * Based on Slack Web API and RTM API specifications
 */

export interface SlackUser {
  id: string;
  name: string;
  real_name?: string;
  display_name?: string;
  email?: string;
  phone?: string;
  skype?: string;
  title?: string;
  team_id: string;
  avatar_hash?: string;
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  is_admin?: boolean;
  is_bot?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  deleted?: boolean;
  color?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  profile?: SlackUserProfile;
  presence?: 'active' | 'away';
  status?: {
    status_text?: string;
    status_emoji?: string;
    status_expiration?: number;
  };
}

export interface SlackUserProfile {
  avatar_hash?: string;
  status_text?: string;
  status_emoji?: string;
  real_name?: string;
  display_name?: string;
  real_name_normalized?: string;
  display_name_normalized?: string;
  email?: string;
  image_24?: string;
  image_32?: string;
  image_48?: string;
  image_72?: string;
  image_192?: string;
  image_512?: string;
  team?: string;
  fields?: Record<string, any>;
  phone?: string;
  skype?: string;
  title?: string;
  first_name?: string;
  last_name?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  created?: number;
  creator?: string;
  is_archived?: boolean;
  is_general?: boolean;
  unlinked?: number;
  name_normalized?: string;
  is_shared?: boolean;
  is_ext_shared?: boolean;
  is_org_shared?: boolean;
  pending_shared?: string[];
  is_pending_ext_shared?: boolean;
  is_member?: boolean;
  is_private?: boolean;
  is_open?: boolean;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
  members?: string[];
  num_members?: number;
  locale?: string;
  user?: string; // For DMs
}

export interface SlackMessage {
  type: string;
  subtype?: string;
  channel: string;
  user?: string;
  bot_id?: string;
  username?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users?: string[];
  reply_users_count?: number;
  latest_reply?: string;
  subscribed?: boolean;
  unread_count?: number;
  reactions?: SlackReaction[];
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
  files?: SlackFile[];
  edited?: {
    user: string;
    ts: string;
  };
  pinned_to?: string[];
  permalink?: string;
  client_msg_id?: string;
  is_starred?: boolean;
  parent_user_id?: string;
}

export interface SlackReaction {
  name: string;
  users: string[];
  count: number;
}

export interface SlackAttachment {
  id?: number;
  color?: string;
  fallback?: string;
  text?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  actions?: SlackAction[];
  callback_id?: string;
  attachment_type?: string;
  service_name?: string;
  service_url?: string;
  from_url?: string;
  original_url?: string;
  file?: SlackFile;
}

export interface SlackBlock {
  type: string;
  block_id?: string;
  elements?: any[];
  text?: any;
  fields?: any[];
  accessory?: any;
}

export interface SlackAction {
  id?: string;
  name: string;
  text: string;
  type: string;
  value?: string;
  style?: 'default' | 'primary' | 'danger';
  confirm?: {
    title: string;
    text: string;
    ok_text?: string;
    dismiss_text?: string;
  };
  options?: Array<{
    text: string;
    value: string;
    description?: string;
  }>;
}

export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  pretty_type: string;
  user: string;
  editable: boolean;
  size: number;
  mode: string;
  is_external: boolean;
  external_type: string;
  is_public: boolean;
  public_url_shared: boolean;
  display_as_bot: boolean;
  username: string;
  url_private: string;
  url_private_download: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_160?: string;
  thumb_720?: string;
  thumb_800?: string;
  thumb_960?: string;
  thumb_1024?: string;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  permalink?: string;
  permalink_public?: string;
  comments_count?: number;
  is_starred?: boolean;
  shares?: {
    public?: Record<string, any>;
    private?: Record<string, any>;
  };
  channels?: string[];
  groups?: string[];
  ims?: string[];
  has_rich_preview?: boolean;
}

export interface SlackTeam {
  id: string;
  name: string;
  domain: string;
  email_domain?: string;
  icon?: {
    image_34?: string;
    image_44?: string;
    image_68?: string;
    image_88?: string;
    image_102?: string;
    image_132?: string;
    image_230?: string;
    image_default?: boolean;
  };
  enterprise_id?: string;
  enterprise_name?: string;
}

export interface SlackWorkspace {
  id: string;
  name: string;
  domain: string;
  url: string;
  team: SlackTeam;
  user: SlackUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  is_connected: boolean;
  last_sync?: number;
  channels: SlackChannel[];
  users: SlackUser[];
  unread_count: number;
  mention_count: number;
}

// Real-time API types
export interface SlackRTMEvent {
  type: string;
  ts?: string;
  user?: string;
  channel?: string;
  text?: string;
  message?: SlackMessage;
  subtype?: string;
  hidden?: boolean;
  deleted_ts?: string;
  event_ts?: string;
}

export interface SlackRTMConnection {
  url: string;
  team: SlackTeam;
  self: SlackUser;
  users: SlackUser[];
  channels: SlackChannel[];
  groups: SlackChannel[];
  mpims: SlackChannel[];
  ims: SlackChannel[];
  bots: any[];
}

// OAuth Types
export interface SlackOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user: {
    id: string;
    scope: string;
    access_token: string;
    token_type: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  bot?: {
    bot_user_id: string;
    bot_access_token: string;
  };
}

// Search Types
export interface SlackSearchQuery {
  query: string;
  sort?: 'score' | 'timestamp';
  sort_dir?: 'asc' | 'desc';
  highlight?: boolean;
  count?: number;
  page?: number;
}

export interface SlackSearchResult {
  messages?: {
    total: number;
    pagination: {
      total_count: number;
      page: number;
      per_page: number;
      page_count: number;
      first: number;
      last: number;
    };
    paging: {
      count: number;
      total: number;
      page: number;
      pages: number;
    };
    matches: SlackMessage[];
  };
  files?: {
    total: number;
    pagination: any;
    paging: any;
    matches: SlackFile[];
  };
}

// Automation Types
export interface SlackAutomationTrigger {
  type: 'new_message' | 'mention' | 'reaction_added' | 'file_shared' | 'user_joined' | 'channel_created';
  channel?: string;
  user?: string;
  keyword?: string;
  emoji?: string;
}

export interface SlackAutomationAction {
  type: 'send_message' | 'add_reaction' | 'pin_message' | 'archive_channel' | 'invite_user' | 'set_status';
  channel?: string;
  text?: string;
  emoji?: string;
  user?: string;
  status_text?: string;
  status_emoji?: string;
}

// Plugin-specific types
export interface SlackPluginConfig {
  enableNotifications: boolean;
  notificationTypes: string[];
  keywords: string[];
  autoMarkRead: boolean;
  syncHistoryDays: number;
  enableTypingIndicators: boolean;
  customStatus: {
    syncWithCalendar: boolean;
    busyMessage: string;
  };
}

export interface SlackPluginState {
  workspaces: SlackWorkspace[];
  activeWorkspace?: string;
  isConnecting: boolean;
  isAuthenticated: boolean;
  lastSync?: number;
  rtmConnections: Map<string, WebSocket>;
  messageCache: Map<string, SlackMessage[]>;
  userCache: Map<string, SlackUser>;
  channelCache: Map<string, SlackChannel>;
  typingUsers: Map<string, Set<string>>;
  unreadCounts: Map<string, number>;
}

// API Response Types
export interface SlackAPIResponse<T = any> {
  ok: boolean;
  error?: string;
  warning?: string;
  response_metadata?: {
    next_cursor?: string;
    warnings?: string[];
  };
  data?: T;
}

export interface SlackConversationsListResponse extends SlackAPIResponse {
  channels: SlackChannel[];
  response_metadata?: {
    next_cursor: string;
  };
}

export interface SlackConversationsHistoryResponse extends SlackAPIResponse {
  messages: SlackMessage[];
  has_more: boolean;
  pin_count?: number;
  response_metadata?: {
    next_cursor: string;
  };
}

export interface SlackUsersListResponse extends SlackAPIResponse {
  members: SlackUser[];
  cache_ts?: number;
  response_metadata?: {
    next_cursor: string;
  };
}

export interface SlackAuthTestResponse extends SlackAPIResponse {
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
  enterprise_id?: string;
}

// WebSocket Event Types
export interface SlackWSMessage {
  type: string;
  envelope_id?: string;
  payload?: any;
  accepts_response_payload?: boolean;
}

export interface SlackSocketModeEvent {
  envelope_id: string;
  payload: {
    type: string;
    event: SlackRTMEvent;
    team_id: string;
    api_app_id: string;
    event_id: string;
    event_time: number;
    authorizations?: Array<{
      enterprise_id?: string;
      team_id: string;
      user_id: string;
      is_bot: boolean;
      is_enterprise_install?: boolean;
    }>;
  };
  type: 'events_api';
  accepts_response_payload: boolean;
}

// Error Types
export interface SlackError extends Error {
  code?: string;
  data?: any;
  status?: number;
}

export class SlackAPIError extends Error implements SlackError {
  code: string;
  data?: any;
  status?: number;

  constructor(message: string, code: string, data?: any, status?: number) {
    super(message);
    this.name = 'SlackAPIError';
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

// Rate limiting types
export interface SlackRateLimit {
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  reset?: number;
}

// Webhook types
export interface SlackWebhookPayload {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  api_app_id: string;
  response_url: string;
  trigger_id: string;
}