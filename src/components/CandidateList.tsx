import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { CandidatePoint } from '../models';
import { secondsToMinutes, metersToKilometers } from '../utils/distance';
import { describeBusTrip } from '../utils/transitText';

interface CandidateListProps {
  candidates: CandidatePoint[];
  selectedId?: string;
  onSelect: (candidate: CandidatePoint) => void;
}

/**
 * Display name with an icon for the meeting point type
 */
export function meetingPointLabel(candidate: CandidatePoint): string {
  if (candidate.passengerLeg.mode === 'TRANSIT') {
    // The car stops near the bus stop, not in it
    return `🚏 Near ${candidate.name || 'bus stop'}`;
  }
  if (candidate.kind === 'STREET') {
    return `🏘️ ${candidate.name || 'Side street'}`;
  }
  return `🚏 ${candidate.name || 'Transit Station'}`;
}

function CandidateItem({
  item,
  isSelected,
  isShortestWalk,
  onSelect,
}: {
  item: CandidatePoint;
  isSelected: boolean;
  isShortestWalk: boolean;
  onSelect: () => void;
}) {
  const busTrip = describeBusTrip(item);
  return (
    <TouchableOpacity
      style={[
        styles.item,
        isShortestWalk && styles.shortestWalkItem,
        isSelected && styles.selectedItem,
      ]}
      onPress={onSelect}
    >
      {isShortestWalk && (
        <View style={styles.shortestWalkBadge}>
          <Text style={styles.shortestWalkBadgeText}>
            {busTrip ? '🚌 Fastest for passenger' : '🚶 Shortest walk'}
          </Text>
        </View>
      )}
      <Text style={styles.name}>{meetingPointLabel(item)}</Text>
      {item.extraDriveTime !== undefined && (
        <Text style={styles.extraTime}>
          +{secondsToMinutes(item.extraDriveTime)} min vs. your normal route
          {item.driverWaitSeconds ? ` · ⏳ driver waits ${secondsToMinutes(item.driverWaitSeconds)} min` : ''}
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
      {busTrip ? (
        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel}>
            🚌 Passenger Bus · {secondsToMinutes(item.passengerLeg.duration)} min trip
          </Text>
          {busTrip.map((line) => (
            <Text key={line} style={styles.routeValue}>{line}</Text>
          ))}
        </View>
      ) : (
        <View style={styles.routeInfo}>
          <Text style={styles.routeLabel}>🚶 Passenger Walk</Text>
          <Text style={styles.routeValue}>
            {secondsToMinutes(item.passengerLeg.duration)} min ({metersToKilometers(item.passengerLeg.distance).toFixed(1)} km)
          </Text>
        </View>
      )}
      <View style={styles.totalInfo}>
        <Text style={styles.totalLabel}>
          {busTrip ? 'Driver extra time + bus trip:' : 'Total Driving:'}
        </Text>
        <Text style={styles.totalValue}>
          {secondsToMinutes(busTrip ? item.combinedTime ?? 0 : item.totalDetour)} min
        </Text>
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

  // Highlight the option where the passenger walks the least (only when there is a choice)
  const shortestWalkId =
    candidates.length > 1
      ? candidates.reduce((best, c) =>
          c.passengerLeg.duration < best.passengerLeg.duration ? c : best,
        ).id
      : undefined;

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
          isShortestWalk={item.id === shortestWalkId}
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
  shortestWalkItem: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#43A047',
  },
  shortestWalkBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#43A047',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  shortestWalkBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
