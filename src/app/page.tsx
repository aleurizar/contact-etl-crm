"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Layers3,
  Search,
  Settings2,
  UploadCloud
} from "lucide-react";
import clsx from "clsx";
import { defaultPipeline, mapRows, runPipeline } from "@/lib/etl";
import { parseContactsFile } from "@/lib/file-parser";
import { sampleContacts, sampleMetrics, sampleRawRows } from "@/lib/mock-data";
import type { BaseType, ColumnMapping, ContactRow, DashboardMetrics, EtlStep, RawRow } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase";

const standardFieldLabels = {
  email: "Email",
  nombre: "Nombre",
  empresa: "Empresa",
  telefono: "Telefono",
  source: "Fuente"
};

const steps = ["Upload", "Metadata", "Mapping", "ETL", "Preview", "Importar"];

function Metric({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-moss">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink/60">{detail}</p>
    </div>
  );
}

function StepPill({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div
      className={clsx(
        "flex min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-sm",
        active && "border-moss bg-moss text-white",
        done && !active && "border-moss/20 bg-moss/10 text-moss",
        !active && !done && "border-line bg-white text-ink/60"
      )}
    >
      <span
        className={clsx(
          "grid h-5 w-5 place-items-center rounded-full text-xs",
          active && "bg-white/20",
          done && !active && "bg-moss text-white",
          !active && !done && "bg-cloud text-ink/50"
        )}
      >
        {done ? <Check className="h-3 w-3" /> : label.slice(0, 1)}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function inferColumns(rows: RawRow[]) {
  return Object.keys(rows[0] ?? {});
}

function detectMapping(columns: string[]): ColumnMapping {
  const find = (patterns: string[]) =>
    columns.find((column) => patterns.some((pattern) => column.toLowerCase().includes(pattern)));

  return {
    email: find(["email", "correo", "mail"]),
    nombre: find(["nombre", "name"]),
    empresa: find(["empresa", "company", "compania"]),
    telefono: find(["telefono", "phone", "celular", "movil"])
  };
}

function PipelineStep({ step }: { step: EtlStep }) {
  const text =
    step.type === "clean"
      ? `${standardFieldLabels[step.field]}: ${step.operation}`
      : step.type === "normalize_email"
        ? "Normalizar emails y dominios"
        : step.type === "filter"
          ? `Eliminar si ${standardFieldLabels[step.field]} esta vacio`
          : step.type === "replace"
            ? `Reemplazar en ${standardFieldLabels[step.field]}`
            : step.type === "concat"
              ? `Concatenar hacia ${standardFieldLabels[step.target]}`
              : `Separar ${standardFieldLabels[step.field]}`;

  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3 py-2 text-sm">
      <span>{text}</span>
      <Settings2 className="h-4 w-4 text-ink/45" />
    </div>
  );
}

export default function Home() {
  const [activeStep, setActiveStep] = useState(0);
  const [fileName, setFileName] = useState("contactos-expo-saas.csv");
  const [metadata, setMetadata] = useState({
    source: "Expo SaaS",
    baseType: "lead" as BaseType,
    notes: "Carga inicial para normalizar leads del evento."
  });
  const [rawRows, setRawRows] = useState<RawRow[]>(sampleRawRows);
  const columns = useMemo(() => inferColumns(rawRows), [rawRows]);
  const [mapping, setMapping] = useState<ColumnMapping>(() => detectMapping(columns));
  const [fileError, setFileError] = useState("");
  const [importStatus, setImportStatus] = useState<{
    state: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ state: "idle", message: "" });
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics>(sampleMetrics);
  const [savedContacts, setSavedContacts] = useState<ContactRow[]>(sampleContacts);
  const [savedSources, setSavedSources] = useState<{ source: string; count: number }[]>([]);
  const [dashboardMode, setDashboardMode] = useState<"loading" | "demo" | "supabase" | "error">("loading");
  const mappedRows = useMemo(() => mapRows(rawRows, mapping), [rawRows, mapping]);
  const preview = useMemo(() => runPipeline(mappedRows, defaultPipeline), [mappedRows]);

  const sourceBreakdown = savedSources.length
    ? savedSources
    : [
        { source: "Expo SaaS", count: preview.rows.length },
        { source: "Clientes historicos", count: 4120 },
        { source: "LinkedIn Ads", count: 2310 },
        { source: "Webinar", count: 1260 }
      ];

  const refreshDashboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/dashboard?ts=${Date.now()}`, { cache: "no-store" });
      const result = await response.json();

      if (!response.ok) {
        setDashboardMode("error");
        return;
      }

      setDashboardMetrics(result.metrics ?? sampleMetrics);
      setSavedContacts(result.contacts?.length ? result.contacts : sampleContacts);
      setSavedSources(result.sources ?? []);
      setDashboardMode(result.mode === "supabase" ? "supabase" : "demo");
    } catch {
      setDashboardMetrics(sampleMetrics);
      setSavedContacts(sampleContacts);
      setDashboardMode("error");
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  async function handleImport() {
    if (!preview.rows.length) {
      setImportStatus({ state: "error", message: "No hay registros validos para importar." });
      return;
    }

    setImportStatus({ state: "loading", message: "Importando contactos en Supabase..." });

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fileName,
          metadata,
          rawRows,
          stats: {
            rowsIn: preview.rowsIn,
            rowsOut: preview.rowsOut,
            rowsRemoved: preview.rowsRemoved
          },
          rows: preview.rows.map((row, index) => ({
            ...row,
            source: metadata.source,
            originalRow: rawRows[index] ?? null
          }))
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo completar la importacion.");
      }

      setImportStatus({
        state: "success",
        message: `Importacion completa: ${result.imported} contactos y ${result.traced} trazas guardadas.`
      });
      await refreshDashboard();
      setActiveStep(5);
    } catch (error) {
      setImportStatus({
        state: "error",
        message: error instanceof Error ? error.message : "No se pudo completar la importacion."
      });
    }
  }

  return (
    <main className="min-h-screen bg-cloud">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-moss text-white">
                <Database className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink">Contact ETL CRM</h1>
                <p className="text-sm text-ink/60">Mini CRM, data warehouse y motor ETL para bases de contactos</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={clsx(
                "rounded-full px-3 py-1 text-sm font-medium",
                isSupabaseConfigured ? "bg-moss/10 text-moss" : "bg-clay/10 text-clay"
              )}
            >
              {isSupabaseConfigured ? "Supabase conectado" : "Modo demo"}
            </span>
            <button
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
              onClick={() => setActiveStep(0)}
            >
              <UploadCloud className="h-4 w-4" />
              Nuevo upload
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {steps.map((step, index) => (
              <button key={step} onClick={() => setActiveStep(index)} className="focus-ring rounded-full">
                <StepPill label={step} active={activeStep === index} done={activeStep > index} />
              </button>
            ))}
          </div>

          {(activeStep === 0 || activeStep === 1) && (
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">1. Upload y metadata</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Archivo listo para procesar</h2>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-moss" />
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-moss/40 bg-moss/5 p-6 text-center">
                <UploadCloud className="h-8 w-8 text-moss" />
                <span className="mt-3 font-semibold text-ink">Arrastra CSV o Excel</span>
                <span className="mt-1 text-sm text-ink/55">La subida final ira a Supabase Storage</span>
                <input
                  className="sr-only"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    setFileName(file.name);
                    setFileError("");

                    try {
                      const parsedRows = await parseContactsFile(file);
                      setRawRows(parsedRows);
                      setMapping(detectMapping(inferColumns(parsedRows)));
                    } catch (error) {
                      setFileError(error instanceof Error ? error.message : "No se pudo leer el archivo.");
                    }
                  }}
                />
              </label>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Nombre del archivo
                  <input
                    className="focus-ring rounded-lg border border-line px-3 py-2"
                    value={fileName}
                    onChange={(event) => setFileName(event.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Fuente
                    <input
                      className="focus-ring rounded-lg border border-line px-3 py-2"
                      value={metadata.source}
                      onChange={(event) => setMetadata({ ...metadata, source: event.target.value })}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Tipo de base
                    <select
                      className="focus-ring rounded-lg border border-line px-3 py-2"
                      value={metadata.baseType}
                      onChange={(event) => setMetadata({ ...metadata, baseType: event.target.value as BaseType })}
                    >
                      <option value="lead">Lead</option>
                      <option value="cliente">Cliente</option>
                      <option value="prospect">Prospect</option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Notas
                  <textarea
                    className="focus-ring min-h-20 rounded-lg border border-line px-3 py-2"
                    value={metadata.notes}
                    onChange={(event) => setMetadata({ ...metadata, notes: event.target.value })}
                  />
                </label>
                {fileError ? <p className="text-sm font-medium text-clay">{fileError}</p> : null}
              </div>
            </div>
          </div>
          )}

          {(activeStep === 2 || activeStep === 3) && (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-moss">2. Mapeo</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">Columnas a campos estandar</h2>
                </div>
                <Layers3 className="h-5 w-5 text-moss" />
              </div>

              <div className="mt-5 space-y-3">
                {Object.entries(standardFieldLabels).map(([field, label]) => (
                  <div key={field} className="grid grid-cols-[0.8fr_auto_1.2fr] items-center gap-3 text-sm">
                    <span className="font-medium text-ink">{label}</span>
                    <ArrowRight className="h-4 w-4 text-ink/35" />
                    <select
                      className="focus-ring min-w-0 rounded-lg border border-line px-3 py-2"
                      value={mapping[field as keyof ColumnMapping] ?? ""}
                      onChange={(event) =>
                        setMapping({ ...mapping, [field]: event.target.value || undefined })
                      }
                    >
                      <option value="">Sin mapear</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>
                          {column}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-moss">3. ETL</p>
                  <h2 className="mt-1 text-lg font-semibold text-ink">Pipeline de transformacion</h2>
                </div>
                <Settings2 className="h-5 w-5 text-moss" />
              </div>

              <div className="mt-5 space-y-2">
                {defaultPipeline.steps.map((step) => (
                  <PipelineStep key={step.id} step={step} />
                ))}
              </div>

              <div className="mt-4 rounded-lg bg-cloud p-3 text-sm text-ink/70">
                Dedupe configurado por <strong>email</strong>. Las ejecuciones se guardan como preview o importacion final
                en <strong>etl_runs</strong>.
              </div>
            </div>
          </div>
          )}

          {(activeStep === 4 || activeStep === 5) && (
          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">4. Preview e importacion</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Resultado antes del upsert</h2>
              </div>
              <button
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-moss px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={importStatus.state === "loading"}
                onClick={handleImport}
              >
                <Check className="h-4 w-4" />
                {importStatus.state === "loading" ? "Importando..." : "Confirmar importacion"}
              </button>
            </div>

            {importStatus.message ? (
              <div
                className={clsx(
                  "mt-4 rounded-lg border px-3 py-2 text-sm font-medium",
                  importStatus.state === "success" && "border-moss/30 bg-moss/10 text-moss",
                  importStatus.state === "error" && "border-clay/30 bg-clay/10 text-clay",
                  importStatus.state === "loading" && "border-line bg-cloud text-ink/70"
                )}
              >
                {importStatus.message}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Entradas" value={String(preview.rowsIn)} detail="Registros leidos" />
              <Metric label="Salida" value={String(preview.rowsOut)} detail="Listos para upsert" />
              <Metric label="Eliminados" value={String(preview.rowsRemoved)} detail="Duplicados o invalidos" />
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-line">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-cloud text-ink/65">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Nombre</th>
                    <th className="px-4 py-3 font-semibold">Empresa</th>
                    <th className="px-4 py-3 font-semibold">Telefono</th>
                    <th className="px-4 py-3 font-semibold">Fuente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-white">
                  {preview.rows.map((row) => (
                    <tr key={row.email}>
                      <td className="px-4 py-3 font-medium text-ink">{row.email}</td>
                      <td className="px-4 py-3 text-ink/75">{row.nombre}</td>
                      <td className="px-4 py-3 text-ink/75">{row.empresa}</td>
                      <td className="px-4 py-3 text-ink/75">{row.telefono || "-"}</td>
                      <td className="px-4 py-3 text-ink/75">{metadata.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Metric
              label="Contactos"
              value={dashboardMetrics.total_contacts.toLocaleString("es-AR")}
              detail={dashboardMode === "supabase" ? "Base maestra real" : dashboardMode === "loading" ? "Cargando..." : "Sin lectura real"}
            />
            <Metric
              label="Este mes"
              value={dashboardMetrics.contacts_this_month.toLocaleString("es-AR")}
              detail={dashboardMode === "supabase" ? "Crecimiento real" : "Pendiente de Supabase"}
            />
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">Dashboard</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Contactos por fuente</h2>
              </div>
              <Filter className="h-5 w-5 text-moss" />
            </div>
            <div className="mt-5 space-y-4">
              {sourceBreakdown.map((item) => (
                <div key={item.source}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{item.source}</span>
                    <span className="text-ink/55">{item.count.toLocaleString("es-AR")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-cloud">
                    <div
                      className="h-2 rounded-full bg-moss"
                      style={{
                        width: `${Math.max(8, Math.min(100, (item.count / Math.max(...sourceBreakdown.map((source) => source.count), 1)) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-moss">Contactos</p>
                <h2 className="mt-1 text-lg font-semibold text-ink">Base maestra</h2>
              </div>
              <button className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold">
                <Download className="h-4 w-4" />
                Exportar
              </button>
            </div>

            <label className="mt-5 flex items-center gap-2 rounded-lg border border-line px-3 py-2">
              <Search className="h-4 w-4 text-ink/45" />
              <input className="min-w-0 flex-1 outline-none" placeholder="Buscar email, nombre o empresa" />
            </label>

            <div className="mt-4 space-y-3">
              {savedContacts.slice(0, 5).map((contact) => (
                <div key={contact.email} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{contact.nombre}</p>
                      <p className="truncate text-sm text-ink/60">{contact.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-cloud px-2 py-1 text-xs text-ink/60">{contact.source}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink/70">{contact.empresa}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
