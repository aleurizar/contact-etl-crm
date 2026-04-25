import type {
  ColumnMapping,
  ContactRow,
  EtlPipeline,
  EtlPreview,
  EtlStep,
  RawRow,
  StandardContactField
} from "./types";

const standardFields: StandardContactField[] = [
  "email",
  "nombre",
  "empresa",
  "telefono",
  "source"
];

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export function mapRows(rows: RawRow[], mapping: ColumnMapping): ContactRow[] {
  return rows.map((row) => {
    const mapped: ContactRow = {};

    for (const field of standardFields) {
      const sourceColumn = mapping[field];
      if (sourceColumn) {
        mapped[field] = asText(row[sourceColumn]);
      }
    }

    return mapped;
  });
}

export function normalizeEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split("@");

  if (!local || !domain) {
    return trimmed;
  }

  return `${local}@${domain.replace(/^www\./, "")}`;
}

function shouldRemove(row: ContactRow, step: Extract<EtlStep, { type: "filter" }>) {
  const value = asText(row[step.field]);
  const expected = step.value ?? "";

  if (step.operator === "empty") return value.trim() === "";
  if (step.operator === "not_empty") return value.trim() !== "";
  if (step.operator === "equals") return value === expected;
  if (step.operator === "contains") return value.includes(expected);

  return false;
}

function applyStep(row: ContactRow, step: EtlStep): ContactRow | null {
  const next = { ...row };

  if (step.type === "clean") {
    const value = asText(next[step.field]);
    if (step.operation === "trim") next[step.field] = value.trim();
    if (step.operation === "lowercase") next[step.field] = value.toLowerCase();
    if (step.operation === "uppercase") next[step.field] = value.toUpperCase();
  }

  if (step.type === "replace") {
    const value = asText(next[step.field]);
    next[step.field] = value.replaceAll(step.search, step.replaceWith);
  }

  if (step.type === "concat") {
    next[step.target] = step.fields.map((field) => asText(next[field]).trim()).filter(Boolean).join(step.separator);
  }

  if (step.type === "split") {
    const value = asText(next[step.field]);
    next[step.target] = value.split(step.separator)[step.partIndex]?.trim() ?? "";
  }

  if (step.type === "normalize_email") {
    next.email = normalizeEmail(asText(next.email));
  }

  if (step.type === "filter" && shouldRemove(next, step)) {
    return null;
  }

  return next;
}

export function runPipeline(rows: ContactRow[], pipeline: EtlPipeline): EtlPreview {
  const errors: string[] = [];
  const output: ContactRow[] = [];
  let rowsRemoved = 0;
  const seen = new Set<string>();

  rows.forEach((input, index) => {
    let current: ContactRow | null = { ...input };

    for (const step of pipeline.steps) {
      if (!current) break;

      try {
        current = applyStep(current, step);
      } catch (error) {
        errors.push(`Fila ${index + 1}: ${error instanceof Error ? error.message : "Error desconocido"}`);
        current = null;
      }
    }

    if (!current) {
      rowsRemoved += 1;
      return;
    }

    const dedupeValue = asText(current[pipeline.dedupeKey]).trim().toLowerCase();
    if (!dedupeValue || seen.has(dedupeValue)) {
      rowsRemoved += 1;
      return;
    }

    seen.add(dedupeValue);
    output.push(current);
  });

  return {
    rowsIn: rows.length,
    rowsOut: output.length,
    rowsRemoved,
    rows: output,
    errors
  };
}

export const defaultPipeline: EtlPipeline = {
  name: "Normalización básica por email",
  dedupeKey: "email",
  steps: [
    { id: "trim-email", type: "clean", field: "email", operation: "trim" },
    { id: "normalize-email", type: "normalize_email", field: "email" },
    { id: "trim-name", type: "clean", field: "nombre", operation: "trim" },
    { id: "trim-company", type: "clean", field: "empresa", operation: "trim" },
    { id: "remove-without-email", type: "filter", field: "email", operator: "empty", action: "remove" }
  ]
};
