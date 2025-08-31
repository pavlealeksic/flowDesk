/**
 * Mobile Event Create/Edit Modal
 * 
 * Native-optimized event creation and editing form with:
 * - Touch-friendly inputs
 * - Date/time pickers
 * - Location services integration
 * - Contact picker for attendees
 * - Meeting URL generation
 * - Recurrence patterns
 * - Reminders management
 * - Accessibility support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Switch,
  StyleSheet,
  Dimensions,
  ActionSheetIOS,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as Contacts from 'expo-contacts';
import { useStore } from '../../store';
import { CalendarEvent, EventAttendee, EventReminder } from '../../store/slices/calendarSlice';
import { useTheme } from '../../hooks/useTheme';
import { format, addMinutes, addHours, addDays, startOfDay, endOfDay } from 'date-fns';
import { mobileCalendarService } from '../../services/calendarService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface EventEditModalProps {
  visible: boolean;
  event?: CalendarEvent | null;
  initialDate?: Date;
  initialStartTime?: Date;
  initialEndTime?: Date;
  onClose: () => void;
  onSave: (event: Partial<CalendarEvent>) => void;
  onDelete?: (eventId: string) => void;
}

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';
  interval: number;
  until?: Date;
  count?: number;
  weekdays?: number[]; // 0 = Sunday, 1 = Monday, etc.
}

const REMINDER_OPTIONS = [
  { label: 'None', minutes: 0 },
  { label: '5 minutes before', minutes: 5 },
  { label: '15 minutes before', minutes: 15 },
  { label: '30 minutes before', minutes: 30 },
  { label: '1 hour before', minutes: 60 },
  { label: '2 hours before', minutes: 120 },
  { label: '1 day before', minutes: 1440 },
  { label: '1 week before', minutes: 10080 },
];

const RECURRENCE_OPTIONS = [
  { label: 'Never', value: 'none' },
  { label: 'Every day', value: 'daily' },
  { label: 'Every week', value: 'weekly' },
  { label: 'Every month', value: 'monthly' },
  { label: 'Every year', value: 'yearly' },
];

const MEETING_URL_TEMPLATES = [
  { label: 'Zoom', template: 'https://zoom.us/j/', icon: 'videocam' },
  { label: 'Google Meet', template: 'https://meet.google.com/', icon: 'logo-google' },
  { label: 'Microsoft Teams', template: 'https://teams.microsoft.com/l/meetup-join/', icon: 'logo-microsoft' },
  { label: 'Custom', template: '', icon: 'link' },
];

export const EventEditModal: React.FC<EventEditModalProps> = ({
  visible,
  event,
  initialDate,
  initialStartTime,
  initialEndTime,
  onClose,
  onSave,
  onDelete,
}) => {
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startTime, setStartTime] = useState(initialStartTime || initialDate || new Date());
  const [endTime, setEndTime] = useState(initialEndTime || addHours(initialStartTime || initialDate || new Date(), 1));
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [reminders, setReminders] = useState<EventReminder[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceRule>({ frequency: 'none', interval: 1 });
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // UI state
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);

  // Initialize form with existing event data
  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setLocation(event.location || '');
      setIsAllDay(event.isAllDay);
      setStartTime(new Date(event.startTime));
      setEndTime(new Date(event.endTime));
      setAttendees(event.attendees || []);
      setReminders(event.reminders || []);
      setMeetingUrl(event.meetingUrl || '');
      setIsPrivate(event.visibility === 'private');
      
      // Parse recurrence rule if exists
      if (event.recurrenceRule) {
        // Simple parsing - in production you'd use a proper RRULE parser
        setRecurrence({ frequency: 'weekly', interval: 1 }); // Simplified
      } else {
        setRecurrence({ frequency: 'none', interval: 1 });
      }
    } else {
      // Reset form for new event
      setTitle('');
      setDescription('');
      setLocation('');
      setIsAllDay(false);
      setStartTime(initialStartTime || initialDate || new Date());
      setEndTime(initialEndTime || addHours(initialStartTime || initialDate || new Date(), 1));
      setAttendees([]);
      setReminders([{ method: 'popup', minutes: 15 }]);
      setRecurrence({ frequency: 'none', interval: 1 });
      setMeetingUrl('');
      setIsPrivate(false);
    }
  }, [event, initialDate, initialStartTime, initialEndTime]);

  // Get current location for location suggestions
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setCurrentLocation(location);
        }
      } catch (error) {
        console.warn('Failed to get current location:', error);
      }
    };

    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  // Handle start time change
  const onStartTimeChange = useCallback((event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    setShowStartTimePicker(false);
    
    if (selectedDate) {
      setStartTime(selectedDate);
      
      // Automatically adjust end time if it's before start time
      if (selectedDate >= endTime) {
        setEndTime(addHours(selectedDate, 1));
      }
    }
  }, [endTime]);

  // Handle end time change
  const onEndTimeChange = useCallback((event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
    
    if (selectedDate) {
      // Ensure end time is after start time
      if (selectedDate <= startTime) {
        setEndTime(addMinutes(startTime, 30));
      } else {
        setEndTime(selectedDate);
      }
    }
  }, [startTime]);

  // Add attendee using contact picker
  const addAttendee = useCallback(async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow access to contacts to add attendees.');
        return;
      }

      // Use native calendar service contact picker
      const contact = await mobileCalendarService.pickContact();
      
      if (contact && contact.emails && contact.emails.length > 0) {
        const newAttendee: EventAttendee = {
          email: contact.emails[0],
          name: contact.name,
          status: 'needsAction',
          isOptional: false,
          isOrganizer: false,
        };

        // Check if attendee already exists
        if (!attendees.some(a => a.email === newAttendee.email)) {
          setAttendees(prev => [...prev, newAttendee]);
        }
      }
    } catch (error) {
      console.error('Failed to add attendee:', error);
      Alert.alert('Error', 'Failed to add attendee. Please try again.');
    }
  }, [attendees]);

  // Remove attendee
  const removeAttendee = useCallback((email: string) => {
    setAttendees(prev => prev.filter(a => a.email !== email));
  }, []);

  // Add reminder
  const addReminder = useCallback((minutes: number) => {
    if (minutes === 0) {
      setReminders([]);
    } else {
      const newReminder: EventReminder = {
        method: 'popup',
        minutes,
      };

      // Check if reminder already exists
      if (!reminders.some(r => r.minutes === minutes)) {
        setReminders(prev => [...prev, newReminder]);
      }
    }
    setShowReminderPicker(false);
  }, [reminders]);

  // Remove reminder
  const removeReminder = useCallback((minutes: number) => {
    setReminders(prev => prev.filter(r => r.minutes !== minutes));
  }, []);

  // Get location suggestions
  const getLocationSuggestions = useCallback(async () => {
    if (!currentLocation) return;

    try {
      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      if (geocode.length > 0) {
        const address = geocode[0];
        const formattedAddress = [
          address.name,
          address.street,
          address.city,
          address.region,
          address.country,
        ].filter(Boolean).join(', ');

        Alert.alert(
          'Use current location?',
          formattedAddress,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use', onPress: () => setLocation(formattedAddress) },
          ]
        );
      }
    } catch (error) {
      console.error('Failed to get location suggestions:', error);
    }
  }, [currentLocation]);

  // Generate meeting URL
  const generateMeetingUrl = useCallback((template: typeof MEETING_URL_TEMPLATES[0]) => {
    if (template.template) {
      const meetingId = Math.random().toString(36).substring(7);
      setMeetingUrl(`${template.template}${meetingId}`);
    } else {
      // Custom URL input
      Alert.prompt(
        'Meeting URL',
        'Enter the meeting URL:',
        (url) => {
          if (url) setMeetingUrl(url);
        },
        'plain-text',
        meetingUrl
      );
    }
  }, [meetingUrl]);

  // Show reminder picker
  const showReminderActionSheet = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...REMINDER_OPTIONS.map(r => r.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            addReminder(REMINDER_OPTIONS[buttonIndex - 1].minutes);
          }
        }
      );
    } else {
      setShowReminderPicker(true);
    }
  }, [addReminder]);

  // Show recurrence picker
  const showRecurrenceActionSheet = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...RECURRENCE_OPTIONS.map(r => r.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const option = RECURRENCE_OPTIONS[buttonIndex - 1];
            setRecurrence({ frequency: option.value as any, interval: 1 });
          }
        }
      );
    } else {
      setShowRecurrencePicker(true);
    }
  }, []);

  // Show meeting URL options
  const showMeetingUrlActionSheet = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...MEETING_URL_TEMPLATES.map(t => t.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            generateMeetingUrl(MEETING_URL_TEMPLATES[buttonIndex - 1]);
          }
        }
      );
    } else {
      // Android implementation with Alert
      Alert.alert(
        'Add Meeting URL',
        'Choose a meeting platform:',
        MEETING_URL_TEMPLATES.map(template => ({
          text: template.label,
          onPress: () => generateMeetingUrl(template),
        })).concat([{ text: 'Cancel', style: 'cancel' }])
      );
    }
  }, [generateMeetingUrl]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a title for the event.');
      return;
    }

    setIsLoading(true);

    try {
      const eventData: Partial<CalendarEvent> = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime: isAllDay ? startOfDay(startTime) : startTime,
        endTime: isAllDay ? endOfDay(endTime) : endTime,
        isAllDay,
        attendees,
        reminders,
        meetingUrl: meetingUrl.trim() || undefined,
        visibility: isPrivate ? 'private' : 'public',
        recurrenceRule: recurrence.frequency !== 'none' ? `FREQ=${recurrence.frequency.toUpperCase()};INTERVAL=${recurrence.interval}` : undefined,
        isRecurring: recurrence.frequency !== 'none',
      };

      await onSave(eventData);
      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
      Alert.alert('Error', 'Failed to save event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [
    title,
    description,
    location,
    startTime,
    endTime,
    isAllDay,
    attendees,
    reminders,
    meetingUrl,
    isPrivate,
    recurrence,
    onSave,
    onClose,
  ]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!event) return;

    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.(event.id);
            onClose();
          },
        },
      ]
    );
  }, [event, onDelete, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={[styles.headerButtonText, { color: theme.colors.primary }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
            {event ? 'Edit Event' : 'New Event'}
          </Text>
          
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleSave}
            disabled={isLoading}
            accessible={true}
            accessibilityLabel="Save event"
            accessibilityRole="button"
          >
            <Text style={[
              styles.headerButtonText,
              { color: theme.colors.primary },
              isLoading && { opacity: 0.5 }
            ]}>
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Title *
            </Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.colors.surfaceVariant,
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline,
              }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Event title"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              returnKeyType="next"
              accessible={true}
              accessibilityLabel="Event title"
            />
          </View>

          {/* All Day Toggle */}
          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                All Day
              </Text>
              <Switch
                value={isAllDay}
                onValueChange={setIsAllDay}
                thumbColor={theme.colors.primary}
                trackColor={{
                  false: theme.colors.outline,
                  true: theme.colors.primaryContainer,
                }}
                accessible={true}
                accessibilityLabel="All day event"
              />
            </View>
          </View>

          {/* Start Time */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Starts
            </Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setShowStartDatePicker(true)}
                accessible={true}
                accessibilityLabel={`Start date: ${format(startTime, 'EEEE, MMMM d, yyyy')}`}
                accessibilityRole="button"
              >
                <Text style={[styles.dateTimeText, { color: theme.colors.onSurface }]}>
                  {format(startTime, 'EEE, MMM d')}
                </Text>
              </TouchableOpacity>
              
              {!isAllDay && (
                <TouchableOpacity
                  style={[styles.dateTimeButton, { backgroundColor: theme.colors.surfaceVariant }]}
                  onPress={() => setShowStartTimePicker(true)}
                  accessible={true}
                  accessibilityLabel={`Start time: ${format(startTime, 'h:mm a')}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.dateTimeText, { color: theme.colors.onSurface }]}>
                    {format(startTime, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* End Time */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Ends
            </Text>
            <View style={styles.dateTimeRow}>
              <TouchableOpacity
                style={[styles.dateTimeButton, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={() => setShowEndDatePicker(true)}
                accessible={true}
                accessibilityLabel={`End date: ${format(endTime, 'EEEE, MMMM d, yyyy')}`}
                accessibilityRole="button"
              >
                <Text style={[styles.dateTimeText, { color: theme.colors.onSurface }]}>
                  {format(endTime, 'EEE, MMM d')}
                </Text>
              </TouchableOpacity>
              
              {!isAllDay && (
                <TouchableOpacity
                  style={[styles.dateTimeButton, { backgroundColor: theme.colors.surfaceVariant }]}
                  onPress={() => setShowEndTimePicker(true)}
                  accessible={true}
                  accessibilityLabel={`End time: ${format(endTime, 'h:mm a')}`}
                  accessibilityRole="button"
                >
                  <Text style={[styles.dateTimeText, { color: theme.colors.onSurface }]}>
                    {format(endTime, 'h:mm a')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Location */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Location
            </Text>
            <View style={styles.locationRow}>
              <TextInput
                style={[styles.input, styles.locationInput, {
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline,
                }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Add location"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                returnKeyType="next"
                accessible={true}
                accessibilityLabel="Event location"
              />
              {currentLocation && (
                <TouchableOpacity
                  style={styles.locationButton}
                  onPress={getLocationSuggestions}
                  accessible={true}
                  accessibilityLabel="Use current location"
                  accessibilityRole="button"
                >
                  <Ionicons 
                    name="location" 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Description */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Description
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, {
                backgroundColor: theme.colors.surfaceVariant,
                color: theme.colors.onSurface,
                borderColor: theme.colors.outline,
              }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add description"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessible={true}
              accessibilityLabel="Event description"
            />
          </View>

          {/* Meeting URL */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Meeting URL
            </Text>
            <View style={styles.meetingUrlRow}>
              <TextInput
                style={[styles.input, styles.meetingUrlInput, {
                  backgroundColor: theme.colors.surfaceVariant,
                  color: theme.colors.onSurface,
                  borderColor: theme.colors.outline,
                }]}
                value={meetingUrl}
                onChangeText={setMeetingUrl}
                placeholder="Add meeting link"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                keyboardType="url"
                returnKeyType="next"
                accessible={true}
                accessibilityLabel="Meeting URL"
              />
              <TouchableOpacity
                style={styles.meetingUrlButton}
                onPress={showMeetingUrlActionSheet}
                accessible={true}
                accessibilityLabel="Generate meeting URL"
                accessibilityRole="button"
              >
                <Ionicons 
                  name="videocam" 
                  size={20} 
                  color={theme.colors.primary} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Attendees */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                Attendees
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={addAttendee}
                accessible={true}
                accessibilityLabel="Add attendee"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            {attendees.map((attendee, index) => (
              <View key={attendee.email} style={styles.attendeeItem}>
                <View style={styles.attendeeInfo}>
                  <Text style={[styles.attendeeName, { color: theme.colors.onSurface }]}>
                    {attendee.name || attendee.email}
                  </Text>
                  {attendee.name && (
                    <Text style={[styles.attendeeEmail, { color: theme.colors.onSurfaceVariant }]}>
                      {attendee.email}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeAttendee(attendee.email)}
                  accessible={true}
                  accessibilityLabel={`Remove ${attendee.name || attendee.email}`}
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Reminders */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                Reminders
              </Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={showReminderActionSheet}
                accessible={true}
                accessibilityLabel="Add reminder"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={20} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
            
            {reminders.map((reminder, index) => (
              <View key={`${reminder.method}-${reminder.minutes}`} style={styles.reminderItem}>
                <Text style={[styles.reminderText, { color: theme.colors.onSurface }]}>
                  {REMINDER_OPTIONS.find(r => r.minutes === reminder.minutes)?.label || `${reminder.minutes} minutes before`}
                </Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeReminder(reminder.minutes)}
                  accessible={true}
                  accessibilityLabel="Remove reminder"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={16} color={theme.colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Recurrence */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.colors.onSurface }]}>
              Repeat
            </Text>
            <TouchableOpacity
              style={[styles.input, styles.selectButton, {
                backgroundColor: theme.colors.surfaceVariant,
                borderColor: theme.colors.outline,
              }]}
              onPress={showRecurrenceActionSheet}
              accessible={true}
              accessibilityLabel={`Repeat: ${RECURRENCE_OPTIONS.find(r => r.value === recurrence.frequency)?.label}`}
              accessibilityRole="button"
            >
              <Text style={[styles.selectButtonText, { color: theme.colors.onSurface }]}>
                {RECURRENCE_OPTIONS.find(r => r.value === recurrence.frequency)?.label}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {/* Privacy Toggle */}
          <View style={styles.formSection}>
            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: theme.colors.onSurface }]}>
                Private Event
              </Text>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                thumbColor={theme.colors.primary}
                trackColor={{
                  false: theme.colors.outline,
                  true: theme.colors.primaryContainer,
                }}
                accessible={true}
                accessibilityLabel="Private event"
              />
            </View>
          </View>

          {/* Delete Button (for existing events) */}
          {event && onDelete && (
            <View style={styles.formSection}>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.colors.errorContainer }]}
                onPress={handleDelete}
                accessible={true}
                accessibilityLabel="Delete event"
                accessibilityRole="button"
              >
                <Ionicons name="trash" size={20} color={theme.colors.onErrorContainer} />
                <Text style={[styles.deleteButtonText, { color: theme.colors.onErrorContainer }]}>
                  Delete Event
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Date/Time Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={startTime}
            mode="date"
            display="default"
            onChange={onStartTimeChange}
          />
        )}
        
        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="default"
            onChange={onStartTimeChange}
          />
        )}
        
        {showEndDatePicker && (
          <DateTimePicker
            value={endTime}
            mode="date"
            display="default"
            onChange={onEndTimeChange}
          />
        )}
        
        {showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="default"
            onChange={onEndTimeChange}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: {
    paddingVertical: 8,
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  form: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationInput: {
    flex: 1,
    marginRight: 8,
  },
  locationButton: {
    padding: 12,
  },
  meetingUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meetingUrlInput: {
    flex: 1,
    marginRight: 8,
  },
  meetingUrlButton: {
    padding: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  addButton: {
    padding: 4,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  attendeeEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  reminderText: {
    fontSize: 16,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EventEditModal;