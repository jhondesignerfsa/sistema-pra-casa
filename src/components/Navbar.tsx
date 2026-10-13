import React, { useState } from 'react';
import { Search, Plus, ShoppingCart, Users, Store, Paperclip, LogOut, Shield, User } from 'lucide-react';
import { ModuleType } from './Sidebar';
import { UserSession } from './AuthScreen';

interface NavbarProps {
  onNavigate: (module: ModuleType) => void;
  onGlobalSearch: (term: string) => void;
  onQuickAction: (action: 'novo_pedido' | 'novo_cliente' | 'novo_rep' | 'anexar_doc') => void;
  lastUpdateStr: string;
  currentUser?: UserSession | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNavigate,
  onGlobalSearch,
  onQuickAction,
  lastUpdateStr,
  currentUser,
  onLogout,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    onGlobalSearch(val);
  };

  const userInitials = currentUser?.nome
    ? currentUser.nome
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'OP';

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-6 flex items-center justify-between gap-4 sticky top-0 z-30 backdrop-blur-md">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Busca global (representante, cliente, SKU, pedido, NF)..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentUser?.perfil !== 'representante' && (
          <div className="flex items-center gap-2 pr-4 border-r border-slate-800">
            <button
              onClick={() => onQuickAction('novo_pedido')}
              className="btn-primary text-xs !py-1.5 !px-3"
              title="Criar Novo Pedido"
            >
              <Plus className="w-3.5 h-3.5" />
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Novo Pedido</span>
            </button>

            <button
              onClick={() => onQuickAction('novo_cliente')}
              className="btn-secondary text-xs !py-1.5 !px-3"
              title="Novo Cliente Supermercado"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Cliente</span>
            </button>

            <button
              onClick={() => onQuickAction('novo_rep')}
              className="btn-secondary text-xs !py-1.5 !px-3"
              title="Novo Representante Comercial"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Representante</span>
            </button>

            <button
              onClick={() => onQuickAction('anexar_doc')}
              className="btn-secondary text-xs !py-1.5 !px-3"
              title="Anexar Documento ou Nota Fiscal"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Anexo</span>
            </button>
          </div>
        )}

        {currentUser?.perfil === 'representante' && (
          <div className="flex items-center gap-2 pr-4 border-r border-slate-800">
            <button
              onClick={() => onQuickAction('novo_pedido')}
              className="btn-primary text-xs !py-1.5 !px-3"
              title="Emitir Pedido de Venda"
            >
              <Plus className="w-3.5 h-3.5" />
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Emitir Pedido</span>
            </button>

            <button
              onClick={() => onQuickAction('novo_cliente')}
              className="btn-secondary text-xs !py-1.5 !px-3"
              title="Cadastrar Novo Cliente"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Novo Cliente</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-200 line-clamp-1 max-w-[160px]">
              {currentUser?.nome || 'Operador Comercial'}
            </div>
            <div className="text-[10px] text-amber-400 font-mono">
              {currentUser?.perfil === 'admin' ? 'Diretoria / Fábrica' : `Rep: ${currentUser?.codigo_rep || 'Comercial'}`}
            </div>
          </div>

          <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-xs shadow-inner">
            {userInitials}
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all ml-1"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
