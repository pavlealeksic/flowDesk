/**
 * Comprehensive Notion API Types
 * Based on official Notion API v1 specification
 */

// Base types
export type NotionDate = string; // ISO 8601 format
export type NotionUUID = string;
export type NotionColor = 
  | 'default' | 'gray' | 'brown' | 'orange' | 'yellow' | 'green' 
  | 'blue' | 'purple' | 'pink' | 'red';

// User types
export interface NotionUser {
  object: 'user';
  id: NotionUUID;
  type: 'person' | 'bot';
  name?: string;
  avatar_url?: string;
  person?: {
    email: string;
  };
  bot?: {
    owner: {
      type: 'workspace';
      workspace: boolean;
    } | {
      type: 'user';
      user: NotionUser;
    };
    workspace_name?: string;
  };
}

// Parent types
export type NotionParent = 
  | { type: 'database_id'; database_id: NotionUUID }
  | { type: 'page_id'; page_id: NotionUUID }
  | { type: 'workspace'; workspace: true }
  | { type: 'block_id'; block_id: NotionUUID };

// Rich text types
export interface NotionRichTextText {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: NotionColor;
  };
  plain_text: string;
  href?: string | null;
}

export interface NotionRichTextMention {
  type: 'mention';
  mention: {
    type: 'user' | 'page' | 'database' | 'date' | 'link_preview' | 'template_mention';
    user?: NotionUser;
    page?: { id: NotionUUID };
    database?: { id: NotionUUID };
    date?: NotionDateValue;
    link_preview?: { url: string };
    template_mention?: {
      type: 'template_mention_date' | 'template_mention_user';
      template_mention_date?: 'today' | 'now';
      template_mention_user?: 'me';
    };
  };
  annotations: NotionRichTextText['annotations'];
  plain_text: string;
  href?: string | null;
}

export interface NotionRichTextEquation {
  type: 'equation';
  equation: {
    expression: string;
  };
  annotations: NotionRichTextText['annotations'];
  plain_text: string;
  href?: string | null;
}

export type NotionRichText = NotionRichTextText | NotionRichTextMention | NotionRichTextEquation;

// Date types
export interface NotionDateValue {
  start: NotionDate;
  end?: NotionDate | null;
  time_zone?: string | null;
}

// File types
export interface NotionFile {
  type: 'external' | 'file';
  external?: {
    url: string;
  };
  file?: {
    url: string;
    expiry_time: NotionDate;
  };
  name?: string;
}

// Icon and Cover types
export type NotionIcon = 
  | { type: 'emoji'; emoji: string }
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string; expiry_time: NotionDate } };

export type NotionCover = NotionFile;

// Property value types
export interface NotionTitleProperty {
  id: string;
  type: 'title';
  title: NotionRichText[];
}

export interface NotionRichTextProperty {
  id: string;
  type: 'rich_text';
  rich_text: NotionRichText[];
}

export interface NotionNumberProperty {
  id: string;
  type: 'number';
  number: number | null;
}

export interface NotionSelectProperty {
  id: string;
  type: 'select';
  select: {
    id: string;
    name: string;
    color: NotionColor;
  } | null;
}

export interface NotionMultiSelectProperty {
  id: string;
  type: 'multi_select';
  multi_select: Array<{
    id: string;
    name: string;
    color: NotionColor;
  }>;
}

export interface NotionDateProperty {
  id: string;
  type: 'date';
  date: NotionDateValue | null;
}

export interface NotionPeopleProperty {
  id: string;
  type: 'people';
  people: NotionUser[];
}

export interface NotionFilesProperty {
  id: string;
  type: 'files';
  files: NotionFile[];
}

export interface NotionCheckboxProperty {
  id: string;
  type: 'checkbox';
  checkbox: boolean;
}

export interface NotionUrlProperty {
  id: string;
  type: 'url';
  url: string | null;
}

export interface NotionEmailProperty {
  id: string;
  type: 'email';
  email: string | null;
}

export interface NotionPhoneNumberProperty {
  id: string;
  type: 'phone_number';
  phone_number: string | null;
}

