import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Paperclip,
  X,
  AlertTriangle,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { Comissao, Representante, Pedido } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToExcel } from '../utils/excelImport';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_PRACASA_PNG } from '../utils/logoPraCasa';

export const ComissoesModule: React.FC = () => {
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [repFilter, setRepFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [selectedCom, setSelectedCom] = useState<Comissao | null>(null);
  const [paymentData, setPaymentData] = useState({
    data_pagamento: new Date().toISOString().slice(0, 10),
    forma_pagamento: 'Pix',
    observacao: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(reps);

      const cList = await queryAll<Comissao>(`
        SELECT c.*, r.nome_razao as representante_nome, p.numero as pedido_numero
        FROM comissao c
        LEFT JOIN representante r ON c.representante_id = r.id
        LEFT JOIN pedido p ON c.pedido_id = p.id
        ORDER BY c.created_at DESC
      `);
      setComissoes(cList);
    } catch (err) {
      console.error('Erro ao carregar comissões:', err);
    }
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCom) return;

    if (selectedCom.status === 'paga') {
      alert('Esta comissão já foi marcada como PAGA anteriormente!');
      return;
    }

    try {
      await execute(
        `UPDATE comissao SET status = 'paga', data_pagamento = ?, observacao = COALESCE(observacao, "") || ? WHERE id = ?`,
        [
          paymentData.data_pagamento,
          `\n[Pagamento via ${paymentData.forma_pagamento}]: ${paymentData.observacao}`,
          selectedCom.id,
        ]
      );

      alert(`Pagamento de comissão de ${formatCurrency(selectedCom.valor_comissao)} registrado com sucesso!`);
      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao registrar pagamento: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (com: Comissao, newStatus: string) => {
    await execute('UPDATE comissao SET status = ? WHERE id = ?', [newStatus, com.id]);
    await loadData();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    try {
      doc.addImage(LOGO_PRACASA_PNG, 'PNG', 14, 10, 36, 22.3);
    } catch {}

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(153, 27, 27);
    doc.text('DEMONSTRATIVO DE COMISSÕES DE REPRESENTAÇÃO', 54, 16);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} | Total de Lançamentos: ${filteredComissoes.length}`, 54, 22);
    doc.text('Tempero PraCasa • Fábrica de Molhos e Especiarias', 54, 27);

    const rows = filteredComissoes.map((c) => [
      c.representante_nome || '-',
      c.pedido_numero || '-',
      formatCurrency(c.valor_base_calculo),
      `${c.percentual_aplicado}%`,
      formatCurrency(c.valor_comissao),
      formatDate(c.data_prevista_pagamento),
      c.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Representante', 'Pedido', 'Base Cálculo', '%', 'Comissão', 'Data Prevista', 'Status']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Tempero PraCasa • O verdadeiro sabor caseiro! • Barra do Pojuca, Camaçari/BA', 14, 290);
      doc.text(`Página ${p} de ${totalPages}`, 196, 290, { align: 'right' });
    }

    doc.save(`demonstrativo_comissoes_${Date.now()}.pdf`);
  };

  const handleExportExcel = () => {
    const exportData = filteredComissoes.map((c) => ({
      Representante: c.representante_nome || '-',
      'Pedido Nº': c.pedido_numero || '-',
      'Base Cálculo (R$)': c.valor_base_calculo,
      'Percentual (%)': c.percentual_aplicado,
      'Valor Comissão (R$)': c.valor_comissao,
      'Data Prevista': c.data_prevista_pagamento,
      'Data Pagamento': c.data_pagamento || '-',
      Status: c.status,
    }));
    exportToExcel(exportData, 'demonstrativo_comissoes');
  };

  const filteredComissoes = comissoes.filter((c) => {
    const matchesSearch =
      (c.representante_nome && c.representante_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.pedido_numero && c.pedido_numero.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRep = repFilter === 'todos' || c.representante_id === repFilter;
    const matchesStatus = statusFilter === 'todos' || c.status === statusFilter;
    return matchesSearch && matchesRep && matchesStatus;
  });

  const totalEstimado = filteredComissoes
    .filter((c) => c.status === 'estimada')
    .reduce((a, b) => a + b.valor_comissao, 0);
  const totalLiberado = filteredComissoes
    .filter((c) => c.status === 'liberada' || c.status === 'adquirida')
    .reduce((a, b) => a + b.valor_comissao, 0);
  const totalPago = filteredComissoes
    .filter((c) => c.status === 'paga')
    .reduce((a, b) => a + b.valor_comissao, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Comissões & Demonstrativos Financeiros
          </h2>
          <p className="text-xs text-slate-400">
            Acompanhe a apuração de comissões por pedido (Lei 4.886/65), liberação e registro de pagamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportExcel} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-xs">
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Demonstrativo PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-amber-500">
          <span className="text-xs font-semibold text-slate-400">Comissões Estimadas (Aguardando Faturamento)</span>
          <div className="text-xl font-extrabold text-amber-400 mt-1">{formatCurrency(totalEstimado)}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-cyan-500">
          <span className="text-xs font-semibold text-slate-400">Comissões Liberadas para Pagamento</span>
          <div className="text-xl font-extrabold text-cyan-400 mt-1">{formatCurrency(totalLiberado)}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500">
          <span className="text-xs font-semibold text-slate-400">Comissões Efectivamente Pagas</span>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{formatCurrency(totalPago)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por representante ou pedido..."
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

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status</option>
            <option value="estimada">Estimada</option>
            <option value="liberada">Liberada</option>
            <option value="paga">Paga</option>
            <option value="estornada">Estornada</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Representante</th>
                <th className="p-3">Pedido Nº</th>
                <th className="p-3">Base Cálculo</th>
                <th className="p-3">% Aplicado</th>
                <th className="p-3">Valor Comissão</th>
                <th className="p-3">Data Prevista</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredComissoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Nenhuma comissão registrada.
                  </td>
                </tr>
              ) : (
                filteredComissoes.map((com) => (
                  <tr key={com.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 font-semibold text-slate-100">{com.representante_nome || '-'}</td>
                    <td className="p-3 font-mono text-amber-400">{com.pedido_numero || '-'}</td>
                    <td className="p-3">{formatCurrency(com.valor_base_calculo)}</td>
                    <td className="p-3 font-bold text-slate-300">{com.percentual_aplicado}%</td>
                    <td className="p-3 font-extrabold text-emerald-400">{formatCurrency(com.valor_comissao)}</td>
                    <td className="p-3 text-slate-400 font-mono">{formatDate(com.data_prevista_pagamento)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          com.status === 'paga'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : com.status === 'liberada'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : com.status === 'estornada'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {com.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {com.status !== 'paga' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(com, 'liberada')}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-all"
                            title="Liberar para Pagamento"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedCom(com);
                              setShowModal(true);
                            }}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-all"
                            title="Registrar Pagamento"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      {showModal && selectedCom && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Registrar Pagamento de Comissão</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="text-slate-400">Representante: <strong className="text-slate-200">{selectedCom.representante_nome}</strong></div>
              <div className="text-slate-400">Valor da Comissão: <strong className="text-emerald-400 text-sm">{formatCurrency(selectedCom.valor_comissao)}</strong></div>
            </div>

            <form onSubmit={handleRegisterPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Data do Pagamento *</label>
                <input
                  type="date"
                  required
                  value={paymentData.data_pagamento}
                  onChange={(e) => setPaymentData({ ...paymentData, data_pagamento: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Forma de Pagamento *</label>
                <select
                  value={paymentData.forma_pagamento}
                  onChange={(e) => setPaymentData({ ...paymentData, forma_pagamento: e.target.value })}
                  className="input-field"
                >
                  <option value="Pix">Pix / Chave Pix</option>
                  <option value="Transferência Bancária">Transferência TED/DOC</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Comprovante / Observações</label>
                <input
                  type="text"
                  placeholder="Ex: Tx ID Pix 123456789"
                  value={paymentData.observacao}
                  onChange={(e) => setPaymentData({ ...paymentData, observacao: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
