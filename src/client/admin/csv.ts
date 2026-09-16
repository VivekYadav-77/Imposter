export interface ImportedTask {
  description: string;
  isActive: boolean;
}

export interface CsvImportResult {
  tasks: ImportedTask[];
  ignoredRows: number;
  truncatedRows: number;
}

const DESCRIPTION_HEADERS = new Set([
  "task",
  "tasks",
  "description",
  "task description",
  "task_description",
  "name",
]);
const ACTIVE_HEADERS = new Set(["active", "is active", "is_active", "enabled", "status"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0", "inactive", "disabled"]);

function rowsFromCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else value += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") value += character;
  }
  row.push(value);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

export function parseTaskCsv(source: string, limit = 15): CsvImportResult {
  const rows = rowsFromCsv(source.replace(/^\uFEFF/, ""));
  if (rows.length === 0) return { tasks: [], ignoredRows: 0, truncatedRows: 0 };

  const normalizedHeaders = rows[0].map((value) => value.trim().toLowerCase());
  const descriptionColumn = normalizedHeaders.findIndex((value) => DESCRIPTION_HEADERS.has(value));
  const activeColumn = normalizedHeaders.findIndex((value) => ACTIVE_HEADERS.has(value));
  const hasHeader = descriptionColumn >= 0 || activeColumn >= 0;
  const descriptionIndex = descriptionColumn >= 0 ? descriptionColumn : 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  let ignoredRows = 0;
  const parsed: ImportedTask[] = [];

  for (const row of dataRows) {
    const description = (row[descriptionIndex] ?? "").trim();
    if (!description) {
      ignoredRows += 1;
      continue;
    }
    const activeValue = activeColumn >= 0 ? (row[activeColumn] ?? "").trim().toLowerCase() : "";
    parsed.push({
      description: description.slice(0, 280),
      isActive: !FALSE_VALUES.has(activeValue),
    });
  }

  return {
    tasks: parsed.slice(0, limit),
    ignoredRows,
    truncatedRows: Math.max(0, parsed.length - limit),
  };
}

export const sampleTaskCsv = [
  "task,active",
  '"Take a photo beside the main entrance",true',
  '"Find something red and photograph it",true',
  '"Optional bonus task",false',
].join("\n");
