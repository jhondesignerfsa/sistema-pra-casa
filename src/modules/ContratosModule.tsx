import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Download,
  Paperclip,
  CheckCircle,
  AlertTriangle,
  X,
  FileCheck,
  Building2,
  Users,
  Store,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { Contrato, Representante, Cliente, Empresa, ContratoType, ContratoStatus } from '../types';
import { formatDate } from '../utils/formatters';
import { generateContratoRepresentacaoPDF, generateContratoFornecimentoPDF } from '../utils/pdfGenerator';

export const ContratosModule: React.FC = () => {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFilter, setTipoFilter] = useState('todos');

  const [showModal, setShowModal] = useState(false);
  const [contractType, setContractType] = useState<ContratoType>('Representação Comercial Autônoma');
  const [selectedRepId, setSelectedRepId] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(reps);

      const clis = await queryAll<Cliente>('SELECT * FROM cliente ORDER BY nome_fantasia ASC');
      setClientes(clis);

      const cList = await queryAll<Contrato>('SELECT * FROM contrato ORDER BY created_at DESC');
      setContratos(cList);
    } catch (err) {
      console.error('Erro ao carregar contratos:', err);
    }
  };

  const handleGenerateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    const empresa = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (!empresa) {
      alert('Configurações da empresa não cadastradas.');
      return;
    }

    const now = new Date().toISOString();
    let pdf: any;
    let num = `CTR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    if (contractType === 'Representação Comercial Autônoma') {
      if (!selectedRepId) {
        alert('Selecione um representante.');
        return;
      }
      const rep = representantes.find((r) => r.id === selectedRepId);
      if (!rep) return;

      pdf = generateContratoRepresentacaoPDF(rep, empresa, { customNotes });
      pdf.save(`Contrato_Representacao_${rep.codigo}_${rep.nome_razao.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      await execute(
        `INSERT INTO contrato (id, tipo, numero, representante_id, data_inicio, status, dados_preenchidos_json, versao_modelo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'rascunho', ?, '1.0', ?, ?)`,
        [`ctr_${Date.now()}`, contractType, num, rep.id, now.slice(0, 10), JSON.stringify({ repId: rep.id, customNotes }), now, now]
      );
    } else {
      if (!selectedClienteId) {
        alert('Selecione um cliente.');
        return;
      }
      const cli = clientes.find((c) => c.id === selectedClienteId);
      if (!cli) return;

      pdf = generateContratoFornecimentoPDF(cli, empresa, { customNotes });
      pdf.save(`Contrato_Fornecimento_${cli.codigo}_${cli.nome_fantasia.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);

      await execute(
        `INSERT INTO contrato (id, tipo, numero, cliente_id, data_inicio, status, dados_preenchidos_json, versao_modelo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'rascunho', ?, '1.0', ?, ?)`,
        [`ctr_${Date.now()}`, contractType, num, cli.id, now.slice(0, 10), JSON.stringify({ cliId: cli.id, customNotes }), now, now]
      );
    }

    alert('Contrato em PDF gerado e registrado no histórico com sucesso!');
    setShowModal(false);
    await loadData();
  };

  const handleUpdateStatus = async (ctrId: string, status: ContratoStatus) => {
    await execute('UPDATE contrato SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      ctrId,
    ]);
    await loadData();
  };

  const handleDownloadContract = async (ctr: Contrato) => {
    const empresa = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (!empresa) {
      alert('Configurações da empresa não cadastradas.');
      return;
    }

    if (ctr.tipo === 'Representação Comercial Autônoma') {
      const rep = representantes.find((r) => r.id === ctr.representante_id);
      if (!rep) {
        alert('Representante vinculado não encontrado.');
        return;
      }
      const pdf = generateContratoRepresentacaoPDF(rep, empresa, {});
      pdf.save(`Contrato_Representacao_${rep.codigo}_${rep.nome_razao.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } else {
      const cli = clientes.find((c) => c.id === ctr.cliente_id);
      if (!cli) {
        alert('Cliente vinculado não encontrado.');
        return;
      }
      const pdf = generateContratoFornecimentoPDF(cli, empresa, {});
      pdf.save(`Contrato_Fornecimento_${cli.codigo}_${cli.nome_fantasia.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    }
  };

  const filteredContratos = contratos.filter((c) => {
    const matchesSearch = c.numero.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = tipoFilter === 'todos' || c.tipo === tipoFilter;
    return matchesSearch && matchesTipo;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Gerador de Contratos Legais (PDF)
          </h2>
          <p className="text-xs text-slate-400">
            Gere PDFs preenchidos dos contratos de Representação Comercial (Lei 4.886/65) e Fornecimento PraCasa.
          </p>
        </div>

        <button onClick={() => setShowModal(true)} className="btn-primary text-xs">
          <Plus className="w-4 h-4" />
          <span>Gerar Novo Contrato PDF</span>
        </button>
      </div>

      {/* Legal Disclaimer Box */}
      <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300 space-y-2">
        <div className="font-bold flex items-center gap-2 text-amber-400">
          <AlertTriangle className="w-4 h-4" /> Lista de Validações Obrigatórias Antes da Assinatura:
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-300">
          <li>Conferir Razão Social e CNPJ da fábrica Tempero PraCasa e do contratado.</li>
          <li>Verificar número e UF de inscrição ativa no conselho comercial CORE (Lei 4.886/65).</li>
          <li>Confirmar explicitamente delimitação de municípios/estados da zona de atuação e regra de exclusividade.</li>
          <li>Revisar percentual de comissão negociado (padrão 10.0%) e foro de arbitragem/domicílio da fábrica.</li>
        </ul>
      </div>

      {/* Filter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar contrato por número ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={tipoFilter} onChange={(e) => setTipoFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Tipos</option>
            <option value="Representação Comercial Autônoma">Representação Comercial</option>
            <option value="Fornecimento">Fornecimento</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Modelo Contratual</th>
                <th className="p-3">Parte Contratada</th>
                <th className="p-3">Data Início</th>
                <th className="p-3">Versão Modelo</th>
                <th className="p-3">Status Documento</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredContratos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    Nenhum contrato histórico gerado.
                  </td>
                </tr>
              ) : (
                filteredContratos.map((ctr) => {
                  const rep = representantes.find((r) => r.id === ctr.representante_id);
                  const cli = clientes.find((c) => c.id === ctr.cliente_id);
                  const parteNome = rep ? rep.nome_razao : cli ? cli.nome_fantasia : '-';

                  return (
                    <tr key={ctr.id} className="hover:bg-slate-800/40 transition-all">
                      <td className="p-3 font-mono font-bold text-amber-400">{ctr.numero}</td>
                      <td className="p-3 font-semibold text-slate-200">{ctr.tipo}</td>
                      <td className="p-3">{parteNome}</td>
                      <td className="p-3 text-slate-400 font-mono">{formatDate(ctr.data_inicio)}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-400">v{ctr.versao_modelo}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            ctr.status === 'assinado'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {ctr.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1">
                        <button
                          onClick={() => handleDownloadContract(ctr)}
                          className="p-1.5 rounded hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition-all"
                          title="Baixar Contrato em PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(ctr.id, ctr.status === 'assinado' ? 'rascunho' : 'assinado')}
                          className={`p-1.5 rounded hover:bg-slate-700 transition-all ${
                            ctr.status === 'assinado' ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'
                          }`}
                          title={ctr.status === 'assinado' ? 'Reverter para Rascunho' : 'Marcar como Assinado'}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Generate */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-500" />
                Gerar Novo Contrato em PDF
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateContract} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Selecione o Modelo de Contrato *</label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as ContratoType)}
                  className="input-field font-bold text-amber-400"
                >
                  <option value="Representação Comercial Autônoma">
                    Contrato de Representação Comercial Autônoma (Lei 4.886/65)
                  </option>
                  <option value="Fornecimento">Contrato de Fornecimento PraCasa</option>
                </select>
              </div>

              {contractType === 'Representação Comercial Autônoma' ? (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Representante Comercial *</label>
                  <select
                    required
                    value={selectedRepId}
                    onChange={(e) => setSelectedRepId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Selecione o representante cadastrado...</option>
                    {representantes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome_razao} — CORE {r.core_numero}/{r.core_uf}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Cliente Supermercado *</label>
                  <select
                    required
                    value={selectedClienteId}
                    onChange={(e) => setSelectedClienteId(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Selecione o cliente cadastrado...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_fantasia} ({c.cidade})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observações / Cláusulas Adicionais</label>
                <textarea
                  rows={2}
                  placeholder="Especificações complementares autorizadas"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Gerar e Baixar PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
