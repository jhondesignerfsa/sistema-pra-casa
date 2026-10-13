import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readDatabaseFile: () => ipcRenderer.invoke('db:read'),
  saveDatabaseFile: (data: number[]) => ipcRenderer.invoke('db:save', data),
  saveAttachment: (fileNameOrObj: any, buffer?: number[]) => {
    if (typeof fileNameOrObj === 'object' && fileNameOrObj !== null) {
      return ipcRenderer.invoke('attachment:save', fileNameOrObj);
    }
    return ipcRenderer.invoke('attachment:save', { fileName: fileNameOrObj, buffer: buffer || [] });
  },
  openAttachment: (relativePath: string) => ipcRenderer.invoke('attachment:open', relativePath),
  selectFile: (filters?: any) => ipcRenderer.invoke('dialog:selectFile', filters),
  saveBackupZip: (buffer: number[], defaultName: string) => ipcRenderer.invoke('backup:saveZip', { buffer, defaultName }),
  exportBackupZip: (args: { buffer: number[]; defaultName: string }) => ipcRenderer.invoke('backup:saveZip', args),
  readBackupZip: () => ipcRenderer.invoke('backup:readZip'),
  importBackupZip: () => ipcRenderer.invoke('backup:readZip'),
});
