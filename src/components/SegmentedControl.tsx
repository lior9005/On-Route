import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  /** Small caption above the control, e.g. "When" */
  label?: string;
}

/**
 * Switch between a few options (e.g. Walking | Bus): grey track with the
 * selected option as a white pill, so it stays calmer than the main button.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.caption}>{label}</Text>}
      <View style={styles.track}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7785',
    marginBottom: 6,
    marginLeft: 2,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: '#EEF1F5',
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#fff',
    shadowColor: '#1E3A5F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7785',
  },
  labelSelected: {
    color: '#1976D2',
    fontWeight: '700',
  },
});
