import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  FileText,
  X,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { VendaHistorica, Representante } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToExcel, parseExcelOrCSV } from '../utils/excelImport';

export const VendasHistoricasModule: React.FC = () => {
  const [vendas, setVendas] = useState<VendaHistorica[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [repFilter, setRepFilter] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  const [selectedRepId, setSelectedRepId] = useState('');
  const [formData, setFormData] = useState<Partial<VendaHistorica>>({
    representante_id: '',
    cliente_nome: '',
    cliente_cnpj: '',
    produto_nome: '',
    produto_sku: '',
    data_venda: new Date().toISOString().slice(0, 10),
    quantidade: 1,
    unidade: 'Caixa c/ 12 un',
    valor_total: 0,
    numero_documento: '',
    nivel_conferencia: 'Informada pelo Representante',
    estoque_descontado: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(reps);

      const vList = await queryAll<VendaHistorica>(`
        SELECT v.*
        FROM venda_historica v
        ORDER BY v.data_venda DESC
      `);
      setVendas(vList);
    } catch (err) {
      console.error('Erro ao carregar vendas históricas:', err);
    }
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.representante_id || !formData.cliente_nome || !formData.produto_nome) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    try {
      const now = new Date().toISOString();
      await execute(
        `INSERT INTO venda_historica (
          id, representante_id, cliente_nome, cliente_cnpj, produto_nome, produto_sku,
          data_venda, quantidade, unidade, valor_total, numero_documento, origem_arquivo,
          nivel_conferencia, estoque_descontado, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Digitação Manual', ?, 0, ?)`,
        [
          `venda_${Date.now()}`,
          formData.representante_id,
          formData.cliente_nome,
          formData.cliente_cnpj,
          formData.produto_nome,
          formData.produto_sku,
          formData.data_venda,
          formData.quantidade || 1,
          formData.unidade || 'Unidade',
          formData.valor_total || 0,
          formData.numero_documento,
          formData.nivel_conferencia || 'Informada pelo Representante',
          now,
        ]
      );

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar venda histórica: ${err.message}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseExcelOrCSV(file);
      if (rows.length === 0) {
        alert('Nenhum dado encontrado na planilha.');
        return;
      }
      setPreviewData(rows);
    } catch (err: any) {
      alert(`Erro ao ler arquivo: ${err.message}`);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedRepId) {
      alert('Selecione o representante responsável por esta carga histórica.');
      return;
    }

    if (previewData.length === 0) {
      alert('Nenhum registro para importar.');
      return;
    }

    try {
      let importedCount = 0;
      let skippedCount = 0;
      const now = new Date().toISOString();

      for (const r of previewData) {
        const cliente = r.Cliente || r.cliente || r['Cliente Supermercado'] || 'Cliente Não Identificado';
        const produto = r.Produto || r.produto || r['Nome Produto'] || 'Produto Não Identificado';
        const dataV = r.Data || r.data || r['Data Venda'] || now.slice(0, 10);
        const qty = parseFloat(r.Quantidade || r.quantidade || r.Qtd) || 1;
        const val = parseFloat(r.Valor || r.valor || r['Valor Total']) || 0;
        const doc = r.Documento || r.documento || r['Nº NF / Pedido'] || '';

        // Check duplicates
        const dup = await queryOne(
          'SELECT id FROM venda_historica WHERE representante_id = ? AND cliente_nome = ? AND produto_nome = ? AND data_venda = ? AND valor_total = ?',
          [selectedRepId, cliente, produto, dataV, val]
        );

        if (dup) {
          skippedCount++;
          continue;
        }

        await execute(
          `INSERT INTO venda_historica (
            id, representante_id, cliente_nome, produto_nome, data_venda, quantidade,
            unidade, valor_total, numero_documento, origem_arquivo, nivel_conferencia,
            estoque_descontado, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'Unidade', ?, ?, 'Importação Planilha', 'Informada pelo Representante', 0, ?)`,
          [`venda_imp_${Date.now()}_${Math.floor(Math.random() * 1000)}`, selectedRepId, cliente, produto, dataV, qty, val, doc, now]
        );
        importedCount++;
      }

      alert(`Importação Histórica Concluída!\n- Registros Importados: ${importedCount}\n- Duplicidades Ignoradas: ${skippedCount}`);
      setShowImportModal(false);
      setPreviewData([]);
      await loadData();
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredVendas.map((v) => ({
      Representante: representantes.find((r) => r.id === v.representante_id)?.nome_razao || '-',
      Cliente: v.cliente_nome,
      Produto: v.produto_nome,
      'Data Venda': v.data_venda,
      Quantidade: v.quantidade,
      'Valor Total (R$)': v.valor_total,
      Documento: v.numero_documento || '-',
      'Nível Conferência': v.nivel_conferencia,
    }));
    exportToExcel(exportData, 'vendas_historicas_pracasa');
  };

  const filteredVendas = vendas.filter((v) => {
    const repName = representantes.find((r) => r.id === v.representante_id)?.nome_razao || '';
    const matchesSearch =
      v.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.produto_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRep = repFilter === 'todos' || v.representante_id === repFilter;
    return matchesSearch && matchesRep;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            Vendas Históricas & Importação de Planilhas
          </h2>
          <p className="text-xs text-slate-400">
            Cadastre ou importe vendas anteriores já realizadas pelos representantes para manter histórico e relatórios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowImportModal(true)} className="btn-secondary text-xs">
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Importar Planilha (CSV/XLSX)</span>
          </button>
          <button onClick={handleExportExcel} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exportar Excel</span>
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Lançar Venda Manual</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, produto ou representante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={repFilter} onChange={(e) => setRepFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Representantes</option>
            {representantes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nome_razao}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Representante</th>
                <th className="p-3">Cliente Supermercado</th>
                <th className="p-3">Produto</th>
                <th className="p-3">Qtd / Unid.</th>
                <th className="p-3">Valor Total</th>
                <th className="p-3">Nível de Conferência</th>
                <th className="p-3">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredVendas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Nenhuma venda histórica cadastrada.
                  </td>
                </tr>
              ) : (
                filteredVendas.map((v) => {
                  const rep = representantes.find((r) => r.id === v.representante_id);
                  return (
                    <tr key={v.id} className="hover:bg-slate-800/40 transition-all">
                      <td className="p-3 text-slate-400 font-mono">{formatDate(v.data_venda)}</td>
                      <td className="p-3 font-semibold text-slate-200">{rep?.nome_razao || '-'}</td>
                      <td className="p-3 font-medium text-slate-100">{v.cliente_nome}</td>
                      <td className="p-3">{v.produto_nome}</td>
                      <td className="p-3">
                        {v.quantidade} <span className="text-[11px] text-slate-400">{v.unidade}</span>
                      </td>
                      <td className="p-3 font-bold text-emerald-400">{formatCurrency(v.valor_total)}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60">
                          {v.nivel_conferencia}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-[11px]">{v.origem_arquivo || 'Sistema'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Lançar Venda Histórica Manual</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManual} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Representante Comercial *</label>
                <select
                  required
                  value={formData.representante_id}
                  onChange={(e) => setFormData({ ...formData, representante_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Selecione...</option>
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_razao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome do Cliente Supermercado *</label>
                <input
                  type="text"
                  required
                  value={formData.cliente_nome || ''}
                  onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome do Produto *</label>
                <input
                  type="text"
                  required
                  value={formData.produto_nome || ''}
                  onChange={(e) => setFormData({ ...formData, produto_nome: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data da Venda *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_venda || ''}
                    onChange={(e) => setFormData({ ...formData, data_venda: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Quantidade *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.quantidade || 1}
                    onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) || 0 })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Valor Total (R$) *</label>
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
                  <label className="block font-semibold text-slate-300 mb-1">Nº NF / Documento</label>
                  <input
                    type="text"
                    value={formData.numero_documento || ''}
                    onChange={(e) => setFormData({ ...formData, numero_documento: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nível de Conferência</label>
                <select
                  value={formData.nivel_conferencia}
                  onChange={(e) => setFormData({ ...formData, nivel_conferencia: e.target.value as any })}
                  className="input-field"
                >
                  <option value="Informada pelo Representante">Informada pelo Representante</option>
                  <option value="Confirmada pela Fábrica">Confirmada pela Fábrica</option>
                  <option value="Comprovada por Documento">Comprovada por Documento / NF</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Gravar Venda Histórica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-500" />
                Importar Planilha de Vendas Históricas
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Selecione o Representante *</label>
                <select
                  required
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Selecione quem realizou estas vendas...</option>
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_razao}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Arquivo Planilha (.csv / .xlsx)</label>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileUpload}
                  className="block w-full text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
                />
              </div>

              {previewData.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <h4 className="font-bold text-slate-200">Pré-visualização ({previewData.length} registros):</h4>
                  <div className="max-h-48 overflow-y-auto bg-slate-900 p-2 rounded border border-slate-800">
                    <table className="w-full text-[11px] text-slate-300">
                      <thead>
                        <tr className="text-amber-400 border-b border-slate-800 text-left">
                          <th className="p-1">Cliente</th>
                          <th className="p-1">Produto</th>
                          <th className="p-1">Data</th>
                          <th className="p-1">Qtd</th>
                          <th className="p-1">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 10).map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-800/40">
                            <td className="p-1">{row.Cliente || row.cliente || '-'}</td>
                            <td className="p-1">{row.Produto || row.produto || '-'}</td>
                            <td className="p-1">{row.Data || row.data || '-'}</td>
                            <td className="p-1">{row.Quantidade || row.quantidade || 1}</td>
                            <td className="p-1 font-bold">{row.Valor || row.valor || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={!selectedRepId || previewData.length === 0}
                  className="btn-primary"
                >
                  Confirmar Importação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
