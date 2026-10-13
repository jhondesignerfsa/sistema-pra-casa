import React, { useState, useEffect } from 'react';
import { Sidebar, ModuleType } from './components/Sidebar';
import { Navbar } from './components/Navbar';

import { getDB } from './db/database';
import { seedInitialData, loadDemoData, clearDemoData } from './db/seed';

// Modules
import { DashboardModule } from './modules/DashboardModule';
import { EmpresaModule } from './modules/EmpresaModule';
import { ProdutosModule } from './modules/ProdutosModule';
import { RepresentantesModule } from './modules/RepresentantesModule';
import { ClientesModule } from './modules/ClientesModule';
import { PedidosModule } from './modules/PedidosModule';
import { EstoqueModule } from './modules/EstoqueModule';
import { VendasHistoricasModule } from './modules/VendasHistoricasModule';
import { NotasFiscaisModule } from './modules/NotasFiscaisModule';
import { ContratosModule } from './modules/ContratosModule';
import { ComissoesModule } from './modules/ComissoesModule';
import { RecompraModule } from './modules/RecompraModule';
import { WhatsAppModule } from './modules/WhatsAppModule';
import { TarefasModule } from './modules/TarefasModule';
import { RelatoriosModule } from './modules/RelatoriosModule';
import { AnexosModule } from './modules/AnexosModule';
import { AuditoriaModule } from './modules/AuditoriaModule';
import { AuthScreen, UserSession } from './components/AuthScreen';

export default function App() {
  const [currentModule, setCurrentModule] = useState<ModuleType>('dashboard');
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [dbReady, setDbReady] = useState<boolean>(false);
  const [lastUpdateStr, setLastUpdateStr] = useState<string>(new Date().toLocaleTimeString('pt-BR'));

  // Sincronização de Sessão de Usuário
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('pracasa_auth_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      await getDB();
      await seedInitialData();
      setDbReady(true);
    } catch (err) {
      console.error('Erro ao inicializar banco de dados:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pracasa_auth_session');
    setCurrentUser(null);
    setCurrentModule('dashboard');
  };

  const handleToggleDemo = async () => {
    if (isDemoMode) {
      if (confirm('Deseja desativar o Modo Demonstração e remover os dados fictícios de teste? Os dados reais permanecerão intactos.')) {
        await clearDemoData();
        setIsDemoMode(false);
        setLastUpdateStr(new Date().toLocaleTimeString('pt-BR'));
      }
    } else {
      if (confirm('Deseja ativar o Modo Demonstração com dados fictícios ilustrativos de produtos, representantes e pedidos?')) {
        await loadDemoData();
        setIsDemoMode(true);
        setLastUpdateStr(new Date().toLocaleTimeString('pt-BR'));
      }
    }
  };

  const handleQuickAction = (action: 'novo_pedido' | 'novo_cliente' | 'novo_rep' | 'anexar_doc') => {
    if (action === 'novo_pedido') setCurrentModule('pedidos');
    else if (action === 'novo_cliente') setCurrentModule('clientes');
    else if (action === 'novo_rep') setCurrentModule('representantes');
    else if (action === 'anexar_doc') setCurrentModule('anexos');
  };

  if (!dbReady) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-4 text-slate-100">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center font-extrabold text-2xl animate-pulse shadow-lg shadow-orange-500/30">
          PC
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold">PraCasa Gestão Comercial</h2>
          <p className="text-xs text-slate-400">Carregando banco de dados SQLite e configurações...</p>
        </div>
      </div>
    );
  }

  // Se não estiver logado, exibe a tela de login para Administrador ou Representante
  if (!currentUser) {
    return <AuthScreen onLogin={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
      <Sidebar
        currentModule={currentModule}
        onSelectModule={(m) => {
          setCurrentModule(m);
          setLastUpdateStr(new Date().toLocaleTimeString('pt-BR'));
        }}
        isDemoMode={isDemoMode}
        onToggleDemo={handleToggleDemo}
        userRole={currentUser.perfil}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Navbar
          onNavigate={(m) => setCurrentModule(m)}
          onGlobalSearch={(term) => {
            if (term.trim()) {
              // Quick navigation filter helper
            }
          }}
          onQuickAction={handleQuickAction}
          lastUpdateStr={lastUpdateStr}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto bg-slate-950/60">
          {currentModule === 'dashboard' && <DashboardModule onNavigate={(m) => setCurrentModule(m)} lastUpdateStr={lastUpdateStr} />}
          {currentModule === 'empresa' && <EmpresaModule />}
          {currentModule === 'produtos' && <ProdutosModule />}
          {currentModule === 'representantes' && <RepresentantesModule />}
          {currentModule === 'clientes' && <ClientesModule />}
          {currentModule === 'pedidos' && <PedidosModule />}
          {currentModule === 'estoque' && <EstoqueModule />}
          {currentModule === 'vendas_historicas' && <VendasHistoricasModule />}
          {currentModule === 'notas_fiscais' && <NotasFiscaisModule />}
          {currentModule === 'contratos' && <ContratosModule />}
          {currentModule === 'comissoes' && <ComissoesModule />}
          {currentModule === 'recompra' && <RecompraModule />}
          {currentModule === 'whatsapp' && <WhatsAppModule />}
          {currentModule === 'tarefas' && <TarefasModule />}
          {currentModule === 'relatorios' && <RelatoriosModule />}
          {currentModule === 'anexos' && <AnexosModule onNavigate={(m) => setCurrentModule(m as any)} />}
          {currentModule === 'auditoria' && <AuditoriaModule />}
        </main>
      </div>
    </div>
  );
}
