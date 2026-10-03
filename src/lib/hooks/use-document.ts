"use client";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { decodeDocument } from "./use-collection";

export function useDocument<T>(col: string, id: string | null) {
  const key = id ? `${col}/${id}` : null;
  const [state, setState] = useState<{ key: string; data: (T & { id: string }) | null; error: Error | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    return onSnapshot(doc(db, key),
      (snap) => setState({ key, data: snap.exists() ? decodeDocument<T>(snap.id, snap.data()) : null, error: null }),
      (error) => setState({ key, data: null, error }));
  }, [key]);
  const current = key !== null && state?.key === key;
  return { data: current ? state.data : null, error: current ? state.error : null, loading: key !== null && !current };
}
