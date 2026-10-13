import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  Plus,
  Search,
  Paperclip,
  Eye,
  FileText,
  X,
  AlertCircle,
  CheckCircle,
  Upload,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { NotaFiscal, Pedido, Cliente, Representante, Anexo } from '../types';
import { formatCurrency, formatDate, maskCNPJ } from '../utils/formatters';

export const NotasFiscaisModule: React.FC = () => {
  const [nfs, setNfs] = useState<NotaFiscal[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<NotaFiscal>>({
    chave_acesso: '',
    numero: '',
    serie: '1',
    data_emissao: new Date().toISOString().slice(0, 10),
    valor_total: 0,
    emitente_cnpj: '04.093.110/0001-04',
    emitente_nome: 'TEMPERO PRACASA FÁBRICA DE MOLHOS E ESPECIARIAS LTDA',
    destinatario_cnpj: '',
    destinatario_nome: '',
    pedido_id: '',
    cliente_id: '',
    representante_id: '',
    status_conferencia: 'Pendente',
    observacoes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const pList = await queryAll<Pedido>('SELECT * FROM pedido ORDER BY numero DESC');
      setPedidos(pList);

      const cList = await queryAll<Cliente>('SELECT * FROM cliente ORDER BY nome_fantasia ASC');
      setClientes(cList);

      const rList = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(rList);

      const nfList = await queryAll<NotaFiscal>('SELECT * FROM nota_fiscal ORDER BY created_at DESC');
      setNfs(nfList);
    } catch (err) {
      console.error('Erro ao carregar NFs:', err);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      chave_acesso: '',
      numero: `${Math.floor(1000 + Math.random() * 9000)}`,
      serie: '1',
      data_emissao: new Date().toISOString().slice(0, 10),
      valor_total: 0,
      emitente_cnpj: '04.093.110/0001-04',
      emitente_nome: 'TEMPERO PRACASA FÁBRICA DE MOLHOS E ESPECIARIAS LTDA',
      destinatario_cnpj: '',
      destinatario_nome: '',
      pedido_id: '',
      cliente_id: '',
      representante_id: '',
      status_conferencia: 'Pendente',
      observacoes: '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    // Check duplicate key
    if (formData.chave_acesso) {
      const dup = await queryOne('SELECT id FROM nota_fiscal WHERE chave_acesso = ?', [formData.chave_acesso]);
      if (dup) {
        alert('Atenção: Esta Chave de Acesso de NF-e já foi cadastrada anteriormente!');
        return;
      }
    }

    try {
      const newId = `nf_${Date.now()}`;
      await execute(
        `INSERT INTO nota_fiscal (
          id, chave_acesso, numero, serie, data_emissao, valor_total, emitente_cnpj, emitente_nome,
          destinatario_cnpj, destinatario_nome, pedido_id, cliente_id, representante_id, status_conferencia,
          observacoes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId,
          formData.chave_acesso || null,
          formData.numero,
          formData.serie || '1',
          formData.data_emissao,
          formData.valor_total || 0,
          formData.emitente_cnpj,
          formData.emitente_nome,
          formData.destinatario_cnpj,
          formData.destinatario_nome,
          formData.pedido_id || null,
          formData.cliente_id || null,
          formData.representante_id || null,
          formData.status_conferencia || 'Pendente',
          formData.observacoes,
          now,
        ]
      );

      // Link order to NF if provided
      if (formData.pedido_id) {
        await execute('UPDATE pedido SET status = "Faturado" WHERE id = ?', [formData.pedido_id]);
      }

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar NF: ${err.message}`);
    }
  };

  const handleAttachFile = async (nfId: string) => {
    if (window.electronAPI && window.electronAPI.selectFile) {
      const fileData = await window.electronAPI.selectFile([
        { name: 'Documentos Fiscais (PDF, XML, Imagens)', extensions: ['pdf', 'xml', 'png', 'jpg', 'jpeg'] },
      ]);

      if (fileData) {
        const savedRelativePath = await window.electronAPI.saveAttachment({
          fileName: fileData.fileName,
          buffer: fileData.buffer,
        });

        const now = new Date().toISOString();
        await execute(
          `INSERT INTO anexo (id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, categoria, entidade_tipo, entidade_id, usuario_id, created_at)
           VALUES (?, ?, ?, ?, 'application/octet-stream', ?, 'nota_fiscal', 'nota_fiscal', ?, 'usr_admin', ?)`,
          [
            `anx_${Date.now()}`,
            fileData.fileName,
            savedRelativePath,
            savedRelativePath,
            fileData.buffer.length,
            nfId,
            now,
          ]
        );

        alert(`Arquivo "${fileData.fileName}" anexado à Nota Fiscal com sucesso!`);
        await loadData();
      }
    } else {
      alert('Recurso de anexar arquivo por diálogo requer execução no aplicativo desktop Electron.');
    }
  };

  const handleUpdateStatus = async (nf: NotaFiscal, newStatus: 'Conferida' | 'Divergente' | 'Pendente') => {
    await execute('UPDATE nota_fiscal SET status_conferencia = ? WHERE id = ?', [newStatus, nf.id]);
    await loadData();
  };

  const filteredNfs = nfs.filter((n) => {
    const matchesSearch =
      n.numero.includes(searchTerm) ||
      (n.chave_acesso && n.chave_acesso.includes(searchTerm)) ||
      n.destinatario_nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || n.status_conferencia === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-amber-500" />
            Notas Fiscais (DANFE & XML)
          </h2>
          <p className="text-xs text-slate-400">
            Organize e relacione documentos fiscais aos pedidos, clientes e representantes.
          </p>
        </div>

        <button onClick={handleOpenModal} className="btn-primary text-xs">
          <Plus className="w-4 h-4" />
          <span>Cadastrar / Anexar NF</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por número da NF, chave de acesso ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status de Conferência</option>
            <option value="Pendente">Pendente de Conferência</option>
            <option value="Conferida">Conferida / Aprovada</option>
            <option value="Divergente">Divergente</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Número / Série</th>
                <th className="p-3">Data Emissão</th>
                <th className="p-3">Destinatário (Cliente)</th>
                <th className="p-3">Valor Total</th>
                <th className="p-3">Chave de Acesso</th>
                <th className="p-3">Conferência</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredNfs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Nenhuma nota fiscal cadastrada.
                  </td>
                </tr>
              ) : (
                filteredNfs.map((nf) => (
                  <tr key={nf.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 font-mono font-bold text-amber-400">
                      NF {nf.numero} (Série {nf.serie})
                    </td>
                    <td className="p-3 text-slate-400 font-mono">{formatDate(nf.data_emissao)}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-200">{nf.destinatario_nome}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{nf.destinatario_cnpj}</div>
                    </td>
                    <td className="p-3 font-bold text-emerald-400">{formatCurrency(nf.valor_total)}</td>
                    <td className="p-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                      {nf.chave_acesso || 'Sem chave'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          nf.status_conferencia === 'Conferida'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : nf.status_conferencia === 'Divergente'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {nf.status_conferencia}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleAttachFile(nf.id)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all"
                        title="Anexar DANFE (PDF) ou XML"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>

                      {nf.status_conferencia !== 'Conferida' && (
                        <button
                          onClick={() => handleUpdateStatus(nf, 'Conferida')}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-all"
                          title="Marcar como Conferida"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Cadastrar Nota Fiscal</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Número da NF *</label>
                  <input
                    type="text"
                    required
                    value={formData.numero || ''}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Série</label>
                  <input
                    type="text"
                    value={formData.serie || '1'}
                    onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Chave de Acesso (44 dígitos)</label>
                <input
                  type="text"
                  maxLength={44}
                  placeholder="35260104093110000104550010000012341000012345"
                  value={formData.chave_acesso || ''}
                  onChange={(e) => setFormData({ ...formData, chave_acesso: e.target.value })}
                  className="input-field font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Vincular ao Pedido de Venda</label>
                <select
                  value={formData.pedido_id || ''}
                  onChange={(e) => {
                    const ped = pedidos.find((p) => p.id === e.target.value);
                    setFormData({
                      ...formData,
                      pedido_id: e.target.value,
                      valor_total: ped ? ped.valor_total : formData.valor_total,
                      cliente_id: ped ? ped.cliente_id : formData.cliente_id,
                      representante_id: ped ? ped.representante_id : formData.representante_id,
                    });
                  }}
                  className="input-field"
                >
                  <option value="">Nenhum vínculo inicial</option>
                  {pedidos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numero} - {p.cliente_nome} ({formatCurrency(p.valor_total)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nome Destinatário / Cliente *</label>
                  <input
                    type="text"
                    required
                    value={formData.destinatario_nome || ''}
                    onChange={(e) => setFormData({ ...formData, destinatario_nome: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">CNPJ / CPF Destinatário *</label>
                  <input
                    type="text"
                    required
                    value={formData.destinatario_cnpj || ''}
                    onChange={(e) => setFormData({ ...formData, destinatario_cnpj: maskCNPJ(e.target.value) })}
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Valor Total NF (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.valor_total || 0}
                    onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 })}
                    className="input-field font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data de Emissão *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_emissao || ''}
                    onChange={(e) => setFormData({ ...formData, data_emissao: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Gravar Nota Fiscal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