export interface NotionFormulaProperty {
  id: string;
  type: 'formula';
  formula: {
    type: 'string' | 'number' | 'boolean' | 'date';
    string?: string | null;
    number?: number | null;
    boolean?: boolean | null;
    date?: NotionDateValue | null;
  };
}

export interface NotionRelationProperty {
  id: string;
  type: 'relation';
  relation: Array<{ id: NotionUUID }>;
  has_more?: boolean;
}

export interface NotionRollupProperty {
  id: string;
  type: 'rollup';
  rollup: {
    type: 'number' | 'date' | 'array' | 'unsupported' | 'incomplete';
    number?: number | null;
    date?: NotionDateValue | null;
    array?: NotionPropertyValue[];
    function: 'count' | 'count_values' | 'empty' | 'not_empty' | 'unique' | 'show_unique' | 'percent_empty' | 'percent_not_empty' | 'sum' | 'average' | 'median' | 'min' | 'max' | 'range' | 'earliest_date' | 'latest_date' | 'date_range' | 'checked' | 'unchecked' | 'percent_checked' | 'percent_unchecked' | 'show_original';
  };
}

export interface NotionCreatedTimeProperty {
  id: string;
  type: 'created_time';
  created_time: NotionDate;
}

export interface NotionCreatedByProperty {
  id: string;
  type: 'created_by';
  created_by: NotionUser;
}

export interface NotionLastEditedTimeProperty {
  id: string;
  type: 'last_edited_time';
  last_edited_time: NotionDate;
}

export interface NotionLastEditedByProperty {
  id: string;
  type: 'last_edited_by';
  last_edited_by: NotionUser;
}

export interface NotionStatusProperty {
  id: string;
  type: 'status';
  status: {
    id: string;
    name: string;
    color: NotionColor;
  } | null;
}

export type NotionPropertyValue = 
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionNumberProperty
  | NotionSelectProperty
  | NotionMultiSelectProperty
  | NotionDateProperty
  | NotionPeopleProperty
  | NotionFilesProperty
  | NotionCheckboxProperty
  | NotionUrlProperty
  | NotionEmailProperty
  | NotionPhoneNumberProperty
  | NotionFormulaProperty
  | NotionRelationProperty
  | NotionRollupProperty
  | NotionCreatedTimeProperty
  | NotionCreatedByProperty
  | NotionLastEditedTimeProperty
  | NotionLastEditedByProperty
  | NotionStatusProperty;

// Database property configurations
export interface NotionDatabaseProperty {
  id: string;
  name: string;
  type: NotionPropertyValue['type'];
  title?: {};
  rich_text?: {};
  number?: {
    format: 'number' | 'number_with_commas' | 'percent' | 'dollar' | 'canadian_dollar' | 'euro' | 'pound' | 'yen' | 'ruble' | 'rupee' | 'won' | 'yuan' | 'real' | 'lira' | 'rupiah' | 'franc' | 'hong_kong_dollar' | 'new_zealand_dollar' | 'krona' | 'norwegian_krone' | 'mexican_peso' | 'rand' | 'new_taiwan_dollar' | 'danish_krone' | 'zloty' | 'baht' | 'forint' | 'koruna' | 'shekel' | 'chilean_peso' | 'philippine_peso' | 'dirham' | 'colombian_peso' | 'riyal' | 'ringgit' | 'leu' | 'argentine_peso' | 'uruguayan_peso';
  };
  select?: {
    options: Array<{
      id: string;
      name: string;
      color: NotionColor;
    }>;
  };
  multi_select?: {
    options: Array<{
      id: string;
      name: string;
      color: NotionColor;
    }>;
  };
  date?: {};
  people?: {};
  files?: {};
  checkbox?: {};
  url?: {};
  email?: {};
  phone_number?: {};
  formula?: {
    expression: string;
  };
  relation?: {
    database_id: NotionUUID;
    type: 'single_property' | 'dual_property';
    single_property?: {};
    dual_property?: {
      synced_property_name: string;
      synced_property_id: string;
    };
  };
  rollup?: {
    rollup_property_name: string;
    relation_property_name: string;
    rollup_property_id: string;
    relation_property_id: string;
    function: NotionRollupProperty['rollup']['function'];
  };
  created_time?: {};
  created_by?: {};
  last_edited_time?: {};
  last_edited_by?: {};
  status?: {
    options: Array<{
      id: string;
      name: string;
      color: NotionColor;
    }>;
    groups: Array<{
      id: string;
      name: string;
      color: NotionColor;
      option_ids: string[];
    }>;
  };
}

