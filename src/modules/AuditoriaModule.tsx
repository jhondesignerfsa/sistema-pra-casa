import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Download,
  Upload,
  RefreshCw,
  Search,
  Database,
  History,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { queryAll, execute, persistDB } from '../db/database';
import { LogAuditoria } from '../types';
import { formatDate } from '../utils/formatters';
import JSZip from 'jszip';

export const AuditoriaModule: React.FC = () => {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('todos');

  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const list = await queryAll<LogAuditoria>('SELECT * FROM log_auditoria ORDER BY data_hora DESC LIMIT 100');
      setLogs(list);
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    }
  };

  const handleExportBackup = async () => {
    setBackingUp(true);
    try {
      await persistDB();

      // Collect database bytes from IPC or localStorage
      let dbBytes: number[] | null = null;
      if (window.electronAPI && window.electronAPI.readDatabaseFile) {
        dbBytes = await window.electronAPI.readDatabaseFile();
      }

      const zip = new JSZip();
      if (dbBytes) {
        zip.file('pracasa.sqlite', new Uint8Array(dbBytes));
      } else if (typeof localStorage !== 'undefined') {
        const b64 = localStorage.getItem('pracasa_db_binary');
        if (b64) {
          zip.file('pracasa_b64.txt', b64);
        }
      }

      zip.file('backup_metadata.json', JSON.stringify({
        app: 'PraCasa Gestão Comercial',
        empresa: 'Tempero PraCasa Fábrica de Molhos e Especiarias',
        export_date: new Date().toISOString(),
        version: '1.0.0',
      }));

      const zipBuffer = await zip.generateAsync({ type: 'uint8array' });
      const defaultName = `Backup_PraCasa_${new Date().toISOString().slice(0, 10)}.zip`;

      if (window.electronAPI && window.electronAPI.exportBackupZip) {
        const ok = await window.electronAPI.exportBackupZip({
          buffer: Array.from(zipBuffer),
          defaultName,
        });

        if (ok) {
          alert('Backup exportado com sucesso!');
          await execute(
            `INSERT INTO log_auditoria (id, data_hora, usuario_nome, acao, entidade, detalhes)
             VALUES (?, ?, 'usr_admin', 'Backup', 'Banco de Dados', 'Backup completo compactado em ZIP gerado com sucesso.')`,
            [`log_${Date.now()}`, new Date().toISOString()]
          );
          await loadLogs();
        }
      } else {
        // Web fallback browser download
        const blob = new Blob([zipBuffer.buffer as ArrayBuffer], { type: 'application/zip' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = defaultName;
        a.click();
        alert('Backup em ZIP baixado pelo navegador.');
      }
    } catch (err: any) {
      alert(`Erro ao gerar backup: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!confirm('ATENÇÃO CRÍTICA: A restauração de um backup irá substituir o banco de dados atual pelo arquivo de backup selecionado. Deseja prosseguir?')) {
      return;
    }

    if (window.electronAPI && window.electronAPI.importBackupZip) {
      setRestoring(true);
      try {
        const zipBytes = await window.electronAPI.importBackupZip();
        if (zipBytes) {
          const zip = await JSZip.loadAsync(new Uint8Array(zipBytes));
          const dbFile = zip.file('pracasa.sqlite') || zip.file('pracasa_b64.txt');
          if (dbFile) {
            if (dbFile.name === 'pracasa_b64.txt') {
              const b64 = await dbFile.async('string');
              localStorage.setItem('pracasa_db_binary', b64.trim());
              localStorage.setItem('pracasa_opera_sync_v2', 'true');
            } else {
              const dbArray = await dbFile.async('uint8array');
              await window.electronAPI.saveDatabaseFile(Array.from(dbArray));
            }
            alert('Banco de dados restaurado com sucesso!');
            window.location.reload();
          } else {
            alert('Arquivo ZIP de backup inválido: não contém pracasa.sqlite ou pracasa_b64.txt');
          }
        }
      } catch (err: any) {
        alert(`Erro ao restaurar backup: ${err.message}`);
      } finally {
        setRestoring(false);
      }
    } else {
      // Web browser file picker
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.txt,.sqlite,.db';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        setRestoring(true);
        try {
          const { restoreBackupFromFile } = await import('../utils/backupRestore');
          const res = await restoreBackupFromFile(file);
          alert(res.message);
          if (res.success) {
            window.location.reload();
          }
        } catch (err: any) {
          alert(`Erro ao restaurar: ${err.message}`);
        } finally {
          setRestoring(false);
        }
      };
      input.click();
    }
  };

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.detalhes.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.entidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.usuario_nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'todos' || l.acao === actionFilter;
    return matchesSearch && matchesAction;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-500" />
            Auditoria, Segurança & Backups
          </h2>
          <p className="text-xs text-slate-400">
            Trilha de auditoria das operações, política de backup diário e restauração de dados em ZIP.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleRestoreBackup} disabled={restoring} className="btn-secondary text-xs">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Restaurar Backup (ZIP)</span>
          </button>
          <button onClick={handleExportBackup} disabled={backingUp} className="btn-primary text-xs">
            <Download className="w-4 h-4" />
            <span>Exportar Backup Completo (ZIP)</span>
          </button>
        </div>
      </div>

      {/* Policy Box */}
      <div className="glass-panel p-4 rounded-xl border border-slate-700 bg-slate-900/60 text-xs space-y-2">
        <h3 className="font-bold text-slate-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" /> Política de Armazenamento & LGPD:
        </h3>
        <p className="text-slate-400">
          O banco de dados SQLite e os anexos são armazenados persistentemente no diretório de dados locais da aplicação (AppData/userData). As senhas e credenciais não são registradas nos logs técnicos.
        </p>
      </div>

      {/* Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por detalhes, entidade ou operador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>

        <div>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input-field text-xs">
            <option value="todos">Todas as Ações</option>
            <option value="Criação">Criação</option>
            <option value="Alteração">Alteração</option>
            <option value="Exclusão">Exclusão</option>
            <option value="Backup">Backup</option>
            <option value="Transferência Carteira">Transferência Carteira</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="p-3 bg-slate-950/80 border-b border-slate-800 text-xs font-bold text-slate-300 uppercase tracking-wider">
          Trilha de Auditoria do Sistema
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Operador</th>
                <th className="p-3">Ação Executada</th>
                <th className="p-3">Entidade</th>
                <th className="p-3">Detalhes da Operação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    Nenhum registro de auditoria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 font-mono text-slate-400">{formatDate(l.data_hora)}</td>
                    <td className="p-3 font-semibold text-slate-200">{l.usuario_nome}</td>
                    <td className="p-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-amber-400">
                        {l.acao}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 font-medium">{l.entidade}</td>
                    <td className="p-3 text-slate-400">{l.detalhes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
