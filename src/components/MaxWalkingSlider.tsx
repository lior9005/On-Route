import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { CONFIG } from '../constants/config';

interface LabeledSliderProps {
  icon: string;
  label: string;
  value: number;
  unit: string; // Appended to values, e.g. "m" or " min"
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
}

/**
 * Slider with an icon, a label showing the current value and min/max captions
 */
export function LabeledSlider({ icon, label, value, unit, min, max, step, onValueChange }: LabeledSliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.labelIcon}>{icon}</Text>
        <Text style={styles.label}>
          {label}: <Text style={styles.valueText}>{value}{unit}</Text>
        </Text>
      </View>
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          value={value}
          onValueChange={onValueChange}
          step={step}
          minimumTrackTintColor="#2196F3"
          maximumTrackTintColor="#E0E0E0"
          thumbTintColor="#2196F3"
        />
      </View>
      <View style={styles.labels}>
        <Text style={styles.minLabel}>{min}{unit}</Text>
        <Text style={styles.maxLabel}>{max}{unit}</Text>
      </View>
    </View>
  );
}

interface ValueSliderProps {
  value: number;
  onValueChange: (value: number) => void;
}

export function MaxWalkingSlider({ value, onValueChange }: ValueSliderProps) {
  return (
    <LabeledSlider
      icon="🚶"
      label="Max Walking Distance"
      value={value}
      unit="m"
      min={CONFIG.MIN_WALKING_DISTANCE}
      max={CONFIG.MAX_WALKING_DISTANCE}
      step={100}
      onValueChange={onValueChange}
    />
  );
}

/**
 * Bus mode: how much extra driving the driver accepts
 */
export function MaxDetourSlider({ value, onValueChange }: ValueSliderProps) {
  return (
    <LabeledSlider
      icon="🚗"
      label="Max Extra Driving"
      value={value}
      unit=" min"
      min={CONFIG.MIN_DETOUR_MINUTES}
      max={CONFIG.MAX_DETOUR_MINUTES}
      step={1}
      onValueChange={onValueChange}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 0,
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 0.3,
  },
  valueText: {
    color: '#2196F3',
    fontWeight: '800',
  },
  sliderContainer: {
    paddingVertical: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  minLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  maxLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});
