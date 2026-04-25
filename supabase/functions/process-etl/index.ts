import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

type ContactRow = Record<string, string | undefined>;

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const [local, domain] = trimmed.split("@");
  return local && domain ? `${local}@${domain.replace(/^www\./, "")}` : trimmed;
}

function applyBasicPipeline(rows: ContactRow[]) {
  const seen = new Set<string>();
  const output: ContactRow[] = [];

  for (const row of rows) {
    const email = normalizeEmail(asText(row.email));
    if (!email || seen.has(email)) continue;

    seen.add(email);
    output.push({
      ...row,
      email,
      nombre: asText(row.nombre).trim(),
      empresa: asText(row.empresa).trim(),
      telefono: asText(row.telefono).trim()
    });
  }

  return output;
}

serve(async (request) => {
  const { uploadId, rows, previewOnly = true } = await request.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const transformed = applyBasicPipeline(rows ?? []);

  await supabase.from("etl_runs").insert({
    upload_id: uploadId,
    status: previewOnly ? "preview" : "completed",
    rows_in: rows?.length ?? 0,
    rows_out: transformed.length,
    rows_removed: Math.max(0, (rows?.length ?? 0) - transformed.length),
    preview: previewOnly ? transformed.slice(0, 50) : null
  });

  if (!previewOnly) {
    await supabase.from("contacts").upsert(transformed, { onConflict: "email" });
  }

  return new Response(JSON.stringify({ rows: transformed }), {
    headers: { "Content-Type": "application/json" }
  });
});
