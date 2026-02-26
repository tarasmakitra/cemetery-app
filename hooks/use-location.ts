import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
  loading: boolean;
  error: string | null;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    latitude: 0,
    longitude: 0,
    loading: false,
    error: null,
  });

  const getCurrentLocation = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState((s) => ({ ...s, loading: false, error: 'Доступ до GPS не надано' }));
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setState({
        ...coords,
        loading: false,
        error: null,
      });

      return coords;
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: 'Не вдалося отримати GPS' }));
      return null;
    }
  }, []);

  return { ...state, getCurrentLocation };
}
