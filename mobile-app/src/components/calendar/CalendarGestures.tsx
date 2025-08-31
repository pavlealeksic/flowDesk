/**
 * Calendar Gesture Handler
 * 
 * Advanced gesture handling for calendar events including:
 * - Drag and drop events
 * - Resize events by dragging edges
 * - Long press to select/edit
 * - Multi-touch support
 * - Haptic feedback
 * - Accessibility support
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  PanGestureHandler,
  LongPressGestureHandler,
  TapGestureHandler,
  State,
  Directions,
} from 'react-native-gesture-handler';
import { Animated, Dimensions, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CalendarEvent } from '../../store/slices/calendarSlice';
import { addMinutes, differenceInMinutes, startOfDay, format } from 'date-fns';

const { width: screenWidth } = Dimensions.get('window');

interface CalendarGestureProps {
  event: CalendarEvent;
  eventLayout: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  onEventMove?: (event: CalendarEvent, newStartTime: Date, newEndTime: Date) => void;
  onEventResize?: (event: CalendarEvent, newStartTime: Date, newEndTime: Date) => void;
  onEventPress?: (event: CalendarEvent) => void;
  onEventLongPress?: (event: CalendarEvent) => void;
  onEventSelect?: (event: CalendarEvent) => void;
  hourHeight?: number;
  minEventDuration?: number; // in minutes
  snapToGrid?: boolean;
  gridSnapInterval?: number; // in minutes
  children: React.ReactNode;
}

interface DragState {
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: 'top' | 'bottom' | null;
  startY: number;
  startTime: Date;
  endTime: Date;
  originalStartTime: Date;
  originalEndTime: Date;
}

export const CalendarGestureHandler: React.FC<CalendarGestureProps> = ({
  event,
  eventLayout,
  onEventMove,
  onEventResize,
  onEventPress,
  onEventLongPress,
  onEventSelect,
  hourHeight = 60,
  minEventDuration = 15,
  snapToGrid = true,
  gridSnapInterval = 15,
  children,
}) => {
  // Animation values
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0.1)).current;

  // Gesture refs
  const dragRef = useRef<PanGestureHandler>(null);
  const longPressRef = useRef<LongPressGestureHandler>(null);
  const tapRef = useRef<TapGestureHandler>(null);

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startY: 0,
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
    originalStartTime: new Date(event.startTime),
    originalEndTime: new Date(event.endTime),
  });

  // Snap time to grid
  const snapTimeToGrid = useCallback((time: Date): Date => {
    if (!snapToGrid) return time;
    
    const minutes = time.getMinutes();
    const snappedMinutes = Math.round(minutes / gridSnapInterval) * gridSnapInterval;
    
    const snappedTime = new Date(time);
    snappedTime.setMinutes(snappedMinutes, 0, 0);
    
    return snappedTime;
  }, [snapToGrid, gridSnapInterval]);

  // Convert Y position to time
  const yToTime = useCallback((y: number, baseDate: Date): Date => {
    const totalMinutes = (y / hourHeight) * 60;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const time = startOfDay(baseDate);
    time.setHours(hours, minutes, 0, 0);
    
    return snapTimeToGrid(time);
  }, [hourHeight, snapTimeToGrid]);

  // Convert time to Y position
  const timeToY = useCallback((time: Date): number => {
    const startOfDayTime = startOfDay(time);
    const minutesFromStart = differenceInMinutes(time, startOfDayTime);
    return (minutesFromStart / 60) * hourHeight;
  }, [hourHeight]);

  // Determine if gesture is near resize handle
  const isNearResizeHandle = useCallback((gestureY: number): 'top' | 'bottom' | null => {
    const handleThreshold = 20; // 20px threshold for resize handles
    
    if (gestureY < handleThreshold) {
      return 'top';
    } else if (gestureY > eventLayout.height - handleThreshold) {
      return 'bottom';
    }
    
    return null;
  }, [eventLayout.height]);

  // Handle pan gesture for drag/resize
  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = useCallback((event: any) => {
    const { state, translationY, y, absoluteY } = event.nativeEvent;

    switch (state) {
      case State.BEGAN:
        // Determine if this is a drag or resize operation
        const relativeY = absoluteY - eventLayout.top;
        const resizeHandle = isNearResizeHandle(relativeY);
        
        setDragState(prev => ({
          ...prev,
          isDragging: true,
          isResizing: !!resizeHandle,
          resizeHandle,
          startY: absoluteY,
          originalStartTime: new Date(event.startTime),
          originalEndTime: new Date(event.endTime),
        }));

        // Haptic feedback
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        // Animation feedback
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1.05,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
          }),
          Animated.spring(shadowOpacity, {
            toValue: 0.3,
            useNativeDriver: true,
            tension: 150,
            friction: 8,
          }),
        ]).start();

        break;

      case State.ACTIVE:
        if (dragState.isDragging) {
          const deltaY = translationY;
          const eventStartTime = new Date(event.startTime);
          const eventEndTime = new Date(event.endTime);
          const eventDuration = differenceInMinutes(eventEndTime, eventStartTime);

          let newStartTime: Date;
          let newEndTime: Date;

          if (dragState.isResizing && dragState.resizeHandle) {
            // Resize operation
            if (dragState.resizeHandle === 'top') {
              // Resize from top
              newStartTime = yToTime(eventLayout.top + deltaY, eventStartTime);
              newEndTime = new Date(eventEndTime);
              
              // Ensure minimum duration
              if (differenceInMinutes(newEndTime, newStartTime) < minEventDuration) {
                newStartTime = addMinutes(newEndTime, -minEventDuration);
              }
            } else {
              // Resize from bottom
              newStartTime = new Date(eventStartTime);
              newEndTime = yToTime(eventLayout.top + eventLayout.height + deltaY, eventStartTime);
              
              // Ensure minimum duration
              if (differenceInMinutes(newEndTime, newStartTime) < minEventDuration) {
                newEndTime = addMinutes(newStartTime, minEventDuration);
              }
            }
          } else {
            // Move operation
            newStartTime = yToTime(eventLayout.top + deltaY, eventStartTime);
            newEndTime = addMinutes(newStartTime, eventDuration);
          }

          setDragState(prev => ({
            ...prev,
            startTime: newStartTime,
            endTime: newEndTime,
          }));
        }
        break;

      case State.END:
      case State.CANCELLED:
        if (dragState.isDragging) {
          const deltaY = translationY;
          const threshold = 5; // Minimum movement threshold

          if (Math.abs(deltaY) > threshold) {
            // Apply the changes
            if (dragState.isResizing) {
              onEventResize?.(event, dragState.startTime, dragState.endTime);
            } else {
              onEventMove?.(event, dragState.startTime, dragState.endTime);
            }

            // Success haptic feedback
            if (Platform.OS === 'ios') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }

          // Reset drag state
          setDragState(prev => ({
            ...prev,
            isDragging: false,
            isResizing: false,
            resizeHandle: null,
          }));

          // Reset animations
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 150,
              friction: 8,
            }),
            Animated.spring(scale, {
              toValue: 1,
              useNativeDriver: true,
              tension: 150,
              friction: 8,
            }),
            Animated.spring(shadowOpacity, {
              toValue: 0.1,
              useNativeDriver: true,
              tension: 150,
              friction: 8,
            }),
          ]).start();
        }
        break;
    }
  }, [
    event,
    eventLayout,
    dragState,
    isNearResizeHandle,
    yToTime,
    minEventDuration,
    onEventMove,
    onEventResize,
    translateY,
    scale,
    shadowOpacity,
  ]);

  // Handle long press for context menu/selection
  const onLongPressHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // Medium haptic feedback for long press
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      onEventLongPress?.(event);
      onEventSelect?.(event);

      // Visual feedback for selection
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [onEventLongPress, onEventSelect, opacity]);

  // Handle tap for event press
  const onTapHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.state === State.END) {
      // Light haptic feedback for tap
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      onEventPress?.(event);
    }
  }, [onEventPress]);

  return (
    <TapGestureHandler
      ref={tapRef}
      onHandlerStateChange={onTapHandlerStateChange}
      waitFor={[longPressRef]}
      shouldCancelWhenOutside={false}
    >
      <Animated.View>
        <LongPressGestureHandler
          ref={longPressRef}
          onHandlerStateChange={onLongPressHandlerStateChange}
          minDurationMs={500}
          shouldCancelWhenOutside={false}
          simultaneousHandlers={[dragRef]}
        >
          <Animated.View>
            <PanGestureHandler
              ref={dragRef}
              onGestureEvent={onPanGestureEvent}
              onHandlerStateChange={onPanHandlerStateChange}
              minDist={10}
              activeOffsetY={[-10, 10]}
              failOffsetX={[-30, 30]}
              shouldCancelWhenOutside={false}
            >
              <Animated.View
                style={[
                  {
                    transform: [
                      { translateY },
                      { scale },
                    ],
                    opacity,
                    shadowOpacity,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 8,
                    elevation: dragState.isDragging ? 8 : 2,
                  },
                ]}
              >
                {children}

                {/* Resize handles */}
                {!dragState.isDragging && (
                  <>
                    {/* Top resize handle */}
                    <View
                      style={{
                        position: 'absolute',
                        top: -2,
                        left: 0,
                        right: 0,
                        height: 8,
                        backgroundColor: 'transparent',
                        zIndex: 1,
                      }}
                      accessible={true}
                      accessibilityLabel="Resize event start time"
                      accessibilityRole="adjustable"
                    />

                    {/* Bottom resize handle */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        left: 0,
                        right: 0,
                        height: 8,
                        backgroundColor: 'transparent',
                        zIndex: 1,
                      }}
                      accessible={true}
                      accessibilityLabel="Resize event end time"
                      accessibilityRole="adjustable"
                    />
                  </>
                )}
              </Animated.View>
            </PanGestureHandler>
          </Animated.View>
        </LongPressGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
};

