import React, { useRef, useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import type { LocationGeocodedAddress } from 'expo-location';
import { Coordinates } from '../models';
import { CONFIG } from '../constants/config';


function formatGeocodedAddress(addr: LocationGeocodedAddress): string {
    if (addr.formattedAddress) return addr.formattedAddress;
    const parts = [
        addr.streetNumber,
        addr.street,
        addr.district,
        addr.city,
        addr.subregion,
        addr.region,
        addr.postalCode,
        addr.country,
    ].filter(Boolean) as string[];
    return parts.join(', ') || 'Current location';
}

interface DestinationInputProps {
    driverStartText: string;
    driverDestinationText: string;
    passengerHomeText: string;
    invalidDriverStart: boolean;
    invalidDriverDestination: boolean;
    invalidPassengerHome: boolean;
    onDriverStartChange: (coord: Coordinates | null, text?: string) => void;
    onDriverDestinationChange: (coord: Coordinates | null, text?: string) => void;
    onPassengerHomeChange: (coord: Coordinates | null, text?: string) => void;
    onDriverStartTextChange?: (text: string) => void;
    onDriverDestinationTextChange?: (text: string) => void;
    onPassengerHomeTextChange?: (text: string) => void;
}

export function DestinationInput({
    driverStartText,
    driverDestinationText,
    passengerHomeText,
    invalidDriverStart,
    invalidDriverDestination,
    invalidPassengerHome,
    onDriverStartChange,
    onDriverDestinationChange,
    onPassengerHomeChange,
    onDriverStartTextChange,
    onDriverDestinationTextChange,
    onPassengerHomeTextChange,
}: DestinationInputProps) {
    const [loadingLocation, setLoadingLocation] = useState<'driverStart' | 'driverDestination' | 'passenger' | null>(null);
    const [focusedField, setFocusedField] = useState<'driverStart' | 'driverDestination' | 'passenger' | null>(null);
    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const driverStartRef = useRef<GooglePlacesAutocompleteRef>(null);
    const driverDestRef = useRef<GooglePlacesAutocompleteRef>(null);
    const passengerRef = useRef<GooglePlacesAutocompleteRef>(null);

    const handleFocus = (field: 'driverStart' | 'driverDestination' | 'passenger') => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setFocusedField(field);
    };


    const handleBlur = () => {
        // Small delay to allow dropdown to appear before clearing focus
        blurTimeoutRef.current = setTimeout(() => {
            setFocusedField(null);
        }, 150);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    // Update text inputs when props change (e.g., when navigating back)
    useEffect(() => {
        if (driverStartText && driverStartRef.current) {
            driverStartRef.current.setAddressText(driverStartText);
        }
    }, [driverStartText]);

    useEffect(() => {
        if (driverDestinationText && driverDestRef.current) {
            driverDestRef.current.setAddressText(driverDestinationText);
        }
    }, [driverDestinationText]);

    useEffect(() => {
        if (passengerHomeText && passengerRef.current) {
            passengerRef.current.setAddressText(passengerHomeText);
        }
    }, [passengerHomeText]);


    const handleUseCurrentLocation = async (
        field: 'driverStart' | 'driverDestination' | 'passenger',
        onChange: (coord: Coordinates | null, text?: string) => void,
        onTextChange?: (text: string) => void,
        autocompleteRef?: React.RefObject<GooglePlacesAutocompleteRef | null>
    ) => {
        setLoadingLocation(field);
        try {
            // Check and request permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            
            if (status !== 'granted') {
                Alert.alert('Permission needed', 'Location permission is required to use current location.');
                setLoadingLocation(null);
                return;
            }

            let location;
            
            // Try to get last known location first (instant!)
            try {
                const lastKnown = await Location.getLastKnownPositionAsync({
                    maxAge: 60000, // Accept locations up to 1 minute old
                    requiredAccuracy: 500, // Accept accuracy up to 500m
                });
                
                if (lastKnown) {
                    location = lastKnown;
                }
            } catch (lastKnownErr) {
                // Silently fall back to GPS
            }

            // If no last known location, get fresh GPS position with lower accuracy for speed
            if (!location) {
                location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Low, // Faster than Balanced
                });
            }

            if (!location || !location.coords) {
                throw new Error('Location data is invalid');
            }

            const coords: Coordinates = {
                lat: location.coords.latitude,
                lon: location.coords.longitude,
            };

            // Reverse geocode to get address
            try {
                const geocoded = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                });
                
                const addressText = geocoded && geocoded[0] 
                    ? formatGeocodedAddress(geocoded[0]) 
                    : 'Current location';
                
                onChange(coords, addressText);
                onTextChange?.(addressText);
                autocompleteRef?.current?.setAddressText(addressText);
            } catch (geocodeErr) {
                // If geocoding fails, still use the coordinates with generic text
                const addressText = 'Current location';
                onChange(coords, addressText);
                onTextChange?.(addressText);
                autocompleteRef?.current?.setAddressText(addressText);
            }
        } catch (err) {
            console.error('Error getting location:', err);
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            Alert.alert(
                'Error', 
                `Could not get current location: ${errorMessage}. Please try again or enter address manually.`
            );
        } finally {
            setLoadingLocation(null);
        }
    };

    // Application Security Requirement: API key from environment variables (never hardcoded)
    const handlePlaceSelect = (
        data: any,
        details: any | null,
        onChange: (coord: Coordinates | null, text?: string) => void
    ) => {
        if (details?.geometry?.location) {
            const coords: Coordinates = {
                lat: details.geometry.location.lat,
                lon: details.geometry.location.lng,
            };
            const text = details?.formatted_address ?? data?.description ?? '';
            onChange(coords, text);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.labelContainer}>
                <Text style={styles.labelIcon}>🚗</Text>
                <Text style={styles.label}>Driver Starting Location</Text>
            </View>
            <View style={styles.inputWrapper}>
                <GooglePlacesAutocomplete
                    ref={driverStartRef}
                    placeholder="Search for driver starting location"
                    fetchDetails={true}
                    onPress={(data, details = null) => {
                        handlePlaceSelect(data, details, onDriverStartChange);
                    }}
                    query={{
                        key: CONFIG.GOOGLE_MAPS_API_KEY,
                        language: 'en',
                    }}
                    styles={{
                        container: styles.autocompleteContainer,
                        textInput: [styles.autocompleteInput, invalidDriverStart && styles.autocompleteInputInvalid],
                        listView: styles.autocompleteList,
                    }}
                    enablePoweredByContainer={false}
                    minLength={0}
                    debounce={300}
                    listViewDisplayed={focusedField === 'driverStart'}
                    textInputProps={{
                        defaultValue: driverStartText,
                        onChangeText: (t) => onDriverStartTextChange?.(t),
                        placeholderTextColor: '#999',
                        autoCorrect: false,
                        autoCapitalize: 'none',
                        onFocus: () => handleFocus('driverStart'),
                        onBlur: handleBlur,
                    }}
                />
                <TouchableOpacity
                    style={styles.locationButton}
                    onPress={() => handleUseCurrentLocation('driverStart', onDriverStartChange, onDriverStartTextChange, driverStartRef)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.locationIcon}>📍</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.labelContainer}>
                <Text style={styles.labelIcon}>🎯</Text>
                <Text style={styles.label}>Driver Destination</Text>
            </View>
            <View style={styles.inputWrapper}>
                <GooglePlacesAutocomplete
                    ref={driverDestRef}
                    placeholder="Search for driver destination"
                    fetchDetails={true}
                    onPress={(data, details = null) => {
                        handlePlaceSelect(data, details, onDriverDestinationChange);
                    }}
                    query={{
                        key: CONFIG.GOOGLE_MAPS_API_KEY,
                        language: 'en',
                    }}
                    styles={{
                        container: styles.autocompleteContainer,
                        textInput: [styles.autocompleteInput, invalidDriverDestination && styles.autocompleteInputInvalid],
                        listView: styles.autocompleteList,
                    }}
                    enablePoweredByContainer={false}
                    minLength={0}
                    debounce={300}
                    listViewDisplayed={focusedField === 'driverDestination'}
                    textInputProps={{
                        defaultValue: driverDestinationText,
                        onChangeText: (t) => onDriverDestinationTextChange?.(t),
                        placeholderTextColor: '#999',
                        autoCorrect: false,
                        autoCapitalize: 'none',
                        onFocus: () => handleFocus('driverDestination'),
                        onBlur: handleBlur,
                    }}
                />
                <TouchableOpacity
                    style={styles.locationButton}
                    onPress={() => handleUseCurrentLocation('driverDestination', onDriverDestinationChange, onDriverDestinationTextChange, driverDestRef)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.locationIcon}>📍</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.labelContainer}>
                <Text style={styles.labelIcon}>🚶</Text>
                <Text style={styles.label}>Passenger start/end of trip</Text>
            </View>
            <View style={styles.inputWrapper}>
                <GooglePlacesAutocomplete
                    ref={passengerRef}
                    placeholder="Passenger start/end of trip"
                    fetchDetails={true}
                    onPress={(data, details = null) => {
                        handlePlaceSelect(data, details, onPassengerHomeChange);
                    }}
                    query={{
                        key: CONFIG.GOOGLE_MAPS_API_KEY,
                        language: 'en',
                    }}
                    styles={{
                        container: styles.autocompleteContainer,
                        textInput: [styles.autocompleteInput, invalidPassengerHome && styles.autocompleteInputInvalid],
                        listView: styles.autocompleteList,
                    }}
                    enablePoweredByContainer={false}
                    minLength={0}
                    debounce={300}
                    listViewDisplayed={focusedField === 'passenger'}
                    textInputProps={{
                        defaultValue: passengerHomeText,
                        onChangeText: (t) => onPassengerHomeTextChange?.(t),
                        placeholderTextColor: '#999',
                        autoCorrect: false,
                        autoCapitalize: 'none',
                        onFocus: () => handleFocus('passenger'),
                        onBlur: handleBlur,
                    }}
                />
                <TouchableOpacity
                    style={styles.locationButton}
                    onPress={() => handleUseCurrentLocation('passenger', onPassengerHomeChange, onPassengerHomeTextChange, passengerRef)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.locationIcon}>📍</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 0,
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 20,
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
  autocompleteContainer: {
    flex: 0,
    marginBottom: 16,
  },
    inputWrapper: {
        position: 'relative',
    },
    autocompleteInput: {
        borderWidth: 2,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        padding: 16,
        paddingRight: 50,
        fontSize: 16,
        backgroundColor: '#FAFAFA',
        color: '#333',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    locationButton: {
        position: 'absolute',
        right: 12,
        top: 4,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        backgroundColor: '#F5F5F5',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    locationIcon: {
        fontSize: 18,
    },
    autocompleteInputInvalid: {
        borderColor: '#EF5350',
        backgroundColor: '#FFEBEE',
    },
    autocompleteList: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        marginTop: 6,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        maxHeight: 200,
    },
});
