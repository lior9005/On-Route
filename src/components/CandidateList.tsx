import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { CandidatePoint } from '../models';
import { secondsToMinutes, metersToKilometers } from '../utils/distance';

interface CandidateListProps {
  candidates: CandidatePoint[];
  selectedId?: string;
  onSelect: (candidate: CandidatePoint) => void;
}

/**
 * Display name with an icon for the meeting point type
 */
export function meetingPointLabel(candidate: CandidatePoint): string {
  if (candidate.kind === 'STREET') {
    return `🏘️ ${candidate.name || 'Side street'}`;
  }
  return `🚏 ${candidate.name || 'Transit Station'}`;
}

function CandidateItem({
  item,
  isSelected,
  onSelect,
}: {
  item: CandidatePoint;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.selectedItem]}
      onPress={onSelect}
    >
      <Text style={styles.name}>{meetingPointLabel(item)}</Text>
      {item.extraDriveTime !== undefined && (
        <Text style={styles.extraTime}>
          +{secondsToMinutes(item.extraDriveTime)} min vs. your normal route
        </Text>
      )}
      <View style={styles.routeInfo}>
        <Text style={styles.routeLabel}>🚗 Your Location → Drop/Pick Location</Text>
        <Text style={styles.routeValue}>
          {secondsToMinutes(item.leg1.duration)} min ({metersToKilometers(item.leg1.distance).toFixed(1)} km)
        </Text>
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeLabel}>🚗 Drop/Pick Location → Destination</Text>
        <Text style={styles.routeValue}>
          {secondsToMinutes(item.leg2.duration)} min ({metersToKilometers(item.leg2.distance).toFixed(1)} km)
        </Text>
      </View>
      <View style={styles.routeInfo}>
        <Text style={styles.routeLabel}>🚶 Passenger Walk</Text>
        <Text style={styles.routeValue}>
          {secondsToMinutes(item.passengerLeg.duration)} min ({metersToKilometers(item.passengerLeg.distance).toFixed(1)} km)
        </Text>
      </View>
      <View style={styles.totalInfo}>
        <Text style={styles.totalLabel}>Total Driving:</Text>
        <Text style={styles.totalValue}>{secondsToMinutes(item.totalDetour)} min</Text>
      </View>
    </TouchableOpacity>
  );
}

export function CandidateList({ candidates, selectedId, onSelect }: CandidateListProps) {
  if (candidates.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No candidates found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled
    >
      {candidates.map((item) => (
        <CandidateItem
          key={item.id}
          item={item}
          isSelected={item.id === selectedId}
          onSelect={() => onSelect(item)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingBottom: 20,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    minHeight: 150,
  },
  selectedItem: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#2196F3',
  },
  extraTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginTop: -8,
    marginBottom: 12,
  },
  routeInfo: {
    marginBottom: 6,
  },
  routeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 12,
    color: '#666',
  },
  totalInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
