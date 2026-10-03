import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

export function uploadFile(
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);
    task.on(
      "state_changed",
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => reject(err),
      () => { getDownloadURL(task.snapshot.ref).then(resolve, reject); },
    );
  });
}

export const deleteFile = (path: string) => deleteObject(ref(storage, path));
