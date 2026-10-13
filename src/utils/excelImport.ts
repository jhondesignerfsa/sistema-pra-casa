import * as XLSX from 'xlsx';

export interface CSVParseResult {
  headers: string[];
  data: Record<string, any>[];
  errors: string[];
}

export async function parseExcelOrCSV(file: File): Promise<Record<string, any>[]> {
  const result = await parseExcelFile(file);
  return result.data;
}

export function parseCSVFile(file: File): Promise<CSVParseResult> {
  return parseExcelFile(file);
}

export function parseExcelFile(file: File): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve({ headers: [], data: [], errors: ['Planilha vazia ou sem abas'] });
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (json.length === 0) {
          resolve({ headers: [], data: [], errors: ['Arquivo vazio'] });
          return;
        }

        const headers = Object.keys(json[0] || {});
        resolve({ headers, data: json, errors: [] });
      } catch (err: any) {
        resolve({ headers: [], data: [], errors: [err?.message || 'Erro ao processar arquivo'] });
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export function exportToCSV(filename: string, data: Record<string, any>[]) {
  exportToExcel(data, filename);
}

export function exportToXLSX(filename: string, sheetName: string, data: Record<string, any>[]) {
  exportToExcel(data, filename, sheetName);
}

export function exportToExcel(
  arg1: string | Record<string, any>[],
  arg2: string | Record<string, any>[],
  arg3?: string | Record<string, any>[]
) {
  let filename = 'exportacao';
  let sheetName = 'Dados';
  let data: Record<string, any>[] = [];

  if (Array.isArray(arg1)) {
    data = arg1;
    filename = typeof arg2 === 'string' ? arg2 : 'exportacao';
    if (typeof arg3 === 'string') sheetName = arg3;
  } else if (typeof arg1 === 'string') {
    filename = arg1;
    if (Array.isArray(arg2)) {
      data = arg2;
    } else if (typeof arg2 === 'string') {
      sheetName = arg2;
      data = Array.isArray(arg3) ? arg3 : [];
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const cleanFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, cleanFilename);
}