// Database types
export interface NotionDatabase {
  object: 'database';
  id: NotionUUID;
  created_time: NotionDate;
  created_by: NotionUser;
  last_edited_time: NotionDate;
  last_edited_by: NotionUser;
  title: NotionRichText[];
  description: NotionRichText[];
  icon: NotionIcon | null;
  cover: NotionCover | null;
  properties: Record<string, NotionDatabaseProperty>;
  parent: NotionParent;
  url: string;
  archived: boolean;
  is_inline: boolean;
  public_url?: string | null;
}

// Page types
export interface NotionPage {
  object: 'page';
  id: NotionUUID;
  created_time: NotionDate;
  created_by: NotionUser;
  last_edited_time: NotionDate;
  last_edited_by: NotionUser;
  archived: boolean;
  icon: NotionIcon | null;
  cover: NotionCover | null;
  properties: Record<string, NotionPropertyValue>;
  parent: NotionParent;
  url: string;
  public_url?: string | null;
  in_trash?: boolean;
}

// Block types
export interface NotionBlockBase {
  object: 'block';
  id: NotionUUID;
  parent: NotionParent;
  type: string;
  created_time: NotionDate;
  created_by: NotionUser;
  last_edited_time: NotionDate;
  last_edited_by: NotionUser;
  archived: boolean;
  has_children: boolean;
  in_trash?: boolean;
}

export interface NotionParagraphBlock extends NotionBlockBase {
  type: 'paragraph';
  paragraph: {
    rich_text: NotionRichText[];
    color: NotionColor;
  };
}

export interface NotionHeadingBlock extends NotionBlockBase {
  type: 'heading_1' | 'heading_2' | 'heading_3';
  heading_1?: {
    rich_text: NotionRichText[];
    color: NotionColor;
    is_toggleable: boolean;
  };
  heading_2?: {
    rich_text: NotionRichText[];
    color: NotionColor;
    is_toggleable: boolean;
  };
  heading_3?: {
    rich_text: NotionRichText[];
    color: NotionColor;
    is_toggleable: boolean;
  };
}

export interface NotionBulletedListItemBlock extends NotionBlockBase {
  type: 'bulleted_list_item';
  bulleted_list_item: {
    rich_text: NotionRichText[];
    color: NotionColor;
  };
}

export interface NotionNumberedListItemBlock extends NotionBlockBase {
  type: 'numbered_list_item';
  numbered_list_item: {
    rich_text: NotionRichText[];
    color: NotionColor;
  };
}

export interface NotionToDoBlock extends NotionBlockBase {
  type: 'to_do';
  to_do: {
    rich_text: NotionRichText[];
    checked: boolean;
    color: NotionColor;
  };
}

export interface NotionToggleBlock extends NotionBlockBase {
  type: 'toggle';
  toggle: {
    rich_text: NotionRichText[];
    color: NotionColor;
  };
}

export interface NotionCodeBlock extends NotionBlockBase {
  type: 'code';
  code: {
    caption: NotionRichText[];
    rich_text: NotionRichText[];
    language: string;
  };
}

export interface NotionCalloutBlock extends NotionBlockBase {
  type: 'callout';
  callout: {
    rich_text: NotionRichText[];
    icon: NotionIcon | null;
    color: NotionColor;
  };
}

export interface NotionQuoteBlock extends NotionBlockBase {
  type: 'quote';
  quote: {
    rich_text: NotionRichText[];
    color: NotionColor;
  };
}

export interface NotionEquationBlock extends NotionBlockBase {
  type: 'equation';
  equation: {
    expression: string;
  };
}

