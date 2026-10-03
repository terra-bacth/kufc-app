"use client";
import { useEffect, useState } from "react";
import { onSnapshot, type Query, type DocumentData, Timestamp } from "firebase/firestore";

export function decodeDocument<T>(id: string, data: DocumentData): T & { id: string } {
  const converted = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value instanceof Timestamp ? value.toDate() : value]));
  return { ...converted, id } as T & { id: string };
}

// Pass a useMemo-stabilized query; null disables reads until authorization is ready.
export function useCollection<T>(source: Query | null) {
  const [state, setState] = useState<{ source: Query | null; data: (T & { id: string })[]; error: Error | null }>({ source: null, data: [], error: null });
  useEffect(() => {
    if (!source) return;
    return onSnapshot(source,
      (snap) => setState({ source, data: snap.docs.map((d) => decodeDocument<T>(d.id, d.data())), error: null }),
      (error) => setState({ source, data: [], error }));
  }, [source]);
  const current = source !== null && state.source === source;
  return { data: current ? state.data : [], error: current ? state.error : null, loading: source !== null && !current };
}
