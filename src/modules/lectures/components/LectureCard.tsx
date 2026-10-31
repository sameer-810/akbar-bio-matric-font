import React, { useState } from "react";
import { Card, VStack, HStack, Text, Button, StatusChip, TextField, ToggleRow, Banner } from "@shared/ui";
import { palette } from "@shared/designSystem";
import { apiErrorMessage } from "@api/apiClient";
import { formatWallTime, formatDay } from "@shared/format";
import { useLectureActions } from "../hooks/useLectures";
import { STATE_LABELS, type Lecture } from "../types";
import { LectureForm } from "./LectureForm";

const ACCENT: Partial<Record<string, string>> = {
  overdue: palette.warning.text,
  ongoing: palette.primary[600],
  not_conducted: palette.danger.text,
};

/**
 * One lecture: when, who, for whom, and what actually happened — the
 * teacher's arrival from their punch, the class's marks. Staff confirm the
 * ones the punches cannot settle ("to confirm"), which is also what makes
 * them count for pay.
 */
export function LectureCard({
  lecture: l,
  canManage,
  onOpen,
  showDate = false,
  showBatch = true,
  showTeacher = true,
  onCancelOverride,
}: {
  lecture: Lecture;
  canManage: boolean;
  onOpen?: () => void;
  showDate?: boolean;
  showBatch?: boolean;
  showTeacher?: boolean;
  /** a teacher's own view cancels through its own route */
  onCancelOverride?: (reason: string) => Promise<unknown>;
}) {
  const act = useLectureActions();
  const [mode, setMode] = useState<"view" | "edit" | "cancel">("view");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const state = l.state ?? (l.status === "cancelled" ? "cancelled" : "upcoming");
  const p = l.teacherPresence;

  async function run(fn: () => Promise<unknown>, done?: string) {
    setMsg(null);
    try {
      await fn();
      setMode("view");
      if (done) setMsg({ tone: "success", text: done });
    } catch (err) {
      setMsg({ tone: "danger", text: apiErrorMessage(err) });
    }
  }

  if (mode === "edit") return <LectureForm lecture={l} onDone={() => setMode("view")} />;

  const canCancel = (canManage || onCancelOverride) && l.status === "scheduled" && (state === "upcoming" || state === "ongoing");

  return (
    <Card accentColor={ACCENT[state]} testID={`lecture-card-${l.startTime}`}>
      <VStack gap={8}>
        <HStack gap={8} align="center" wrap>
          <Text variant="label" tabular style={{ minWidth: 130 }}>
            {showDate ? `${formatDay(l.date)} · ` : ""}
            {formatWallTime(l.startTime)} – {formatWallTime(l.endTime)}
          </Text>
          <Text variant="h3" style={{ flex: 1 }}>
            {l.subject || "Lecture"}
          </Text>
          <StatusChip status={STATE_LABELS[state]} size="sm" />
        </HStack>
        <Text variant="body-sm" tone="secondary">
          {[showBatch ? l.batchName : null, showTeacher ? (l.teacherName ?? "No teacher set") : null].filter(Boolean).join(" · ")}
        </Text>
        {l.status === "scheduled" && l.teacherId && state !== "upcoming" ? (
          <Text variant="caption" tone={p?.present ? "secondary" : "warning"} testID="lecture-teacher-actual">
            {p?.present
              ? `Teacher in${p.lateMinutes ? `, ${p.lateMinutes} min late` : " on time"}${p.leftEarlyMinutes ? `, left ${p.leftEarlyMinutes} min early` : ""}`
              : "No punch from the teacher during this lecture"}
          </Text>
        ) : null}
        {l.counts && (l.counts.present || l.counts.absent) ? (
          <Text variant="caption" tone="tertiary">
            {l.counts.present ?? 0} present · {l.counts.absent ?? 0} absent
          </Text>
        ) : null}
        {l.topics ? <Text variant="body-sm">Topics: {l.topics}</Text> : null}
        {l.status === "cancelled" && l.cancelReason ? (
          <Text variant="caption" tone="tertiary">
            Cancelled: {l.cancelReason}
          </Text>
        ) : null}
        {msg ? <Banner tone={msg.tone} message={msg.text} onDismiss={() => setMsg(null)} /> : null}

        {mode === "cancel" ? (
          <VStack gap={8}>
            <TextField label="Why" value={reason} onChangeText={setReason} placeholder="Sir is unwell" testID="cancel-reason" />
            {!onCancelOverride ? <ToggleRow label="Tell the families in the app" value={notify} onChange={setNotify} /> : null}
            <HStack gap={8}>
              <Button
                label="Cancel the lecture"
                variant="destructive"
                size="sm"
                disabled={onCancelOverride ? reason.trim().length < 3 : false}
                onPress={() =>
                  void run(
                    () => (onCancelOverride ? onCancelOverride(reason.trim()) : act.cancel.mutateAsync({ id: l.id, reason: reason.trim(), notify })),
                    "Cancelled.",
                  )
                }
                testID="cancel-confirm"
              />
              <Button label="Keep it" variant="ghost" size="sm" onPress={() => setMode("view")} />
            </HStack>
          </VStack>
        ) : (
          <HStack gap={8} wrap>
            {onOpen ? <Button label="Register" size="xs" variant="secondary" onPress={onOpen} /> : null}
            {canManage && l.status === "scheduled" ? <Button label="Edit" size="xs" variant="ghost" onPress={() => setMode("edit")} testID="lecture-edit" /> : null}
            {canManage && (state === "overdue" || state === "not_conducted") ? (
              <Button
                label="It was taken"
                size="xs"
                variant="secondary"
                onPress={() => void run(() => act.update.mutateAsync({ id: l.id, patch: { conducted: true } }), "Marked as taken.")}
                testID="lecture-confirm"
              />
            ) : null}
            {canManage && state === "overdue" ? (
              <Button
                label="Not taken"
                size="xs"
                variant="ghost"
                onPress={() => void run(() => act.update.mutateAsync({ id: l.id, patch: { conducted: false } }))}
              />
            ) : null}
            {canCancel ? <Button label="Cancel…" size="xs" variant="ghost" onPress={() => setMode("cancel")} testID="lecture-cancel" /> : null}
          </HStack>
        )}
      </VStack>
    </Card>
  );
}
