import { NextResponse } from "next/server";
import { z } from "zod";
import { mapRows, runPipeline } from "@/lib/etl";
import type { ColumnMapping, EtlPipeline } from "@/lib/types";

const requestSchema = z.object({
  rows: z.array(z.record(z.union([z.string(), z.number(), z.null()]))),
  mapping: z.record(z.string(), z.string()),
  pipeline: z.object({
    name: z.string(),
    dedupeKey: z.enum(["email", "nombre", "empresa", "telefono", "source"]),
    steps: z.array(z.unknown())
  })
});

export async function POST(request: Request) {
  const payload = requestSchema.parse(await request.json());
  const mappedRows = mapRows(payload.rows, payload.mapping as ColumnMapping);
  const preview = runPipeline(mappedRows, payload.pipeline as EtlPipeline);

  return NextResponse.json(preview);
}
