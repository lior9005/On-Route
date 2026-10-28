import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CandidatePoint, WalkingTradeoffStep } from '../models';
import { secondsToMinutes } from '../utils/distance';
import { meetingPointLabel } from './CandidateList';

interface WalkingTradeoffProps {
  tradeoff: WalkingTradeoffStep[];
  currentLimit: number; // The suggested walk (shortest within a minute of the fastest)
  directDriveTime: number | null; // The driver's direct A→C time (seconds), if known
  selectedId?: string;
  onSelect: (candidate: CandidatePoint) => void;
}

/**
 * Shows how the best driving time changes with the passenger's walking limit.
 * Each row names the one meeting point that gives that time; only steps where
 * the best point changes are listed, plus the current limit.
 */
export function WalkingTradeoff({ tradeoff, currentLimit, directDriveTime, selectedId, onSelect }: WalkingTradeoffProps) {
  const current = tradeoff.find((s) => s.maxWalk === currentLimit);
  if (!current || current.bestDriveTime === null) {
    return null;
  }

  const rows = tradeoff.filter((s, i) => {
    if (!s.best) return false;
    if (s.maxWalk === currentLimit) return true;
    const prev = tradeoff[i - 1];
    return !prev || prev.best?.id !== s.best.id;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚶 Walk more, drive less?</Text>
      <Text style={styles.subtitle}>Fastest spot for each walking distance. Tap one to preview it.</Text>
      {directDriveTime !== null && (
        <View style={styles.directBox}>
          <Text style={styles.directLabel}>🚗 Direct drive, no pickup</Text>
          <Text style={styles.directValue}>{secondsToMinutes(directDriveTime)} min</Text>
        </View>
      )}
      {rows.map((s) => {
        const best = s.best!;
        const isCurrent = s.maxWalk === currentLimit;
        const addedMin =
          directDriveTime !== null
            ? secondsToMinutes(Math.max(0, best.totalDetour - directDriveTime))
            : null;
        return (
          <TouchableOpacity
            key={s.maxWalk}
            style={[styles.row, best.id === selectedId && styles.selectedRow]}
            onPress={() => onSelect(best)}
          >
            <View style={styles.rowMain}>
              <Text style={[styles.walk, isCurrent && styles.currentText]}>
                Up to {s.maxWalk}m{isCurrent ? ' · suggested' : ''}
              </Text>
              <Text style={styles.place} numberOfLines={1}>
                {meetingPointLabel(best)} · {Math.round(best.passengerLeg.distance)}m walk
              </Text>
            </View>
            <View style={styles.rowTime}>
              <Text style={styles.drive}>{secondsToMinutes(best.totalDetour)} min</Text>
              {addedMin !== null && (
                <Text style={styles.added}>+{addedMin} min vs direct</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F5F9FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    marginBottom: 6,
  },
  directBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  directLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1565C0',
  },
  directValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1565C0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectedRow: {
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  rowMain: {
    flex: 1,
    marginRight: 8,
  },
  walk: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  currentText: {
    color: '#2196F3',
  },
  place: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  rowTime: {
    alignItems: 'flex-end',
  },
  drive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  added: {
    fontSize: 12,
    color: '#C62828',
  },
});
