import React, { useState, useEffect } from 'react';
import {
  Paperclip,
  Upload,
  Search,
  Eye,
  Trash2,
  FileText,
  X,
  FileCheck,
  CheckCircle,
  Download,
  Shield,
  Users,
} from 'lucide-react';
import { queryAll, execute } from '../db/database';
import { Anexo } from '../types';
import { formatDate } from '../utils/formatters';

interface AnexosModuleProps {
  onNavigate?: (module: string) => void;
}

export const AnexosModule: React.FC<AnexosModuleProps> = ({ onNavigate }) => {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [catFilter, setCatFilter] = useState('todos');

  useEffect(() => {
    loadAnexos();
  }, []);

  const loadAnexos = async () => {
    try {
      // Documentos de representantes devem ficar somente no painel do representante
      const list = await queryAll<Anexo>(
        "SELECT * FROM anexo WHERE entidade_tipo != 'representante' ORDER BY created_at DESC"
      );
      setAnexos(list);
    } catch (err) {
      console.error('Erro ao carregar anexos:', err);
    }
  };

  const handleOpenAttachment = async (anx: Anexo) => {
    if (window.electronAPI && window.electronAPI.openAttachment) {
      const ok = await window.electronAPI.openAttachment(anx.caminho_relativo);
      if (!ok) {
        alert(`Não foi possível abrir o arquivo: ${anx.nome_original}`);
      }
    } else {
      alert(`Visualização de anexos do sistema requer o aplicativo desktop Electron.`);
    }
  };

  const handleUploadNew = async () => {
    if (window.electronAPI && window.electronAPI.selectFile) {
      const fileData = await window.electronAPI.selectFile([
        { name: 'Todos os Documentos Suportados', extensions: ['pdf', 'docx', 'xlsx', 'csv', 'xml', 'jpg', 'png', 'webp'] },
      ]);

      if (fileData) {
        const savedRelativePath = await window.electronAPI.saveAttachment({
          fileName: fileData.fileName,
          buffer: fileData.buffer,
        });

        const now = new Date().toISOString();
        await execute(
          `INSERT INTO anexo (id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, categoria, entidade_tipo, entidade_id, usuario_id, created_at)
           VALUES (?, ?, ?, ?, 'application/octet-stream', ?, 'outro', 'geral', 'geral_1', 'usr_admin', ?)`,
          [
            `anx_${Date.now()}`,
            fileData.fileName,
            savedRelativePath,
            savedRelativePath,
            fileData.buffer.length,
            now,
          ]
        );

        alert(`Arquivo "${fileData.fileName}" anexado ao repositório digital com sucesso!`);
        await loadAnexos();
      }
    } else {
      alert('Diálogo de anexos disponível no aplicativo desktop.');
    }
  };

  const filteredAnexos = anexos.filter((a) => {
    const matchesSearch =
      a.nome_original.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.entidade_tipo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = catFilter === 'todos' || a.categoria === catFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-amber-500" />
            Arquivo Digital & Gestão de Documentos Gerais
          </h2>
          <p className="text-xs text-slate-400">
            Repositório central de notas fiscais, XMLs, contratos da empresa e planilhas gerais.
          </p>
        </div>

        <button onClick={handleUploadNew} className="btn-primary text-xs">
          <Upload className="w-4 h-4" />
          <span>Anexar Novo Arquivo Geral</span>
        </button>
      </div>

      {/* Security & Representative Privacy Banner */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>Privacidade & Gestão Restrita de Documentos de Representantes</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Acesso Restrito ao Painel
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Por segurança e conformidade, documentos pessoais de identificação (RG, CNH, Certidões CORE, Comprovantes de Residência e Contratos) não ficam avulsos nesta seção. O acesso é exclusivo dentro da ficha individual de cada representante.
            </p>
          </div>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('representantes')}
            className="btn-secondary text-xs shrink-0 flex items-center gap-1.5 hover:border-amber-500/50"
          >
            <Users className="w-3.5 h-3.5 text-amber-400" />
            <span>Acessar Painel de Representantes</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar anexo por nome ou tipo de entidade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="input-field">
            <option value="todos">Todas as Categorias</option>
            <option value="contrato">Contrato</option>
            <option value="nota_fiscal">Nota Fiscal</option>
            <option value="xml">XML</option>
            <option value="comprovante">Comprovante</option>
            <option value="imagem">Imagem</option>
            <option value="planilha">Planilha</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Nome do Arquivo</th>
                <th className="p-3">Data de Inclusão</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Tamanho</th>
                <th className="p-3">Vínculo Entidade</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAnexos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    Nenhum anexo armazenado.
                  </td>
                </tr>
              ) : (
                filteredAnexos.map((anx) => (
                  <tr key={anx.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 font-semibold text-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="truncate max-w-xs">{anx.nome_original}</span>
                    </td>
                    <td className="p-3 text-slate-400 font-mono">{formatDate(anx.created_at)}</td>
                    <td className="p-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] uppercase font-bold text-slate-300">
                        {anx.categoria}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-400">
                      {(anx.tamanho_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="p-3 text-slate-300">
                      {anx.entidade_tipo} ({anx.entidade_id})
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenAttachment(anx)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all"
                        title="Abrir Anexo no Sistema Operacional"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
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
