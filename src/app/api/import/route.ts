import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server-supabase";

const requestSchema = z.object({
  uploadId: z.string().uuid(),
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
  const contacts = payload.rows.map(({ originalRow: _originalRow, ...row }) => row);

  const { data, error } = await supabase
    .from("contacts")
    .upsert(contacts, { onConflict: "email" })
    .select("id,email");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const contactIdByEmail = new Map(data?.map((contact) => [contact.email, contact.id]) ?? []);
  const sourceRows = payload.rows
    .map((row) => ({
      contact_id: contactIdByEmail.get(row.email),
      upload_id: payload.uploadId,
      original_row: row.originalRow ?? null,
      transformed_row: row
    }))
    .filter((row) => row.contact_id);

  const { error: sourceError } = await supabase.from("contact_sources").upsert(sourceRows, {
    onConflict: "contact_id,upload_id"
  });

  if (sourceError) {
    return NextResponse.json({ error: sourceError.message }, { status: 500 });
  }

  return NextResponse.json({
    imported: contacts.length,
    traced: sourceRows.length
  });
}
