"use client";
import { useEffect, useState } from "react";
import { onSnapshot, type Query, type DocumentData, Timestamp } from "firebase/firestore";

export function decodeDocument<T>(id: string, data: DocumentData, path = id): T & { id: string; path: string } {
  const converted = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value instanceof Timestamp ? value.toDate() : value]));
  return { ...converted, id, path } as T & { id: string; path: string };
}

// Pass a useMemo-stabilized query; null disables reads until authorization is ready.
// `path` is the full document path, which is the only place a collection group
// query preserves the parent id.
export function useCollection<T>(source: Query | null) {
  const [state, setState] = useState<{ source: Query | null; data: (T & { id: string; path: string })[]; error: Error | null }>({ source: null, data: [], error: null });
  useEffect(() => {
    if (!source) return;
    return onSnapshot(source,
      (snap) => setState({ source, data: snap.docs.map((d) => decodeDocument<T>(d.id, d.data(), d.ref.path)), error: null }),
      (error) => setState({ source, data: [], error }));
  }, [source]);
  const current = source !== null && state.source === source;
  return { data: current ? state.data : [], error: current ? state.error : null, loading: source !== null && !current };
}
