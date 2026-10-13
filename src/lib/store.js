import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useFocusEffect } from 'expo-router';

export const DataContext = createContext({ version: 0, bump: () => {}, settings: {}, refreshSettings: () => {}, toast: () => {}, cloud: { user: null, state: 'idle', signIn: async () => null, signOut: async () => {}, syncNow: () => {} } });

export function useData() {
  return useContext(DataContext);
}

export function useSettings() {
  return useContext(DataContext).settings;
}

export function useQuery(fn, deps = []) {
  const db = useSQLiteContext();
  const { version } = useData();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const alive = useRef(true);

  const run = useCallback(async () => {
    try {
      const result = await fnRef.current(db);
      if (alive.current) setData(result);
    } catch (e) {
      console.warn('Query failed', e);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [db, version, ...deps]);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      run();
    }, [run])
  );

  return { data, loading, reload: run };
}
