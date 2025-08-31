/**
 * Microsoft Teams Plugin Types
 * 
 * Comprehensive types for Microsoft Teams Graph API integration
 */

export interface TeamsUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  officeLocation?: string;
  preferredLanguage?: string;
  presence?: TeamsPresence;
}

export interface TeamsPresence {
  id: string;
  availability: 'Available' | 'AvailableIdle' | 'Away' | 'BeRightBack' | 'Busy' | 'BusyIdle' | 'DoNotDisturb' | 'Offline' | 'PresenceUnknown';
  activity: string;
  statusMessage?: {
    message: {
      content: string;
      contentType: 'text' | 'html';
    };
    publishedDateTime?: Date;
    expiryDateTime?: Date;
  };
}

export interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
  internalId: string;
  classification?: string;
  specialization?: 'none' | 'educationStandard' | 'educationClass' | 'educationProfessionalLearningCommunity' | 'educationStaff' | 'healthcareStandard' | 'healthcareCareCoordination';
  visibility?: 'private' | 'public';
  webUrl?: string;
  isArchived?: boolean;
  isMembershipLimitedToOwners?: boolean;
  memberSettings?: {
    allowCreatePrivateChannels?: boolean;
    allowCreateUpdateChannels?: boolean;
    allowDeleteChannels?: boolean;
    allowAddRemoveApps?: boolean;
    allowCreateUpdateRemoveTabs?: boolean;
    allowCreateUpdateRemoveConnectors?: boolean;
  };
  guestSettings?: {
    allowCreateUpdateChannels?: boolean;
    allowDeleteChannels?: boolean;
  };
  messagingSettings?: {
    allowUserEditMessages?: boolean;
    allowUserDeleteMessages?: boolean;
    allowOwnerDeleteMessages?: boolean;
    allowTeamMentions?: boolean;
    allowChannelMentions?: boolean;
  };
  funSettings?: {
    allowGiphy?: boolean;
    giphyContentRating?: 'strict' | 'moderate';
    allowStickersAndMemes?: boolean;
    allowCustomMemes?: boolean;
  };
  discoverySettings?: {
    showInTeamsSearchAndSuggestions?: boolean;
  };
}

export interface TeamsChannel {
  id: string;
  createdDateTime: Date;
  displayName: string;
  description?: string;
  isFavoriteByDefault?: boolean;
  email?: string;
  webUrl?: string;
  membershipType?: 'standard' | 'private' | 'unknownFutureValue';
  moderationSettings?: {
    userNewMessageRestriction?: 'everyone' | 'everyoneExceptGuests' | 'moderators' | 'unknownFutureValue';
    replyRestriction?: 'everyone' | 'authorAndModerators' | 'unknownFutureValue';
    allowNewMessageFromBots?: boolean;
    allowNewMessageFromConnectors?: boolean;
  };
  teamId: string;
  unreadMessageCount?: number;
  lastActivityDateTime?: Date;
}

export interface TeamsMessage {
  id: string;
  replyToId?: string;
  etag?: string;
  messageType: 'message' | 'chatMessage' | 'typing' | 'unknownFutureValue' | 'systemEventMessage';
  createdDateTime: Date;
  lastModifiedDateTime?: Date;
  lastEditedDateTime?: Date;
  deletedDateTime?: Date;
  subject?: string;
  summary?: string;
  chatId?: string;
  channelIdentity?: {
    teamId?: string;
    channelId?: string;
  };
  importance: 'normal' | 'high' | 'urgent' | 'unknownFutureValue';
  policyViolation?: any;
  eventDetail?: any;
  from: {
    application?: any;
    device?: any;
    conversation?: any;
    user?: TeamsUser;
  };
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  attachments?: TeamsMessageAttachment[];
  mentions?: TeamsMention[];
  reactions?: TeamsMessageReaction[];
  replies?: TeamsMessage[];
  hostedContents?: any[];
}

export interface TeamsMessageAttachment {
  id?: string;
  contentType?: string;
  contentUrl?: string;
  content?: string;
  name?: string;
  thumbnailUrl?: string;
  teamsAppId?: string;
}

export interface TeamsMention {
  id: number;
  mentionText: string;
  mentioned: {
    application?: any;
    device?: any;
    conversation?: any;
    user?: TeamsUser;
  };
}

export interface TeamsMessageReaction {
  reactionType: string;
  user: TeamsUser;
  createdDateTime: Date;
}

export interface TeamsChat {
  id: string;
  topic?: string;
  createdDateTime: Date;
  lastUpdatedDateTime: Date;
  chatType: 'oneOnOne' | 'group' | 'meeting' | 'unknownFutureValue';
  webUrl?: string;
  tenantId?: string;
  onlineMeetingInfo?: {
    calendarEventId?: string;
    joinWebUrl?: string;
    organizer?: TeamsUser;
  };
  viewpoint?: {
    isHidden?: boolean;
    lastMessageReadDateTime?: Date;
  };
  members?: TeamsChatMember[];
  messages?: TeamsMessage[];
  installedApps?: any[];
  permissionGrants?: any[];
  operations?: any[];
  tabs?: any[];
  pinnedMessages?: any[];
}

