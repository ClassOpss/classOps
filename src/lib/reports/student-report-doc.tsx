import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { StudentReportData, Standing } from "./student-report-data";

const BRAND = "#4f46e5";
const INK = "#0f1729";
const MUTED = "#5b6472";
const FAINT = "#98a1ae";
const LINE = "#e8eaed";
const SOFT = "#f4f5f7";
const GREEN = "#15803d";
const RED = "#dc2626";

const s = StyleSheet.create({
  page: { paddingBottom: 54, fontSize: 9.5, color: INK, fontFamily: "Helvetica" },
  band: { backgroundColor: BRAND, paddingHorizontal: 32, paddingVertical: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#fff", fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  bandSub: { color: "#dfe1fb", fontSize: 8.5, marginTop: 3, textTransform: "uppercase", letterSpacing: 1.2 },
  logoBox: { backgroundColor: "#fff", borderRadius: 6, padding: 6 },
  logo: { width: 46, height: 46, objectFit: "contain" },
  body: { paddingHorizontal: 32, paddingTop: 20 },
  title: { fontSize: 19, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9.5, color: MUTED, marginTop: 4 },
  kpiRow: { flexDirection: "row", marginTop: 16 },
  kpi: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 7, paddingVertical: 11, paddingHorizontal: 12, marginRight: 8 },
  kpiVal: { fontSize: 17, fontFamily: "Helvetica-Bold", color: BRAND },
  kpiLabel: { fontSize: 7.5, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6 },
  section: { marginTop: 20 },
  h2: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 },
  thead: { flexDirection: "row", backgroundColor: SOFT, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  th: { paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", color: MUTED, fontSize: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  td: { paddingVertical: 5.5, paddingHorizontal: 8, color: INK },
  empty: { color: FAINT, paddingVertical: 8, paddingHorizontal: 8, fontSize: 8.5 },
  notes: { borderWidth: 1, borderColor: LINE, borderRadius: 7, backgroundColor: "#fffdf6", padding: 12, fontSize: 10, lineHeight: 1.5 },
  footer: { position: "absolute", bottom: 22, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, fontSize: 7.5, color: FAINT },
});

function standingStyle(st: Standing | null) {
  if (st === "above") return { color: GREEN, label: "Above average" };
  if (st === "below") return { color: RED, label: "Below average" };
  if (st === "average") return { color: MUTED, label: "On average" };
  return { color: FAINT, label: "—" };
}

export function StudentReportDoc({ data }: { data: StudentReportData }) {
  return (
    <Document title={`${data.studentName} — ${data.monthLabel}`} author={data.brandName} subject="Student progress report">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <View>
            <Text style={s.brand}>{data.brandName}</Text>
            <Text style={s.bandSub}>Student Progress Report</Text>
          </View>
          {data.logoDataUri ? <View style={s.logoBox}><Image style={s.logo} src={data.logoDataUri} /></View> : null}
        </View>

        <View style={s.body}>
          <Text style={s.title}>{data.studentName}</Text>
          <Text style={s.meta}>
            Code {data.code}  ·  {data.className}  ·  {data.schoolName}  ·  {data.monthLabel}
          </Text>

          <View style={s.kpiRow}>
            <View style={s.kpi}><Text style={s.kpiVal}>{data.summary.attendanceRate}</Text><Text style={s.kpiLabel}>Attendance</Text></View>
            <View style={s.kpi}><Text style={s.kpiVal}>{data.summary.average}</Text><Text style={s.kpiLabel}>Average grade</Text></View>
            <View style={s.kpi}><Text style={s.kpiVal}>{String(data.summary.absences)}</Text><Text style={s.kpiLabel}>Absences</Text></View>
            <View style={[s.kpi, { marginRight: 0 }]}><Text style={s.kpiVal}>{String(data.summary.missedHw)}</Text><Text style={s.kpiLabel}>Missed homework</Text></View>
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Grades this month</Text>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 4 }]}>Assessment</Text>
              <Text style={[s.th, { flex: 2 }]}>Date</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: "right" }]}>Score</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: "right" }]}>Class avg</Text>
              <Text style={[s.th, { flex: 2.5, textAlign: "right" }]}>Standing</Text>
            </View>
            {data.grades.length === 0 ? (
              <Text style={s.empty}>No assessments this month.</Text>
            ) : (
              data.grades.map((g, i) => {
                const st = standingStyle(g.standing);
                return (
                  <View key={i} style={s.tr} wrap={false}>
                    <Text style={[s.td, { flex: 4 }]}>{g.label}</Text>
                    <Text style={[s.td, { flex: 2 }]}>{g.date}</Text>
                    <Text style={[s.td, { flex: 1.5, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{g.score}</Text>
                    <Text style={[s.td, { flex: 1.5, textAlign: "right", color: MUTED }]}>{g.classAvg}</Text>
                    <Text style={[s.td, { flex: 2.5, textAlign: "right", color: st.color }]}>{st.label}</Text>
                  </View>
                );
              })
            )}
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Absences</Text>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 2 }]}>Date</Text>
              <Text style={[s.th, { flex: 6 }]}>Lesson</Text>
            </View>
            {data.absences.length === 0 ? (
              <Text style={s.empty}>Full attendance this month.</Text>
            ) : (
              data.absences.map((a, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, { flex: 2 }]}>{a.date}</Text>
                  <Text style={[s.td, { flex: 6 }]}>{a.topic}</Text>
                </View>
              ))
            )}
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Missed homework</Text>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 6 }]}>Homework</Text>
              <Text style={[s.th, { flex: 2, textAlign: "right" }]}>Was due</Text>
            </View>
            {data.missedHomework.length === 0 ? (
              <Text style={s.empty}>No missed homework this month.</Text>
            ) : (
              data.missedHomework.map((h, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, { flex: 6 }]}>{h.description}</Text>
                  <Text style={[s.td, { flex: 2, textAlign: "right", color: MUTED }]}>{h.due}</Text>
                </View>
              ))
            )}
          </View>

          {data.parentNotes ? (
            <View style={s.section}>
              <Text style={s.h2}>Notes from the teaching team</Text>
              <Text style={s.notes}>{data.parentNotes}</Text>
            </View>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text>{data.brandName} · Generated {data.generatedAt}</Text>
          <Text>Confidential — for {data.studentName}&apos;s parent/guardian</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
