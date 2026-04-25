import type { ContactRow, DashboardMetrics, RawRow } from "./types";

export const sampleRawRows: RawRow[] = [
  {
    "Correo electronico": " ANA@Acme.COM ",
    Nombre: "Ana Torres",
    Empresa: "Acme",
    Telefono: "11 5555 1200"
  },
  {
    "Correo electronico": "martin@delta.io",
    Nombre: "Martin Ruiz",
    Empresa: "Delta",
    Telefono: "+54 9 11 4444 0101"
  },
  {
    "Correo electronico": "ana@acme.com",
    Nombre: "Ana T.",
    Empresa: "Acme",
    Telefono: ""
  },
  {
    "Correo electronico": "",
    Nombre: "Registro sin email",
    Empresa: "Beta",
    Telefono: "123"
  }
];

export const sampleContacts: ContactRow[] = [
  { email: "ana@acme.com", nombre: "Ana Torres", empresa: "Acme", telefono: "11 5555 1200", source: "Expo SaaS" },
  { email: "martin@delta.io", nombre: "Martin Ruiz", empresa: "Delta", telefono: "+54 9 11 4444 0101", source: "LinkedIn Ads" },
  { email: "sofia@northwind.co", nombre: "Sofia Molina", empresa: "Northwind", telefono: "11 5300 2211", source: "Clientes históricos" },
  { email: "lucas@orbit.dev", nombre: "Lucas Perez", empresa: "Orbit", telefono: "11 4100 9921", source: "Webinar" }
];

export const sampleMetrics: DashboardMetrics = {
  total_contacts: 12840,
  total_uploads: 37,
  contacts_this_month: 942,
  latest_upload_at: new Date().toISOString()
};