/**
 * Multi-Event Selection Handler
 * 
 * Handles selection of multiple events with rubber band selection
 */
interface MultiEventSelectionProps {
  events: CalendarEvent[];
  eventLayouts: Map<string, { top: number; left: number; width: number; height: number }>;
  onSelectionChange?: (selectedEvents: CalendarEvent[]) => void;
  children: React.ReactNode;
}

export const MultiEventSelection: React.FC<MultiEventSelectionProps> = ({
  events,
  eventLayouts,
  onSelectionChange,
  children,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });
  const [selectedEvents, setSelectedEvents] = useState<CalendarEvent[]>([]);

  const selectionOpacity = useRef(new Animated.Value(0)).current;

  // Handle selection area drag
  const onSelectionPanStateChange = useCallback((event: any) => {
    const { state, x, y } = event.nativeEvent;

    switch (state) {
      case State.BEGAN:
        setIsSelecting(true);
        setSelectionStart({ x, y });
        setSelectionEnd({ x, y });
        
        Animated.timing(selectionOpacity, {
          toValue: 0.3,
          duration: 150,
          useNativeDriver: true,
        }).start();
        break;

      case State.ACTIVE:
        setSelectionEnd({ x, y });
        
        // Calculate which events are within selection area
        const selectionRect = {
          left: Math.min(selectionStart.x, x),
          top: Math.min(selectionStart.y, y),
          right: Math.max(selectionStart.x, x),
          bottom: Math.max(selectionStart.y, y),
        };

        const eventsInSelection = events.filter(event => {
          const layout = eventLayouts.get(event.id);
          if (!layout) return false;

          return (
            layout.left < selectionRect.right &&
            layout.left + layout.width > selectionRect.left &&
            layout.top < selectionRect.bottom &&
            layout.top + layout.height > selectionRect.top
          );
        });

        setSelectedEvents(eventsInSelection);
        break;

      case State.END:
      case State.CANCELLED:
        setIsSelecting(false);
        
        Animated.timing(selectionOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();

        if (selectedEvents.length > 0) {
          onSelectionChange?.(selectedEvents);
        }
        break;
    }
  }, [
    events,
    eventLayouts,
    selectionStart,
    selectedEvents,
    onSelectionChange,
    selectionOpacity,
  ]);

  return (
    <PanGestureHandler
      onHandlerStateChange={onSelectionPanStateChange}
      minDist={20}
      shouldCancelWhenOutside={false}
    >
      <View style={{ flex: 1 }}>
        {children}

        {/* Selection overlay */}
        {isSelecting && (
          <Animated.View
            style={{
              position: 'absolute',
              left: Math.min(selectionStart.x, selectionEnd.x),
              top: Math.min(selectionStart.y, selectionEnd.y),
              width: Math.abs(selectionEnd.x - selectionStart.x),
              height: Math.abs(selectionEnd.y - selectionStart.y),
              backgroundColor: 'rgba(33, 150, 243, 0.3)',
              borderWidth: 1,
              borderColor: '#2196f3',
              borderStyle: 'dashed',
              opacity: selectionOpacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </View>
    </PanGestureHandler>
  );
};

/**
 * Time Slot Gesture Handler
 * 
 * Handles gestures on empty time slots for creating new events
 */
interface TimeSlotGestureProps {
  date: Date;
  hour: number;
  onCreateEvent?: (startTime: Date, endTime: Date) => void;
  children: React.ReactNode;
}

export const TimeSlotGesture: React.FC<TimeSlotGestureProps> = ({
  date,
  hour,
  onCreateEvent,
  children,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [createStartY, setCreateStartY] = useState(0);
  const [createEndY, setCreateEndY] = useState(0);

  const createOpacity = useRef(new Animated.Value(0)).current;

  const onCreatePanStateChange = useCallback((event: any) => {
    const { state, y, translationY } = event.nativeEvent;

    switch (state) {
      case State.BEGAN:
        setIsCreating(true);
        setCreateStartY(y);
        setCreateEndY(y);
        
        // Light haptic feedback
        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        Animated.timing(createOpacity, {
          toValue: 0.5,
          duration: 150,
          useNativeDriver: true,
        }).start();
        break;

      case State.ACTIVE:
        setCreateEndY(y + translationY);
        break;

      case State.END:
        if (isCreating) {
          const startTime = new Date(date);
          startTime.setHours(hour, 0, 0, 0);
          
          const durationMinutes = Math.max(
            15, // Minimum 15 minutes
            Math.abs(createEndY - createStartY) * 0.5 // Approximate conversion
          );
          
          const endTime = addMinutes(startTime, durationMinutes);
          
          onCreateEvent?.(startTime, endTime);

          // Success haptic feedback
          if (Platform.OS === 'ios') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }

        setIsCreating(false);
        Animated.timing(createOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
        break;

      case State.CANCELLED:
        setIsCreating(false);
        Animated.timing(createOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
        break;
    }
  }, [
    date,
    hour,
    isCreating,
    createStartY,
    createEndY,
    onCreateEvent,
    createOpacity,
  ]);

  return (
    <PanGestureHandler
      onHandlerStateChange={onCreatePanStateChange}
      minDist={10}
      activeOffsetY={[-10, 10]}
      shouldCancelWhenOutside={false}
    >
      <View style={{ flex: 1 }}>
        {children}

        {/* Event creation preview */}
        {isCreating && (
          <Animated.View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: Math.min(0, createEndY - createStartY),
              height: Math.abs(createEndY - createStartY),
              backgroundColor: 'rgba(33, 150, 243, 0.3)',
              borderWidth: 1,
              borderColor: '#2196f3',
              borderStyle: 'dashed',
              borderRadius: 4,
              opacity: createOpacity,
              pointerEvents: 'none',
            }}
          />
        )}
      </View>
    </PanGestureHandler>
  );
};

export default CalendarGestureHandler;