import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server-supabase";
import { sampleContacts, sampleMetrics } from "@/lib/mock-data";

export async function GET() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({
      metrics: sampleMetrics,
      contacts: sampleContacts,
      sources: []
    });
  }

  const [
    { count: totalContacts },
    { count: totalUploads },
    { count: contactsThisMonth },
    { data: contacts, error: contactsError },
    { data: sourceRows, error: sourceError }
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("uploads").select("*", { count: "exact", head: true }),
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("contacts").select("email,nombre,empresa,telefono,source").order("created_at", { ascending: false }).limit(10),
    supabase.from("contacts_by_source").select("source,contacts")
  ]);

  if (contactsError || sourceError) {
    return NextResponse.json(
      { error: contactsError?.message ?? sourceError?.message ?? "No se pudo leer Supabase." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    metrics: {
      total_contacts: totalContacts ?? 0,
      total_uploads: totalUploads ?? 0,
      contacts_this_month: contactsThisMonth ?? 0,
      latest_upload_at: null
    },
    contacts: contacts ?? [],
    sources:
      sourceRows?.map((row) => ({
        source: row.source,
        count: row.contacts
      })) ?? []
  });
}
