import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  Download,
  Calendar,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { queryAll } from '../db/database';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToExcel } from '../utils/excelImport';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_PRACASA_PNG } from '../utils/logoPraCasa';

export const RelatoriosModule: React.FC = () => {
  const [reportType, setReportType] = useState('vendas_rep');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));

  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    generateReport();
  }, [reportType, startDate, endDate]);

  const generateReport = async () => {
    setLoading(true);
    try {
      let data: any[] = [];

      if (reportType === 'vendas_rep') {
        data = await queryAll(`
          SELECT r.nome_razao as representante, COUNT(p.id) as total_pedidos, SUM(p.valor_total) as valor_total, SUM(p.comissao_calculada) as total_comissoes
          FROM representante r
          LEFT JOIN pedido p ON r.id = p.representante_id AND date(p.data_hora) BETWEEN ? AND ?
          GROUP BY r.id
          ORDER BY valor_total DESC
        `, [startDate, endDate]);
      } else if (reportType === 'vendas_cliente') {
        data = await queryAll(`
          SELECT c.nome_fantasia as cliente, c.cidade, COUNT(p.id) as total_pedidos, SUM(p.valor_total) as valor_total
          FROM cliente c
          LEFT JOIN pedido p ON c.id = p.cliente_id AND date(p.data_hora) BETWEEN ? AND ?
          GROUP BY c.id
          ORDER BY valor_total DESC
        `, [startDate, endDate]);
      } else if (reportType === 'vendas_produto') {
        data = await queryAll(`
          SELECT pr.sku, pr.nome as produto, pr.categoria, SUM(i.quantidade) as total_quantidade, SUM(i.subtotal) as valor_total
          FROM produto pr
          JOIN item_pedido i ON pr.id = i.produto_id
          JOIN pedido p ON i.pedido_id = p.id AND date(p.data_hora) BETWEEN ? AND ?
          GROUP BY pr.id
          ORDER BY total_quantidade DESC
        `, [startDate, endDate]);
      } else if (reportType === 'estoque_local') {
        data = await queryAll(`
          SELECT l.nome as local, p.sku, p.nome as produto, COALESCE(SUM(m.quantidade_base), 0) as saldo_atual, p.estoque_minimo
          FROM local_estoque l
          CROSS JOIN produto p
          LEFT JOIN movimento_estoque m ON p.id = m.produto_id AND (m.local_destino_id = l.id OR m.local_origem_id = l.id)
          GROUP BY l.id, p.id
          HAVING saldo_atual != 0
          ORDER BY l.nome ASC, p.nome ASC
        `);
      } else if (reportType === 'comissoes_rep') {
        data = await queryAll(`
          SELECT r.nome_razao as representante, c.status, COUNT(c.id) as total_lancamentos, SUM(c.valor_comissao) as valor_comissoes
          FROM comissao c
          JOIN representante r ON c.representante_id = r.id
          WHERE date(c.created_at) BETWEEN ? AND ?
          GROUP BY r.id, c.status
          ORDER BY r.nome_razao ASC
        `, [startDate, endDate]);
      } else if (reportType === 'pedidos_status') {
        data = await queryAll(`
          SELECT status, COUNT(id) as total_pedidos, SUM(valor_total) as valor_total
          FROM pedido
          WHERE date(data_hora) BETWEEN ? AND ?
          GROUP BY status
        `, [startDate, endDate]);
      } else if (reportType === 'recompra_previsao') {
        data = await queryAll(`
          SELECT c.nome_fantasia as cliente, p.nome as produto, a.data_ultima_compra, a.data_prevista_recompra, a.status
          FROM alerta_recompra a
          JOIN cliente c ON a.cliente_id = c.id
          JOIN produto p ON a.produto_id = p.id
          ORDER BY a.data_prevista_recompra ASC
        `);
      }

      setReportData(data);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    try {
      doc.addImage(LOGO_PRACASA_PNG, 'PNG', 14, 10, 36, 22.3);
    } catch {}

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(153, 27, 27);
    doc.text(`RELATÓRIO GERENCIAL — ${reportType.toUpperCase()}`, 54, 16);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Período: ${formatDate(startDate)} até ${formatDate(endDate)} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 54, 22);
    doc.text('Tempero PraCasa • Fábrica de Molhos e Especiarias', 54, 27);

    if (reportData.length > 0) {
      const headers = Object.keys(reportData[0]);
      const rows = reportData.map((row) => Object.values(row).map((v: any) => (typeof v === 'number' ? formatCurrency(v) : v || '-')));

      autoTable(doc, {
        startY: 35,
        head: [headers.map((h) => h.toUpperCase().replace(/_/g, ' '))],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8 },
      });
    }

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Tempero PraCasa • O verdadeiro sabor caseiro! • Barra do Pojuca, Camaçari/BA', 14, 290);
      doc.text(`Página ${p} de ${totalPages}`, 196, 290, { align: 'right' });
    }

    doc.save(`relatorio_${reportType}_${Date.now()}.pdf`);
  };

  const handleExportExcel = () => {
    exportToExcel(reportData, `relatorio_${reportType}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Central de Relatórios Executivos & Exportações
          </h2>
          <p className="text-xs text-slate-400">
            Gere relatórios dinâmicos de vendas, estoque, comissões, faturamento e auditoria em PDF/Excel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportExcel} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-xs">
            <FileText className="w-4 h-4 text-rose-400" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="md:col-span-2">
          <label className="block font-semibold text-slate-300 mb-1">Selecione o Tipo de Relatório *</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="input-field font-bold text-amber-400"
          >
            <option value="vendas_rep">1. Vendas por Representante e Período</option>
            <option value="vendas_cliente">2. Vendas por Cliente / Supermercado</option>
            <option value="vendas_produto">3. Vendas por Produto e Categoria</option>
            <option value="pedidos_status">4. Pedidos por Status de Aprovação</option>
            <option value="estoque_local">5. Posição de Estoque por Local</option>
            <option value="comissoes_rep">6. Comissões por Representante e Período</option>
            <option value="recompra_previsao">7. Previsão de Recompra Supermercados</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1">Data Inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-300 mb-1">Data Final</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      {/* Report Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <span>Resultados apurados do banco de dados ({reportData.length} registros)</span>
          <span>Período: {formatDate(startDate)} a {formatDate(endDate)}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                {reportData.length > 0 &&
                  Object.keys(reportData[0]).map((h) => (
                    <th key={h} className="p-3">
                      {h.replace(/_/g, ' ')}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    Nenhum registro apurado para os parâmetros selecionados.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-all">
                    {Object.values(row).map((val: any, vIdx) => (
                      <td key={vIdx} className="p-3 font-medium">
                        {typeof val === 'number' && val > 100 ? formatCurrency(val) : val || '-'}
                      </td>
                    ))}
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
