import React, { useState, useEffect } from 'react';
import { Building2, Save, ShieldAlert, CheckCircle, RefreshCw, Database } from 'lucide-react';
import { queryOne, execute, forceResetToOperaDB } from '../db/database';
import { Empresa } from '../types';
import { maskCNPJ, maskCPF, maskPhone } from '../utils/formatters';

export const EmpresaModule: React.FC = () => {
  const [formData, setFormData] = useState<Partial<Empresa>>({
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    endereco: '',
    telefone: '',
    whatsapp: '',
    email: '',
    responsavel_legal: '',
    cargo_responsavel: '',
    cpf_responsavel: '',
    comissao_padrao_pct: 10.0,
    estoque_minimo_padrao: 15,
    intervalo_recompra_dias: 15,
    politica_backup: 'Diário Automático',
  });

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    const emp = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (emp) {
      setFormData(emp);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      const now = new Date().toISOString();
      await execute(`
        UPDATE empresa SET
          razao_social = ?,
          nome_fantasia = ?,
          cnpj = ?,
          endereco = ?,
          telefone = ?,
          whatsapp = ?,
          email = ?,
          responsavel_legal = ?,
          cargo_responsavel = ?,
          cpf_responsavel = ?,
          comissao_padrao_pct = ?,
          estoque_minimo_padrao = ?,
          intervalo_recompra_dias = ?,
          politica_backup = ?,
          updated_at = ?
        WHERE id = 'emp_1'
      `, [
        formData.razao_social,
        formData.nome_fantasia,
        formData.cnpj,
        formData.endereco,
        formData.telefone,
        formData.whatsapp,
        formData.email,
        formData.responsavel_legal,
        formData.cargo_responsavel,
        formData.cpf_responsavel,
        formData.comissao_padrao_pct,
        formData.estoque_minimo_padrao,
        formData.intervalo_recompra_dias,
        formData.politica_backup,
        now
      ]);
      setSavedMsg('Configurações salvas com sucesso!');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch (err: any) {
      alert(`Erro ao salvar configurações: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            Configurações da Empresa (Tempero PraCasa)
          </h2>
          <p className="text-xs text-slate-400">
            Cadastre os dados oficiais da fábrica usados na emissão de contratos, pedidos e relatórios.
          </p>
        </div>

        {savedMsg && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-semibold animate-pulse">
            <CheckCircle className="w-4 h-4" />
            <span>{savedMsg}</span>
          </div>
        )}
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 space-y-1">
        <div className="font-bold flex items-center gap-1 text-amber-400">
          <ShieldAlert className="w-4 h-4" /> Observação de Segurança & Jurídica:
        </div>
        <p>
          Os dados abaixo são pré-carregados para facilitar a geração dos modelos de contrato. Antes de assinar qualquer documento oficial, confirme a conferência jurídica do CNPJ, endereço e representante legal.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="glass-panel p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Dados Cadastrais da Fábrica</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Razão Social *</label>
              <input
                type="text"
                required
                value={formData.razao_social || ''}
                onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome Fantasia *</label>
              <input
                type="text"
                required
                value={formData.nome_fantasia || ''}
                onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">CNPJ *</label>
              <input
                type="text"
                required
                value={formData.cnpj || ''}
                onChange={(e) => setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail Comercial *</label>
              <input
                type="email"
                required
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Endereço Completo *</label>
              <input
                type="text"
                required
                value={formData.endereco || ''}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Telefone Fixo</label>
              <input
                type="text"
                value={formData.telefone || ''}
                onChange={(e) => setFormData({ ...formData, telefone: maskPhone(e.target.value) })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp de Atendimento</label>
              <input
                type="text"
                value={formData.whatsapp || ''}
                onChange={(e) => setFormData({ ...formData, whatsapp: maskPhone(e.target.value) })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Representante Legal da Fábrica</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Responsável *</label>
              <input
                type="text"
                required
                value={formData.responsavel_legal || ''}
                onChange={(e) => setFormData({ ...formData, responsavel_legal: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Cargo *</label>
              <input
                type="text"
                required
                value={formData.cargo_responsavel || ''}
                onChange={(e) => setFormData({ ...formData, cargo_responsavel: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">CPF do Responsável *</label>
              <input
                type="text"
                required
                value={formData.cpf_responsavel || ''}
                onChange={(e) => setFormData({ ...formData, cpf_responsavel: maskCPF(e.target.value) })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Preferências de Operação e Comissões</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Comissão Padrão (% Lei 4.886)</label>
              <input
                type="number"
                step="0.1"
                value={formData.comissao_padrao_pct || 10}
                onChange={(e) => setFormData({ ...formData, comissao_padrao_pct: parseFloat(e.target.value) || 0 })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Estoque Mínimo Padrão (Fábrica)</label>
              <input
                type="number"
                value={formData.estoque_minimo_padrao || 15}
                onChange={(e) => setFormData({ ...formData, estoque_minimo_padrao: parseInt(e.target.value) || 0 })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Intervalo Padrão Recompra (Dias)</label>
              <input
                type="number"
                value={formData.intervalo_recompra_dias || 15}
                onChange={(e) => setFormData({ ...formData, intervalo_recompra_dias: parseInt(e.target.value) || 0 })}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl space-y-4 border border-amber-500/30 bg-amber-950/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Sincronização & Banco de Dados Oficial (Opera GX)
              </h3>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
              Dados Gravados no Git
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Todos os dados que você cadastrou no navegador Opera (Representante <strong>Joedson REP-614</strong>, 
            catálogo de 13 produtos com preços de caixa corretos, 4 clientes de supermercado, 3 pedidos emitidos e estoques) 
            estão salvos e integrados ao sistema online. Caso seu navegador esteja usando uma versão antiga em cache, você pode 
            forçar a restauração imediata do banco oficial abaixo.
          </p>

          <div className="pt-1">
            <button
              type="button"
              onClick={async () => {
                if (window.confirm('Deseja recarregar o banco de dados oficial cadastrado no Opera? Seus dados serão atualizados com sucesso.')) {
                  setSaving(true);
                  await forceResetToOperaDB();
                }
              }}
              className="btn-secondary !text-amber-300 !border-amber-500/40 hover:!bg-amber-500/20 text-xs py-2 px-4 flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Restaurar / Sincronizar Banco Oficial do Opera</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Salvar Configurações</span>
          </button>
        </div>
      </form>
    </div>
  );
};
