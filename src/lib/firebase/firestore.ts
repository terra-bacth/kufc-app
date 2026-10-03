import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  onSnapshot,
  Timestamp,
  type DocumentData,
  type QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./config";

// ponytail: Timestamp→Date conversion only for known keys (createdAt, etc.). If new date fields are added, extend `dateKeys`.
const dateKeys = new Set(["createdAt", "updatedAt", "joiningDate", "fromDate", "toDate", "reviewedAt", "markedAt", "date", "dueDate", "sentAt", "paidDate"]);

function convertTimestamps<T extends DocumentData>(data: DocumentData): T {
  const out: DocumentData = { ...data };
  for (const k of Object.keys(out)) {
    if (dateKeys.has(k) && out[k] instanceof Timestamp) out[k] = out[k].toDate();
  }
  return out as T;
}

function withId<T extends DocumentData>(id: string, data: DocumentData): T & { id: string } {
  const converted = convertTimestamps<T>(data);
  return { ...converted, id } as T & { id: string };
}

export async function getDocById<T extends DocumentData>(col: string, id: string): Promise<(T & { id: string }) | null> {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? withId<T>(snap.id, snap.data() as DocumentData) : null;
}

export async function getDocsFromCollection<T extends DocumentData>(col: string, ...constraints: QueryConstraint[]): Promise<(T & { id: string })[]> {
  const snap = await getDocs(query(collection(db, col), ...constraints));
  return snap.docs.map((d) => withId<T>(d.id, d.data() as DocumentData));
}

export async function addDocument<T extends DocumentData>(col: string, data: Omit<T, "id">): Promise<string> {
  const ref = await addDoc(collection(db, col), data as DocumentData);
  return ref.id;
}

export async function updateDocument(col: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(db, col, id), data);
}

export async function deleteDocument(col: string, id: string): Promise<void> {
  await deleteDoc(doc(db, col, id));
}

export function watchCollection<T extends DocumentData>(
  col: string,
  cb: (docs: (T & { id: string })[]) => void,
  onError?: (err: Error) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  return onSnapshot(
    query(collection(db, col), ...constraints),
    (snap) => cb(snap.docs.map((d) => withId<T>(d.id, d.data() as DocumentData))),
    (err) => onError?.(err as Error),
  );
}

export function watchDocument<T extends DocumentData>(
  col: string,
  id: string,
  cb: (doc: (T & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, col, id),
    (snap) => cb(snap.exists() ? withId<T>(snap.id, snap.data()!) : null),
    (err) => onError?.(err as Error),
  );
}