export interface TeamsChatMember {
  id?: string;
  roles?: string[];
  displayName?: string;
  visibleHistoryStartDateTime?: Date;
  userId?: string;
  email?: string;
  tenantId?: string;
}

export interface TeamsOnlineMeeting {
  id: string;
  creationDateTime: Date;
  startDateTime: Date;
  endDateTime: Date;
  joinWebUrl: string;
  subject: string;
  isBroadcast?: boolean;
  autoAdmittedUsers: 'everyoneInCompany' | 'everyone' | 'unknownFutureValue';
  outerMeetingAutoAdmittedUsers?: 'everyoneInCompany' | 'everyone' | 'unknownFutureValue';
  participantInfo?: {
    organizer?: {
      upn?: string;
      role?: 'attendee' | 'presenter' | 'producer' | 'unknownFutureValue';
      identity?: {
        application?: any;
        device?: any;
        user?: TeamsUser;
      };
    };
    attendees?: Array<{
      upn?: string;
      role?: 'attendee' | 'presenter' | 'producer' | 'unknownFutureValue';
      identity?: {
        application?: any;
        device?: any;
        user?: TeamsUser;
      };
    }>;
  };
  audioConferencing?: {
    tollNumber?: string;
    tollFreeNumber?: string;
    conferenceId?: string;
    dialinUrl?: string;
  };
  chatInfo?: {
    threadId?: string;
    messageId?: string;
    replyChainMessageId?: string;
  };
  videoTeleconferenceId?: string;
  externalId?: string;
  joinMeetingIdSettings?: {
    isPasscodeRequired?: boolean;
    joinMeetingId?: string;
    passcode?: string;
  };
  lobbyBypassSettings?: {
    scope?: 'organizer' | 'organization' | 'organizationAndFederated' | 'everyone' | 'unknownFutureValue';
    isDialInBypassEnabled?: boolean;
  };
  allowedPresenters?: 'everyone' | 'organization' | 'roleIsPresenter' | 'organizer' | 'unknownFutureValue';
  allowMeetingChat?: 'enabled' | 'disabled' | 'limited' | 'unknownFutureValue';
  allowTeamworkReactions?: boolean;
  attendeeReport?: any;
  broadcastSettings?: any;
  capabilities?: string[];
  recordAutomatically?: boolean;
  allowRecording?: boolean;
  allowTranscription?: boolean;
  meetingAttendanceReport?: any;
}

export interface TeamsCalendarEvent {
  id: string;
  createdDateTime: Date;
  lastModifiedDateTime: Date;
  changeKey: string;
  categories: string[];
  transactionId?: string;
  originalStartTimeZone?: string;
  originalEndTimeZone?: string;
  iCalUId: string;
  reminderMinutesBeforeStart?: number;
  isReminderOn?: boolean;
  hasAttachments?: boolean;
  subject?: string;
  bodyPreview?: string;
  importance?: 'low' | 'normal' | 'high';
  sensitivity?: 'normal' | 'personal' | 'private' | 'confidential';
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOrganizer?: boolean;
  responseRequested?: boolean;
  seriesMasterId?: string;
  showAs?: 'unknown' | 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere';
  type?: 'singleInstance' | 'occurrence' | 'exception' | 'seriesMaster';
  webLink?: string;
  onlineMeetingUrl?: string;
  isOnlineMeeting?: boolean;
  onlineMeetingProvider?: 'unknown' | 'teamsForBusiness' | 'skypeForBusiness' | 'skypeForConsumer';
  allowNewTimeProposals?: boolean;
  occurrenceId?: string;
  isDraft?: boolean;
  hideAttendees?: boolean;
  responseStatus?: {
    response?: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
    time?: Date;
  };
  body?: {
    contentType?: 'text' | 'html';
    content?: string;
  };
  start?: {
    dateTime: Date;
    timeZone: string;
  };
  end?: {
    dateTime: Date;
    timeZone: string;
  };
  location?: {
    displayName?: string;
    locationType?: 'default' | 'conferenceRoom' | 'homeAddress' | 'businessAddress' | 'geoCoordinates' | 'streetAddress' | 'hotel' | 'restaurant' | 'localBusiness' | 'postalAddress';
    uniqueId?: string;
    uniqueIdType?: 'unknown' | 'locationStore' | 'directory' | 'private' | 'bing';
    address?: {
      type?: 'unknown' | 'home' | 'business' | 'other';
      postOfficeBox?: string;
      street?: string;
      city?: string;
      state?: string;
      countryOrRegion?: string;
      postalCode?: string;
    };
    coordinates?: {
      altitude?: number;
      latitude?: number;
      longitude?: number;
      accuracy?: number;
      altitudeAccuracy?: number;
    };
  };
  locations?: any[];
  recurrence?: any;
  attendees?: Array<{
    type?: 'required' | 'optional' | 'resource';
    status?: {
      response?: 'none' | 'organizer' | 'tentativelyAccepted' | 'accepted' | 'declined' | 'notResponded';
      time?: Date;
    };
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  onlineMeeting?: TeamsOnlineMeeting;
  calendar?: any;
}

export interface TeamsNotification {
  id: string;
  subscriptionId: string;
  subscriptionExpirationDateTime: Date;
  tenantId?: string;
  clientState?: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData?: {
    id?: string;
    '@odata.type'?: string;
    '@odata.id'?: string;
  };
  encryptedContent?: {
    data?: string;
    dataSignature?: string;
    dataKey?: string;
    encryptionCertificateId?: string;
    encryptionCertificateThumbprint?: string;
  };
}

export interface TeamsSubscription {
  id: string;
  resource: string;
  changeType: string;
  clientState?: string;
  notificationUrl: string;
  lifecycleNotificationUrl?: string;
  expirationDateTime: Date;
  creatorId?: string;
  includeResourceData?: boolean;
  latestSupportedTlsVersion?: '1.0' | '1.1' | '1.2' | '1.3';
  encryptionCertificate?: string;
  encryptionCertificateId?: string;
  applicationId?: string;
  createdDateTime?: Date;
}

export interface TeamsPluginConfig {
  enableNotifications: boolean;
  notificationTypes: Array<'mentions' | 'direct-messages' | 'channel-messages' | 'meeting-invites' | 'meeting-started'>;
  autoJoinMeetings: boolean;
  syncChannels: string[];
  syncHistoryDays: number;
  enablePresence: boolean;
  customStatus: {
    syncWithCalendar: boolean;
    busyMessage: string;
    awayAfterMinutes: number;
  };
  meetingSettings: {
    defaultCamera: boolean;
    defaultMicrophone: boolean;
    showMeetingPreview: boolean;
  };
}

export interface TeamsAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: string;
  scope: string;
  idToken?: string;
}

