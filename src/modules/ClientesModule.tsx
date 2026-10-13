import React, { useState, useEffect } from 'react';
import {
  Store,
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Edit2,
  Archive,
  X,
  Building2,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { Cliente, Representante, UnidadeCliente, Empresa } from '../types';
import { formatCurrency, formatDate, maskCNPJ, maskCPF, maskPhone, maskCEP } from '../utils/formatters';
import { exportToExcel } from '../utils/excelImport';
import { generateContratoFornecimentoPDF } from '../utils/pdfGenerator';

export const ClientesModule: React.FC = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [repFilter, setRepFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showUnidadesModal, setShowUnidadesModal] = useState(false);

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [unidades, setUnidades] = useState<UnidadeCliente[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newRepId, setNewRepId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const [formData, setFormData] = useState<Partial<Cliente>>({
    codigo: '',
    razao_social: '',
    nome_fantasia: '',
    cpf_cnpj: '',
    inscricao_estadual: '',
    endereco: '',
    cidade: 'Camaçari',
    uf: 'BA',
    cep: '42800-000',
    contato_compras: '',
    telefone: '',
    whatsapp: '',
    email: '',
    horario_recebimento: '08:00 às 17:00 (Segunda a Sexta)',
    representante_id: '',
    condicoes_comerciais: '',
    condicoes_pagamento: '30 dias',
    modalidade_frete: 'FOB',
    status: 'ativo',
    observacoes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const repsData = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(repsData);

      const clisData = await queryAll<Cliente>(`
        SELECT c.*, r.nome_razao as representante_nome
        FROM cliente c
        LEFT JOIN representante r ON c.representante_id = r.id
        ORDER BY c.nome_fantasia ASC
      `);
      setClientes(clisData);
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    }
  };

  const handleOpenModal = (cli?: Cliente) => {
    if (cli) {
      setEditingId(cli.id);
      setFormData(cli);
    } else {
      setEditingId(null);
      setFormData({
        codigo: `CLI-${Math.floor(100 + Math.random() * 900)}`,
        razao_social: '',
        nome_fantasia: '',
        cpf_cnpj: '',
        inscricao_estadual: '',
        endereco: '',
        cidade: 'Camaçari',
        uf: 'BA',
        cep: '42800-000',
        contato_compras: '',
        telefone: '',
        whatsapp: '',
        email: '',
        horario_recebimento: '08:00 às 17:00 (Segunda a Sexta)',
        representante_id: representantes[0]?.id || '',
        condicoes_comerciais: '',
        condicoes_pagamento: '30 dias',
        modalidade_frete: 'FOB',
        status: 'ativo',
        observacoes: '',
      });
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();

    // Check duplicate CNPJ
    if (!editingId && formData.cpf_cnpj) {
      const dup = await queryOne<Cliente>('SELECT id FROM cliente WHERE cpf_cnpj = ?', [formData.cpf_cnpj]);
      if (dup) {
        if (!confirm('Atenção: Já existe um cliente cadastrado com este mesmo CNPJ/CPF. Deseja prosseguir assim mesmo?')) {
          return;
        }
      }
    }

    try {
      if (editingId) {
        await execute(
          `UPDATE cliente SET
            codigo = ?, razao_social = ?, nome_fantasia = ?, cpf_cnpj = ?, inscricao_estadual = ?,
            endereco = ?, cidade = ?, uf = ?, cep = ?, contato_compras = ?, telefone = ?, whatsapp = ?,
            email = ?, horario_recebimento = ?, representante_id = ?, condicoes_comerciais = ?,
            condicoes_pagamento = ?, modalidade_frete = ?, status = ?, observacoes = ?, updated_at = ?
          WHERE id = ?`,
          [
            formData.codigo,
            formData.razao_social,
            formData.nome_fantasia,
            formData.cpf_cnpj,
            formData.inscricao_estadual,
            formData.endereco,
            formData.cidade,
            formData.uf,
            formData.cep,
            formData.contato_compras,
            formData.telefone,
            formData.whatsapp,
            formData.email,
            formData.horario_recebimento,
            formData.representante_id,
            formData.condicoes_comerciais,
            formData.condicoes_pagamento,
            formData.modalidade_frete,
            formData.status || 'ativo',
            formData.observacoes,
            now,
            editingId,
          ]
        );
      } else {
        const newId = `cli_${Date.now()}`;
        await execute(
          `INSERT INTO cliente (
            id, codigo, razao_social, nome_fantasia, cpf_cnpj, inscricao_estadual, endereco, cidade, uf,
            cep, contato_compras, telefone, whatsapp, email, horario_recebimento, representante_id,
            condicoes_comerciais, condicoes_pagamento, modalidade_frete, status, observacoes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            formData.codigo,
            formData.razao_social,
            formData.nome_fantasia,
            formData.cpf_cnpj,
            formData.inscricao_estadual,
            formData.endereco,
            formData.cidade,
            formData.uf,
            formData.cep,
            formData.contato_compras,
            formData.telefone,
            formData.whatsapp,
            formData.email,
            formData.horario_recebimento,
            formData.representante_id,
            formData.condicoes_comerciais,
            formData.condicoes_pagamento,
            formData.modalidade_frete,
            formData.status || 'ativo',
            formData.observacoes,
            now,
            now,
          ]
        );
      }

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar cliente: ${err.message}`);
    }
  };

  const handleTransferPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCliente || !newRepId) return;

    try {
      const now = new Date().toISOString();
      const oldRep = representantes.find((r) => r.id === selectedCliente.representante_id);
      const newRep = representantes.find((r) => r.id === newRepId);

      await execute('UPDATE cliente SET representante_id = ?, updated_at = ? WHERE id = ?', [
        newRepId,
        now,
        selectedCliente.id,
      ]);

      // Audit log
      await execute(
        `INSERT INTO log_auditoria (id, data_hora, usuario_nome, acao, entidade, entidade_id, detalhes)
         VALUES (?, ?, ?, 'Transferência Carteira', 'Cliente', ?, ?)`,
        [
          `log_${Date.now()}`,
          now,
          'usr_admin',
          selectedCliente.id,
          `Transferência de carteira do cliente ${selectedCliente.nome_fantasia} do representante ${oldRep?.nome_razao || '-'} para ${newRep?.nome_razao || '-'}. Motivo: ${transferReason || 'Ajuste comercial'}`,
        ]
      );

      alert(`Carteira transferida com sucesso para ${newRep?.nome_razao}!`);
      setShowTransferModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao transferir carteira: ${err.message}`);
    }
  };

  const handleGenerateContract = async (cli: Cliente) => {
    const empresa = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (!empresa) {
      alert('Dados da empresa não configurados.');
      return;
    }
    const pdf = generateContratoFornecimentoPDF(cli, empresa, {});
    pdf.save(`Contrato_Fornecimento_${cli.codigo}_${cli.nome_fantasia.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  const handleExportExcel = () => {
    const exportData = filteredClientes.map((c) => ({
      Código: c.codigo,
      'Razão Social': c.razao_social,
      'Nome Fantasia': c.nome_fantasia,
      'CNPJ / CPF': c.cpf_cnpj,
      Cidade: c.cidade,
      UF: c.uf,
      Contato: c.contato_compras,
      WhatsApp: c.whatsapp,
      Representante: c.representante_nome || '-',
      'Condição Pagamento': c.condicoes_pagamento,
      Frete: c.modalidade_frete,
      Status: c.status,
    }));
    exportToExcel(exportData, 'clientes_supermercados_pracasa');
  };

  const filteredClientes = clientes.filter((c) => {
    const matchesSearch =
      c.nome_fantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.razao_social.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpf_cnpj.includes(searchTerm) ||
      c.cidade.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRep = repFilter === 'todos' || c.representante_id === repFilter;
    return matchesSearch && matchesRep;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Store className="w-5 h-5 text-amber-500" />
            Clientes Supermercados & Filiais
          </h2>
          <p className="text-xs text-slate-400">
            Gerencie as redes de supermercados, unidades, vínculos com representantes e condições comerciais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleExportExcel} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Novo Cliente</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome fantasia, razão social, CNPJ, código ou cidade..."
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
                <th className="p-3">Código</th>
                <th className="p-3">Supermercado / Cliente</th>
                <th className="p-3">CNPJ / Cidade</th>
                <th className="p-3">Contato Compras</th>
                <th className="p-3">Representante Resp.</th>
                <th className="p-3">Pagamento / Frete</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredClientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Nenhum cliente supermercado encontrado.
                  </td>
                </tr>
              ) : (
                filteredClientes.map((cli) => (
                  <tr key={cli.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 font-mono font-bold text-amber-400">{cli.codigo}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-100">{cli.nome_fantasia}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{cli.razao_social}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono">{cli.cpf_cnpj}</div>
                      <div className="text-[11px] text-slate-400">
                        {cli.cidade}/{cli.uf}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-200">{cli.contato_compras}</div>
                      <div className="text-[11px] text-amber-400">{cli.whatsapp}</div>
                    </td>
                    <td className="p-3">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700/50">
                        {cli.representante_nome || 'Sem representante'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div>{cli.condicoes_pagamento}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">{cli.modalidade_frete}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          cli.status === 'ativo'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {cli.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleGenerateContract(cli)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all"
                        title="Gerar Contrato de Fornecimento PDF"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedCliente(cli);
                          setNewRepId(cli.representante_id);
                          setTransferReason('');
                          setShowTransferModal(true);
                        }}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-all"
                        title="Transferir Carteira de Representante"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(cli)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all"
                        title="Editar Cliente"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl p-6 rounded-xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">
                {editingId ? 'Editar Cliente Supermercado' : 'Novo Cliente Supermercado'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Código Único *</label>
                  <input
                    type="text"
                    required
                    value={formData.codigo || ''}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Razão Social *</label>
                  <input
                    type="text"
                    required
                    value={formData.razao_social || ''}
                    onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Nome Fantasia / Loja *</label>
                  <input
                    type="text"
                    required
                    value={formData.nome_fantasia || ''}
                    onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">CNPJ / CPF *</label>
                  <input
                    type="text"
                    required
                    value={formData.cpf_cnpj || ''}
                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: maskCNPJ(e.target.value) })}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Inscrição Estadual</label>
                  <input
                    type="text"
                    value={formData.inscricao_estadual || ''}
                    onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Endereço Completo *</label>
                  <input
                    type="text"
                    required
                    value={formData.endereco || ''}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cidade *</label>
                  <input
                    type="text"
                    required
                    value={formData.cidade || ''}
                    onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">UF *</label>
                  <input
                    type="text"
                    required
                    maxLength={2}
                    value={formData.uf || 'BA'}
                    onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                    className="input-field uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">CEP *</label>
                  <input
                    type="text"
                    required
                    value={formData.cep || ''}
                    onChange={(e) => setFormData({ ...formData, cep: maskCEP(e.target.value) })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Contato Responsável Compras *</label>
                  <input
                    type="text"
                    required
                    value={formData.contato_compras || ''}
                    onChange={(e) => setFormData({ ...formData, contato_compras: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">WhatsApp de Compras *</label>
                  <input
                    type="text"
                    required
                    value={formData.whatsapp || ''}
                    onChange={(e) => setFormData({ ...formData, whatsapp: maskPhone(e.target.value) })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">E-mail Comercial *</label>
                  <input
                    type="email"
                    required
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Representante Responsável *</label>
                  <select
                    value={formData.representante_id}
                    onChange={(e) => setFormData({ ...formData, representante_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Selecione o representante...</option>
                    {representantes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome_razao}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Condição de Pagamento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 30 dias / Boleto 30/60"
                    value={formData.condicoes_pagamento || ''}
                    onChange={(e) => setFormData({ ...formData, condicoes_pagamento: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Modalidade Frete *</label>
                  <select
                    value={formData.modalidade_frete}
                    onChange={(e) => setFormData({ ...formData, modalidade_frete: e.target.value as any })}
                    className="input-field font-bold"
                  >
                    <option value="FOB">FOB (Cliente retira / paga frete)</option>
                    <option value="CIF">CIF (Fábrica entrega)</option>
                    <option value="Retirada">Retirada Local</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Horário & Instruções de Recebimento</label>
                <input
                  type="text"
                  placeholder="Ex: Seg a Sex 08:00 às 11:30 - Docas no fundo"
                  value={formData.horario_recebimento || ''}
                  onChange={(e) => setFormData({ ...formData, horario_recebimento: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Portfolio Modal */}
      {showTransferModal && selectedCliente && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-cyan-400" />
                Transferir Carteira de Representante
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Transferir o cliente <strong>{selectedCliente.nome_fantasia}</strong> para um novo representante comercial.
            </p>

            <form onSubmit={handleTransferPortfolio} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Novo Representante Responsável *</label>
                <select
                  required
                  value={newRepId}
                  onChange={(e) => setNewRepId(e.target.value)}
                  className="input-field"
                >
                  <option value="">Selecione o representante...</option>
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_razao} ({r.territorio})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo / Justificativa da Transferência</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Reorganização de território / solicitação da fábrica"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowTransferModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Confirmar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
