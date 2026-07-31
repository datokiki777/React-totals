import * as XLSX from "xlsx";
import { db } from "../../db/database";

export async function exportToExcel() {
  const [groups, periods, clientRows] = await Promise.all([
    db.groups.toArray(),
    db.periods.toArray(),
    db.clientRows.toArray(),
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const periodById = new Map(periods.map((p) => [p.id, p]));

  const rows = clientRows.map((r) => {
    const period = periodById.get(r.periodId);
    const group = period ? groupById.get(period.groupId) : undefined;
    return {
      Group: group?.name ?? "",
      From: period?.fromDate ?? "",
      To: period?.toDate ?? "",
      Customer: r.customer,
      Gross: r.gross,
      Net: r.net,
      City: r.city,
      Status: r.status,
      Comment: r.comment,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `client-totals-${dateStr}.xlsx`);
}
