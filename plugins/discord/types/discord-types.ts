/**
 * Discord Plugin Types
 * 
 * Comprehensive types for Discord API integration
 */

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string;
  accent_color?: number;
  locale?: string;
  verified?: boolean;
  email?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  icon_hash?: string;
  splash?: string;
  discovery_splash?: string;
  owner?: boolean;
  owner_id: string;
  permissions?: string;
  region?: string;
  afk_channel_id?: string;
  afk_timeout: number;
  widget_enabled?: boolean;
  widget_channel_id?: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  roles: DiscordRole[];
  emojis: DiscordEmoji[];
  features: string[];
  mfa_level: number;
  application_id?: string;
  system_channel_id?: string;
  system_channel_flags: number;
  rules_channel_id?: string;
  max_presences?: number;
  max_members?: number;
  vanity_url_code?: string;
  description?: string;
  banner?: string;
  premium_tier: number;
  premium_subscription_count?: number;
  preferred_locale: string;
  public_updates_channel_id?: string;
  max_video_channel_users?: number;
  max_stage_video_channel_users?: number;
  approximate_member_count?: number;
  approximate_presence_count?: number;
  welcome_screen?: DiscordWelcomeScreen;
  nsfw_level: number;
  stickers?: DiscordSticker[];
  premium_progress_bar_enabled: boolean;
  safety_alerts_channel_id?: string;
}

export interface DiscordChannel {
  id: string;
  type: DiscordChannelType;
  guild_id?: string;
  position?: number;
  permission_overwrites?: DiscordOverwrite[];
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: DiscordUser[];
  icon?: string;
  owner_id?: string;
  application_id?: string;
  managed?: boolean;
  parent_id?: string;
  last_pin_timestamp?: string;
  rtc_region?: string;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: DiscordThreadMetadata;
  member?: DiscordThreadMember;
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
  total_message_sent?: number;
  available_tags?: DiscordForumTag[];
  applied_tags?: string[];
  default_reaction_emoji?: DiscordDefaultReaction;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number;
  default_forum_layout?: number;
}

export enum DiscordChannelType {
  GUILD_TEXT = 0,
  DM = 1,
  GUILD_VOICE = 2,
  GROUP_DM = 3,
  GUILD_CATEGORY = 4,
  GUILD_ANNOUNCEMENT = 5,
  ANNOUNCEMENT_THREAD = 10,
  PUBLIC_THREAD = 11,
  PRIVATE_THREAD = 12,
  GUILD_STAGE_VOICE = 13,
  GUILD_DIRECTORY = 14,
  GUILD_FORUM = 15,
  GUILD_MEDIA = 16
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: DiscordUser[];
  mention_roles: string[];
  mention_channels?: DiscordChannelMention[];
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  reactions?: DiscordReaction[];
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: string;
  type: DiscordMessageType;
  activity?: DiscordMessageActivity;
  application?: DiscordApplication;
  application_id?: string;
  message_reference?: DiscordMessageReference;
  flags?: number;
  referenced_message?: DiscordMessage;
  interaction?: DiscordMessageInteraction;
  thread?: DiscordChannel;
  components?: DiscordComponent[];
  sticker_items?: DiscordStickerItem[];
  stickers?: DiscordSticker[];
  position?: number;
  role_subscription_data?: DiscordRoleSubscriptionData;
  resolved?: DiscordResolvedData;
}

export enum DiscordMessageType {
  DEFAULT = 0,
  RECIPIENT_ADD = 1,
  RECIPIENT_REMOVE = 2,
  CALL = 3,
  CHANNEL_NAME_CHANGE = 4,
  CHANNEL_ICON_CHANGE = 5,
  CHANNEL_PINNED_MESSAGE = 6,
  USER_JOIN = 7,
  GUILD_BOOST = 8,
  GUILD_BOOST_TIER_1 = 9,
  GUILD_BOOST_TIER_2 = 10,
  GUILD_BOOST_TIER_3 = 11,
  CHANNEL_FOLLOW_ADD = 12,
  GUILD_DISCOVERY_DISQUALIFIED = 14,
  GUILD_DISCOVERY_REQUALIFIED = 15,
  GUILD_DISCOVERY_GRACE_PERIOD_INITIAL_WARNING = 16,
  GUILD_DISCOVERY_GRACE_PERIOD_FINAL_WARNING = 17,
  THREAD_CREATED = 18,
  REPLY = 19,
  CHAT_INPUT_COMMAND = 20,
  THREAD_STARTER_MESSAGE = 21,
  GUILD_INVITE_REMINDER = 22,
  CONTEXT_MENU_COMMAND = 23,
  AUTO_MODERATION_ACTION = 24,
  ROLE_SUBSCRIPTION_PURCHASE = 25,
  INTERACTION_PREMIUM_UPSELL = 26,
  STAGE_START = 27,
  STAGE_END = 28,
  STAGE_SPEAKER = 29,
  STAGE_TOPIC = 31,
  GUILD_APPLICATION_PREMIUM_SUBSCRIPTION = 32
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon?: string;
  unicode_emoji?: string;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  tags?: DiscordRoleTags;
  flags: number;
}

