/**
 * Microsoft Teams Plugin Automation Script
 * 
 * Handles automation triggers and actions for Microsoft Teams integration
 */

import { TeamsPlugin } from './TeamsPlugin';

let teamsPlugin = null;

/**
 * Initialize automation system
 */
async function initializeAutomation(api) {
  try {
    if (!teamsPlugin) {
      teamsPlugin = new TeamsPlugin(api);
      await teamsPlugin.initialize();
    }

    // Register all automation triggers
    registerTriggers(api);
    
    // Register all automation actions
    registerActions(api);
    
    // Set up event listeners for real-time automation
    setupRealtimeAutomation(api);
    
    api.logger.info('Teams automation system initialized');
  } catch (error) {
    api.logger.error('Failed to initialize Teams automation:', error);
    throw error;
  }
}

/**
 * Register automation triggers
 */
function registerTriggers(api) {
  // Message received trigger
  api.automation.registerTrigger({
    id: 'teams-message-received',
    name: 'Teams Message Received',
    description: 'Triggered when a new message is received in Microsoft Teams',
    category: 'communication',
    configSchema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          title: 'Team ID',
          description: 'Specific team to monitor (leave empty for all teams)'
        },
        channelId: {
          type: 'string',
          title: 'Channel ID', 
          description: 'Specific channel to monitor (leave empty for all channels)'
        },
        keywords: {
          type: 'array',
          title: 'Keywords',
          description: 'Trigger only when message contains these keywords',
          items: { type: 'string' },
          default: []
        },
        fromUsers: {
          type: 'array',
          title: 'From Users',
          description: 'Trigger only for messages from specific users (user IDs)',
          items: { type: 'string' },
          default: []
        },
        messageTypes: {
          type: 'array',
          title: 'Message Types',
          description: 'Types of messages to monitor',
          items: {
            type: 'string',
            enum: ['message', 'systemEventMessage', 'chatMessage']
          },
          default: ['message', 'chatMessage']
        },
        includeReplies: {
          type: 'boolean',
          title: 'Include Replies',
          description: 'Also trigger for reply messages',
          default: true
        }
      }
    },
    handler: async (config, context) => {
      return await handleMessageReceivedTrigger(api, config, context);
    }
  });

  // Mention received trigger
  api.automation.registerTrigger({
    id: 'teams-mention-received',
    name: 'Teams Mention Received',
    description: 'Triggered when you are mentioned in Microsoft Teams',
    category: 'communication',
    configSchema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          title: 'Team ID',
          description: 'Specific team to monitor (leave empty for all teams)'
        },
        channelId: {
          type: 'string',
          title: 'Channel ID',
          description: 'Specific channel to monitor (leave empty for all channels)'
        },
        mentionTypes: {
          type: 'array',
          title: 'Mention Types',
          description: 'Types of mentions to trigger on',
          items: {
            type: 'string',
            enum: ['user', 'team', 'channel']
          },
          default: ['user']
        }
      }
    },
    handler: async (config, context) => {
      return await handleMentionReceivedTrigger(api, config, context);
    }
  });

  // Meeting started trigger
  api.automation.registerTrigger({
    id: 'teams-meeting-started',
    name: 'Teams Meeting Started',
    description: 'Triggered when a Microsoft Teams meeting starts',
    category: 'meetings',
    configSchema: {
      type: 'object',
      properties: {
        organizedByMe: {
          type: 'boolean',
          title: 'Only My Meetings',
          description: 'Trigger only for meetings organized by me',
          default: false
        },
        attendedByMe: {
          type: 'boolean',
          title: 'Only My Attended Meetings',
          description: 'Trigger only for meetings I am attending',
          default: true
        },
        minutesBefore: {
          type: 'number',
          title: 'Minutes Before Start',
          description: 'Trigger N minutes before meeting starts',
          minimum: 0,
          maximum: 60,
          default: 5
        }
      }
    },
    handler: async (config, context) => {
      return await handleMeetingStartedTrigger(api, config, context);
    }
  });

  // Presence changed trigger
  api.automation.registerTrigger({
    id: 'teams-presence-changed',
    name: 'Teams Presence Changed',
    description: 'Triggered when your Teams presence status changes',
    category: 'status',
    configSchema: {
      type: 'object',
      properties: {
        fromStatus: {
          type: 'array',
          title: 'From Status',
          description: 'Trigger when changing from these statuses',
          items: {
            type: 'string',
            enum: ['Available', 'Busy', 'DoNotDisturb', 'BeRightBack', 'Away', 'Offline']
          },
          default: []
        },
        toStatus: {
          type: 'array',
          title: 'To Status',
          description: 'Trigger when changing to these statuses',
          items: {
            type: 'string',
            enum: ['Available', 'Busy', 'DoNotDisturb', 'BeRightBack', 'Away', 'Offline']
          },
          default: []
        }
      }
    },
    handler: async (config, context) => {
      return await handlePresenceChangedTrigger(api, config, context);
    }
  });

  // Team created trigger
  api.automation.registerTrigger({
    id: 'teams-team-created',
    name: 'Teams Team Created',
    description: 'Triggered when a new team is created or you join a team',
    category: 'teams',
    configSchema: {
      type: 'object',
      properties: {
        visibility: {
          type: 'array',
          title: 'Team Visibility',
          description: 'Trigger for teams with specific visibility',
          items: {
            type: 'string',
            enum: ['public', 'private']
          },
          default: ['public', 'private']
        }
      }
    },
    handler: async (config, context) => {
      return await handleTeamCreatedTrigger(api, config, context);
    }
  });

  // Channel created trigger
  api.automation.registerTrigger({
    id: 'teams-channel-created',
    name: 'Teams Channel Created',
    description: 'Triggered when a new channel is created in a team',
    category: 'teams',
    configSchema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          title: 'Team ID',
          description: 'Specific team to monitor (leave empty for all teams)'
        },
        membershipType: {
          type: 'array',
          title: 'Channel Type',
          description: 'Types of channels to monitor',
          items: {
            type: 'string',
            enum: ['standard', 'private']
          },
          default: ['standard', 'private']
        }
      }
    },
    handler: async (config, context) => {
      return await handleChannelCreatedTrigger(api, config, context);
    }
  });
}

