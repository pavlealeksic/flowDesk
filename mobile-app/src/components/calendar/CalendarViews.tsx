/**
 * Touch-Optimized Calendar Views for React Native
 * 
 * Provides mobile-optimized calendar views with:
 * - Touch gestures (swipe, pinch, drag)
 * - Smooth animations
 * - Accessibility support
 * - Performance optimization for large datasets
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
  GestureHandlerRootView,
  Dimensions,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  Animated,
  VirtualizedList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, isSameDay, isSameMonth, getDay, getDaysInMonth, startOfDay, endOfDay, differenceInMinutes, addMinutes, isToday } from 'date-fns';
import { useStore } from '../../store';
import { CalendarEvent, CalendarView } from '../../store/slices/calendarSlice';
import { useTheme } from '../../hooks/useTheme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CalendarViewsProps {
  onEventPress?: (event: CalendarEvent) => void;
  onDatePress?: (date: Date) => void;
  onAddEvent?: (date?: Date, hour?: number) => void;
  accessibilityLabel?: string;
}

interface EventLayoutInfo {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
  zIndex: number;
}

interface TimeSlot {
  hour: number;
  minute: number;
  date: Date;
}

export const CalendarViews: React.FC<CalendarViewsProps> = ({
  onEventPress,
  onDatePress,
  onAddEvent,
  accessibilityLabel = 'Calendar',
}) => {
  const theme = useTheme();
  const currentView = useStore(state => state.currentView);
  const currentDate = useStore(state => state.currentDate);
  const events = useStore(state => state.events);
  const isLoading = useStore(state => state.isLoading);
  
  const setCurrentDate = useStore(state => state.setCurrentDate);
  const navigateNext = useStore(state => state.navigateNext);
  const navigatePrevious = useStore(state => state.navigatePrevious);

  // Gesture handling
  const panRef = useRef<PanGestureHandler>(null);
  const pinchRef = useRef<PinchGestureHandler>(null);
  const tapRef = useRef<TapGestureHandler>(null);
  
  // Animation values
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  // State for gestures
  const [isDragging, setIsDragging] = useState(false);
  const [dragEvent, setDragEvent] = useState<CalendarEvent | null>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });

  // Accessibility
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = useState(false);

  useEffect(() => {
    const checkScreenReader = async () => {
      const enabled = await AccessibilityInfo.isScreenReaderEnabled();
      setIsScreenReaderEnabled(enabled);
    };
    
    checkScreenReader();
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', checkScreenReader);
    return () => subscription?.remove();
  }, []);

  // Handle pan gesture for navigation
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX, velocityX } = event.nativeEvent;
      const threshold = screenWidth * 0.3;
      
      if (Math.abs(translationX) > threshold || Math.abs(velocityX) > 1000) {
        if (translationX > 0) {
          navigatePrevious();
        } else {
          navigateNext();
        }
      }
      
      // Reset animation
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [navigateNext, navigatePrevious, translateX]);

  // Handle pinch gesture for zooming
  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { scale: finalScale } = event.nativeEvent;
      
      // Scale threshold to switch between views
      if (currentView === 'month' && finalScale > 1.5) {
        // Zoom in to week view
        useStore.getState().setCurrentView('week');
      } else if (currentView === 'week' && finalScale > 1.5) {
        // Zoom in to day view
        useStore.getState().setCurrentView('day');
      } else if (currentView === 'day' && finalScale < 0.7) {
        // Zoom out to week view
        useStore.getState().setCurrentView('week');
      } else if (currentView === 'week' && finalScale < 0.7) {
        // Zoom out to month view
        useStore.getState().setCurrentView('month');
      }
      
      // Reset scale
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [currentView]);

  // Get events for current view period
  const viewEvents = useMemo(() => {
    let startDate: Date;
    let endDate: Date;

    switch (currentView) {
      case 'day':
        startDate = startOfDay(currentDate);
        endDate = endOfDay(currentDate);
        break;
      case 'week':
        startDate = startOfWeek(currentDate, { weekStartsOn: 0 });
        endDate = endOfWeek(currentDate, { weekStartsOn: 0 });
        break;
      case 'month':
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
        break;
      case 'agenda':
        startDate = startOfDay(currentDate);
        endDate = addDays(startDate, 30); // Show 30 days in agenda
        break;
      default:
        return [];
    }

    return events.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      return eventStart <= endDate && eventEnd >= startDate;
    });
  }, [currentView, currentDate, events]);

  // Layout events for day/week views
  const layoutEvents = useCallback((eventsToLayout: CalendarEvent[], containerWidth: number): EventLayoutInfo[] => {
    if (eventsToLayout.length === 0) return [];

    const hourHeight = 60; // Height of each hour in pixels
    const eventInfos: EventLayoutInfo[] = [];

    // Sort events by start time
    const sortedEvents = [...eventsToLayout].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Calculate positions for each event
    sortedEvents.forEach((event, index) => {
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      
      // Calculate vertical position
      const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
      const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
      const top = (startMinutes / 60) * hourHeight;
      const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 30); // Minimum height

      // Find overlapping events
      const overlappingEvents = sortedEvents.filter((otherEvent, otherIndex) => {
        if (otherIndex >= index) return false;
        const otherStart = new Date(otherEvent.startTime);
        const otherEnd = new Date(otherEvent.endTime);
        return startTime < otherEnd && endTime > otherStart;
      });

      // Calculate horizontal position
      const numColumns = Math.max(1, overlappingEvents.length + 1);
      const column = overlappingEvents.length;
      const width = containerWidth / numColumns - 4; // 4px for margins
      const left = (column * containerWidth / numColumns) + 2;

      eventInfos.push({
        event,
        top,
        height,
        left,
        width,
        zIndex: 100 - index, // Later events have higher z-index
      });
    });

    return eventInfos;
  }, []);

  // Render month view
  const renderMonthView = useCallback(() => {
    const startDate = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const endDate = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const weeks = [];
    let currentWeek = startDate;

    while (currentWeek <= endDate) {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = addDays(currentWeek, i);
        const dayEvents = viewEvents.filter(event => 
          isSameDay(new Date(event.startTime), day)
        );

        weekDays.push(
          <TouchableOpacity
            key={day.toISOString()}
            style={[
              styles.monthDay,
              !isSameMonth(day, currentDate) && styles.monthDayInactive,
              isSameDay(day, currentDate) && styles.monthDaySelected,
              isToday(day) && styles.monthDayToday,
            ]}
            onPress={() => onDatePress?.(day)}
            accessible={true}
            accessibilityLabel={`${format(day, 'MMMM d, yyyy')}, ${dayEvents.length} events`}
            accessibilityRole="button"
          >
            <Text style={[
              styles.monthDayText,
              !isSameMonth(day, currentDate) && styles.monthDayTextInactive,
              isSameDay(day, currentDate) && styles.monthDayTextSelected,
              isToday(day) && styles.monthDayTextToday,
            ]}>
              {format(day, 'd')}
            </Text>
            {dayEvents.length > 0 && (
              <View style={styles.monthDayEvents}>
                {dayEvents.slice(0, 3).map((event, index) => (
                  <View
                    key={event.id}
                    style={[styles.monthEventDot, { backgroundColor: theme.colors.primary }]}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <Text style={styles.monthEventMore}>+{dayEvents.length - 3}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      }

      weeks.push(
        <View key={currentWeek.toISOString()} style={styles.monthWeek}>
          {weekDays}
        </View>
      );

      currentWeek = addWeeks(currentWeek, 1);
    }

    return (
      <View style={styles.monthContainer}>
        {/* Month header with day names */}
        <View style={styles.monthHeader}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <View key={day} style={styles.monthHeaderDay}>
              <Text style={styles.monthHeaderDayText}>{day}</Text>
            </View>
          ))}
        </View>
        
        {/* Month weeks */}
        <ScrollView style={styles.monthWeeks} showsVerticalScrollIndicator={false}>
          {weeks}
        </ScrollView>
      </View>
    );
  }, [currentDate, viewEvents, onDatePress, theme.colors.primary]);

  // Render week view
  const renderWeekView = useCallback(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = [];
    
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(weekStart, i));
    }

    return (
      <View style={styles.weekContainer}>
        {/* Week header */}
        <View style={styles.weekHeader}>
          {weekDays.map(day => {
            const dayEvents = viewEvents.filter(event => 
              isSameDay(new Date(event.startTime), day)
            );
            
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.weekHeaderDay,
                  isSameDay(day, currentDate) && styles.weekHeaderDaySelected,
                  isToday(day) && styles.weekHeaderDayToday,
                ]}
                onPress={() => {
                  setCurrentDate(day);
                  onDatePress?.(day);
                }}
                accessible={true}
                accessibilityLabel={`${format(day, 'EEEE, MMMM d')}, ${dayEvents.length} events`}
                accessibilityRole="button"
              >
                <Text style={[
                  styles.weekHeaderDayName,
                  isSameDay(day, currentDate) && styles.weekHeaderDayNameSelected,
                ]}>
                  {format(day, 'EEE')}
                </Text>
                <Text style={[
                  styles.weekHeaderDayNumber,
                  isSameDay(day, currentDate) && styles.weekHeaderDayNumberSelected,
                  isToday(day) && styles.weekHeaderDayNumberToday,
                ]}>
                  {format(day, 'd')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Week timeline */}
        <ScrollView style={styles.weekTimeline} showsVerticalScrollIndicator={false}>
          <View style={styles.weekTimelineContainer}>
            {/* Hour labels */}
            <View style={styles.weekHourLabels}>
              {Array.from({ length: 24 }, (_, hour) => (
                <View key={hour} style={styles.weekHourLabel}>
                  <Text style={styles.weekHourLabelText}>
                    {format(new Date().setHours(hour, 0), 'HH:mm')}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.weekDaysGrid}>
              {weekDays.map((day, dayIndex) => {
                const dayEvents = viewEvents.filter(event => 
                  isSameDay(new Date(event.startTime), day)
                );
                const layoutedEvents = layoutEvents(dayEvents, (screenWidth - 80) / 7);

                return (
                  <View key={day.toISOString()} style={styles.weekDay}>
                    {/* Hour grid lines */}
                    {Array.from({ length: 24 }, (_, hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={styles.weekHourSlot}
                        onPress={() => onAddEvent?.(day, hour)}
                        accessible={true}
                        accessibilityLabel={`Add event on ${format(day, 'EEEE')} at ${hour}:00`}
                        accessibilityRole="button"
                      />
                    ))}

                    {/* Events */}
                    {layoutedEvents.map(({ event, top, height, left, width, zIndex }) => (
                      <TouchableOpacity
                        key={event.id}
                        style={[
                          styles.weekEvent,
                          {
                            top,
                            height,
                            left: left - (screenWidth - 80) / 7 * dayIndex,
                            width,
                            zIndex,
                            backgroundColor: theme.colors.primary,
                          },
                        ]}
                        onPress={() => onEventPress?.(event)}
                        accessible={true}
                        accessibilityLabel={`Event: ${event.title} from ${format(new Date(event.startTime), 'HH:mm')} to ${format(new Date(event.endTime), 'HH:mm')}`}
                        accessibilityRole="button"
                      >
                        <Text style={styles.weekEventTitle} numberOfLines={2}>
                          {event.title}
                        </Text>
                        <Text style={styles.weekEventTime} numberOfLines={1}>
                          {format(new Date(event.startTime), 'HH:mm')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }, [currentDate, viewEvents, layoutEvents, onDatePress, onEventPress, onAddEvent, setCurrentDate, theme.colors.primary]);

  // Render day view
  const renderDayView = useCallback(() => {
    const dayEvents = viewEvents.filter(event => 
      isSameDay(new Date(event.startTime), currentDate)
    );
    const layoutedEvents = layoutEvents(dayEvents, screenWidth - 80);

    return (
      <View style={styles.dayContainer}>
        {/* Day header */}
        <View style={styles.dayHeader}>
          <Text style={styles.dayHeaderDate}>
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </Text>
          <Text style={styles.dayHeaderEvents}>
            {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Day timeline */}
        <ScrollView style={styles.dayTimeline} showsVerticalScrollIndicator={false}>
          <View style={styles.dayTimelineContainer}>
            {/* Hour labels and slots */}
            {Array.from({ length: 24 }, (_, hour) => (
              <View key={hour} style={styles.dayHour}>
                <View style={styles.dayHourLabel}>
                  <Text style={styles.dayHourLabelText}>
                    {format(new Date().setHours(hour, 0), 'HH:mm')}
                  </Text>
                </View>
                
                <TouchableOpacity
                  style={styles.dayHourSlot}
                  onPress={() => onAddEvent?.(currentDate, hour)}
                  accessible={true}
                  accessibilityLabel={`Add event at ${hour}:00`}
                  accessibilityRole="button"
                />
              </View>
            ))}

            {/* Events overlay */}
            {layoutedEvents.map(({ event, top, height, left, width, zIndex }) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.dayEvent,
                  {
                    top,
                    height,
                    left: left + 80, // Account for hour labels
                    width: width - 80,
                    zIndex,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
                onPress={() => onEventPress?.(event)}
                accessible={true}
                accessibilityLabel={`Event: ${event.title} from ${format(new Date(event.startTime), 'HH:mm')} to ${format(new Date(event.endTime), 'HH:mm')}`}
                accessibilityRole="button"
              >
                <Text style={styles.dayEventTitle} numberOfLines={3}>
                  {event.title}
                </Text>
                <Text style={styles.dayEventTime}>
                  {format(new Date(event.startTime), 'HH:mm')} - {format(new Date(event.endTime), 'HH:mm')}
                </Text>
                {event.location && (
                  <Text style={styles.dayEventLocation} numberOfLines={1}>
                    📍 {event.location}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }, [currentDate, viewEvents, layoutEvents, onEventPress, onAddEvent, theme.colors.primary]);

  // Render agenda view
  const renderAgendaView = useCallback(() => {
    const agendaEvents = viewEvents.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    const getItemCount = () => agendaEvents.length;
    const getItem = (data: any, index: number) => agendaEvents[index];

    return (
      <VirtualizedList
        style={styles.agendaContainer}
        data={agendaEvents}
        initialNumToRender={10}
        getItemCount={getItemCount}
        getItem={getItem}
        keyExtractor={(item: CalendarEvent) => item.id}
        renderItem={({ item: event }) => {
          const eventDate = new Date(event.startTime);
          const eventEndDate = new Date(event.endTime);
          
          return (
            <TouchableOpacity
              style={styles.agendaEvent}
              onPress={() => onEventPress?.(event)}
              accessible={true}
              accessibilityLabel={`Event: ${event.title} on ${format(eventDate, 'EEEE, MMMM d')} from ${format(eventDate, 'HH:mm')} to ${format(eventEndDate, 'HH:mm')}`}
              accessibilityRole="button"
            >
              <View style={styles.agendaEventDate}>
                <Text style={styles.agendaEventDateText}>
                  {format(eventDate, 'MMM d')}
                </Text>
                <Text style={styles.agendaEventDayText}>
                  {format(eventDate, 'EEE')}
                </Text>
              </View>
              
              <View style={styles.agendaEventContent}>
                <Text style={styles.agendaEventTitle} numberOfLines={2}>
                  {event.title}
                </Text>
                <Text style={styles.agendaEventTime}>
                  {event.isAllDay 
                    ? 'All day' 
                    : `${format(eventDate, 'HH:mm')} - ${format(eventEndDate, 'HH:mm')}`
                  }
                </Text>
                {event.location && (
                  <Text style={styles.agendaEventLocation} numberOfLines={1}>
                    📍 {event.location}
                  </Text>
                )}
                {event.attendees.length > 0 && (
                  <Text style={styles.agendaEventAttendees}>
                    👥 {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              
              <View style={[
                styles.agendaEventIndicator,
                { backgroundColor: theme.colors.primary }
              ]} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={() => (
          <View style={styles.agendaEmpty}>
            <Ionicons name="calendar-outline" size={64} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.agendaEmptyText}>No upcoming events</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    );
  }, [viewEvents, onEventPress, theme.colors.primary, theme.colors.onSurfaceVariant]);

  // Main render method
  const renderCurrentView = useCallback(() => {
    switch (currentView) {
      case 'month':
        return renderMonthView();
      case 'week':
        return renderWeekView();
      case 'day':
        return renderDayView();
      case 'agenda':
        return renderAgendaView();
      default:
        return renderMonthView();
    }
  }, [currentView, renderMonthView, renderWeekView, renderDayView, renderAgendaView]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <TapGestureHandler ref={tapRef}>
        <PinchGestureHandler
          ref={pinchRef}
          onGestureEvent={onPinchGestureEvent}
          onHandlerStateChange={onPinchHandlerStateChange}
          simultaneousHandlers={[panRef]}
        >
          <Animated.View style={[styles.gestureContainer, { transform: [{ scale }] }]}>
            <PanGestureHandler
              ref={panRef}
              onGestureEvent={onPanGestureEvent}
              onHandlerStateChange={onPanHandlerStateChange}
              simultaneousHandlers={[pinchRef]}
              enabled={currentView !== 'agenda'} // Disable pan for agenda view
            >
              <Animated.View 
                style={[
                  styles.viewContainer, 
                  { transform: [{ translateX }], opacity }
                ]}
                accessible={true}
                accessibilityLabel={accessibilityLabel}
                accessibilityRole="grid"
              >
                {renderCurrentView()}
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </PinchGestureHandler>
      </TapGestureHandler>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gestureContainer: {
    flex: 1,
  },
  viewContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },

  // Month view styles
  monthContainer: {
    flex: 1,
  },
  monthHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  monthHeaderDay: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
  },
  monthHeaderDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  monthWeeks: {
    flex: 1,
  },
  monthWeek: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  monthDay: {
    flex: 1,
    minHeight: 80,
    padding: 4,
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#f0f0f0',
  },
  monthDayInactive: {
    opacity: 0.3,
  },
  monthDaySelected: {
    backgroundColor: '#e3f2fd',
  },
  monthDayToday: {
    backgroundColor: '#fff3e0',
  },
  monthDayText: {
    fontSize: 16,
    color: '#333',
  },
  monthDayTextInactive: {
    color: '#999',
  },
  monthDayTextSelected: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  monthDayTextToday: {
    color: '#ff6f00',
    fontWeight: 'bold',
  },
  monthDayEvents: {
    marginTop: 2,
    alignItems: 'center',
  },
  monthEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginVertical: 1,
  },
  monthEventMore: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },

  // Week view styles
  weekContainer: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 80, // Account for hour labels
  },
  weekHeaderDay: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#f0f0f0',
  },
  weekHeaderDaySelected: {
    backgroundColor: '#e3f2fd',
  },
  weekHeaderDayToday: {
    backgroundColor: '#fff3e0',
  },
  weekHeaderDayName: {
    fontSize: 12,
    color: '#666',
  },
  weekHeaderDayNameSelected: {
    color: '#1976d2',
    fontWeight: 'bold',
  },
  weekHeaderDayNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  weekHeaderDayNumberSelected: {
    color: '#1976d2',
  },
  weekHeaderDayNumberToday: {
    color: '#ff6f00',
  },
  weekTimeline: {
    flex: 1,
  },
  weekTimelineContainer: {
    flexDirection: 'row',
    minHeight: 24 * 60, // 24 hours * 60px per hour
  },
  weekHourLabels: {
    width: 80,
    paddingTop: 30, // Half hour height to center labels
  },
  weekHourLabel: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  weekHourLabelText: {
    fontSize: 12,
    color: '#666',
  },
  weekDaysGrid: {
    flex: 1,
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#f0f0f0',
    position: 'relative',
  },
  weekHourSlot: {
    height: 60,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  weekEvent: {
    position: 'absolute',
    borderRadius: 4,
    padding: 4,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  weekEventTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  weekEventTime: {
    fontSize: 10,
    color: '#fff',
    opacity: 0.9,
  },

  // Day view styles
  dayContainer: {
    flex: 1,
  },
  dayHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  dayHeaderDate: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  dayHeaderEvents: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  dayTimeline: {
    flex: 1,
  },
  dayTimelineContainer: {
    position: 'relative',
    minHeight: 24 * 60, // 24 hours * 60px per hour
  },
  dayHour: {
    flexDirection: 'row',
    height: 60,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  dayHourLabel: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayHourLabelText: {
    fontSize: 12,
    color: '#666',
  },
  dayHourSlot: {
    flex: 1,
  },
  dayEvent: {
    position: 'absolute',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dayEventTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  dayEventTime: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 2,
  },
  dayEventLocation: {
    fontSize: 11,
    color: '#fff',
    opacity: 0.8,
  },

  // Agenda view styles
  agendaContainer: {
    flex: 1,
  },
  agendaEvent: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  agendaEventDate: {
    width: 60,
    alignItems: 'center',
    marginRight: 16,
  },
  agendaEventDateText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  agendaEventDayText: {
    fontSize: 12,
    color: '#666',
  },
  agendaEventContent: {
    flex: 1,
    marginRight: 12,
  },
  agendaEventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  agendaEventTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  agendaEventLocation: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  agendaEventAttendees: {
    fontSize: 13,
    color: '#888',
  },
  agendaEventIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  agendaEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  agendaEmptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
});

export default CalendarViews;