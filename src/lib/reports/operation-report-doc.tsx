import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { OperationReportData } from "./operation-report-data";

const BRAND = "#4f46e5";
const INK = "#0f1729";
const MUTED = "#5b6472";
const FAINT = "#98a1ae";
const LINE = "#e8eaed";
const SOFT = "#f4f5f7";

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
  kpi: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 7, paddingVertical: 10, paddingHorizontal: 10, marginRight: 7 },
  kpiVal: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND },
  kpiLabel: { fontSize: 7, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  section: { marginTop: 20 },
  h2: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND, textTransform: "uppercase", letterSpacing: 1, marginBottom: 7 },
  thead: { flexDirection: "row", backgroundColor: SOFT, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  th: { paddingVertical: 6, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", color: MUTED, fontSize: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  td: { paddingVertical: 5.5, paddingHorizontal: 8, color: INK },
  empty: { color: FAINT, paddingVertical: 8, paddingHorizontal: 8, fontSize: 8.5 },
  footer: { position: "absolute", bottom: 22, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, fontSize: 7.5, color: FAINT },
});

function Kpi({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View style={[s.kpi, last ? { marginRight: 0 } : {}]}>
      <Text style={s.kpiVal}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function OperationReportDoc({ data }: { data: OperationReportData }) {
  const k = data.kpis;
  return (
    <Document title={`${data.brandName} — ${data.monthLabel}`} author={data.brandName} subject="Monthly operation report">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <View>
            <Text style={s.brand}>{data.brandName}</Text>
            <Text style={s.bandSub}>Monthly Operation Report</Text>
          </View>
          {data.logoDataUri ? <View style={s.logoBox}><Image style={s.logo} src={data.logoDataUri} /></View> : null}
        </View>

        <View style={s.body}>
          <Text style={s.title}>Operation Summary</Text>
          <Text style={s.meta}>{data.monthLabel}</Text>

          <View style={s.kpiRow}>
            <Kpi value={`${k.sessionsDelivered}/${k.sessionsPlanned}`} label="Sessions (deliv/plan)" />
            <Kpi value={k.avgAttendance} label="Avg attendance" />
            <Kpi value={k.avgGrade} label="Avg grade" />
            <Kpi value={k.hwCompletion} label="HW completion" />
            <Kpi value={k.payTotal} label="Pay this month" last />
          </View>
          <View style={s.kpiRow}>
            <Kpi value={String(k.activeClasses)} label="Active classes" />
            <Kpi value={String(k.activeAssistants)} label="Assistants" />
            <Kpi value={String(k.students)} label="Students" />
            <Kpi value={String(k.needsAttention)} label="Need attention" last />
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Classes</Text>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 3.5 }]}>Class</Text>
              <Text style={[s.th, { flex: 3 }]}>School</Text>
              <Text style={[s.th, { flex: 1.5, textAlign: "right" }]}>Students</Text>
              <Text style={[s.th, { flex: 2, textAlign: "right" }]}>Attendance</Text>
              <Text style={[s.th, { flex: 2, textAlign: "right" }]}>Avg grade</Text>
            </View>
            {data.classes.length === 0 ? (
              <Text style={s.empty}>No active classes.</Text>
            ) : (
              data.classes.map((c, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, { flex: 3.5, fontFamily: "Helvetica-Bold" }]}>{c.name}</Text>
                  <Text style={[s.td, { flex: 3, color: MUTED }]}>{c.school}</Text>
                  <Text style={[s.td, { flex: 1.5, textAlign: "right" }]}>{c.students}</Text>
                  <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{c.attendance}</Text>
                  <Text style={[s.td, { flex: 2, textAlign: "right" }]}>{c.avgGrade}</Text>
                </View>
              ))
            )}
          </View>

          <View style={s.section}>
            <Text style={s.h2}>Assistants</Text>
            <View style={s.thead}>
              <Text style={[s.th, { flex: 4 }]}>Assistant</Text>
              <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Sessions</Text>
              <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Office hrs</Text>
              <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Incidents</Text>
              <Text style={[s.th, { flex: 2.2, textAlign: "right" }]}>Net pay</Text>
            </View>
            {data.assistants.length === 0 ? (
              <Text style={s.empty}>No active assistants.</Text>
            ) : (
              data.assistants.map((a, i) => (
                <View key={i} style={s.tr} wrap={false}>
                  <Text style={[s.td, { flex: 4, fontFamily: "Helvetica-Bold" }]}>{a.name}</Text>
                  <Text style={[s.td, { flex: 1.6, textAlign: "right" }]}>{a.sessions}</Text>
                  <Text style={[s.td, { flex: 1.6, textAlign: "right" }]}>{a.officeHours}</Text>
                  <Text style={[s.td, { flex: 1.6, textAlign: "right" }]}>{a.incidents}</Text>
                  <Text style={[s.td, { flex: 2.2, textAlign: "right" }]}>{a.netPay}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{data.brandName} · Generated {data.generatedAt}</Text>
          <Text>Confidential — operation summary</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
