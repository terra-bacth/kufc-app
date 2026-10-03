export type UserRole = "admin" | "coach" | "student";
export type UserStatus = "pending" | "active" | "rejected" | "inactive";
export type AttendanceStatus = "present" | "absent" | "late";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "card";
export type FileType = "pdf" | "video" | "image";
export type TestStatus = "upcoming" | "completed";

export interface User {
  id: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  linkedEntityId?: string;
  /** Students only: the batch code they registered with, kept for audit. */
  requestedBatchCode?: string;
  createdAt: Date;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  status: "active" | "inactive";
  createdAt: Date;
}

export interface Batch {
  id: string;
  name: string;
  branchId: string;
  coachId: string;
  sport: string;
  schedule: { days: string[]; startTime: string; endTime: string };
  monthlyFee: number;
  /** Join code students enter at registration. Generated, not chosen by hand. */
  code: string;
  status: "active" | "inactive";
  createdAt: Date;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  parentPhone?: string;
  userId?: string;
  batchId: string;
  branchId: string;
  status: "active" | "inactive";
  joiningDate: Date;
  createdAt: Date;
}

export interface Coach {
  id: string;
  name: string;
  email: string;
  phone: string;
  userId: string;
  batchIds: string[];
  branchIds: string[];
  specialization: string;
  status: "active" | "inactive";
  joiningDate: Date;
  createdAt: Date;
}

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  batchId: string;
  markedBy: string;
  markedAt: Date;
  students: Record<string, AttendanceStatus>;
  coachPresent: boolean;
}

export interface Leave {
  id: string;
  requestedBy: string;
  requesterType: "student" | "coach";
  requesterId: string;
  batchId?: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
}

export interface Material {
  id: string;
  title: string;
  description?: string;
  batchId: string;
  uploadedBy: string;
  fileUrl: string;
  fileType: FileType;
  fileName: string;
  fileSize: number;
  createdAt: Date;
}

export interface Test {
  id: string;
  title: string;
  batchId: string;
  totalMarks: number;
  date: Date;
  createdBy: string;
  status: TestStatus;
  createdAt: Date;
}

export interface TestScore {
  studentId: string;
  marksObtained: number;
  grade?: string;
  remarks?: string;
}

export interface Invoice {
  id: string;
  studentId: string;
  batchId: string;
  invoiceNumber: string;
  month: number;
  year: number;
  amount: number;
  dueDate: Date;
  status: InvoiceStatus;
  lineItems: { description: string; amount: number }[];
  createdAt: Date;
  sentAt?: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  paidDate: Date;
  method: PaymentMethod;
  receiptUrl?: string;
  createdAt: Date;
}
