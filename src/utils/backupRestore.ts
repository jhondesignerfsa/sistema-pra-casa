import JSZip from 'jszip';
import { persistDB, getDB } from '../db/database';
import initSqlJs from 'sql.js';

export async function restoreBackupFromFile(file: File): Promise<{ success: boolean; message: string }> {
  try {
    let b64Data = '';

    if (file.name.endsWith('.zip')) {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      // Check for pracasa_b64.txt
      const txtFile = zip.file('pracasa_b64.txt');
      if (txtFile) {
        b64Data = (await txtFile.async('string')).trim();
      } else {
        // Check for pracasa.sqlite or any .sqlite file
        const sqliteFile = zip.file('pracasa.sqlite') || Object.values(zip.files).find(f => f.name.endsWith('.sqlite') || f.name.endsWith('.db'));
        if (sqliteFile) {
          const sqliteBytes = await sqliteFile.async('uint8array');
          let binaryStr = '';
          for (let i = 0; i < sqliteBytes.length; i++) {
            binaryStr += String.fromCharCode(sqliteBytes[i]);
          }
          b64Data = btoa(binaryStr);
        }
      }
    } else if (file.name.endsWith('.txt')) {
      b64Data = (await file.text()).trim();
    } else if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryStr = '';
      for (let i = 0; i < bytes.length; i++) {
        binaryStr += String.fromCharCode(bytes[i]);
      }
      b64Data = btoa(binaryStr);
    }

    if (!b64Data || b64Data.length < 100) {
      return { success: false, message: 'Arquivo de backup inválido ou vazio. Selecione o arquivo ZIP baixado ou arquivo SQLite.' };
    }

    // Validate that it decodes into a valid SQLite DB
    const binaryStr = atob(b64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
    const testDb = new SQL.Database(bytes);
    const repCheck = testDb.exec("SELECT count(*) FROM representante;");
    const repCount = repCheck[0]?.values[0]?.[0] || 0;
    const prodCheck = testDb.exec("SELECT count(*) FROM produto;");
    const prodCount = prodCheck[0]?.values[0]?.[0] || 0;

    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pracasa_db_binary', b64Data);
      localStorage.setItem('pracasa_opera_sync_v2', 'true');
    }

    return {
      success: true,
      message: `Backup restaurado com sucesso! (${repCount} representantes, ${prodCount} produtos carregados). Recarregando sistema...`
    };
  } catch (err: any) {
    console.error('Erro ao restaurar backup:', err);
    return { success: false, message: `Erro ao processar backup: ${err.message || 'Arquivo corrompido'}` };
  }
}
