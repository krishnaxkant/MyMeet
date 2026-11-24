import { useCallback, useEffect, useState } from 'react';
import { fetchBackendHealth, type HealthResponse } from '../services/api';

interface UseBackendHealthState {
  data: HealthResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBackendHealth(): UseBackendHealthState {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBackendHealth();
      setData(result);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Unable to reach Meet backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
