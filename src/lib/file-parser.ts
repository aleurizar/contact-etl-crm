import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { RawRow } from "./types";

function normalizeRow(row: Record<string, unknown>): RawRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim(),
      value === undefined || value === null ? null : typeof value === "number" ? value : String(value)
    ])
  );
}

export async function parseContactsFile(file: File): Promise<RawRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, unknown>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => resolve(result.data.map(normalizeRow)),
        error: reject
      });
    });
  }

  if (extension === "xlsx" || extension === "xls") {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!firstSheet) {
      return [];
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: null
    });

    return rows.map(normalizeRow);
  }

  throw new Error("Formato no soportado. Usa CSV, XLS o XLSX.");
}
