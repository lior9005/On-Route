import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SegmentedControl } from './SegmentedControl';

const DAYS_AHEAD = 7;
const MINUTE_STEP = 15;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DepartureTimePickerProps {
  /** null = leave now */
  value: Date | null;
  onChange: (value: Date | null) => void;
}

/**
 * Default planned time: 30 minutes from now, rounded up to the next quarter hour
 */
export function defaultPlannedTime(now: Date = new Date()): Date {
  const d = new Date(now.getTime() + 30 * 60_000);
  const minutes = Math.ceil(d.getMinutes() / MINUTE_STEP) * MINUTE_STEP;
  d.setMinutes(minutes, 0, 0);
  return d;
}

function startOfDay(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}

function dayLabel(day: Date, today: Date): string {
  const diff = Math.round((startOfDay(day).getTime() - startOfDay(today).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${WEEKDAYS[day.getDay()]} ${day.getDate()}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * When the driver leaves: now, or a planned day and time (next 7 days)
 */
export function DepartureTimePicker({ value, onChange }: DepartureTimePickerProps) {
  const now = new Date();
  const isPast = value !== null && value.getTime() <= now.getTime();

  const setDay = (day: Date) => {
    if (!value) return;
    const next = new Date(day);
    next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    onChange(next);
  };
  const shiftMinutes = (minutes: number) => {
    if (!value) return;
    const next = new Date(value.getTime() + minutes * 60_000);
    // Stay on the chosen day: wrap around midnight instead of changing day
    if (startOfDay(next).getTime() !== startOfDay(value).getTime()) {
      next.setTime(next.getTime() + (minutes > 0 ? -1 : 1) * 86_400_000);
    }
    onChange(next);
  };

  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = startOfDay(now);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <View style={styles.container}>
      <SegmentedControl<'NOW' | 'LATER'>
        options={[
          { value: 'NOW', label: '🕒 Leave now' },
          { value: 'LATER', label: '📅 Plan a ride' },
        ]}
        value={value ? 'LATER' : 'NOW'}
        onChange={(mode) => onChange(mode === 'NOW' ? null : value ?? defaultPlannedTime())}
      />

      {value && (
        <View style={styles.planner}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
            {days.map((day) => {
              const selected = startOfDay(value).getTime() === day.getTime();
              return (
                <TouchableOpacity
                  key={day.getTime()}
                  style={[styles.dayChip, selected && styles.dayChipSelected]}
                  onPress={() => setDay(day)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                    {dayLabel(day, now)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.timeRow}>
            <Stepper label="Hour" onMinus={() => shiftMinutes(-60)} onPlus={() => shiftMinutes(60)} />
            <Text style={styles.time}>
              {pad(value.getHours())}:{pad(value.getMinutes())}
            </Text>
            <Stepper
              label="Min"
              onMinus={() => shiftMinutes(-MINUTE_STEP)}
              onPlus={() => shiftMinutes(MINUTE_STEP)}
            />
          </View>

          <Text style={[styles.summary, isPast && styles.summaryPast]}>
            {isPast
              ? '⚠️ That time has passed. Pick a later time.'
              : `Driver leaves ${WEEKDAYS[value.getDay()]} ${value.getDate()} ${MONTHS[value.getMonth()]}, ${pad(value.getHours())}:${pad(value.getMinutes())}`}
          </Text>
        </View>
      )}
    </View>
  );
}

function Stepper({ label, onMinus, onPlus }: { label: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepButton} onPress={onMinus} accessibilityLabel={`${label} earlier`}>
        <Text style={styles.stepButtonText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepLabel}>{label}</Text>
      <TouchableOpacity style={styles.stepButton} onPress={onPlus} accessibilityLabel={`${label} later`}>
        <Text style={styles.stepButtonText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  planner: {
    backgroundColor: '#F6F8FB',
    borderRadius: 14,
    padding: 12,
    marginTop: -4,
    marginBottom: 14,
  },
  days: {
    gap: 8,
    paddingBottom: 4,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE3EA',
  },
  dayChipSelected: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  dayTextSelected: {
    color: '#fff',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  time: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E3A5F',
    letterSpacing: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2196F3',
    lineHeight: 22,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  summary: {
    marginTop: 10,
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
  },
  summaryPast: {
    color: '#D32F2F',
    fontWeight: '600',
  },
});
