import React, { useState } from "react";
import { Fingerprint } from "lucide-react-native";
import { Screen, Card, VStack, HStack, Text, Button, DataTable, ChipsRow, TextField, Banner, ErrorState, SearchInput, Select, Pagination, type Column } from "@shared/ui";
import { useFilters } from "@shared/useFilters";
import { academyToday, formatDay, formatTime } from "@shared/format";
import { useDailyPunches } from "../hooks/useAttendance";
import type { DailyPunch } from "../types";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const PAGE_SIZE = 50;

const personLabel = (p: DailyPunch) => {
  if (p.name) return p.personType === "teacher" ? `${p.name} (faculty)` : p.name;
  return p.machineName ? `${p.machineName} · not added in the app` : "Nobody with this ID";
};
const timeOrDash = (at: string | null) => (at ? formatTime(at) : "--");

/**
 * The old system's "Biometric" report: one row per person per date, with the
 * first valid punch as In and the last as Out. "Unknown IDs" shows the people
 * nobody here has yet: usually a student enrolled on the machine but not admitted.
 */
export default function PunchesScreen() {
  const [today] = useState(academyToday());
  const { filters, set, reset, isFiltered } = useFilters("punches-daily", { who: "all", search: "", source: "", from: today, to: today, page: 1 });
  // typed dates wait for Apply, so a half-typed date never reloads the table
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const validRange = YMD.test(from) && YMD.test(to) && from <= to;
  const punches = useDailyPunches(
    {
      from: filters.from,
      to: filters.to,
      personType: filters.who === "all" ? undefined : filters.who,
      source: filters.source || undefined,
      search: filters.search.trim() || undefined,
      page: filters.page,
    },
    YMD.test(filters.from) && YMD.test(filters.to),
  );
  const rows = punches.data?.data ?? [];
  const meta = punches.data?.meta;

  const resetAll = () => {
    setFrom(today);
    setTo(today);
    reset();
  };

  const columns: Column<DailyPunch>[] = [
    { key: "date", header: "Date", width: 110, render: (p) => <Text variant="body-sm" tabular>{formatDay(p.date)}</Text> },
    {
      key: "who",
      header: "Student Name",
      flex: 2,
      render: (p) => (
        <Text variant="body-sm" tone={p.personType === "unknown" ? "warning" : "primary"}>
          {personLabel(p)}
        </Text>
      ),
    },
    { key: "gr", header: "GR Number", width: 100, render: (p) => <Text variant="body-sm" tabular>{p.grNumber ?? "--"}</Text> },
    { key: "in", header: "In Time", width: 90, render: (p) => <Text variant="body-sm" tabular>{timeOrDash(p.inAt)}</Text> },
    { key: "out", header: "Out Time", width: 90, render: (p) => <Text variant="body-sm" tabular>{timeOrDash(p.outAt)}</Text> },
    { key: "id", header: "Fingerprint ID", width: 120, render: (p) => <Text variant="body-sm" tabular>{p.biometricId}</Text> },
    { key: "count", header: "Punches", width: 80, render: (p) => <Text variant="body-sm" tabular>{p.punches}</Text> },
    {
      key: "src",
      header: "From",
      flex: 1,
      render: (p) => (
        <Text variant="caption" tone="tertiary">
          {p.sources.map((s) => (s === "manual" ? "entered by hand" : s)).join(", ")}
        </Text>
      ),
    },
  ];

  return (
    <Screen title="Punches" subtitle="Straight from the fingerprint machines" testID="punches-screen">
      <VStack gap={12}>
        <HStack gap={12} align="flex-end" wrap>
          <TextField label="From Date" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" containerStyle={{ width: 150 }} testID="punches-from" />
          <TextField label="To Date" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" containerStyle={{ width: 150 }} testID="punches-to" />
          <Button label="Apply" size="sm" disabled={!validRange} onPress={() => set({ from, to, page: 1 })} testID="punches-apply" />
          <Button label="Reset" variant="secondary" size="sm" onPress={resetAll} testID="punches-reset" />
        </HStack>
        {!validRange ? <Banner tone="warning" message="Enter both dates as YYYY-MM-DD, with From on or before To." /> : null}
        <ChipsRow
          chips={[
            { key: "all", label: "Everyone" },
            { key: "student", label: "Students" },
            { key: "teacher", label: "Faculty" },
            { key: "unknown", label: "Unknown IDs" },
          ]}
          active={filters.who}
          onChange={(k) => set({ who: k, page: 1 })}
        />
        <HStack gap={12} align="center" wrap>
          <SearchInput
            value={filters.search}
            onChangeText={(v) => set({ search: v, page: 1 })}
            placeholder="Name, GR or fingerprint ID"
            style={{ flex: 2, minWidth: 220 }}
            testID="punches-search"
          />
          <HStack style={{ flex: 1, minWidth: 160 }}>
            <Select
              value={filters.source || null}
              options={[
                { value: "", label: "Any source" },
                { value: "device", label: "Fingerprint machine" },
                { value: "manual", label: "Entered by hand" },
              ]}
              onChange={(v) => set({ source: v, page: 1 })}
              placeholder="Any source"
            />
          </HStack>
        </HStack>
        {punches.error ? <ErrorState error={punches.error} onRetry={() => void punches.refetch()} /> : null}
        <DataTable
          columns={columns}
          rows={rows}
          keyExtractor={(p) => p.id}
          emptyIcon={Fingerprint}
          emptyTitle={punches.isLoading ? "Loading…" : isFiltered ? "No punch matches these filters" : "No punches"}
          mobileCard={(p) => (
            <Card>
              <VStack gap={4}>
                <Text variant="label" tone={p.personType === "unknown" ? "warning" : "primary"}>
                  {personLabel(p)}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatDay(p.date)} · GR {p.grNumber ?? "--"} · ID {p.biometricId}
                </Text>
                <Text variant="body-sm" tabular>
                  In {timeOrDash(p.inAt)} · Out {timeOrDash(p.outAt)}
                </Text>
              </VStack>
            </Card>
          )}
          testID="punches-table"
        />
        {meta && meta.pages > 1 ? (
          <Pagination page={filters.page} totalPages={meta.pages} total={meta.total} limit={PAGE_SIZE} onPageChange={(page) => set({ page })} />
        ) : null}
      </VStack>
    </Screen>
  );
}
