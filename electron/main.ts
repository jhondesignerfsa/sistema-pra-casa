import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

const USER_DATA_DIR = app.getPath('userData');
const DB_PATH = path.join(USER_DATA_DIR, 'pracasa.sqlite');
const ATTACHMENTS_DIR = path.join(USER_DATA_DIR, 'attachments');
const LOGS_DIR = path.join(USER_DATA_DIR, 'logs');

if (!fs.existsSync(ATTACHMENTS_DIR)) fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

function logEvent(message: string) {
  const logFile = path.join(LOGS_DIR, 'app.log');
  const entry = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logFile, entry, 'utf8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'PraCasa Gestão Comercial',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  logEvent('Aplicação inicializada com sucesso.');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('db:read', async () => {
  try {
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      return Array.from(buffer);
    }
    return null;
  } catch (err: any) {
    logEvent(`Erro ao ler banco: ${err.message}`);
    return null;
  }
});

ipcMain.handle('db:save', async (_, data: number[]) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    return true;
  } catch (err: any) {
    logEvent(`Erro ao salvar banco: ${err.message}`);
    return false;
  }
});

ipcMain.handle('attachment:save', async (_, { fileName, buffer }: { fileName: string; buffer: number[] }) => {
  try {
    const safeName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destPath = path.join(ATTACHMENTS_DIR, safeName);
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return safeName;
  } catch (err: any) {
    logEvent(`Erro ao salvar anexo: ${err.message}`);
    throw err;
  }
});

ipcMain.handle('attachment:open', async (_, relativePath: string) => {
  try {
    const fullPath = path.join(ATTACHMENTS_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      await shell.openPath(fullPath);
      return true;
    }
    return false;
  } catch (err: any) {
    logEvent(`Erro ao abrir anexo: ${err.message}`);
    return false;
  }
});

ipcMain.handle('dialog:selectFile', async (_, filters: any) => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'Todos os arquivos', extensions: ['*'] }],
  });
  if (!res.canceled && res.filePaths.length > 0) {
    const filePath = res.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    return {
      fileName: path.basename(filePath),
      buffer: Array.from(buffer),
    };
  }
  return null;
});

ipcMain.handle('backup:saveZip', async (_, { buffer, defaultName }: { buffer: number[]; defaultName: string }) => {
  if (!mainWindow) return false;
  const res = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'Arquivo ZIP Backup', extensions: ['zip'] }],
  });
  if (!res.canceled && res.filePath) {
    fs.writeFileSync(res.filePath, Buffer.from(buffer));
    logEvent(`Backup exportado para: ${res.filePath}`);
    return true;
  }
  return false;
});

ipcMain.handle('backup:readZip', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Arquivo ZIP Backup', extensions: ['zip'] }],
  });
  if (!res.canceled && res.filePaths.length > 0) {
    const filePath = res.filePaths[0];
    const buffer = fs.readFileSync(filePath);
    return Array.from(buffer);
  }
  return null;
});
