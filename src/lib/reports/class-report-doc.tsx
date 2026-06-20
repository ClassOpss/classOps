import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ClassReportData } from "./class-report-data";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#111", fontFamily: "Helvetica" },
  logo: { position: "absolute", top: 24, right: 28, width: 70, opacity: 0.5 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sub: { fontSize: 9, color: "#555", marginTop: 2 },
  section: { marginTop: 16 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingVertical: 3 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#999", paddingVertical: 3 },
  cell: { paddingRight: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: "#888" },
});

function Table({ columns, rows }: { columns: { label: string; flex: number }[]; rows: string[][] }) {
  if (rows.length === 0) return <Text style={s.muted}>None.</Text>;
  return (
    <View>
      <View style={s.head}>
        {columns.map((c, i) => (
          <Text key={i} style={[s.cell, s.bold, { flex: c.flex }]}>{c.label}</Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={s.row}>
          {r.map((val, ci) => (
            <Text key={ci} style={[s.cell, { flex: columns[ci].flex }]}>{val}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ClassReportDoc({ data }: { data: ClassReportData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {data.logoDataUri ? <Image style={s.logo} src={data.logoDataUri} /> : null}

        <Text style={s.title}>{data.className}</Text>
        <Text style={s.sub}>
          {data.schoolName} · {data.yearGroup} · {data.monthLabel}
        </Text>
        <Text style={s.sub}>
          Assistant{data.assistants.length === 1 ? "" : "s"}: {data.assistants.join(", ") || "—"}
        </Text>

        <View style={s.section}>
          <Text style={s.h2}>Session log</Text>
          <Table
            columns={[
              { label: "Lesson", flex: 1 },
              { label: "Date", flex: 2 },
              { label: "Topic", flex: 5 },
              { label: "Attendance", flex: 2 },
            ]}
            rows={data.sessions.map((x) => [x.lesson, x.date, x.topic, x.attendanceRate])}
          />
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Assessments</Text>
          <Table
            columns={[
              { label: "Assessment", flex: 4 },
              { label: "Date", flex: 2 },
              { label: "Max", flex: 1 },
              { label: "Class avg", flex: 2 },
            ]}
            rows={data.assessments.map((a) => [a.label, a.date, String(a.max), a.classAvg])}
          />
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Student summary (by code)</Text>
          <Table
            columns={[
              { label: "Code", flex: 2 },
              { label: "Overall average", flex: 3 },
              { label: "Absences", flex: 2 },
            ]}
            rows={data.students.map((st) => [st.code, st.average, String(st.absences)])}
          />
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Homework</Text>
          <Table
            columns={[
              { label: "Homework", flex: 5 },
              { label: "Due", flex: 2 },
              { label: "Submission rate", flex: 2 },
            ]}
            rows={data.homeworks.map((h) => [h.description, h.due, h.submissionRate])}
          />
        </View>
      </Page>
    </Document>
  );
}
