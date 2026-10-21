import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { CONFIG } from '../constants/config';

interface MaxWalkingSliderProps {
  value: number;
  onValueChange: (value: number) => void;
}

export function MaxWalkingSlider({ value, onValueChange }: MaxWalkingSliderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labelContainer}>
        <Text style={styles.labelIcon}>🚶</Text>
        <Text style={styles.label}>
          Max Walking Distance: <Text style={styles.valueText}>{value}m</Text>
        </Text>
      </View>
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={CONFIG.MIN_WALKING_DISTANCE}
          maximumValue={CONFIG.MAX_WALKING_DISTANCE}
          value={value}
          onValueChange={onValueChange}
          step={100}
          minimumTrackTintColor="#2196F3"
          maximumTrackTintColor="#E0E0E0"
          thumbTintColor="#2196F3"
        />
      </View>
      <View style={styles.labels}>
        <Text style={styles.minLabel}>{CONFIG.MIN_WALKING_DISTANCE}m</Text>
        <Text style={styles.maxLabel}>{CONFIG.MAX_WALKING_DISTANCE}m</Text>
      </View>
    </View>
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
