import React, { useState } from 'react';
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
  const [editing, setEditing] = useState(false);
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

  const timeText = value ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : '';
  const dateText = value ? `${WEEKDAYS[value.getDay()]} ${value.getDate()} ${MONTHS[value.getMonth()]}` : '';

  return (
    <View style={styles.container}>
      <SegmentedControl<'NOW' | 'LATER'>
        label="When"
        options={[
          { value: 'NOW', label: 'Now' },
          { value: 'LATER', label: 'Later' },
        ]}
        value={value ? 'LATER' : 'NOW'}
        onChange={(mode) => {
          if (mode === 'LATER' && !value) setEditing(true);
          onChange(mode === 'NOW' ? null : value ?? defaultPlannedTime());
        }}
      />

      {value && !editing && (
        <TouchableOpacity style={styles.summaryChip} onPress={() => setEditing(true)} activeOpacity={0.8}>
          <Text style={[styles.summaryChipText, isPast && styles.summaryPast]}>
            {isPast ? '⚠️ Time has passed' : `📅 ${dateText} · ${timeText}`}
          </Text>
          <Text style={styles.changeText}>Change</Text>
        </TouchableOpacity>
      )}

      {value && editing && (
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

          <Text style={styles.time}>{timeText}</Text>
          <View style={styles.stepRow}>
            <StepButton label="−1 h" onPress={() => shiftMinutes(-60)} />
            <StepButton label={`−${MINUTE_STEP} min`} onPress={() => shiftMinutes(-MINUTE_STEP)} />
            <StepButton label={`+${MINUTE_STEP} min`} onPress={() => shiftMinutes(MINUTE_STEP)} />
            <StepButton label="+1 h" onPress={() => shiftMinutes(60)} />
          </View>

          <View style={styles.plannerFooter}>
            <Text style={[styles.summary, isPast && styles.summaryPast]}>
              {isPast ? '⚠️ That time has passed. Pick a later time.' : `Driver leaves ${dateText}, ${timeText}`}
            </Text>
            <TouchableOpacity onPress={() => setEditing(false)} disabled={isPast}>
              <Text style={[styles.doneText, isPast && styles.doneDisabled]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

function StepButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.stepButton} onPress={onPress} accessibilityLabel={label} activeOpacity={0.7}>
      <Text style={styles.stepButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {},
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F8FB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: -6,
    marginBottom: 14,
  },
  summaryChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E3A5F',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976D2',
  },
  planner: {
    backgroundColor: '#F6F8FB',
    borderRadius: 12,
    padding: 12,
    marginTop: -6,
    marginBottom: 14,
  },
  days: {
    gap: 8,
    paddingBottom: 4,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE3EA',
  },
  dayChipSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A5561',
  },
  dayTextSelected: {
    color: '#1976D2',
  },
  time: {
    fontSize: 34,
    fontWeight: '800',
    color: '#1E3A5F',
    letterSpacing: 1,
    textAlign: 'center',
    marginTop: 10,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  stepButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DDE3EA',
  },
  stepButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1976D2',
  },
  plannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  summary: {
    flex: 1,
    fontSize: 13,
    color: '#4A5561',
    marginRight: 12,
  },
  summaryPast: {
    color: '#D32F2F',
    fontWeight: '600',
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1976D2',
  },
  doneDisabled: {
    color: '#B0BAC5',
  },
});
