export type DayStatus = "present" | "late" | "absent" | "leave" | "holiday";
export type Counts = Partial<Record<DayStatus, number>>;

export interface BoardBatch {
  batchId: string;
  name: string;
  startTime: string;
  endTime: string;
  meetsToday: boolean;
  total: number;
  counts: Counts;
  notYet: number;
}

export interface BoardPunch {
  id: string;
  at: string;
  biometricId: string;
  personType: "student" | "teacher" | "unknown";
  name: string | null;
  grNumber: string | null;
  kind: string | null;
  source: string;
  stale: boolean;
  processed: boolean;
}

export interface Board {
  date: string;
  batches: BoardBatch[];
  unknownToday: number;
  recentPunches: BoardPunch[];
}

export interface RegisterRow {
  studentId: string;
  grNumber: string;
  name: string;
  status: DayStatus | null;
  entryAt: string | null;
  exitAt: string | null;
  durationMinutes: number | null;
  lateByMinutes: number | null;
  source: "auto" | "manual" | null;
  reason: string;
}

export interface LectureLite {
  id: string;
  startTime: string;
  endTime: string;
  subject: string;
  status: "scheduled" | "cancelled";
}

export interface Register {
  batch: { id: string; name: string; startTime: string; endTime: string };
  date: string;
  holiday: boolean;
  counts: Counts;
  rows: RegisterRow[];
  lectures: LectureLite[];
}

export interface LectureRegister {
  session: LectureLite & { batchId: string; date: string; markedAt: string | null };
  rows: {
    studentId: string;
    grNumber: string;
    name: string;
    status: "present" | "absent" | null;
    source: "auto" | "manual" | null;
    reason: string;
    punches: string[];
  }[];
}

export interface StudentHistory {
  counts: Counts;
  percent: number | null;
  lectures: { total: number; present: number };
  days: {
    date: string;
    status: DayStatus;
    entryAt: string | null;
    exitAt: string | null;
    durationMinutes: number | null;
    /** every IN with its OUT */
    sessions?: { inAt: string; outAt: string | null }[];
    /** "import": brought over from the old portal's punch report */
    source: string;
    reason: string;
  }[];
}

export interface Leave {
  id: string;
  studentId: string;
  from: string;
  to: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  source: "staff" | "parent";
  /** present on the staff list */
  student?: { name: string; grNumber: string };
  decidedAt?: string | null;
  createdAt?: string;
}

/** One person on one date: their first valid punch and their last. */
export interface DailyPunch {
  id: string;
  date: string;
  biometricId: string;
  personType: string;
  name: string | null;
  /** for an ID nobody here has, the GR the ID itself carries */
  grNumber: string | null;
  /** the name the ID is enrolled under on the machine, when nobody here has it */
  machineName: string | null;
  inAt: string;
  outAt: string | null;
  punches: number;
  /** machine serials, or "manual" for punches entered by hand */
  sources: string[];
}

export interface DailyPunchQuery {
  from: string;
  to: string;
  personType?: string;
  source?: string;
  search?: string;
  page: number;
}
