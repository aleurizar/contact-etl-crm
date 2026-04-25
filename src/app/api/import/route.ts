import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server-supabase";

const requestSchema = z.object({
  uploadId: z.string().uuid().optional(),
  fileName: z.string().min(1).default("importacion-manual.csv"),
  metadata: z.object({
    source: z.string().min(1),
    baseType: z.enum(["lead", "cliente", "prospect"]),
    notes: z.string().optional()
  }),
  rawRows: z.array(z.record(z.unknown())).default([]),
  stats: z
    .object({
      rowsIn: z.number().int().nonnegative(),
      rowsOut: z.number().int().nonnegative(),
      rowsRemoved: z.number().int().nonnegative()
    })
    .optional(),
  rows: z.array(
    z.object({
      email: z.string().email(),
      nombre: z.string().optional(),
      empresa: z.string().optional(),
      telefono: z.string().optional(),
      source: z.string().optional(),
      originalRow: z.record(z.unknown()).optional()
    })
  )
});

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase no esta configurado en variables de entorno." }, { status: 503 });
  }

  const payload = requestSchema.parse(await request.json());
  const uploadId = payload.uploadId ?? crypto.randomUUID();
  const storagePath = `manual/${uploadId}/${payload.fileName}`;
  const contacts = payload.rows.map(({ originalRow: _originalRow, ...row }) => ({
    ...row,
    source: row.source ?? payload.metadata.source
  }));

  const { error: uploadError } = await supabase.from("uploads").upsert({
    id: uploadId,
    file_name: payload.fileName,
    storage_path: storagePath,
    source: payload.metadata.source,
    base_type: payload.metadata.baseType,
    notes: payload.metadata.notes ?? null,
    status: "imported",
    row_count: payload.stats?.rowsIn ?? payload.rawRows.length
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .upsert(contacts, { onConflict: "email" })
    .select("id,email");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contactIdByEmail = new Map(data?.map((contact) => [contact.email, contact.id]) ?? []);
  const sourceRows = payload.rows
    .map((row, index) => ({
      contact_id: contactIdByEmail.get(row.email),
      upload_id: uploadId,
      original_row: row.originalRow ?? payload.rawRows[index] ?? null,
      transformed_row: {
        ...row,
        source: row.source ?? payload.metadata.source
      }
    }))
    .filter((row) => row.contact_id);

  const { error: sourceError } = await supabase.from("contact_sources").upsert(sourceRows, {
    onConflict: "contact_id,upload_id"
  });

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }

  const { error: runError } = await supabase.from("etl_runs").insert({
    upload_id: uploadId,
    status: "completed",
    rows_in: payload.stats?.rowsIn ?? payload.rawRows.length,
    rows_out: payload.stats?.rowsOut ?? contacts.length,
    rows_removed: payload.stats?.rowsRemoved ?? Math.max(0, payload.rawRows.length - contacts.length),
    preview: contacts.slice(0, 50)
  });

  if (runError) {
    return NextResponse.json({ error: runError.message }, { status: 500 });
  }

  return NextResponse.json({
    uploadId,
    imported: contacts.length,
    traced: sourceRows.length
  });
}
