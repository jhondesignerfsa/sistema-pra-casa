import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Package,
  Users,
  Store,
  ShoppingCart,
  Boxes,
  FileSpreadsheet,
  FileCheck2,
  FileText,
  DollarSign,
  Clock,
  MessageSquare,
  CheckSquare,
  BarChart3,
  Paperclip,
  ShieldCheck,
} from 'lucide-react';

export type ModuleType =
  | 'dashboard'
  | 'empresa'
  | 'produtos'
  | 'representantes'
  | 'clientes'
  | 'pedidos'
  | 'estoque'
  | 'vendas_historicas'
  | 'notas_fiscais'
  | 'contratos'
  | 'comissoes'
  | 'recompra'
  | 'whatsapp'
  | 'tarefas'
  | 'relatorios'
  | 'anexos'
  | 'auditoria';

interface SidebarProps {
  currentModule: ModuleType;
  onSelectModule: (module: ModuleType) => void;
  isDemoMode: boolean;
  onToggleDemo: () => void;
  userRole?: 'admin' | 'representante';
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  isDemoMode,
  onToggleDemo,
  userRole = 'admin',
}) => {
  const allMenuItems: { id: ModuleType; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'empresa', label: 'Empresa & Config.', icon: Building2 },
    { id: 'produtos', label: 'Catálogo de Produtos', icon: Package },
    { id: 'representantes', label: 'Representantes (CORE)', icon: Users },
    { id: 'clientes', label: 'Clientes Supermercados', icon: Store },
    { id: 'pedidos', label: 'Pedidos de Venda', icon: ShoppingCart },
    { id: 'estoque', label: 'Estoque por Locais', icon: Boxes },
    { id: 'vendas_historicas', label: 'Vendas Históricas', icon: FileSpreadsheet },
    { id: 'notas_fiscais', label: 'Notas Fiscais & XML', icon: FileCheck2 },
    { id: 'contratos', label: 'Contratos (PDF)', icon: FileText },
    { id: 'comissoes', label: 'Comissões & Financeiro', icon: DollarSign },
    { id: 'recompra', label: 'Alertas de Recompra', icon: Clock },
    { id: 'whatsapp', label: 'WhatsApp & Atendimento', icon: MessageSquare },
    { id: 'tarefas', label: 'Tarefas & Histórico', icon: CheckSquare },
    { id: 'relatorios', label: 'Relatórios & Exportações', icon: BarChart3 },
    { id: 'anexos', label: 'Arquivo Digital (Anexos)', icon: Paperclip },
    { id: 'auditoria', label: 'Auditoria & Backups', icon: ShieldCheck },
  ];

  // Restringir itens se for perfil de Representante Comercial
  const repAllowedModules: ModuleType[] = [
    'dashboard',
    'pedidos',
    'estoque',
    'produtos',
    'clientes',
    'comissoes',
    'whatsapp',
  ];

  const menuItems = userRole === 'representante'
    ? allMenuItems.filter((item) => repAllowedModules.includes(item.id))
    : allMenuItems;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0">
      <div className="p-3.5 border-b border-slate-800 flex items-center gap-3 bg-slate-950/40">
        <img
          src="/logo-pracasa-badge.png"
          alt="Tempero PraCasa"
          className="h-11 w-auto object-contain drop-shadow-md transition-all hover:scale-105 cursor-pointer"
        />
        <div className="overflow-hidden">
          <h1 className="font-extrabold text-slate-100 text-sm tracking-tight leading-tight truncate">
            PraCasa Gestão
          </h1>
          <p className="text-[10.5px] text-amber-500/90 font-medium tracking-tight italic truncate">O verdadeiro sabor caseiro!</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectModule(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={onToggleDemo}
          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between transition-all border ${
            isDemoMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
          }`}
        >
          <span>Modo Demonstração</span>
          <span className={`px-2 py-0.5 text-[10px] rounded-full uppercase tracking-wider ${isDemoMode ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-700 text-slate-400'}`}>
            {isDemoMode ? 'ATIVO' : 'DESATIVADO'}
          </span>
        </button>
      </div>
    </aside>
  );
};
