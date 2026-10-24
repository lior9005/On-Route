import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { TravelMode } from '../models';

const MESSAGES: Record<TravelMode, string[]> = {
  WALK: [
    'Looking for bus stops…',
    'Checking quiet streets…',
    'Comparing driving times…',
    'Measuring the walk…',
  ],
  BUS: [
    'Finding stops on your route…',
    'Checking direct buses…',
    'Matching bus times…',
    'Comparing total times…',
  ],
};
const MESSAGE_INTERVAL_MS = 1400;

/**
 * Button content while meeting points are being searched: a magnifier
 * sweeping over map pins and a rotating status message.
 */
export function SearchingIndicator({ mode = 'WALK' }: { mode?: TravelMode }) {
  const messages = MESSAGES[mode];
  const sweep = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(1)).current;
  const [message, setMessage] = useState(0);

  useEffect(() => {
    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    sweepLoop.start();

    const timer = setInterval(() => {
      Animated.timing(textFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
        setMessage((m) => (m + 1) % messages.length);
        Animated.timing(textFade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      });
    }, MESSAGE_INTERVAL_MS);

    return () => {
      sweepLoop.stop();
      clearInterval(timer);
    };
  }, [sweep, textFade, messages.length]);

  const magnifierX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-20, 20] });
  const magnifierTilt = sweep.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] });
  // Each pin "lights up" as the magnifier passes over it
  const pinOpacity = (at: number) =>
    sweep.interpolate({
      inputRange: [0, Math.max(0, at - 0.2), at, Math.min(1, at + 0.2), 1],
      outputRange: [0.35, 0.35, 1, 0.35, 0.35],
      extrapolate: 'clamp',
    });

  return (
    <View style={styles.container}>
      <View style={styles.scanner}>
        <View style={styles.pins}>
          {[0.1, 0.5, 0.9].map((at) => (
            <Animated.Text key={at} style={[styles.pin, { opacity: pinOpacity(at) }]}>
              📍
            </Animated.Text>
          ))}
        </View>
        <Animated.Text
          style={[
            styles.magnifier,
            { transform: [{ translateX: magnifierX }, { rotate: magnifierTilt }] },
          ]}
        >
          🔍
        </Animated.Text>
      </View>
      <Animated.Text style={[styles.text, { opacity: textFade }]} numberOfLines={1}>
        {messages[message % messages.length]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanner: {
    width: 60,
    height: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pins: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 60,
  },
  pin: {
    fontSize: 13,
  },
  magnifier: {
    fontSize: 20,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
