import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, LayoutChangeEvent } from 'react-native';
import { TravelMode } from '../models';

const STEPS: Record<TravelMode, string[]> = {
  WALK: [
    '🚗 Finding the fastest driving route…',
    '🚶 Mapping the walk for your passenger…',
    '🗺️ Drawing the map…',
  ],
  BUS: [
    '🚗 Finding the fastest driving route…',
    '🚌 Mapping the bus for your passenger…',
    '🗺️ Drawing the map…',
  ],
};
const STEP_INTERVAL_MS = 800; // All steps show within the minimum loading time
const CAR_SIZE = 36;

interface RouteLoadingProps {
  meetingPointName: string;
  mode?: TravelMode;
}

/**
 * Loading screen while the route preview is fetched: a car driving a
 * mini route (start → meeting point → destination) on the app's dark theme.
 */
export function RouteLoading({ meetingPointName, mode = 'WALK' }: RouteLoadingProps) {
  const steps = STEPS[mode];
  const drive = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [roadWidth, setRoadWidth] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const driveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drive, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(drive, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    driveLoop.start();
    pulseLoop.start();

    const stepTimer = setInterval(
      () => setStep((s) => Math.min(s + 1, steps.length - 1)),
      STEP_INTERVAL_MS,
    );

    return () => {
      driveLoop.stop();
      pulseLoop.stop();
      clearInterval(stepTimer);
    };
  }, [drive, fade, pulse]);

  const carX = drive.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, roadWidth - CAR_SIZE)],
  });

  return (
    <View style={styles.container}>
      <View style={styles.backgroundCircle} />

      <Animated.View style={[styles.content, { opacity: fade }]}>
        <Text style={styles.title}>Planning your route</Text>
        <Text style={styles.meetingPoint} numberOfLines={2}>
          {meetingPointName}
        </Text>

        {/* Mini route: start → meeting point → destination */}
        <View style={styles.routeCard}>
          <View
            style={styles.road}
            onLayout={(e: LayoutChangeEvent) => setRoadWidth(e.nativeEvent.layout.width)}
          >
            <View style={styles.roadLine} />
            <View style={[styles.stop, styles.stopStart]} />
            <Animated.View style={[styles.stop, styles.stopMeeting, { transform: [{ scale: pulse }] }]} />
            <View style={[styles.stop, styles.stopEnd]} />
            <Animated.View style={[styles.car, { transform: [{ translateX: carX }] }]}>
              <Text style={styles.carEmoji}>🚗</Text>
            </Animated.View>
          </View>
          <View style={styles.labels}>
            <Text style={styles.label}>You</Text>
            <Text style={styles.label}>Meeting point</Text>
            <Text style={styles.label}>Destination</Text>
          </View>
        </View>

        <Text style={styles.step}>{steps[step]}</Text>
        <View style={styles.progressDots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1929',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backgroundCircle: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: '#1E3A5F',
    opacity: 0.6,
    top: -180,
    left: -160,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  meetingPoint: {
    color: '#90CAF9',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  routeCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    marginBottom: 28,
  },
  road: {
    height: CAR_SIZE + 8,
    justifyContent: 'center',
  },
  roadLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  stop: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0A1929',
  },
  stopStart: {
    left: 0,
    backgroundColor: '#4285F4',
  },
  stopMeeting: {
    left: '50%',
    marginLeft: -7,
    backgroundColor: '#E91E63',
  },
  stopEnd: {
    right: 0,
    backgroundColor: '#34A853',
  },
  car: {
    position: 'absolute',
    left: 0,
    top: -4,
    width: CAR_SIZE,
    alignItems: 'center',
  },
  carEmoji: {
    fontSize: 28,
    transform: [{ scaleX: -1 }], // Emoji faces left; it drives right
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  step: {
    color: '#fff',
    fontSize: 15,
    marginBottom: 14,
    textAlign: 'center',
  },
  progressDots: {
    flexDirection: 'row',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dotActive: {
    backgroundColor: '#2196F3',
  },
});