/**
 * Register automation actions
 */
function registerActions(api) {
  // Send message action
  api.automation.registerAction({
    id: 'teams-send-message',
    name: 'Send Teams Message',
    description: 'Send a message to a Microsoft Teams channel or chat',
    category: 'communication',
    configSchema: {
      type: 'object',
      properties: {
        targetType: {
          type: 'string',
          title: 'Target Type',
          enum: ['channel', 'chat'],
          default: 'channel'
        },
        targetId: {
          type: 'string',
          title: 'Target ID',
          description: 'Channel ID or Chat ID to send message to'
        },
        message: {
          type: 'string',
          title: 'Message',
          description: 'Message content (supports variables like {{user}}, {{date}}, {{trigger.data.subject}})'
        },
        messageType: {
          type: 'string',
          title: 'Message Type',
          enum: ['text', 'html'],
          default: 'text'
        },
        urgent: {
          type: 'boolean',
          title: 'Mark as Urgent',
          description: 'Mark message as urgent/important',
          default: false
        }
      },
      required: ['targetType', 'targetId', 'message']
    },
    handler: async (config, context) => {
      return await handleSendMessageAction(api, config, context);
    }
  });

  // Create meeting action
  api.automation.registerAction({
    id: 'teams-create-meeting',
    name: 'Create Teams Meeting',
    description: 'Create a new Microsoft Teams meeting',
    category: 'meetings',
    configSchema: {
      type: 'object',
      properties: {
        subject: {
          type: 'string',
          title: 'Subject',
          description: 'Meeting subject (supports variables)'
        },
        startDateTime: {
          type: 'string',
          title: 'Start Date/Time',
          description: 'Meeting start time (ISO format or relative like "+1h")',
          default: 'now'
        },
        endDateTime: {
          type: 'string',
          title: 'End Date/Time',
          description: 'Meeting end time (ISO format or relative like "+2h")',
          default: '+1h'
        },
        attendees: {
          type: 'array',
          title: 'Attendees',
          description: 'List of attendee email addresses',
          items: { type: 'string', format: 'email' },
          default: []
        },
        allowPstn: {
          type: 'boolean',
          title: 'Allow Phone Join',
          description: 'Allow attendees to join via phone',
          default: true
        },
        isRecorded: {
          type: 'boolean',
          title: 'Auto Record',
          description: 'Automatically record the meeting',
          default: false
        }
      },
      required: ['subject']
    },
    handler: async (config, context) => {
      return await handleCreateMeetingAction(api, config, context);
    }
  });

  // Update presence action
  api.automation.registerAction({
    id: 'teams-update-presence',
    name: 'Update Teams Presence',
    description: 'Update your Microsoft Teams presence status',
    category: 'status',
    configSchema: {
      type: 'object',
      properties: {
        availability: {
          type: 'string',
          title: 'Availability',
          enum: ['Available', 'Busy', 'DoNotDisturb', 'BeRightBack', 'Away'],
          default: 'Available'
        },
        activity: {
          type: 'string',
          title: 'Activity',
          description: 'Activity description (supports variables)'
        },
        statusMessage: {
          type: 'string',
          title: 'Status Message',
          description: 'Custom status message (supports variables)'
        },
        expirationMinutes: {
          type: 'number',
          title: 'Expiration (minutes)',
          description: 'How long to keep this status (0 for permanent)',
          minimum: 0,
          maximum: 1440,
          default: 0
        }
      },
      required: ['availability', 'activity']
    },
    handler: async (config, context) => {
      return await handleUpdatePresenceAction(api, config, context);
    }
  });

  // Add team member action
  api.automation.registerAction({
    id: 'teams-add-member',
    name: 'Add Teams Member',
    description: 'Add a member to a Microsoft Teams team',
    category: 'teams',
    configSchema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          title: 'Team ID',
          description: 'ID of the team to add member to'
        },
        userEmail: {
          type: 'string',
          title: 'User Email',
          description: 'Email address of user to add (supports variables)',
          format: 'email'
        },
        role: {
          type: 'string',
          title: 'Role',
          enum: ['member', 'owner'],
          default: 'member'
        }
      },
      required: ['teamId', 'userEmail']
    },
    handler: async (config, context) => {
      return await handleAddMemberAction(api, config, context);
    }
  });

  // Create channel action
  api.automation.registerAction({
    id: 'teams-create-channel',
    name: 'Create Teams Channel',
    description: 'Create a new channel in a Microsoft Teams team',
    category: 'teams',
    configSchema: {
      type: 'object',
      properties: {
        teamId: {
          type: 'string',
          title: 'Team ID',
          description: 'ID of the team to create channel in'
        },
        displayName: {
          type: 'string',
          title: 'Channel Name',
          description: 'Name of the new channel (supports variables)'
        },
        description: {
          type: 'string',
          title: 'Description',
          description: 'Channel description (supports variables)'
        },
        membershipType: {
          type: 'string',
          title: 'Channel Type',
          enum: ['standard', 'private'],
          default: 'standard'
        }
      },
      required: ['teamId', 'displayName']
    },
    handler: async (config, context) => {
      return await handleCreateChannelAction(api, config, context);
    }
  });
}

