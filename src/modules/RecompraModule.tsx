import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  MessageSquare,
  ShoppingCart,
  Calendar,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { queryAll, execute } from '../db/database';
import { AlertaRecompra, Cliente, Produto } from '../types';
import { formatDate } from '../utils/formatters';

export const RecompraModule: React.FC = () => {
  const [alertas, setAlertas] = useState<AlertaRecompra[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    cliente_id: '',
    produto_id: '',
    intervalo_dias_estimado: 15,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cList = await queryAll<Cliente>('SELECT * FROM cliente ORDER BY nome_fantasia ASC');
      setClientes(cList);

      const pList = await queryAll<Produto>('SELECT * FROM produto WHERE status = "ativo" ORDER BY nome ASC');
      setProdutos(pList);

      // Automatic repurchase alert calculation from past orders
      const recentOrders = await queryAll(`
        SELECT p.cliente_id, c.nome_fantasia as cliente_nome, i.produto_id, pr.nome as produto_nome, MAX(p.data_hora) as ultima_compra
        FROM pedido p
        JOIN item_pedido i ON p.id = i.pedido_id
        JOIN cliente c ON p.cliente_id = c.id
        JOIN produto pr ON i.produto_id = pr.id
        GROUP BY p.cliente_id, i.produto_id
      `);

      const now = new Date();
      for (const ord of recentOrders) {
        const lastDate = new Date(ord.ultima_compra);
        const prevDate = new Date(lastDate.getTime() + 15 * 86400000);

        const existing = await queryAll('SELECT id FROM alerta_recompra WHERE cliente_id = ? AND produto_id = ? AND status = "pendente"', [
          ord.cliente_id,
          ord.produto_id,
        ]);

        if (existing.length === 0 && now >= prevDate) {
          await execute(
            `INSERT INTO alerta_recompra (id, cliente_id, produto_id, data_ultima_compra, intervalo_dias_estimado, data_prevista_recompra, tipo_estimativa, status, created_at)
             VALUES (?, ?, ?, ?, 15, ?, 'Regra Manual (15 dias)', 'pendente', ?)`,
            [
              `alr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
              ord.cliente_id,
              ord.produto_id,
              ord.ultima_compra.slice(0, 10),
              prevDate.toISOString().slice(0, 10),
              now.toISOString(),
            ]
          );
        }
      }

      const aList = await queryAll<AlertaRecompra>(`
        SELECT a.*, c.nome_fantasia as cliente_nome, p.nome as produto_nome
        FROM alerta_recompra a
        LEFT JOIN cliente c ON a.cliente_id = c.id
        LEFT JOIN produto p ON a.produto_id = p.id
        ORDER BY a.data_prevista_recompra ASC
      `);

      setAlertas(aList);
    } catch (err) {
      console.error('Erro ao carregar alertas de recompra:', err);
    }
  };

  const handleCreateManualAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.produto_id) return;

    try {
      const now = new Date();
      const prevDate = new Date(now.getTime() + formData.intervalo_dias_estimado * 86400000);
      const nowStr = now.toISOString();

      await execute(
        `INSERT INTO alerta_recompra (id, cliente_id, produto_id, data_ultima_compra, intervalo_dias_estimado, data_prevista_recompra, tipo_estimativa, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'Regra Manual', 'pendente', ?)`,
        [
          `alr_${Date.now()}`,
          formData.cliente_id,
          formData.produto_id,
          nowStr.slice(0, 10),
          formData.intervalo_dias_estimado,
          prevDate.toISOString().slice(0, 10),
          nowStr,
        ]
      );

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao criar alerta: ${err.message}`);
    }
  };

  const handleUpdateStatus = async (alertId: string, status: string) => {
    let motivo = '';
    if (status === 'dispensado') {
      motivo = prompt('Informe a justificativa para dispensar este alerta (Ex: Cliente já possui estoque suficiente):') || '';
      if (!motivo) return;
    }

    await execute('UPDATE alerta_recompra SET status = ?, motivo_dispensa = ? WHERE id = ?', [status, motivo, alertId]);
    await loadData();
  };

  const handleOpenWhatsApp = (alr: AlertaRecompra) => {
    const cli = clientes.find((c) => c.id === alr.cliente_id);
    const phone = cli ? cli.whatsapp.replace(/[^0-9]/g, '') : '';
    const msg = encodeURIComponent(
      `Olá, ${cli?.contato_compras || 'gerente'}! Tudo bem?\n\n` +
        `Constatamos que pode estar no momento de repor o produto *${alr.produto_nome}* no *${alr.cliente_nome}* (última compra em ${formatDate(alr.data_ultima_compra)}).\n\n` +
        `Gostaria de verificar a necessidade e quantidade para emitirmos o novo pedido?`
    );

    const url = phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  };

  const filteredAlertas = alertas.filter((a) => {
    const matchesSearch =
      (a.cliente_nome && a.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.produto_nome && a.produto_nome.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'todos' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Alertas Inteligentes de Recompra
          </h2>
          <p className="text-xs text-slate-400">
            Estimativa de reposição de estoque para supermercados baseada em histórico de compras (Padrão 15 dias).
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary text-xs">
          <Plus className="w-4 h-4" />
          <span>Configurar Novo Alerta</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="glass-panel p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs text-blue-300 space-y-1">
        <div className="font-bold flex items-center gap-2 text-blue-400">
          <AlertCircle className="w-4 h-4" /> Diretriz de Atendimento:
        </div>
        <p>
          Os alertas indicam estimativa de ruptura iminente. Entre em contato com o cliente para confirmar a contagem real de estoque antes de emitir o pedido.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por supermercado ou produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendente / Alerta Ativo</option>
            <option value="contatado">Contatado</option>
            <option value="pedido_criado">Pedido Criado</option>
            <option value="dispensado">Dispensado</option>
          </select>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAlertas.length === 0 ? (
          <div className="col-span-full glass-panel p-8 text-center text-slate-500 text-xs">
            Nenhum alerta de recompra no filtro atual.
          </div>
        ) : (
          filteredAlertas.map((alr) => (
            <div key={alr.id} className="glass-panel p-4 rounded-xl space-y-3 hover:border-blue-500/40 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30">
                    {alr.tipo_estimativa}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      alr.status === 'pendente'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : alr.status === 'pedido_criado'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {alr.status}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{alr.cliente_nome || 'Supermercado'}</h3>
                  <p className="text-xs text-amber-400 font-medium">Produto: {alr.produto_nome}</p>
                </div>

                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Última Compra:</span>
                    <span className="font-mono text-slate-200">{formatDate(alr.data_ultima_compra)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Data Prevista Reposição:</span>
                    <span className="font-mono font-bold text-rose-400">{formatDate(alr.data_prevista_recompra)}</span>
                  </div>
                  {alr.motivo_dispensa && (
                    <div className="text-[11px] text-slate-400 italic border-t border-slate-800 pt-1">
                      Justificativa: {alr.motivo_dispensa}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleOpenWhatsApp(alr)}
                  className="btn-secondary text-[11px] !py-1 !px-2 flex-1"
                  title="Contatar via WhatsApp"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WhatsApp</span>
                </button>

                {alr.status === 'pendente' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus(alr.id, 'pedido_criado')}
                      className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400"
                      title="Marcar Pedido Criado"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(alr.id, 'dispensado')}
                      className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                      title="Dispensar Alerta"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Alert Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Configurar Alerta de Recompra</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualAlert} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Supermercado Cliente *</label>
                <select
                  required
                  value={formData.cliente_id}
                  onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Selecione o cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_fantasia} ({c.cidade})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Produto *</label>
                <select
                  required
                  value={formData.produto_id}
                  onChange={(e) => setFormData({ ...formData, produto_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Selecione o produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Intervalo de Recompra (Dias) *</label>
                <input
                  type="number"
                  required
                  value={formData.intervalo_dias_estimado}
                  onChange={(e) => setFormData({ ...formData, intervalo_dias_estimado: parseInt(e.target.value) || 15 })}
                  className="input-field font-bold text-amber-400"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Criar Alerta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
