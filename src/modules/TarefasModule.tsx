import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  Phone,
  MessageSquare,
  Calendar,
  User,
} from 'lucide-react';
import { queryAll, execute } from '../db/database';
import { Tarefa, Representante, Cliente } from '../types';
import { formatDate } from '../utils/formatters';

export const TarefasModule: React.FC = () => {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('pendente');
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState<Partial<Tarefa>>({
    titulo: '',
    descricao: '',
    tipo: 'ligação',
    prioridade: 'média',
    data_vencimento: new Date().toISOString().slice(0, 10),
    responsavel: 'Equipe Comercial',
    status: 'pendente',
    representante_id: '',
    cliente_id: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(reps);

      const clis = await queryAll<Cliente>('SELECT * FROM cliente ORDER BY nome_fantasia ASC');
      setClientes(clis);

      const tList = await queryAll<Tarefa>('SELECT * FROM tarefa ORDER BY data_vencimento ASC');
      setTarefas(tList);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo) return;

    try {
      const now = new Date().toISOString();
      await execute(
        `INSERT INTO tarefa (
          id, titulo, descricao, tipo, prioridade, data_vencimento, responsavel, status,
          representante_id, cliente_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?)`,
        [
          `tar_${Date.now()}`,
          formData.titulo,
          formData.descricao,
          formData.tipo || 'ligação',
          formData.prioridade || 'média',
          formData.data_vencimento,
          formData.responsavel || 'Operador',
          formData.representante_id || null,
          formData.cliente_id || null,
          now,
        ]
      );

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar tarefa: ${err.message}`);
    }
  };

  const handleToggleStatus = async (tarId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
    await execute('UPDATE tarefa SET status = ? WHERE id = ?', [newStatus, tarId]);
    await loadData();
  };

  const filteredTarefas = tarefas.filter((t) => {
    const matchesSearch = t.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-500" />
            Tarefas, Agenda & Histórico CRM
          </h2>
          <p className="text-xs text-slate-400">
            Gerencie reuniões, ligações, visitas comerciais e acompanhamentos de clientes e representantes.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary text-xs">
          <Plus className="w-4 h-4" />
          <span>Nova Tarefa / Contato</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar tarefa por título ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status</option>
            <option value="pendente">Pendentes</option>
            <option value="concluida">Concluídas</option>
          </select>
        </div>
      </div>

      {/* List Cards */}
      <div className="space-y-3">
        {filteredTarefas.length === 0 ? (
          <div className="glass-panel p-8 text-center text-slate-500 text-xs">Nenhuma tarefa agendada.</div>
        ) : (
          filteredTarefas.map((t) => {
            const rep = representantes.find((r) => r.id === t.representante_id);
            const cli = clientes.find((c) => c.id === t.cliente_id);

            return (
              <div
                key={t.id}
                className={`glass-panel p-4 rounded-xl flex items-center justify-between gap-4 transition-all ${
                  t.status === 'concluida' ? 'opacity-60 bg-slate-950/40' : 'hover:border-amber-500/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleStatus(t.id, t.status)}
                    className={`mt-0.5 p-1 rounded-lg border transition-all ${
                      t.status === 'concluida'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'border-slate-700 hover:border-amber-500 text-slate-400'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-slate-100 ${t.status === 'concluida' ? 'line-through' : ''}`}>
                        {t.titulo}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-800 text-slate-300">
                        {t.tipo}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          t.prioridade === 'urgente' || t.prioridade === 'alta'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {t.prioridade}
                      </span>
                    </div>

                    {t.descricao && <p className="text-slate-400">{t.descricao}</p>}

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span>Vencimento: <strong className="text-amber-400">{formatDate(t.data_vencimento)}</strong></span>
                      <span>Resp: {t.responsavel}</span>
                      {rep && <span>Rep: {rep.nome_razao}</span>}
                      {cli && <span>Cliente: {cli.nome_fantasia}</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">Nova Tarefa / Compromisso</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Título da Tarefa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reunião de alinhamento com supermercado X"
                  value={formData.titulo || ''}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Tipo de Atendimento *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="ligação">Ligação Telefônica</option>
                    <option value="whatsapp">Mensagem WhatsApp</option>
                    <option value="reunião">Reunião Presencial/Online</option>
                    <option value="visita">Visita Comercial</option>
                    <option value="email">E-mail</option>
                    <option value="documento">Conferência de Documentos</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Prioridade *</label>
                  <select
                    value={formData.prioridade}
                    onChange={(e) => setFormData({ ...formData, prioridade: e.target.value as any })}
                    className="input-field font-bold text-amber-400"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="média">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data de Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_vencimento || ''}
                    onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Responsável *</label>
                  <input
                    type="text"
                    required
                    value={formData.responsavel || ''}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Vincular Representante</label>
                  <select
                    value={formData.representante_id || ''}
                    onChange={(e) => setFormData({ ...formData, representante_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Nenhum</option>
                    {representantes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome_razao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Vincular Cliente</label>
                  <select
                    value={formData.cliente_id || ''}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Nenhum</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_fantasia}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Descrição / Detalhes</label>
                <textarea
                  rows={2}
                  value={formData.descricao || ''}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Gravar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