/**
 * Set up real-time automation event listeners
 */
function setupRealtimeAutomation(api) {
  // Listen for Teams events and trigger automations
  api.events.on('teams-message-received', async (data) => {
    await api.automation.execute('teams-message-received', data);
  });

  api.events.on('teams-mention-received', async (data) => {
    await api.automation.execute('teams-mention-received', data);
  });

  api.events.on('teams-meeting-started', async (data) => {
    await api.automation.execute('teams-meeting-started', data);
  });

  api.events.on('teams-presence-changed', async (data) => {
    await api.automation.execute('teams-presence-changed', data);
  });

  api.events.on('teams-team-created', async (data) => {
    await api.automation.execute('teams-team-created', data);
  });

  api.events.on('teams-channel-created', async (data) => {
    await api.automation.execute('teams-channel-created', data);
  });
}

/**
 * Trigger Handlers
 */
async function handleMessageReceivedTrigger(api, config, context) {
  const message = context.data;
  
  // Check team filter
  if (config.teamId && message.channelIdentity?.teamId !== config.teamId) {
    return false;
  }
  
  // Check channel filter
  if (config.channelId && message.channelIdentity?.channelId !== config.channelId) {
    return false;
  }
  
  // Check keywords
  if (config.keywords && config.keywords.length > 0) {
    const messageText = message.body.content.toLowerCase();
    const hasKeyword = config.keywords.some(keyword => 
      messageText.includes(keyword.toLowerCase())
    );
    if (!hasKeyword) {
      return false;
    }
  }
  
  // Check from users
  if (config.fromUsers && config.fromUsers.length > 0) {
    if (!config.fromUsers.includes(message.from.user?.id)) {
      return false;
    }
  }
  
  // Check message types
  if (config.messageTypes && config.messageTypes.length > 0) {
    if (!config.messageTypes.includes(message.messageType)) {
      return false;
    }
  }
  
  // Check if replies are included
  if (!config.includeReplies && message.replyToId) {
    return false;
  }
  
  return true;
}

