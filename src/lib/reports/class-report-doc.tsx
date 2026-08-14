import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ClassReportData } from "./class-report-data";

const BRAND = "#4f46e5";
const INK = "#0f1729";
const MUTED = "#5b6472";
const FAINT = "#98a1ae";
const LINE = "#e8eaed";
const SOFT = "#f4f5f7";

const s = StyleSheet.create({
  page: { paddingBottom: 54, fontSize: 9, color: INK, fontFamily: "Helvetica" },

  // Header band
  band: {
    backgroundColor: BRAND,
    paddingHorizontal: 32,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: "#ffffff", fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  bandSub: { color: "#dfe1fb", fontSize: 8.5, marginTop: 3, textTransform: "uppercase", letterSpacing: 1.2 },
  logoBox: { backgroundColor: "#ffffff", borderRadius: 6, padding: 6 },
  logo: { width: 46, height: 46, objectFit: "contain" },

  body: { paddingHorizontal: 32, paddingTop: 20 },

  title: { fontSize: 19, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9.5, color: MUTED, marginTop: 4 },

  // KPI cards
  kpiRow: { flexDirection: "row", marginTop: 16, marginBottom: 4 },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 7,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  kpiVal: { fontSize: 17, fontFamily: "Helvetica-Bold", color: BRAND },
  kpiLabel: { fontSize: 7.5, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6 },

  section: { marginTop: 20 },
  h2: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 7,
  },

  thead: { flexDirection: "row", backgroundColor: SOFT, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  th: { paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", color: MUTED, fontSize: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  trAlt: { backgroundColor: "#fbfbfc" },
  td: { paddingVertical: 5.5, paddingHorizontal: 8, color: INK },
  empty: { color: FAINT, paddingVertical: 8, paddingHorizontal: 8, fontSize: 8.5 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: LINE,
    paddingTop: 8,
    fontSize: 7.5,
    color: FAINT,
  },
});

type Col = { label: string; flex: number; align?: "left" | "right" };

function Table({ columns, rows }: { columns: Col[]; rows: string[][] }) {
  return (
    <View>
      <View style={s.thead}>
        {columns.map((c, i) => (
          <Text key={i} style={[s.th, { flex: c.flex, textAlign: c.align ?? "left" }]}>{c.label}</Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={s.empty}>None recorded this period.</Text>
      ) : (
        rows.map((r, ri) => (
          <View key={ri} style={ri % 2 ? [s.tr, s.trAlt] : s.tr} wrap={false}>
            {r.map((val, ci) => (
              <Text key={ci} style={[s.td, { flex: columns[ci].flex, textAlign: columns[ci].align ?? "left" }]}>
                {val}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function Kpi({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View style={[s.kpi, last ? { marginRight: 0 } : {}]}>
      <Text style={s.kpiVal}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function ClassReportDoc({ data }: { data: ClassReportData }) {
  return (
    <Document
      title={`${data.className} — ${data.monthLabel}`}
      author={data.brandName}
      subject="Monthly class report"
    >
      <Page size="A4" style={s.page}>
        {/* Header band */}
        <View style={s.band} fixed>
          <View>
            <Text style={s.brand}>{data.brandName}</Text>
            <Text style={s.bandSub}>Monthly Class Report</Text>
          </View>
          {data.logoDataUri ? (
            <View style={s.logoBox}>
              <Image style={s.logo} src={data.logoDataUri} />
            </View>
          ) : null}
        </View>

        <View style={s.body}>
          <Text style={s.title}>{data.className}</Text>
          <Text style={s.meta}>
            {data.schoolName}  ·  {data.yearGroup}  ·  {data.monthLabel}
          </Text>
          <Text style={s.meta}>
            Assistant{data.assistants.length === 1 ? "" : "s"}: {data.assistants.join(", ") || "—"}
          </Text>

          {/* KPIs */}
          <View style={s.kpiRow}>
            <Kpi value={String(data.summary.sessionsDelivered)} label="Sessions delivered" />
            <Kpi value={data.summary.avgAttendance} label="Avg attendance" />
            <Kpi value={data.summary.classAverage} label="Class average" />
            <Kpi value={String(data.summary.students)} label="Students" last />
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Session log</Text>
            <Table
              columns={[
                { label: "Lesson", flex: 1.2 },
                { label: "Date", flex: 2.2 },
                { label: "Topic", flex: 5 },
                { label: "Attendance", flex: 2, align: "right" },
              ]}
              rows={data.sessions.map((x) => [x.lesson, x.date, x.topic, x.attendanceRate])}
            />
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Assessments</Text>
            <Table
              columns={[
                { label: "Assessment", flex: 4 },
                { label: "Date", flex: 2.2 },
                { label: "Max", flex: 1, align: "right" },
                { label: "Class avg", flex: 2, align: "right" },
              ]}
              rows={data.assessments.map((a) => [a.label, a.date, String(a.max), a.classAvg])}
            />
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Student summary</Text>
            <Table
              columns={[
                { label: "Code", flex: 2 },
                { label: "Overall average", flex: 3, align: "right" },
                { label: "Absences", flex: 2, align: "right" },
              ]}
              rows={data.students.map((st) => [st.code, st.average, String(st.absences)])}
            />
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Homework</Text>
            <Table
              columns={[
                { label: "Homework", flex: 5 },
                { label: "Due", flex: 2.2 },
                { label: "Submission rate", flex: 2, align: "right" },
              ]}
              rows={data.homeworks.map((h) => [h.description, h.due, h.submissionRate])}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>{data.brandName} · Generated {data.generatedAt}</Text>
          <Text>Confidential — student performance data</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
