import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Clock,
  AlertTriangle,
  DollarSign,
  FileText,
  CheckCircle2,
  Calendar,
  Filter,
} from 'lucide-react';
import { queryAll } from '../db/database';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ModuleType } from '../components/Sidebar';

interface DashboardProps {
  onNavigate: (module: ModuleType, filter?: any) => void;
  lastUpdateStr: string;
}

export const DashboardModule: React.FC<DashboardProps> = ({ onNavigate, lastUpdateStr }) => {
  const [stats, setStats] = useState({
    pedidosHojeCount: 0,
    pedidosHojeVal: 0,
    pedidosMesVal: 0,
    pedidosAguardandoAprovacao: 0,
    pedidosFaturados: 0,
    estoqueBaixoCount: 0,
    recompraPendenteCount: 0,
    notasPendentesCount: 0,
    comissoesEstimadasVal: 0,
    comissoesLiberadasVal: 0,
    contratosPendentesCount: 0,
    tarefasHojeCount: 0,
  });

  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);

      // Orders today
      const pHoje = await queryAll(`SELECT * FROM pedido WHERE date(data_hora) = date('now')`);
      const pMes = await queryAll(`SELECT * FROM pedido WHERE date(data_hora) >= date('now', '-30 days')`);
      const pAguardando = await queryAll(`SELECT * FROM pedido WHERE status IN ('Aguardando aprovação', 'Enviado para análise')`);
      const pFaturados = await queryAll(`SELECT * FROM pedido WHERE status = 'Faturado'`);

      // Low stock products
      const prodsEstoqueBaixo = await queryAll(`
        SELECT p.*, COALESCE(SUM(m.quantidade_base), 0) as saldo
        FROM produto p
        LEFT JOIN movimento_estoque m ON p.id = m.produto_id
        GROUP BY p.id
        HAVING saldo <= p.estoque_minimo AND p.status = 'ativo'
      `);

      // Repurchase alerts
      const recompra = await queryAll(`SELECT * FROM alerta_recompra WHERE status = 'pendente'`);

      // Pending invoices
      const nfs = await queryAll(`SELECT * FROM nota_fiscal WHERE status_conferencia = 'Pendente'`);

      // Commissions
      const comEstimadas = await queryAll(`SELECT SUM(valor_comissao) as total FROM comissao WHERE status = 'estimada'`);
      const comLiberadas = await queryAll(`SELECT SUM(valor_comissao) as total FROM comissao WHERE status = 'liberada'`);

      // Contracts
      const contratos = await queryAll(`SELECT * FROM contrato WHERE status IN ('rascunho', 'revisao')`);

      // Tasks
      const tarefas = await queryAll(`SELECT * FROM tarefa WHERE date(data_vencimento) = date('now') AND status != 'concluida'`);

      const hojeVal = pHoje.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);
      const mesVal = pMes.reduce((acc, curr) => acc + (curr.valor_total || 0), 0);

      setStats({
        pedidosHojeCount: pHoje.length,
        pedidosHojeVal: hojeVal,
        pedidosMesVal: mesVal,
        pedidosAguardandoAprovacao: pAguardando.length,
        pedidosFaturados: pFaturados.length,
        estoqueBaixoCount: prodsEstoqueBaixo.length,
        recompraPendenteCount: recompra.length,
        notasPendentesCount: nfs.length,
        comissoesEstimadasVal: comEstimadas[0]?.total || 0,
        comissoesLiberadasVal: comLiberadas[0]?.total || 0,
        contratosPendentesCount: contratos.length,
        tarefasHojeCount: tarefas.length,
      });
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Visão Geral Operacional</h2>
          <p className="text-xs text-slate-400">
            Acompanhe em tempo real as vendas, estoque, comissões e alertas prioritários.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700/60 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <span>Período:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-slate-100 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="7" className="bg-slate-900 text-slate-100">Últimos 7 dias</option>
              <option value="30" className="bg-slate-900 text-slate-100">Últimos 30 dias</option>
              <option value="90" className="bg-slate-900 text-slate-100">Últimos 90 dias</option>
            </select>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-800/40 px-3 py-1.5 rounded-lg border border-slate-700/40">
            Atualizado em: <span className="text-amber-400 font-semibold">{lastUpdateStr}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pedidos Hoje */}
        <div
          onClick={() => onNavigate('pedidos', { status: 'hoje' })}
          className="glass-card p-4 rounded-xl cursor-pointer hover:border-amber-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pedidos do Dia</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-all">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {stats.pedidosHojeCount} <span className="text-xs text-slate-400 font-normal">pedidos</span>
          </div>
          <div className="text-xs text-amber-400 font-medium mt-1">
            {formatCurrency(stats.pedidosHojeVal)} total acumulado
          </div>
        </div>

        {/* Card 2: Vendas do Mês */}
        <div
          onClick={() => onNavigate('pedidos', { status: 'mes' })}
          className="glass-card p-4 rounded-xl cursor-pointer hover:border-orange-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Vendas (30 dias)</span>
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 group-hover:scale-110 transition-all">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {formatCurrency(stats.pedidosMesVal)}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">{stats.pedidosFaturados} faturados</span>
          </div>
        </div>

        {/* Card 3: Estoque Baixo */}
        <div
          onClick={() => onNavigate('estoque', { status: 'baixo' })}
          className="glass-card p-4 rounded-xl cursor-pointer hover:border-rose-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Estoque Crítico / Baixo</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-all">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {stats.estoqueBaixoCount} <span className="text-xs text-slate-400 font-normal">produtos</span>
          </div>
          <div className="text-xs text-rose-400 mt-1">Requer reposição na fábrica</div>
        </div>

        {/* Card 4: Recompras Previstas */}
        <div
          onClick={() => onNavigate('recompra', { status: 'pendente' })}
          className="glass-card p-4 rounded-xl cursor-pointer hover:border-blue-500/40 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Alertas de Recompra</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-all">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-100">
            {stats.recompraPendenteCount} <span className="text-xs text-slate-400 font-normal">clientes</span>
          </div>
          <div className="text-xs text-blue-400 mt-1">Estimativa de ruptura iminente</div>
        </div>
      </div>

      {/* Secondary Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Comissões */}
        <div
          onClick={() => onNavigate('comissoes')}
          className="glass-panel p-4 rounded-xl cursor-pointer hover:border-amber-500/30 transition-all"
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Comissões</h3>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">Financeiro</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Comissões Liberadas para Pgto:</span>
              <span className="text-emerald-400 font-bold">{formatCurrency(stats.comissoesLiberadasVal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Comissões Estimadas (Aguardando):</span>
              <span className="text-amber-400 font-semibold">{formatCurrency(stats.comissoesEstimadasVal)}</span>
            </div>
          </div>
        </div>

        {/* Contratos & NFs */}
        <div
          onClick={() => onNavigate('contratos')}
          className="glass-panel p-4 rounded-xl cursor-pointer hover:border-amber-500/30 transition-all"
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Contratos & NFs</h3>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">Documentos</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Contratos Pendentes / Revisão:</span>
              <span className="text-amber-400 font-bold">{stats.contratosPendentesCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Notas Fiscais Sem Conferência:</span>
              <span className="text-rose-400 font-semibold">{stats.notasPendentesCount}</span>
            </div>
          </div>
        </div>

        {/* Tarefas & Atendimento */}
        <div
          onClick={() => onNavigate('tarefas')}
          className="glass-panel p-4 rounded-xl cursor-pointer hover:border-amber-500/30 transition-all"
        >
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Tarefas do Dia</h3>
            </div>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">CRM</span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Tarefas & Contatos para Hoje:</span>
              <span className="text-cyan-400 font-bold">{stats.tarefasHojeCount} agendadas</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pedidos Aguardando Aprovação:</span>
              <span className="text-orange-400 font-semibold">{stats.pedidosAguardandoAprovacao}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
