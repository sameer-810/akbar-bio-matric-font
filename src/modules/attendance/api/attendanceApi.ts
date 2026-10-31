import { apiClient } from "@api/apiClient";
import type { Board, Register, LectureRegister, StudentHistory, Leave, DailyPunch, DailyPunchQuery, DayStatus } from "../types";

const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const attendanceApi = Object.freeze({
  board: (date?: string) => data<Board>(apiClient.get("/attendance/board", { params: { date } })),
  register: (batchId: string, date: string) => data<Register>(apiClient.get(`/attendance/batches/${batchId}`, { params: { date } })),
  history: (studentId: string, from: string, to: string) =>
    data<StudentHistory>(apiClient.get(`/attendance/students/${studentId}`, { params: { from, to } })),
  override: (studentId: string, date: string, status: DayStatus, reason: string) =>
    data(apiClient.put(`/attendance/students/${studentId}/days/${date}`, { status, reason })),
  clearOverride: (studentId: string, date: string) => apiClient.delete(`/attendance/students/${studentId}/days/${date}`),

  manualPunch: (studentId: string, date: string, time: string, reason: string) =>
    data(apiClient.post("/punches/manual", { studentId, date, time, reason })),
  dailyPunches: async (q: DailyPunchQuery) => {
    const { data: body } = await apiClient.get("/punches/daily", { params: { ...q, limit: 50 } });
    return { data: body.data as DailyPunch[], meta: body.meta as { total: number; page: number; pages: number } };
  },

  lecture: (id: string) => data<LectureRegister>(apiClient.get(`/lectures/sessions/${id}`)),
  createLecture: (body: { batchId: string; date: string; startTime: string; endTime: string; subject?: string }) =>
    data(apiClient.post("/lectures/sessions", body)),
  setLectureMarks: (id: string, marks: { studentId: string; status: "present" | "absent"; remark?: string }[]) =>
    data<LectureRegister>(apiClient.put(`/lectures/sessions/${id}/marks`, { marks })),

  leaves: (studentId: string) => data<Leave[]>(apiClient.get("/leaves", { params: { studentId } })),
  addLeave: (body: { studentId: string; from: string; to: string; reason?: string }) => data<Leave>(apiClient.post("/leaves", body)),
  cancelLeave: (id: string) => data<Leave>(apiClient.post(`/leaves/${id}/cancel`)),
  leaveList: (params: { status?: Leave["status"]; from?: string }) => data<Leave[]>(apiClient.get("/leaves", { params })),
  decideLeave: (id: string, approve: boolean) => data<Leave>(apiClient.post(`/leaves/${id}/decide`, { approve })),
});
