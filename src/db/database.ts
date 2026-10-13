import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { SCHEMA_SQL } from './schema';

let dbInstance: SqlJsDatabase | null = null;
const STORAGE_KEY = 'pracasa_db_binary';

export async function getDB(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs({
    // Locate local wasm binary for 100% offline capability
    locateFile: (file) => `/sql-wasm.wasm`
  });

  // Check if saved state exists in localStorage or local file
  let savedData: Uint8Array | null = null;

  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.readDatabaseFile) {
    const fileBytes = await window.electronAPI.readDatabaseFile();
    if (fileBytes) {
      savedData = new Uint8Array(fileBytes);
    }
  } else if (typeof localStorage !== 'undefined') {
    const b64 = localStorage.getItem(STORAGE_KEY);
    if (b64) {
      const binaryStr = atob(b64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      savedData = bytes;
    }
  }

  // Se não há dados salvos localmente, carrega o banco de dados oficial extraído do Opera
  if (!savedData || savedData.length === 0) {
    try {
      const res = await fetch('/initial_database.sqlite');
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength > 1000) {
          savedData = new Uint8Array(arrayBuf);
          console.log(`[PraCasa DB] Banco oficial importado de /initial_database.sqlite (${savedData.length} bytes)!`);
        }
      }
    } catch (e) {
      console.warn('[PraCasa DB] Falha ao carregar banco inicial da web:', e);
    }
  }

  if (savedData && savedData.length > 0) {
    dbInstance = new SQL.Database(savedData);
    try {
      dbInstance.run("ALTER TABLE representante ADD COLUMN contatos_seguranca TEXT;");
    } catch (_) {}
    try {
      dbInstance.run("ALTER TABLE produto ADD COLUMN preco_caixa REAL;");
    } catch (_) {}
    try {
      dbInstance.run("ALTER TABLE item_pedido ADD COLUMN tipo_embalagem TEXT DEFAULT 'caixa';");
    } catch (_) {}
    try {
      // Fix box prices for products that have individual bottle price or null box price
      dbInstance.run(`
        UPDATE produto SET preco_caixa = 80.91 WHERE sku = 'COD-35' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 82.68 WHERE sku = 'COD-36' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 65.89 WHERE sku = 'COD-37' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 53.88 WHERE sku = 'COD-38' AND (preco_caixa IS NULL OR preco_caixa < 40);
        UPDATE produto SET preco_caixa = 82.68 WHERE sku = 'COD-39' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 58.68 WHERE sku = 'COD-40' AND (preco_caixa IS NULL OR preco_caixa < 40);
        UPDATE produto SET preco_caixa = 58.68 WHERE sku = 'COD-41' AND (preco_caixa IS NULL OR preco_caixa < 40);
        UPDATE produto SET preco_caixa = 240.00 WHERE sku = 'FAR-CROC-CX20' AND (preco_caixa IS NULL OR preco_caixa < 100);
        UPDATE produto SET preco_caixa = 120.00 WHERE sku = 'FAR-CROC-CX10' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 125.40 WHERE sku = 'TEMP-CHURR-SPIM' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 125.40 WHERE sku = 'TEMP-CHURR-500' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 128.00 WHERE sku = 'TEMP-AMAC-250' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 128.00 WHERE sku = 'TEMP-COMPL-POTE' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 129.00 WHERE sku = 'SAL-ERVAS-500' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 129.00 WHERE sku = 'SAL-TEMP-500' AND (preco_caixa IS NULL OR preco_caixa < 50);
        UPDATE produto SET preco_caixa = 120.00 WHERE sku = 'FAR-TEMP-CX20' AND (preco_caixa IS NULL OR preco_caixa < 50);

        UPDATE produto 
        SET preco_caixa = ROUND(preco_tabela * CASE WHEN fator_conversao_estoque > 1 THEN fator_conversao_estoque ELSE 1 END, 2)
        WHERE (preco_caixa IS NULL OR preco_caixa <= 0) AND preco_tabela > 0;

        -- Fix any item_pedido with individual bottle prices instead of box prices
        UPDATE item_pedido 
        SET preco_unitario = 82.68, subtotal = ROUND(quantidade * 82.68 * (1 - COALESCE(desconto_pct, 0) / 100), 2)
        WHERE produto_sku = 'COD-39' AND preco_unitario < 50;

        UPDATE item_pedido 
        SET preco_unitario = 80.91, subtotal = ROUND(quantidade * 80.91 * (1 - COALESCE(desconto_pct, 0) / 100), 2)
        WHERE produto_sku = 'COD-35' AND preco_unitario < 50;

        -- Update pedido totals
        UPDATE pedido
        SET subtotal = (SELECT COALESCE(SUM(subtotal), 0) FROM item_pedido WHERE pedido_id = pedido.id),
            valor_total = (SELECT COALESCE(SUM(subtotal), 0) FROM item_pedido WHERE pedido_id = pedido.id) + COALESCE(valor_frete, 0) - COALESCE(desconto_total, 0)
        WHERE id IN (SELECT DISTINCT pedido_id FROM item_pedido WHERE produto_sku IN ('COD-39', 'COD-35'));
      `);
    } catch (_) {}
  } else {
    dbInstance = new SQL.Database();
    // Run initial schema
    dbInstance.run(SCHEMA_SQL);
    await persistDB();
  }

  return dbInstance;
}

export async function persistDB() {
  if (!dbInstance) return;
  const data = dbInstance.export();

  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.saveDatabaseFile) {
    await window.electronAPI.saveDatabaseFile(Array.from(data));
  } else if (typeof localStorage !== 'undefined') {
    let binaryStr = '';
    const bytes = new Uint8Array(data);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binaryStr += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binaryStr);
    localStorage.setItem(STORAGE_KEY, b64);
  }
}

export async function queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getDB();
  const stmt = db.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const list = await queryAll<T>(sql, params);
  return list.length > 0 ? list[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<void> {
  const db = await getDB();
  db.run(sql, params);
  await persistDB();
}

export async function executeMany(sqls: { sql: string; params?: any[] }[]): Promise<void> {
  const db = await getDB();
  db.run('BEGIN TRANSACTION;');
  try {
    for (const item of sqls) {
      db.run(item.sql, item.params || []);
    }
    db.run('COMMIT;');
    await persistDB();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}
