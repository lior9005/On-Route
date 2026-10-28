import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WalkingTradeoffStep } from '../models';
import { secondsToMinutes } from '../utils/distance';

interface WalkingTradeoffProps {
  tradeoff: WalkingTradeoffStep[];
  currentLimit: number;
  onSelectLimit: (maxWalk: number) => void;
}

/**
 * Shows how the best driving time changes with the passenger's walking limit.
 * Only steps where the best time changes are listed, plus the current limit.
 */
export function WalkingTradeoff({ tradeoff, currentLimit, onSelectLimit }: WalkingTradeoffProps) {
  const current = tradeoff.find((s) => s.maxWalk === currentLimit);
  if (!current || current.bestDriveTime === null) {
    return null;
  }
  const baseline = current.bestDriveTime;

  const rows = tradeoff.filter((s, i) => {
    if (s.bestDriveTime === null) return false;
    if (s.maxWalk === currentLimit) return true;
    const prev = tradeoff[i - 1];
    return !prev || prev.bestDriveTime !== s.bestDriveTime;
  });

  // First longer walk that saves at least a minute of driving
  const nextGain = tradeoff.find(
    (s) =>
      s.maxWalk > currentLimit &&
      s.bestDriveTime !== null &&
      baseline - s.bestDriveTime >= 60,
  );
  const lastStep = tradeoff[tradeoff.length - 1];
  const hint = nextGain
    ? `Walking ${nextGain.maxWalk - currentLimit}m more saves ${secondsToMinutes(baseline - nextGain.bestDriveTime!)} min of driving`
    : lastStep && lastStep.maxWalk > currentLimit
      ? `Walking up to ${lastStep.maxWalk}m wouldn't save a full minute`
      : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚶 Walk more, drive less?</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.headerRow}>
        <Text style={[styles.cell, styles.headerText]}>Max walk</Text>
        <Text style={[styles.cell, styles.headerText]}>Best drive</Text>
        <Text style={[styles.cell, styles.headerText]}>vs. now</Text>
      </View>
      {rows.map((s) => {
        const isCurrent = s.maxWalk === currentLimit;
        const diffMin = secondsToMinutes(s.bestDriveTime! - baseline);
        return (
          <TouchableOpacity
            key={s.maxWalk}
            style={[styles.row, isCurrent && styles.currentRow]}
            onPress={() => onSelectLimit(s.maxWalk)}
            disabled={isCurrent}
          >
            <Text style={[styles.cell, isCurrent && styles.currentText]}>
              {s.maxWalk}m{isCurrent ? ' (now)' : ''}
            </Text>
            <Text style={styles.cell}>{secondsToMinutes(s.bestDriveTime!)} min</Text>
            <Text style={[styles.cell, diffMin < 0 && styles.saving, diffMin > 0 && styles.loss]}>
              {isCurrent ? '—' : diffMin === 0 ? '±0' : `${diffMin > 0 ? '+' : ''}${diffMin} min`}
            </Text>
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
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: '#1565C0',
    fontWeight: '600',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  currentRow: {
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  cell: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    paddingHorizontal: 4,
  },
  currentText: {
    fontWeight: '700',
    color: '#2196F3',
  },
  saving: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  loss: {
    color: '#C62828',
  },
});
