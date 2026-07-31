import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "../../db/database";
import { formatMoney } from "../../shared/lib/calc";

export async function exportToPdf() {
  const [groups, periods, clientRows] = await Promise.all([
    db.groups.toArray(),
    db.periods.toArray(),
    db.clientRows.toArray(),
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const periodById = new Map(periods.map((p) => [p.id, p]));

  const body = clientRows.map((r) => {
    const period = periodById.get(r.periodId);
    const group = period ? groupById.get(period.groupId) : undefined;
    return [
      group?.name ?? "",
      `${period?.fromDate ?? "—"} → ${period?.toDate ?? "—"}`,
      r.customer,
      formatMoney(r.gross),
      formatMoney(r.net),
      r.city,
      r.status,
    ];
  });

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Client Totals", 14, 16);

  autoTable(doc, {
    startY: 22,
    head: [["Group", "Period", "Customer", "Gross", "Net", "City", "Status"]],
    body,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [11, 29, 63] },
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`client-totals-${dateStr}.pdf`);
}