export interface TeamsApiResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
  value?: T[];
  error?: {
    code: string;
    message: string;
    innerError?: {
      date: string;
      'request-id': string;
      'client-request-id': string;
    };
  };
}

export interface TeamsSearchResult {
  id: string;
  title: string;
  description: string;
  url?: string;
  contentType: 'message' | 'channel' | 'team' | 'chat' | 'meeting' | 'file';
  teamId?: string;
  channelId?: string;
  chatId?: string;
  messageId?: string;
  author?: TeamsUser;
  timestamp: Date;
  snippet?: string;
  highlights?: string[];
  score: number;
  metadata: Record<string, any>;
}

export interface TeamsRateLimitInfo {
  remaining: number;
  resetTime: Date;
  limit: number;
  retryAfter?: number;
}

export interface TeamsWebSocketMessage {
  type: 'message' | 'presence' | 'meeting' | 'subscription' | 'error';
  data: any;
  timestamp: Date;
  subscriptionId?: string;
}

export interface TeamsAutomationTrigger {
  type: 'message-received' | 'mention-received' | 'meeting-started' | 'meeting-ended' | 'channel-created' | 'team-created' | 'presence-changed';
  teamId?: string;
  channelId?: string;
  chatId?: string;
  userId?: string;
  keywords?: string[];
  conditions?: Record<string, any>;
}

export interface TeamsAutomationAction {
  type: 'send-message' | 'create-meeting' | 'update-presence' | 'create-channel' | 'add-member' | 'send-notification';
  targetId?: string; // team, channel, or chat ID
  message?: string;
  templateData?: Record<string, any>;
  options?: Record<string, any>;
}

export interface TeamsFile {
  id: string;
  name: string;
  size: number;
  createdDateTime: Date;
  lastModifiedDateTime: Date;
  webUrl: string;
  downloadUrl?: string;
  mimeType?: string;
  file?: {
    mimeType: string;
    processingMetadata?: boolean;
  };
  folder?: {
    childCount?: number;
  };
  image?: {
    width?: number;
    height?: number;
  };
  parentReference?: {
    driveId: string;
    driveType: string;
    id: string;
    name?: string;
    path?: string;
    shareId?: string;
    sharepointIds?: {
      listId?: string;
      listItemId?: string;
      listItemUniqueId?: string;
      siteId?: string;
      siteUrl?: string;
      tenantId?: string;
      webId?: string;
    };
    siteId?: string;
  };
  shared?: {
    effectiveRoles?: string[];
    owner?: TeamsUser;
    scope?: string;
    sharedDateTime?: Date;
  };
  createdBy?: {
    application?: any;
    device?: any;
    user?: TeamsUser;
  };
  lastModifiedBy?: {
    application?: any;
    device?: any;
    user?: TeamsUser;
  };
}

export interface TeamsApp {
  id: string;
  externalId: string;
  displayName: string;
  distributionMethod: 'store' | 'organization' | 'sideloaded' | 'unknownFutureValue';
  appDefinitions: Array<{
    id: string;
    teamsAppId: string;
    azureADAppId?: string;
    displayName: string;
    version: string;
    requiredResourceSpecificApplicationPermissions?: string[];
    publishingState?: 'submitted' | 'rejected' | 'published' | 'unknownFutureValue';
    shortdescription?: string;
    description?: string;
    lastModifiedDateTime?: Date;
    createdBy?: {
      application?: any;
      device?: any;
      user?: TeamsUser;
    };
  }>;
}