export interface DiscordEmoji {
  id?: string;
  name?: string;
  roles?: string[];
  user?: DiscordUser;
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number;
  width?: number;
  ephemeral?: boolean;
  duration_secs?: number;
  waveform?: string;
  flags?: number;
}

export interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  video?: DiscordEmbedVideo;
  provider?: DiscordEmbedProvider;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedThumbnail {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedVideo {
  url?: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedProvider {
  name?: string;
  url?: string;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordReaction {
  count: number;
  me: boolean;
  emoji: DiscordEmoji;
  count_details: DiscordReactionCountDetails;
}

export interface DiscordReactionCountDetails {
  burst: number;
  normal: number;
}

export interface DiscordOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

export interface DiscordThreadMetadata {
  archived: boolean;
  auto_archive_duration: number;
  archive_timestamp: string;
  locked: boolean;
  invitable?: boolean;
  create_timestamp?: string;
}

export interface DiscordThreadMember {
  id?: string;
  user_id?: string;
  join_timestamp: string;
  flags: number;
  member?: DiscordGuildMember;
}

export interface DiscordGuildMember {
  user?: DiscordUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string;
}

export interface DiscordVoiceState {
  guild_id?: string;
  channel_id?: string;
  user_id: string;
  member?: DiscordGuildMember;
  session_id: string;
  deaf: boolean;
  mute: boolean;
  self_deaf: boolean;
  self_mute: boolean;
  self_stream?: boolean;
  self_video: boolean;
  suppress: boolean;
  request_to_speak_timestamp?: string;
}

export interface DiscordPresence {
  user: Partial<DiscordUser>;
  guild_id: string;
  status: DiscordPresenceStatus;
  activities: DiscordActivity[];
  client_status: DiscordClientStatus;
}

export enum DiscordPresenceStatus {
  IDLE = 'idle',
  DND = 'dnd',
  ONLINE = 'online',
  OFFLINE = 'offline'
}

export interface DiscordActivity {
  name: string;
  type: DiscordActivityType;
  url?: string;
  created_at: number;
  timestamps?: DiscordActivityTimestamps;
  application_id?: string;
  details?: string;
  state?: string;
  emoji?: DiscordEmoji;
  party?: DiscordActivityParty;
  assets?: DiscordActivityAssets;
  secrets?: DiscordActivitySecrets;
  instance?: boolean;
  flags?: number;
  buttons?: DiscordActivityButton[];
}

export enum DiscordActivityType {
  PLAYING = 0,
  STREAMING = 1,
  LISTENING = 2,
  WATCHING = 3,
  CUSTOM = 4,
  COMPETING = 5
}

export interface DiscordActivityTimestamps {
  start?: number;
  end?: number;
}

export interface DiscordActivityParty {
  id?: string;
  size?: [number, number];
}

export interface DiscordActivityAssets {
  large_image?: string;
  large_text?: string;
  small_image?: string;
  small_text?: string;
}

export interface DiscordActivitySecrets {
  join?: string;
  spectate?: string;
  match?: string;
}

export interface DiscordActivityButton {
  label: string;
  url: string;
}

export interface DiscordClientStatus {
  desktop?: string;
  mobile?: string;
  web?: string;
}

export interface DiscordApplication {
  id: string;
  name: string;
  icon?: string;
  description: string;
  rpc_origins?: string[];
  bot_public: boolean;
  bot_require_code_grant: boolean;
  terms_of_service_url?: string;
  privacy_policy_url?: string;
  owner?: DiscordUser;
  summary?: string;
  verify_key: string;
  team?: DiscordTeam;
  guild_id?: string;
  primary_sku_id?: string;
  slug?: string;
  cover_image?: string;
  flags?: number;
  approximate_guild_count?: number;
  redirect_uris?: string[];
  interactions_endpoint_url?: string;
  role_connections_verification_url?: string;
  tags?: string[];
  install_params?: DiscordInstallParams;
  custom_install_url?: string;
}

export interface DiscordTeam {
  icon?: string;
  id: string;
  members: DiscordTeamMember[];
  name: string;
  owner_user_id: string;
}

export interface DiscordTeamMember {
  membership_state: number;
  team_id: string;
  user: Partial<DiscordUser>;
  role: string;
}

export interface DiscordInstallParams {
  scopes: string[];
  permissions: string;
}

export interface DiscordWebhook {
  id: string;
  type: number;
  guild_id?: string;
  channel_id: string;
  user?: DiscordUser;
  name?: string;
  avatar?: string;
  token?: string;
  application_id?: string;
  source_guild?: DiscordGuild;
  source_channel?: DiscordChannel;
  url?: string;
}

export interface DiscordInvite {
  code: string;
  guild?: Partial<DiscordGuild>;
  channel: Partial<DiscordChannel>;
  inviter?: DiscordUser;
  target_type?: number;
  target_user?: DiscordUser;
  target_application?: Partial<DiscordApplication>;
  approximate_presence_count?: number;
  approximate_member_count?: number;
  expires_at?: string;
  stage_instance?: DiscordInviteStageInstance;
  guild_scheduled_event?: DiscordGuildScheduledEvent;
}

export interface DiscordPluginConfig {
  enableNotifications: boolean;
  notificationTypes: Array<'mentions' | 'direct-messages' | 'server-messages' | 'voice-events' | 'friend-requests'>;
  monitoredServers: string[];
  syncHistoryDays: number;
  enableRichPresence: boolean;
  autoJoinVoice: boolean;
  soundSettings: {
    enableSounds: boolean;
    messageSound: string;
    voiceSound: string;
  };
  privacySettings: {
    indexPrivateMessages: boolean;
    shareOnlineStatus: boolean;
  };
  botSettings: {
    enableBotCommands: boolean;
    botCommandPrefix: string;
  };
}

export interface DiscordAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope: string;
}

export interface DiscordApiResponse<T> {
  data?: T;
  error?: {
    code: number;
    message: string;
    errors?: any;
  };
  rateLimit?: {
    remaining: number;
    reset: number;
    resetAfter: number;
    bucket?: string;
    global: boolean;
  };
}

export interface DiscordSearchResult {
  id: string;
  title: string;
  description: string;
  url?: string;
  contentType: 'message' | 'channel' | 'server' | 'user' | 'file';
  serverId?: string;
  channelId?: string;
  authorId?: string;
  author?: DiscordUser;
  timestamp: Date;
  snippet?: string;
  highlights?: string[];
  score: number;
  metadata: Record<string, any>;
}

export interface DiscordRateLimitInfo {
  remaining: number;
  reset: Date;
  limit: number;
  bucket?: string;
  global: boolean;
  retryAfter?: number;
}

export interface DiscordWebSocketMessage {
  op: number; // Opcode
  d?: any; // Data
  s?: number; // Sequence number
  t?: string; // Event name
}

export interface DiscordAutomationTrigger {
  type: 'message-received' | 'mention-received' | 'voice-joined' | 'voice-left' | 'server-joined' | 'server-left' | 'reaction-added' | 'user-updated';
  serverId?: string;
  channelId?: string;
  userId?: string;
  keywords?: string[];
  conditions?: Record<string, any>;
}

export interface DiscordAutomationAction {
  type: 'send-message' | 'react-to-message' | 'join-voice' | 'leave-voice' | 'create-channel' | 'send-dm' | 'update-status' | 'kick-user' | 'ban-user';
  targetId?: string;
  message?: string;
  emoji?: string;
  templateData?: Record<string, any>;
  options?: Record<string, any>;
}

// Additional interfaces for completeness
export interface DiscordWelcomeScreen {
  description?: string;
  welcome_channels: DiscordWelcomeScreenChannel[];
}

export interface DiscordWelcomeScreenChannel {
  channel_id: string;
  description: string;
  emoji_id?: string;
  emoji_name?: string;
}

export interface DiscordSticker {
  id: string;
  pack_id?: string;
  name: string;
  description?: string;
  tags: string;
  type: number;
  format_type: number;
  available?: boolean;
  guild_id?: string;
  user?: DiscordUser;
  sort_value?: number;
}

export interface DiscordStickerItem {
  id: string;
  name: string;
  format_type: number;
}

export interface DiscordChannelMention {
  id: string;
  guild_id: string;
  type: DiscordChannelType;
  name: string;
}

export interface DiscordMessageActivity {
  type: number;
  party_id?: string;
}

export interface DiscordMessageReference {
  message_id?: string;
  channel_id?: string;
  guild_id?: string;
  fail_if_not_exists?: boolean;
}

export interface DiscordMessageInteraction {
  id: string;
  type: number;
  name: string;
  user: DiscordUser;
  member?: Partial<DiscordGuildMember>;
}

export interface DiscordComponent {
  type: number;
  style?: number;
  label?: string;
  emoji?: Partial<DiscordEmoji>;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  components?: DiscordComponent[];
  options?: DiscordSelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
}

export interface DiscordSelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: Partial<DiscordEmoji>;
  default?: boolean;
}

export interface DiscordRoleSubscriptionData {
  role_subscription_listing_id: string;
  tier_name: string;
  total_months_subscribed: number;
  is_renewal: boolean;
}

export interface DiscordResolvedData {
  users?: Record<string, DiscordUser>;
  members?: Record<string, Partial<DiscordGuildMember>>;
  roles?: Record<string, DiscordRole>;
  channels?: Record<string, Partial<DiscordChannel>>;
  messages?: Record<string, Partial<DiscordMessage>>;
  attachments?: Record<string, DiscordAttachment>;
}

export interface DiscordRoleTags {
  bot_id?: string;
  integration_id?: string;
  premium_subscriber?: null;
  subscription_listing_id?: string;
  available_for_purchase?: null;
  guild_connections?: null;
}

export interface DiscordForumTag {
  id: string;
  name: string;
  moderated: boolean;
  emoji_id?: string;
  emoji_name?: string;
}

export interface DiscordDefaultReaction {
  emoji_id?: string;
  emoji_name?: string;
}

export interface DiscordInviteStageInstance {
  members: Partial<DiscordGuildMember>[];
  participant_count: number;
  speaker_count: number;
  topic: string;
}

export interface DiscordGuildScheduledEvent {
  id: string;
  guild_id: string;
  channel_id?: string;
  creator_id?: string;
  name: string;
  description?: string;
  scheduled_start_time: string;
  scheduled_end_time?: string;
  privacy_level: number;
  status: number;
  entity_type: number;
  entity_id?: string;
  entity_metadata?: DiscordGuildScheduledEventEntityMetadata;
  creator?: DiscordUser;
  user_count?: number;
  image?: string;
}

export interface DiscordGuildScheduledEventEntityMetadata {
  location?: string;
}

// Bot-related interfaces
export interface DiscordBot {
  id: string;
  name: string;
  avatar?: string;
  discriminator: string;
  public: boolean;
  verified: boolean;
  commands?: DiscordBotCommand[];
}

export interface DiscordBotCommand {
  id: string;
  name: string;
  description: string;
  options?: DiscordBotCommandOption[];
  defaultPermission?: boolean;
  type: number;
  version: string;
}

export interface DiscordBotCommandOption {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  choices?: DiscordBotCommandOptionChoice[];
  options?: DiscordBotCommandOption[];
}

export interface DiscordBotCommandOptionChoice {
  name: string;
  value: string | number;
}

// Gateway events
export enum DiscordGatewayOpcode {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  PRESENCE_UPDATE = 3,
  VOICE_STATE_UPDATE = 4,
  RESUME = 6,
  RECONNECT = 7,
  REQUEST_GUILD_MEMBERS = 8,
  INVALID_SESSION = 9,
  HELLO = 10,
  HEARTBEAT_ACK = 11
}

export interface DiscordGatewayPayload {
  op: DiscordGatewayOpcode;
  d?: any;
  s?: number;
  t?: string;
}

// Voice-related interfaces
export interface DiscordVoiceRegion {
  id: string;
  name: string;
  optimal: boolean;
  deprecated: boolean;
  custom: boolean;
}

export interface DiscordVoiceServerUpdate {
  token: string;
  guild_id: string;
  endpoint?: string;
}

// Stage instances
export interface DiscordStageInstance {
  id: string;
  guild_id: string;
  channel_id: string;
  topic: string;
  privacy_level: number;
  discoverable_disabled: boolean;
  guild_scheduled_event_id?: string;
}