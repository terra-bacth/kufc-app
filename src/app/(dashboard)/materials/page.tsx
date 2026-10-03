"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, doc, query, where } from "firebase/firestore";
import { addDocument, deleteDocument } from "@/lib/firebase/firestore";
import { uploadFile, deleteFile } from "@/lib/firebase/storage";
import type { Batch, FileType, Material, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

// ponytail: 20MB for pdf/image, 100MB for video. Raise if the academy needs bigger uploads.
const LIMITS = { pdf: 20, image: 20, video: 100 } as const;

function fileType(file: File): FileType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  return null;
}

export default function MaterialsPage() {
  useRequireRole("admin", "coach", "student");
  const { userData } = useAuth();
  const isAdmin = userData?.role === "admin";
  const canUpload = userData?.role === "admin" || userData?.role === "coach";

  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const { data: students = [] } = useCollection<Student>(
    useMemo(() => query(collection(db, "students"), where("status", "==", "active")), []),
  );
  const { data: all = [] } = useCollection<Material>(query(collection(db, "materials")));

  const mine = userData?.role === "coach"
    ? batches.filter((b) => b.coachId === userData?.id || b.coachId === userData?.linkedEntityId).map((b) => b.id)
    : [];
  const myBatchId = userData?.role === "student" ? students.find((s) => s.userId === userData?.id)?.batchId : undefined;
  const visibleBatch = (batchId: string) => isAdmin || mine.includes(batchId) || batchId === myBatchId;

  const [batchId, setBatchId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const materials = useMemo(() => {
    const list = batchId ? all.filter((m) => m.batchId === batchId) : all;
    return list.filter((m) => visibleBatch(m.batchId));
  }, [all, batchId, visibleBatch]);

  async function upload() {
    if (!batchId) return toast.error("Select a batch");
    if (!title.trim()) return toast.error("Give the material a title");
    if (!file) return toast.error("Choose a PDF, image, or video");
    const kind = fileType(file);
    if (!kind) return toast.error("Only PDF, image, and video files are allowed");
    if (file.size > LIMITS[kind] * 1024 * 1024) {
      return toast.error(`${kind} files must be under ${LIMITS[kind]}MB`);
    }
    setUploading(true);
    try {
      const path = `materials/${batchId}/${Date.now()}_${file.name}`;
      const url = await uploadFile(path, file, setProgress);
      await addDocument("materials", {
        title: title.trim(),
        batchId,
        uploadedBy: userData?.id ?? "",
        fileUrl: url,
        fileType: kind,
        fileName: file.name,
        fileSize: file.size,
        createdAt: new Date(),
      });
      setTitle("");
      setFile(null);
      toast.success("Material uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function remove(m: Material) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    try {
      await deleteDocument("materials", m.id);
      if (m.fileUrl.includes("firebasestorage")) {
        const name = decodeURIComponent(m.fileUrl.split("/o/")[1].split("?")[0]);
        await deleteFile(name).catch(() => undefined);
      }
      toast.success("Deleted");
    } catch {
      toast.error("Could not delete");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Study Materials</h1>

      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={batchId} onValueChange={(v) => setBatchId(v || "")}>
          <SelectTrigger><SelectValue placeholder="All batches" /></SelectTrigger>
          <SelectContent>{batches.filter((b) => visibleBatch(b.id)).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {canUpload && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Upload</h2>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input id="file" type="file" accept="application/pdf,image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            {uploading && <p className="text-sm text-muted-foreground">Uploading… {progress}%</p>}
            <Button onClick={upload} disabled={uploading || !batchId}>Upload</Button>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {materials.map((m) => (
          <li key={m.id}>
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-sm text-muted-foreground">{m.fileType} · {(m.fileSize / 1024 / 1024).toFixed(1)}MB</p>
                  </div>
                  {canUpload && <Button size="sm" variant="destructive" onClick={() => remove(m)}>Delete</Button>}
                </div>
                <a className="text-sm underline" href={m.fileUrl} target="_blank" rel="noreferrer">Open</a>
              </CardContent>
            </Card>
          </li>
        ))}
        {materials.length === 0 && <li className="text-sm text-muted-foreground">No materials yet.</li>}
      </ul>
    </div>
  );
}