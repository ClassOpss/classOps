import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { PayslipData } from "./payslip-data";

const BRAND = "#4f46e5";
const INK = "#0f1729";
const MUTED = "#5b6472";
const FAINT = "#98a1ae";
const LINE = "#e8eaed";
const GREEN = "#15803d";
const RED = "#dc2626";

const s = StyleSheet.create({
  page: { paddingBottom: 54, fontSize: 10, color: INK, fontFamily: "Helvetica" },
  band: { backgroundColor: BRAND, paddingHorizontal: 32, paddingVertical: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { color: "#fff", fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  bandSub: { color: "#dfe1fb", fontSize: 8.5, marginTop: 3, textTransform: "uppercase", letterSpacing: 1.2 },
  logoBox: { backgroundColor: "#fff", borderRadius: 6, padding: 6 },
  logo: { width: 46, height: 46, objectFit: "contain" },
  body: { paddingHorizontal: 32, paddingTop: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  name: { fontSize: 19, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 10, color: MUTED, marginTop: 4 },
  statusPill: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.8, color: BRAND, borderWidth: 1, borderColor: BRAND, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  table: { marginTop: 26, borderWidth: 1, borderColor: LINE, borderRadius: 8 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: LINE },
  lineLabel: { color: INK },
  lineNote: { color: FAINT, fontSize: 8, marginTop: 2 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 14, backgroundColor: "#f4f5f7", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 },
  totalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  totalVal: { fontSize: 15, fontFamily: "Helvetica-Bold", color: BRAND },
  footer: { position: "absolute", bottom: 22, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, fontSize: 7.5, color: FAINT },
});

export function PayslipDoc({ data }: { data: PayslipData }) {
  const fmt = (v: number) => `${v < 0 ? "-" : ""}${Math.abs(v).toLocaleString("en-US")} ${data.currency}`;

  return (
    <Document title={`Payslip — ${data.assistantName} — ${data.periodLabel}`} author={data.brandName} subject="Payslip">
      <Page size="A4" style={s.page}>
        <View style={s.band} fixed>
          <View>
            <Text style={s.brand}>{data.brandName}</Text>
            <Text style={s.bandSub}>Payslip</Text>
          </View>
          {data.logoDataUri ? <View style={s.logoBox}><Image style={s.logo} src={data.logoDataUri} /></View> : null}
        </View>

        <View style={s.body}>
          <View style={s.row}>
            <View>
              <Text style={s.name}>{data.assistantName}</Text>
              <Text style={s.meta}>Pay period · {data.periodLabel}</Text>
            </View>
            <Text style={s.statusPill}>{data.status}</Text>
          </View>

          <View style={s.table}>
            {data.lines.map((l, i) => (
              <View key={i} style={s.line} wrap={false}>
                <View>
                  <Text style={s.lineLabel}>{l.label}</Text>
                  {l.note ? <Text style={s.lineNote}>{l.note}</Text> : null}
                </View>
                <Text style={{ fontFamily: "Helvetica-Bold", color: l.amount < 0 ? RED : l.amount > 0 ? GREEN : INK }}>
                  {l.amount > 0 ? "+" : ""}{fmt(l.amount)}
                </Text>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Net total</Text>
              <Text style={s.totalVal}>{fmt(data.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>{data.brandName} · Generated {data.generatedAt}</Text>
          <Text>Confidential — payroll</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
