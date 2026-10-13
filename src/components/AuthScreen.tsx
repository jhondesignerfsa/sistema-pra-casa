import React, { useState, useEffect } from 'react';
import { Lock, User, Key, Shield, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { queryAll, forceResetToOperaDB } from '../db/database';
import { Representante } from '../types';

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  perfil: 'admin' | 'representante';
  representante_id?: string;
  codigo_rep?: string;
}

interface AuthScreenProps {
  onLogin: (session: UserSession) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [role, setRole] = useState<'admin' | 'rep'>('admin');
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState<string>('admin@temperopracasa.com.br');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadReps();
  }, []);

  const loadReps = async () => {
    try {
      let reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      if (reps.length === 0) {
        // Tenta sincronizar banco oficial do Opera automaticamente
        await forceResetToOperaDB();
        reps = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      }
      setRepresentantes(reps);
      if (reps.length > 0) {
        setSelectedRepId(reps[0].id);
      }
    } catch (e) {
      console.error('Erro ao carregar representantes:', e);
    }
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    setTimeout(() => {
      if (role === 'admin') {
        // Admin verification
        if (password !== 'admin123' && password !== 'pracasa2026') {
          setErrorMsg('Senha incorreta para Administrador. Dica: use "admin123" ou "pracasa2026".');
          setLoading(false);
          return;
        }

        const session: UserSession = {
          id: 'usr_admin',
          nome: 'Administrador PraCasa',
          email: adminEmail,
          perfil: 'admin',
        };

        if (rememberMe) {
          localStorage.setItem('pracasa_auth_session', JSON.stringify(session));
        }
        onLogin(session);
      } else {
        // Representative verification
        const rep = representantes.find((r) => r.id === selectedRepId);
        if (!rep) {
          setErrorMsg('Selecione um representante válido.');
          setLoading(false);
          return;
        }

        // Rep default password can be "123456", "pracasa", or rep code digits
        const repDigits = rep.codigo.replace(/\D/g, '') || '123';
        if (password !== '123456' && password !== 'pracasa' && password !== repDigits && password !== rep.codigo) {
          setErrorMsg(`Senha incorreta para o representante. Dica inicial: use "123456" ou o código "${rep.codigo}".`);
          setLoading(false);
          return;
        }

        const session: UserSession = {
          id: `usr_${rep.id}`,
          nome: rep.nome_razao,
          email: rep.email || `${rep.codigo.toLowerCase()}@temperopracasa.com.br`,
          perfil: 'representante',
          representante_id: rep.id,
          codigo_rep: rep.codigo,
        };

        if (rememberMe) {
          localStorage.setItem('pracasa_auth_session', JSON.stringify(session));
        }
        onLogin(session);
      }
      setLoading(false);
    }, 300);
  };

  return (
    <div className="min-h-screen w-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl shadow-amber-500/5">
            <img
              src="/logo-pracasa-badge.png"
              alt="Tempero PraCasa"
              className="h-16 w-auto object-contain mx-auto drop-shadow-md"
            />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              Tempero PraCasa
            </h1>
            <p className="text-xs text-amber-400/90 font-medium italic mt-0.5">
              Gestão Comercial de Vendas & Estoque
            </p>
          </div>
        </div>

        {/* Login Box */}
        <div className="glass-panel p-6 sm:p-7 rounded-2xl border border-slate-800 shadow-2xl bg-slate-900/80 backdrop-blur-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" /> Acesso ao Sistema
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Online
            </span>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setRole('admin');
                setPassword('');
                setErrorMsg('');
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                role === 'admin'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Diretoria / Fábrica</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('rep');
                setPassword('');
                setErrorMsg('');
              }}
              className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                role === 'rep'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Representante</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4 text-xs">
            {role === 'admin' ? (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  E-mail do Administrador
                </label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="input-field w-full font-mono text-slate-100"
                  placeholder="admin@temperopracasa.com.br"
                />
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Selecione o seu Nome / Registro
                </label>
                <select
                  value={selectedRepId}
                  onChange={(e) => setSelectedRepId(e.target.value)}
                  className="input-field w-full text-slate-100 font-semibold"
                >
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_razao} ({r.codigo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-semibold">Senha de Acesso</label>
                <span className="text-[10px] text-slate-500">
                  {role === 'admin' ? 'Padrão: admin123' : 'Padrão: 123456'}
                </span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha..."
                  className="input-field w-full pl-9 font-mono text-slate-100"
                />
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px] text-slate-400">Permanecer conectado</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full !py-2.5 flex items-center justify-center gap-2 font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 shadow-lg shadow-orange-500/20"
            >
              <span>{loading ? 'Entrando...' : 'Entrar no Sistema'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick info footer */}
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 text-center leading-relaxed">
            Ambiente seguro Tempero PraCasa. Todos os pedidos e estoques são sincronizados na nuvem.
          </div>
        </div>
      </div>
    </div>
  );
};
