import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Journey } from "../models";

const JOURNEY_STORAGE_KEY = "@ontheway:journey";

export function useJourneyState() {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);

  // Load journey from storage on mount
  useEffect(() => {
    loadJourney();
  }, []);

  const loadJourney = async () => {
    try {
      const stored = await AsyncStorage.getItem(JOURNEY_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Journey;
        setJourney(parsed);
      }
    } catch (error) {
      // Error loading journey
    } finally {
      setLoading(false);
    }
  };

  const saveJourney = useCallback(async (newJourney: Journey) => {
    try {
      await AsyncStorage.setItem(
        JOURNEY_STORAGE_KEY,
        JSON.stringify(newJourney),
      );
      setJourney(newJourney);
    } catch (error) {
      throw error;
    }
  }, []);

  const updateJourney = useCallback(
    async (updates: Partial<Journey>) => {
      if (!journey) {
        throw new Error("No journey to update");
      }
      const updated = { ...journey, ...updates };
      await saveJourney(updated);
    },
    [journey, saveJourney],
  );

  const advanceStage = useCallback(
    async (newStage: Journey["stage"]) => {
      await updateJourney({ stage: newStage });
    },
    [updateJourney],
  );

  const clearJourney = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(JOURNEY_STORAGE_KEY);
      setJourney(null);
    } catch (error) {
      // Error clearing journey
    }
  }, []);

  return {
    journey,
    loading,
    saveJourney,
    updateJourney,
    advanceStage,
    clearJourney,
  };
}
