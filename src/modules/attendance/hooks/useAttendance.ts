import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceApi } from "../api/attendanceApi";
import type { DailyPunchQuery, DayStatus } from "../types";

/** The board is the screen at the gate: near live. A socket can replace this poll later. */
export function useBoard(date?: string) {
  return useQuery({ queryKey: ["board", date ?? "today"], queryFn: () => attendanceApi.board(date), refetchInterval: 5_000 });
}

export function useRegister(batchId: string | null, date: string) {
  return useQuery({
    queryKey: ["register", batchId, date],
    queryFn: () => attendanceApi.register(batchId as string, date),
    enabled: Boolean(batchId),
    refetchInterval: 15_000,
  });
}

export function useStudentHistory(studentId: string, from: string, to: string) {
  return useQuery({ queryKey: ["studentHistory", studentId, from, to], queryFn: () => attendanceApi.history(studentId, from, to) });
}

export function useLectureRegister(id: string) {
  return useQuery({ queryKey: ["lectureRegister", id], queryFn: () => attendanceApi.lecture(id) });
}

export function useDailyPunches(q: DailyPunchQuery, enabled: boolean) {
  return useQuery({
    queryKey: ["punches", "daily", q],
    queryFn: () => attendanceApi.dailyPunches(q),
    enabled,
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });
}

/** Parent applications waiting for staff; polled so the desk sees new ones. */
export function useLeaveList(params: { status?: "pending" | "approved" | "rejected" | "cancelled"; from?: string }) {
  return useQuery({ queryKey: ["leaves", "list", params], queryFn: () => attendanceApi.leaveList(params), refetchInterval: 30_000 });
}

export function useLeaves(studentId: string) {
  return useQuery({ queryKey: ["leaves", studentId], queryFn: () => attendanceApi.leaves(studentId) });
}

/** Anything that changes attendance refreshes every view of it. */
function useInvalidateAttendance() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["register", "board", "studentHistory", "lectureRegister", "punches", "leaves"]) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function useAttendanceActions() {
  const invalidate = useInvalidateAttendance();
  return {
    override: useMutation({
      mutationFn: (v: { studentId: string; date: string; status: DayStatus; reason: string }) =>
        attendanceApi.override(v.studentId, v.date, v.status, v.reason),
      onSuccess: invalidate,
    }),
    clearOverride: useMutation({
      mutationFn: (v: { studentId: string; date: string }) => attendanceApi.clearOverride(v.studentId, v.date),
      onSuccess: invalidate,
    }),
    manualPunch: useMutation({
      mutationFn: (v: { studentId: string; date: string; time: string; reason: string }) =>
        attendanceApi.manualPunch(v.studentId, v.date, v.time, v.reason),
      // the engine works on the punch a moment later; refresh twice
      onSuccess: () => {
        invalidate();
        setTimeout(invalidate, 1500);
      },
    }),
    createLecture: useMutation({ mutationFn: attendanceApi.createLecture, onSuccess: invalidate }),
    setLectureMarks: useMutation({
      mutationFn: (v: { id: string; marks: { studentId: string; status: "present" | "absent"; remark?: string }[] }) =>
        attendanceApi.setLectureMarks(v.id, v.marks),
      onSuccess: invalidate,
    }),
    addLeave: useMutation({ mutationFn: attendanceApi.addLeave, onSuccess: invalidate }),
    cancelLeave: useMutation({ mutationFn: attendanceApi.cancelLeave, onSuccess: invalidate }),
    decideLeave: useMutation({
      mutationFn: (v: { id: string; approve: boolean }) => attendanceApi.decideLeave(v.id, v.approve),
      onSuccess: invalidate,
    }),
  };
}
