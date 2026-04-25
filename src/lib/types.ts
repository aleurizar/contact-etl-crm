export type BaseType = "lead" | "cliente" | "prospect";

export type StandardContactField =
  | "email"
  | "nombre"
  | "empresa"
  | "telefono"
  | "source";

export type ColumnMapping = Partial<Record<StandardContactField, string>>;

export type RawRow = Record<string, string | number | null | undefined>;

export type ContactRow = {
  email?: string;
  nombre?: string;
  empresa?: string;
  telefono?: string;
  source?: string;
};

export type UploadMetadata = {
  source: string;
  baseType: BaseType;
  notes?: string;
};

export type EtlStep =
  | {
      id: string;
      type: "clean";
      field: StandardContactField;
      operation: "trim" | "lowercase" | "uppercase";
    }
  | {
      id: string;
      type: "replace";
      field: StandardContactField;
      search: string;
      replaceWith: string;
    }
  | {
      id: string;
      type: "concat";
      fields: StandardContactField[];
      target: StandardContactField;
      separator: string;
    }
  | {
      id: string;
      type: "split";
      field: StandardContactField;
      separator: string;
      target: StandardContactField;
      partIndex: number;
    }
  | {
      id: string;
      type: "normalize_email";
      field: "email";
    }
  | {
      id: string;
      type: "filter";
      field: StandardContactField;
      operator: "empty" | "not_empty" | "equals" | "contains";
      value?: string;
      action: "remove";
    };

export type EtlPipeline = {
  id?: string;
  name: string;
  dedupeKey: StandardContactField;
  steps: EtlStep[];
};

export type EtlPreview = {
  rowsIn: number;
  rowsOut: number;
  rowsRemoved: number;
  rows: ContactRow[];
  errors: string[];
};

export type DashboardMetrics = {
  total_contacts: number;
  total_uploads: number;
  contacts_this_month: number;
  latest_upload_at: string | null;
};