export interface NotionDividerBlock extends NotionBlockBase {
  type: 'divider';
  divider: {};
}

export interface NotionImageBlock extends NotionBlockBase {
  type: 'image';
  image: NotionFile & {
    caption: NotionRichText[];
  };
}

export interface NotionVideoBlock extends NotionBlockBase {
  type: 'video';
  video: NotionFile & {
    caption: NotionRichText[];
  };
}

export interface NotionFileBlock extends NotionBlockBase {
  type: 'file';
  file: NotionFile & {
    caption: NotionRichText[];
  };
}

export interface NotionPdfBlock extends NotionBlockBase {
  type: 'pdf';
  pdf: NotionFile & {
    caption: NotionRichText[];
  };
}

export interface NotionBookmarkBlock extends NotionBlockBase {
  type: 'bookmark';
  bookmark: {
    caption: NotionRichText[];
    url: string;
  };
}

export interface NotionEmbedBlock extends NotionBlockBase {
  type: 'embed';
  embed: {
    caption: NotionRichText[];
    url: string;
  };
}

export interface NotionLinkPreviewBlock extends NotionBlockBase {
  type: 'link_preview';
  link_preview: {
    url: string;
  };
}

export interface NotionTableBlock extends NotionBlockBase {
  type: 'table';
  table: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
  };
}

export interface NotionTableRowBlock extends NotionBlockBase {
  type: 'table_row';
  table_row: {
    cells: NotionRichText[][];
  };
}

export interface NotionChildPageBlock extends NotionBlockBase {
  type: 'child_page';
  child_page: {
    title: string;
  };
}

export interface NotionChildDatabaseBlock extends NotionBlockBase {
  type: 'child_database';
  child_database: {
    title: string;
  };
}

export interface NotionColumnListBlock extends NotionBlockBase {
  type: 'column_list';
  column_list: {};
}

export interface NotionColumnBlock extends NotionBlockBase {
  type: 'column';
  column: {};
}

export interface NotionLinkToPageBlock extends NotionBlockBase {
  type: 'link_to_page';
  link_to_page: {
    type: 'page_id' | 'database_id';
    page_id?: NotionUUID;
    database_id?: NotionUUID;
  };
}

export interface NotionSyncedBlock extends NotionBlockBase {
  type: 'synced_block';
  synced_block: {
    synced_from: {
      type: 'block_id';
      block_id: NotionUUID;
    } | null;
  };
}

export interface NotionTemplateBlock extends NotionBlockBase {
  type: 'template';
  template: {
    rich_text: NotionRichText[];
  };
}

export interface NotionBreadcrumbBlock extends NotionBlockBase {
  type: 'breadcrumb';
  breadcrumb: {};
}

export interface NotionTableOfContentsBlock extends NotionBlockBase {
  type: 'table_of_contents';
  table_of_contents: {
    color: NotionColor;
  };
}

export type NotionBlock = 
  | NotionParagraphBlock
  | NotionHeadingBlock
  | NotionBulletedListItemBlock
  | NotionNumberedListItemBlock
  | NotionToDoBlock
  | NotionToggleBlock
  | NotionCodeBlock
  | NotionCalloutBlock
  | NotionQuoteBlock
  | NotionEquationBlock
  | NotionDividerBlock
  | NotionImageBlock
  | NotionVideoBlock
  | NotionFileBlock
  | NotionPdfBlock
  | NotionBookmarkBlock
  | NotionEmbedBlock
  | NotionLinkPreviewBlock
  | NotionTableBlock
  | NotionTableRowBlock
  | NotionChildPageBlock
  | NotionChildDatabaseBlock
  | NotionColumnListBlock
  | NotionColumnBlock
  | NotionLinkToPageBlock
  | NotionSyncedBlock
  | NotionTemplateBlock
  | NotionBreadcrumbBlock
  | NotionTableOfContentsBlock;

// API Response types
export interface NotionAPIResponse<T = any> {
  object: string;
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
  type?: string;
  page_or_database?: {};
  developer_survey?: string;
}

