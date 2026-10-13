import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Copy,
  Users,
  Store,
  FileText,
  History,
  Check,
  AlertCircle,
} from 'lucide-react';
import { queryAll, execute } from '../db/database';
import { Representante, Cliente } from '../types';
import { formatDate } from '../utils/formatters';

export const WhatsAppModule: React.FC = () => {
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [recipientType, setRecipientType] = useState<'rep' | 'cli'>('rep');
  const [selectedId, setSelectedId] = useState('');
  const [phone, setPhone] = useState('');
  const [template, setTemplate] = useState('vendas_estoque');
  const [customMessage, setCustomMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [contactHistory, setContactHistory] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(reps);

      const clis = await queryAll<Cliente>('SELECT * FROM cliente ORDER BY nome_fantasia ASC');
      setClientes(clis);

      const logs = await queryAll('SELECT * FROM interacao WHERE tipo = "whatsapp" ORDER BY data_hora DESC LIMIT 20');
      setContactHistory(logs);
    } catch (err) {
      console.error('Erro ao carregar contatos WhatsApp:', err);
    }
  };

  useEffect(() => {
    updateTemplateText();
  }, [recipientType, selectedId, template]);

  const updateTemplateText = () => {
    let targetName = 'Cliente / Representante';
    if (recipientType === 'rep') {
      const rep = representantes.find((r) => r.id === selectedId);
      if (rep) {
        targetName = rep.nome_razao;
        setPhone(rep.whatsapp.replace(/[^0-9]/g, ''));
      }
    } else {
      const cli = clientes.find((c) => c.id === selectedId);
      if (cli) {
        targetName = cli.contato_compras || cli.nome_fantasia;
        setPhone(cli.whatsapp.replace(/[^0-9]/g, ''));
      }
    }

    let msg = '';
    if (template === 'vendas_estoque') {
      msg = `Olá, ${targetName}! Tudo bem?\n\nPode nos enviar a atualização das vendas e do saldo em estoque dos produtos da Tempero PraCasa?`;
    } else if (template === 'recompra') {
      msg = `Olá, ${targetName}! Constatamos uma possível reposição da linha de molhos e especiarias PraCasa.\n\nPode verificar a necessidade e a quantidade sugerida para este período?`;
    } else if (template === 'pedido_status') {
      msg = `Olá, ${targetName}! Seu pedido foi processado pela fábrica Tempero PraCasa e já está pronto para entrega/faturamento.\n\nQualquer dúvida estamos à disposição!`;
    } else if (template === 'comissao') {
      msg = `Olá, ${targetName}! Seu demonstrativo de comissões de representação está disponível para conferência.\n\nFavor revisar e retornar a confirmação.`;
    } else if (template === 'documentos') {
      msg = `Olá, ${targetName}! Lembrando sobre a atualização cadastral e do registro CORE para mantermos o contrato em dia.\n\nAgradecemos a atenção!`;
    }

    setCustomMessage(msg);
  };

  const handleOpenWhatsApp = async () => {
    if (!phone) {
      alert('Número de WhatsApp não encontrado para o contato selecionado.');
      return;
    }

    try {
      await navigator.clipboard.writeText(customMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}

    const encoded = encodeURIComponent(customMessage);
    const url = `https://web.whatsapp.com/send?phone=55${phone}&text=${encoded}`;
    window.open(url, '_blank');

    // Record contact history log
    const now = new Date().toISOString();
    let targetName = 'Contato';
    if (recipientType === 'rep') {
      targetName = representantes.find((r) => r.id === selectedId)?.nome_razao || 'Representante';
    } else {
      targetName = clientes.find((c) => c.id === selectedId)?.nome_fantasia || 'Cliente';
    }

    await execute(
      `INSERT INTO interacao (id, tipo, data_hora, resumo, detalhes, usuario_nome, representante_id, cliente_id)
       VALUES (?, 'whatsapp', ?, ?, ?, 'usr_admin', ?, ?)`,
      [
        `int_${Date.now()}`,
        now,
        `Contato via WhatsApp com ${targetName}`,
        customMessage,
        recipientType === 'rep' ? selectedId : null,
        recipientType === 'cli' ? selectedId : null,
      ]
    );

    await loadData();
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [activeTab, setActiveTab] = useState<'representantes' | 'editor' | 'clientes' | 'conexao'>('representantes');
  const [searchRep, setSearchRep] = useState('');

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            Central de WhatsApp & Contato Comercial
          </h2>
          <p className="text-xs text-slate-400">
            Comunicação direta com representantes comerciais e clientes, envio de relatórios e histórico.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('representantes')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'representantes'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Representantes ({representantes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'editor'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Mensagem</span>
          </button>
          <button
            onClick={() => setActiveTab('clientes')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'clientes'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Clientes ({clientes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('conexao')}
            className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'conexao'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>WhatsApp da Empresa</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Representantes Comerciais */}
      {activeTab === 'representantes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar representante por nome, região ou telefone..."
                value={searchRep}
                onChange={(e) => setSearchRep(e.target.value)}
                className="input-field !py-2 text-xs pl-3 w-full"
              />
            </div>
            <div className="text-xs text-slate-400">
              Total: <strong className="text-amber-400">{representantes.length}</strong> representantes cadastrados
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {representantes
              .filter(
                (r) =>
                  r.nome_razao.toLowerCase().includes(searchRep.toLowerCase()) ||
                  (r.territorio && r.territorio.toLowerCase().includes(searchRep.toLowerCase())) ||
                  r.whatsapp.includes(searchRep)
              )
              .map((rep) => {
                const cleanNum = rep.whatsapp.replace(/\D/g, '');
                return (
                  <div
                    key={rep.id}
                    className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                            {rep.nome_razao.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-100 text-xs line-clamp-1">{rep.nome_razao}</h4>
                            <span className="text-[10px] text-amber-400/90 font-mono">{rep.codigo || 'REP'}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {rep.status || 'Ativo'}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">WhatsApp:</span>
                          <span className="text-emerald-400 font-mono font-semibold">{rep.whatsapp}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">Região:</span>
                          <span className="text-slate-300 line-clamp-1">{rep.territorio || 'Não informada'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-medium">CORE:</span>
                          <span className="text-slate-300">{rep.core_numero ? `${rep.core_numero}/${rep.core_uf || 'BA'}` : 'Não informado'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientType('rep');
                          setSelectedId(rep.id);
                          setTemplate('vendas_estoque');
                          setActiveTab('editor');
                        }}
                        className="btn-secondary !py-1.5 !px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1 border-slate-700 text-slate-300 hover:text-white"
                        title="Escrever mensagem ou selecionar modelo"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                        <span>Mensagem</span>
                      </button>

                      <a
                        href={`https://wa.me/55${cleanNum}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary !py-1.5 !px-3 text-[11px] flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        title="Abrir chat no WhatsApp Web ou App"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Conversar</span>
                      </a>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 2: Editor de Mensagem e Modelos */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form Panel */}
          <div className="glass-panel p-5 rounded-xl space-y-4 text-xs">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Send className="w-4 h-4 text-amber-400" /> Preparar e Enviar Mensagem
            </h3>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Tipo de Destinatário *</label>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="rep"
                    checked={recipientType === 'rep'}
                    onChange={() => {
                      setRecipientType('rep');
                      setSelectedId(representantes[0]?.id || '');
                    }}
                    className="text-amber-500"
                  />
                  <span>Representante Comercial</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="cli"
                    checked={recipientType === 'cli'}
                    onChange={() => {
                      setRecipientType('cli');
                      setSelectedId(clientes[0]?.id || '');
                    }}
                    className="text-amber-500"
                  />
                  <span>Cliente Supermercado</span>
                </label>
              </div>

              {recipientType === 'rep' ? (
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input-field">
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_razao} ({r.whatsapp})
                    </option>
                  ))}
                </select>
              ) : (
                <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input-field">
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_fantasia} - {c.contato_compras} ({c.whatsapp})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Modelo de Mensagem Predefinido</label>
              <select value={template} onChange={(e) => setTemplate(e.target.value)} className="input-field font-semibold text-amber-400">
                <option value="vendas_estoque">Solicitar Relatório de Vendas e Estoque</option>
                <option value="recompra">Aviso de Possível Recompra / Reposição</option>
                <option value="pedido_status">Aviso sobre Status do Pedido</option>
                <option value="comissao">Envio de Demonstrativo de Comissão</option>
                <option value="documentos">Lembrete de Documentos / CORE Pendentes</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Conteúdo da Mensagem (Editável)</label>
              <textarea
                rows={7}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="input-field font-mono text-[11px] leading-relaxed"
              />
            </div>

            <div className="flex justify-between items-center gap-2 pt-2 border-t border-slate-800">
              <button type="button" onClick={handleCopyText} className="btn-secondary text-xs">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>

              <button type="button" onClick={handleOpenWhatsApp} className="btn-primary text-xs bg-emerald-600 hover:bg-emerald-500 border-emerald-500">
                <Send className="w-4 h-4" />
                <span>Abrir no WhatsApp</span>
              </button>
            </div>
          </div>

          {/* History Panel */}
          <div className="glass-panel p-5 rounded-xl space-y-4 text-xs">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <History className="w-4 h-4 text-amber-500" /> Histórico de Contatos Recentes
            </h3>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {contactHistory.length === 0 ? (
                <p className="text-slate-500 text-center py-6">Nenhum contato registrado recentemente.</p>
              ) : (
                contactHistory.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex justify-between font-semibold text-slate-200">
                      <span>{h.resumo}</span>
                      <span className="text-[10px] text-slate-400">{formatDate(h.data_hora)}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 italic line-clamp-3">{h.detalhes}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Clientes Supermercados */}
      {activeTab === 'clientes' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clientes.map((cli) => {
              const cleanNum = cli.whatsapp ? cli.whatsapp.replace(/\D/g, '') : '';
              return (
                <div
                  key={cli.id}
                  className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-100 text-xs line-clamp-1">{cli.nome_fantasia}</h4>
                        <span className="text-[10px] text-slate-400">{cli.razao_social}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {cli.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Contato:</span>
                        <span className="text-slate-300 font-semibold">{cli.contato_compras || 'Compras'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">WhatsApp:</span>
                        <span className="text-emerald-400 font-mono font-semibold">{cli.whatsapp || 'Não cadastrado'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Cidade:</span>
                        <span className="text-slate-300">{cli.cidade || 'Bahia'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRecipientType('cli');
                        setSelectedId(cli.id);
                        setTemplate('recompra');
                        setActiveTab('editor');
                      }}
                      className="btn-secondary !py-1.5 !px-2.5 text-[11px] flex-1 flex items-center justify-center gap-1 border-slate-700 text-slate-300 hover:text-white"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                      <span>Mensagem</span>
                    </button>

                    {cleanNum && (
                      <a
                        href={`https://wa.me/55${cleanNum}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary !py-1.5 !px-3 text-[11px] flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Conversar</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Conexão do WhatsApp da Empresa */}
      {activeTab === 'conexao' && (
        <div className="space-y-6 max-w-4xl">
          <div className="glass-panel p-6 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Status de Conexão: Modo Webhook / Atalho Direto (Ativo)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Atualmente o sistema está configurado para disparar mensagens através do WhatsApp Web / Aplicativo Oficial Tempero PraCasa.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" /> Vantagens do Modo Atual (Atalho Direto):
                </h4>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>Zero custo de servidores externos ou APIs pagas;</li>
                  <li>Sem risco de bloqueio de número por políticas do WhatsApp;</li>
                  <li>Funciona com qualquer número (WhatsApp normal ou Business);</li>
                  <li>Total controle: você confere antes de enviar.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> Quer Conectar o WhatsApp da Empresa com QR Code?
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Para o sistema enviar mensagens e arquivos <strong>100% de forma invisível e automática em segundo plano</strong> escaneando um QR Code, basta acoplar um gateway como <strong>Evolution API</strong> ou biblioteca <strong>Baileys / WPPConnect</strong> rodando em segundo plano.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