async function handleMentionReceivedTrigger(api, config, context) {
  const message = context.data;
  
  // Check if message has mentions
  if (!message.mentions || message.mentions.length === 0) {
    return false;
  }
  
  // Get current user
  const currentUser = await teamsPlugin.getCurrentUser();
  
  // Check if current user is mentioned
  const isMentioned = message.mentions.some(mention => {
    if (config.mentionTypes.includes('user') && mention.mentioned.user?.id === currentUser.id) {
      return true;
    }
    // Additional mention type checks can be added here
    return false;
  });
  
  if (!isMentioned) {
    return false;
  }
  
  // Check team/channel filters
  if (config.teamId && message.channelIdentity?.teamId !== config.teamId) {
    return false;
  }
  
  if (config.channelId && message.channelIdentity?.channelId !== config.channelId) {
    return false;
  }
  
  return true;
}

async function handleMeetingStartedTrigger(api, config, context) {
  const meeting = context.data;
  const now = new Date();
  const startTime = new Date(meeting.startDateTime);
  
  // Check if meeting should trigger based on timing
  const timeUntilMeeting = startTime.getTime() - now.getTime();
  const triggerTime = (config.minutesBefore || 5) * 60 * 1000;
  
  if (Math.abs(timeUntilMeeting - triggerTime) > 60000) { // 1 minute tolerance
    return false;
  }
  
  // Check if organized by me
  if (config.organizedByMe) {
    const currentUser = await teamsPlugin.getCurrentUser();
    if (meeting.organizer?.emailAddress?.address !== currentUser.mail) {
      return false;
    }
  }
  
  // Check if attended by me
  if (config.attendedByMe) {
    const currentUser = await teamsPlugin.getCurrentUser();
    const isAttendee = meeting.attendees?.some(attendee => 
      attendee.emailAddress?.address === currentUser.mail
    );
    if (!isAttendee) {
      return false;
    }
  }
  
  return true;
}

async function handlePresenceChangedTrigger(api, config, context) {
  const { previousPresence, currentPresence } = context.data;
  
  // Check from status filter
  if (config.fromStatus && config.fromStatus.length > 0) {
    if (!config.fromStatus.includes(previousPresence?.availability)) {
      return false;
    }
  }
  
  // Check to status filter
  if (config.toStatus && config.toStatus.length > 0) {
    if (!config.toStatus.includes(currentPresence?.availability)) {
      return false;
    }
  }
  
  return true;
}

async function handleTeamCreatedTrigger(api, config, context) {
  const team = context.data;
  
  // Check visibility filter
  if (config.visibility && config.visibility.length > 0) {
    if (!config.visibility.includes(team.visibility)) {
      return false;
    }
  }
  
  return true;
}