export interface NotionSearchResponse extends NotionAPIResponse<NotionPage | NotionDatabase> {
  object: 'list';
  results: (NotionPage | NotionDatabase)[];
}

export interface NotionDatabaseQueryResponse extends NotionAPIResponse<NotionPage> {
  object: 'list';
  results: NotionPage[];
}

export interface NotionBlockChildrenResponse extends NotionAPIResponse<NotionBlock> {
  object: 'list';
  results: NotionBlock[];
}

// Filter and Sort types
export interface NotionFilter {
  property: string;
  title?: {
    equals?: string;
    does_not_equal?: string;
    contains?: string;
    does_not_contain?: string;
    starts_with?: string;
    ends_with?: string;
    is_empty?: true;
    is_not_empty?: true;
  };
  rich_text?: NotionFilter['title'];
  number?: {
    equals?: number;
    does_not_equal?: number;
    greater_than?: number;
    less_than?: number;
    greater_than_or_equal_to?: number;
    less_than_or_equal_to?: number;
    is_empty?: true;
    is_not_empty?: true;
  };
  checkbox?: {
    equals?: boolean;
    does_not_equal?: boolean;
  };
  select?: {
    equals?: string;
    does_not_equal?: string;
    is_empty?: true;
    is_not_empty?: true;
  };
  multi_select?: {
    contains?: string;
    does_not_contain?: string;
    is_empty?: true;
    is_not_empty?: true;
  };
  status?: {
    equals?: string;
    does_not_equal?: string;
    is_empty?: true;
    is_not_empty?: true;
  };
  date?: {
    equals?: string;
    before?: string;
    after?: string;
    on_or_before?: string;
    on_or_after?: string;
    past_week?: {};
    past_month?: {};
    past_year?: {};
    this_week?: {};
    next_week?: {};
    next_month?: {};
    next_year?: {};
    is_empty?: true;
    is_not_empty?: true;
  };
  people?: {
    contains?: NotionUUID;
    does_not_contain?: NotionUUID;
    is_empty?: true;
    is_not_empty?: true;
  };
  files?: {
    is_empty?: true;
    is_not_empty?: true;
  };
  relation?: {
    contains?: NotionUUID;
    does_not_contain?: NotionUUID;
    is_empty?: true;
    is_not_empty?: true;
  };
  formula?: {
    string?: NotionFilter['title'];
    checkbox?: NotionFilter['checkbox'];
    number?: NotionFilter['number'];
    date?: NotionFilter['date'];
  };
  rollup?: {
    any?: NotionFilter;
    every?: NotionFilter;
    none?: NotionFilter;
    number?: NotionFilter['number'];
    date?: NotionFilter['date'];
  };
  created_time?: NotionFilter['date'];
  created_by?: NotionFilter['people'];
  last_edited_time?: NotionFilter['date'];
  last_edited_by?: NotionFilter['people'];
}

export interface NotionCompoundFilter {
  and?: NotionFilter[];
  or?: NotionFilter[];
}

export type NotionFilterCondition = NotionFilter | NotionCompoundFilter;

export interface NotionSort {
  property?: string;
  timestamp?: 'created_time' | 'last_edited_time';
  direction: 'ascending' | 'descending';
}

// Comment types
export interface NotionComment {
  object: 'comment';
  id: NotionUUID;
  parent: {
    type: 'page_id' | 'block_id';
    page_id?: NotionUUID;
    block_id?: NotionUUID;
  };
  discussion_id: NotionUUID;
  created_time: NotionDate;
  created_by: NotionUser;
  last_edited_time: NotionDate;
  rich_text: NotionRichText[];
}

// Plugin-specific types
export interface NotionPluginConfig {
  enableNotifications: boolean;
  notificationTypes: string[];
  syncInterval: number;
  indexContent: boolean;
  maxSearchResults: number;
  autoSyncDatabases: boolean;
  watchedDatabases: string[];
  defaultTemplate: string;
  quickCapture: {
    enabled: boolean;
    targetPage: string;
    includeTimestamp: boolean;
    includeSource: boolean;
  };
}

