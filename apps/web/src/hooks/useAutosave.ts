import { useRef, useEffect, useState, useCallback } from 'react';

interface UseAutosaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

export function useAutosave<T>({ data, onSave, delay = 500, enabled = true }: UseAutosaveOptions<T>) {
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const initialRef = useRef(true);

  dataRef.current = data;

  const save = useCallback(async () => {
    if (!enabled) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(dataRef.current);
      setLastSavedAt(new Date());
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [onSave, enabled]);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }

    if (!enabled) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, save, enabled]);

  return { saving, lastSavedAt, error };
}