async function handleChannelCreatedTrigger(api, config, context) {
  const channel = context.data;
  
  // Check team filter
  if (config.teamId && channel.teamId !== config.teamId) {
    return false;
  }
  
  // Check membership type filter
  if (config.membershipType && config.membershipType.length > 0) {
    if (!config.membershipType.includes(channel.membershipType)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Action Handlers
 */
async function handleSendMessageAction(api, config, context) {
  try {
    // Process message content with variables
    const message = processVariables(config.message, context);
    
    // Send message
    const result = await teamsPlugin.sendMessage(
      config.targetId,
      message,
      config.targetType
    );
    
    // Set importance if urgent
    if (config.urgent) {
      // This would require additional API call to update message importance
      api.logger.info('Message sent with urgent flag');
    }
    
    return {
      success: true,
      messageId: result.id,
      message: 'Message sent successfully'
    };
  } catch (error) {
    api.logger.error('Failed to send Teams message:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleCreateMeetingAction(api, config, context) {
  try {
    // Process variables
    const subject = processVariables(config.subject, context);
    
    // Parse start/end times
    const startDateTime = parseDateTime(config.startDateTime);
    const endDateTime = parseDateTime(config.endDateTime, startDateTime);
    
    // Create meeting
    const meeting = await teamsPlugin.createOnlineMeeting({
      subject,
      startDateTime,
      endDateTime,
      attendees: config.attendees?.map(email => ({
        emailAddress: { address: email }
      })) || [],
      allowPstn: config.allowPstn,
      recordAutomatically: config.isRecorded
    });
    
    return {
      success: true,
      meetingId: meeting.id,
      joinUrl: meeting.joinWebUrl,
      message: 'Meeting created successfully'
    };
  } catch (error) {
    api.logger.error('Failed to create Teams meeting:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleUpdatePresenceAction(api, config, context) {
  try {
    // Process variables
    const activity = processVariables(config.activity, context);
    const statusMessage = config.statusMessage ? processVariables(config.statusMessage, context) : undefined;
    
    // Update presence
    await teamsPlugin.updatePresence(config.availability, activity, statusMessage);
    
    // Set expiration if specified
    if (config.expirationMinutes > 0) {
      setTimeout(async () => {
        try {
          await teamsPlugin.updatePresence('Available', 'Available');
        } catch (error) {
          api.logger.error('Failed to reset presence after expiration:', error);
        }
      }, config.expirationMinutes * 60 * 1000);
    }
    
    return {
      success: true,
      message: 'Presence updated successfully'
    };
  } catch (error) {
    api.logger.error('Failed to update Teams presence:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleAddMemberAction(api, config, context) {
  try {
    // Process variables
    const userEmail = processVariables(config.userEmail, context);
    
    // Add member to team
    await teamsPlugin.addTeamMember(config.teamId, userEmail, config.role);
    
    return {
      success: true,
      message: `Member ${userEmail} added to team successfully`
    };
  } catch (error) {
    api.logger.error('Failed to add Teams member:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleCreateChannelAction(api, config, context) {
  try {
    // Process variables
    const displayName = processVariables(config.displayName, context);
    const description = config.description ? processVariables(config.description, context) : undefined;
    
    // Create channel
    const channel = await teamsPlugin.createChannel(config.teamId, {
      displayName,
      description,
      membershipType: config.membershipType
    });
    
    return {
      success: true,
      channelId: channel.id,
      message: `Channel "${displayName}" created successfully`
    };
  } catch (error) {
    api.logger.error('Failed to create Teams channel:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Utility Functions
 */
function processVariables(text, context) {
  if (!text) return text;
  
  return text
    .replace(/\{\{user\}\}/g, context.user?.name || 'Unknown User')
    .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
    .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString())
    .replace(/\{\{datetime\}\}/g, new Date().toLocaleString())
    .replace(/\{\{trigger\.data\.(\w+)\}\}/g, (match, key) => {
      return context.data?.[key] || match;
    })
    .replace(/\{\{trigger\.user\.(\w+)\}\}/g, (match, key) => {
      return context.user?.[key] || match;
    });
}

function parseDateTime(dateTimeString, referenceDate = new Date()) {
  if (!dateTimeString || dateTimeString === 'now') {
    return new Date();
  }
  
  // Handle relative time (e.g., "+1h", "+30m", "+2d")
  const relativeMatch = dateTimeString.match(/^([+-])(\d+)([hdm])$/);
  if (relativeMatch) {
    const [, sign, amount, unit] = relativeMatch;
    const multiplier = sign === '+' ? 1 : -1;
    const value = parseInt(amount) * multiplier;
    
    const result = new Date(referenceDate);
    switch (unit) {
      case 'h':
        result.setHours(result.getHours() + value);
        break;
      case 'm':
        result.setMinutes(result.getMinutes() + value);
        break;
      case 'd':
        result.setDate(result.getDate() + value);
        break;
    }
    return result;
  }
  
  // Try to parse as ISO date string
  try {
    return new Date(dateTimeString);
  } catch (error) {
    // Fallback to current time
    return new Date();
  }
}

// Export main function
export { initializeAutomation };