export interface NotionWorkspace {
  id: string;
  name: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: NotionUser;
  is_connected: boolean;
  last_sync?: number;
  pages: NotionPage[];
  databases: NotionDatabase[];
  bot_id?: string;
  workspace_icon?: string;
  workspace_name?: string;
}

export interface NotionPluginState {
  workspaces: NotionWorkspace[];
  activeWorkspace?: string;
  isConnecting: boolean;
  isAuthenticated: boolean;
  lastSync?: number;
  pageCache: Map<string, NotionPage>;
  databaseCache: Map<string, NotionDatabase>;
  blockCache: Map<string, NotionBlock[]>;
  searchIndex: Map<string, any>;
  watchedPages: Set<string>;
  watchedDatabases: Set<string>;
}

// Automation types
export interface NotionAutomationTrigger {
  type: 'page_updated' | 'page_created' | 'database_row_added' | 'database_row_updated' | 'comment_added' | 'reminder';
  databaseId?: string;
  pageId?: string;
  propertyName?: string;
  propertyValue?: any;
  schedule?: string; // For reminders
}

export interface NotionAutomationAction {
  type: 'create_page' | 'update_page' | 'create_database_entry' | 'update_database_entry' | 'add_comment' | 'send_notification';
  templateId?: string;
  pageId?: string;
  databaseId?: string;
  properties?: Record<string, any>;
  content?: string;
  title?: string;
  parent?: NotionParent;
}

// Search types
export interface NotionSearchQuery {
  query: string;
  filter?: {
    value: 'page' | 'database';
    property: 'object';
  };
  sort?: {
    direction: 'ascending' | 'descending';
    timestamp: 'last_edited_time';
  };
  start_cursor?: string;
  page_size?: number;
}

export interface NotionSearchResult {
  id: string;
  title: string;
  description?: string;
  url: string;
  icon?: string;
  thumbnail?: string;
  score: number;
  metadata: {
    type: 'page' | 'database';
    parentId?: string;
    parentType?: string;
    lastEditedTime: string;
    createdTime: string;
    createdBy: string;
    properties?: Record<string, any>;
  };
  contentType: string;
  provider: string;
  lastModified: Date;
}

// Template types
export interface NotionTemplate {
  id: string;
  name: string;
  description: string;
  type: 'page' | 'database';
  content: NotionBlock[];
  properties?: Record<string, NotionDatabaseProperty>;
  icon?: NotionIcon;
  cover?: NotionCover;
  variables?: Array<{
    name: string;
    type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
}

// Error types
export interface NotionError extends Error {
  code: string;
  status?: number;
  object?: 'error';
  message: string;
}

export class NotionAPIError extends Error implements NotionError {
  code: string;
  status?: number;
  object: 'error' = 'error';

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = 'NotionAPIError';
    this.code = code;
    this.status = status;
  }
}

// Rate limiting types
export interface NotionRateLimit {
  retryAfter?: number;
  limit?: number;
  remaining?: number;
  reset?: number;
}

// Webhook types (for future use)
export interface NotionWebhookPayload {
  object: 'event';
  id: NotionUUID;
  created_time: NotionDate;
  event_type: 'page.created' | 'page.updated' | 'database.created' | 'database.updated';
  parent_id: NotionUUID;
  workspace_id: NotionUUID;
}

// Export types
export interface NotionExportOptions {
  format: 'markdown' | 'pdf' | 'html' | 'csv' | 'json';
  includeSubpages: boolean;
  flattenNesting: boolean;
  exportAssets: boolean;
}

// Import types
export interface NotionImportOptions {
  format: 'markdown' | 'html' | 'csv' | 'json';
  parentId: NotionUUID;
  parentType: 'page' | 'database';
  createSubpages: boolean;
  preserveFormatting: boolean;
}

// Sync types
export interface NotionSyncOptions {
  incremental: boolean;
  maxPages: number;
  includeArchived: boolean;
  syncBlocks: boolean;
  syncComments: boolean;
}

export interface NotionSyncResult {
  pagesUpdated: number;
  databasesUpdated: number;
  blocksUpdated: number;
  errors: NotionError[];
  duration: number;
  lastCursor?: string;
}