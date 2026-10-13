/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    readDatabaseFile: () => Promise<number[] | null>;
    saveDatabaseFile: (data: number[]) => Promise<boolean>;
    saveAttachment: (fileNameOrObj: string | { fileName: string; buffer: number[] }, buffer?: number[]) => Promise<string>;
    openAttachment: (relativePath: string) => Promise<boolean>;
    selectFile: (filters?: any) => Promise<{ fileName: string; buffer: number[] } | null>;
    saveBackupZip: (buffer: number[], defaultName: string) => Promise<boolean>;
    exportBackupZip: (args: { buffer: number[]; defaultName: string }) => Promise<boolean>;
    readBackupZip: () => Promise<number[] | null>;
    importBackupZip: () => Promise<number[] | null>;
  };
}
