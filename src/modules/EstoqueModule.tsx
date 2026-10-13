import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  FileSpreadsheet,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  X,
  History,
  TrendingDown,
  TrendingUp,
  Edit2,
  ArrowRight,
  Truck,
  RefreshCw,
  Building2,
  User,
  Users,
  Layers,
  Sparkles,
  Save,
  Package,
  FileText,
  MessageSquare,
  Copy,
  Send,
} from 'lucide-react';
import { queryAll, execute, persistDB, queryOne } from '../db/database';
import { MovimentoEstoque, Produto, Representante, Empresa } from '../types';
import { formatDate, formatCurrency } from '../utils/formatters';
import { exportToExcel } from '../utils/excelImport';
import { generateEstoqueRepresentantePDF, EstoqueRepItemReport } from '../utils/pdfGenerator';
import { getProductBoxPrice } from './PedidosModule';

// Helper to determine package type and labeling
export function getPackagingInfo(unidadeVenda?: string, fatorConversao: number = 1) {
  const uv = (unidadeVenda || '').trim();
  const fator = fatorConversao > 0 ? fatorConversao : 1;

  let tipo = 'Pacote';
  if (uv.toLowerCase().includes('fardo') || uv.toLowerCase().includes('fd')) {
    tipo = 'Fardo';
  } else if (uv.toLowerCase().includes('caixa') || uv.toLowerCase().includes('cx')) {
    tipo = 'Caixa';
  } else if (uv.toLowerCase().includes('pacote') || uv.toLowerCase().includes('pct')) {
    tipo = 'Pacote';
  }

  const sigla = tipo === 'Fardo' ? 'Fd' : tipo === 'Caixa' ? 'Cx' : 'Pct';
  const plural = tipo === 'Fardo' ? 'Fardos' : tipo === 'Caixa' ? 'Caixas' : 'Pacotes';

  return {
    tipo,
    sigla,
    plural,
    fator,
    descricaoCompleta: uv || `${tipo} c/ ${fator} un`,
  };
}

interface ProductStockSummary {
  produto: Produto;
  packaging: {
    tipo: string;
    plural: string;
    sigla: string;
    fator: number;
    descricaoCompleta: string;
  };
  // Stock in PACKAGES / BOXES (Primary business unit)
  saldoFabricaPacotes: number;
  saldoRepresentantesTotalPacotes: number;
  saldoTotalGeralPacotes: number;
  saldosPorRepPacotes: Record<string, number>;
  // Stock in loose units (secondary / converted)
  saldoFabricaUnidades: number;
  saldoRepresentantesTotalUnidades: number;
  saldoTotalGeralUnidades: number;
  saldosPorRepUnidades: Record<string, number>;
  // Minimum stock in packages
  estoqueMinimoPacotes: number;
}

export const EstoqueModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'fabrica' | 'representante' | 'comparativo' | 'movimentos'>('fabrica');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[]>([]);
  const [stockSummaries, setStockSummaries] = useState<ProductStockSummary[]>([]);

  const [selectedRepId, setSelectedRepId] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZeroRepStock, setHideZeroRepStock] = useState<boolean>(true);

  // Edit Stock Modal State (Focus on Packages/Boxes)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Produto | null>(null);
  const [editLocationType, setEditLocationType] = useState<'fabrica' | 'representante'>('fabrica');
  const [editRepId, setEditRepId] = useState<string>('');
  const [editMode, setEditMode] = useState<'set_total' | 'add' | 'subtract'>('set_total');
  const [editInputValue, setEditInputValue] = useState<string>('0'); // In packages/boxes!
  const [editMotivo, setEditMotivo] = useState('Ajuste de inventário físico');
  const [editResponsavel, setEditResponsavel] = useState('Administrador PraCasa');

  // Transfer Modal State (Fábrica <-> Representante)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferProduct, setTransferProduct] = useState<Produto | null>(null);
  const [transferDirection, setTransferDirection] = useState<'fabrica_to_rep' | 'rep_to_fabrica'>('fabrica_to_rep');
  const [transferRepId, setTransferRepId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<string>('10'); // In packages/boxes!
  const [transferMotivo, setTransferMotivo] = useState('Remessa para atendimento de pronta entrega');

  // WhatsApp Report Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppReportData, setWhatsAppReportData] = useState<{
    rep: Representante;
    phone: string;
    message: string;
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 1. Load active products
      const prodList = await queryAll<Produto>('SELECT * FROM produto ORDER BY nome ASC');
      setProdutos(prodList);

      // 2. Load active representatives
      const repList = await queryAll<Representante>("SELECT * FROM representante WHERE status = 'ativo' ORDER BY nome_razao ASC");
      setRepresentantes(repList);

      // Ensure representative locations exist in local_estoque
      for (const rep of repList) {
        await execute(
          `INSERT OR IGNORE INTO local_estoque (id, nome, tipo, responsavel_id, descricao)
           VALUES (?, ?, 'Estoque Representante', ?, ?)`,
          [`loc_rep_${rep.id}`, `Estoque - ${rep.nome_razao}`, rep.id, `Mercadorias em posse de ${rep.nome_razao}`]
        );
      }
      await execute(
        `INSERT OR IGNORE INTO local_estoque (id, nome, tipo, descricao)
         VALUES ('loc_rep', 'Estoque em Posse de Representante (Geral)', 'Estoque Representante', 'Estoque consolidado de representantes')`
      );

      // 3. Load all movements
      const movSql = `
        SELECT m.*, p.nome as produto_nome, p.sku as produto_sku
        FROM movimento_estoque m
        LEFT JOIN produto p ON m.produto_id = p.id
        ORDER BY m.data_movimento DESC
      `;
      const movList = await queryAll<MovimentoEstoque>(movSql);
      setMovimentos(movList);

      // 4. Compute balances in units and in packages/boxes
      const unitsMap: Record<
        string,
        {
          fabrica: number;
          repsTotal: number;
          repsByRep: Record<string, number>;
        }
      > = {};

      for (const p of prodList) {
        unitsMap[p.id] = {
          fabrica: 0,
          repsTotal: 0,
          repsByRep: {},
        };
      }

      for (const m of movList) {
        const item = unitsMap[m.produto_id];
        if (!item) continue;

        const qtyBase = Number(m.quantidade_base) || 0;

        // Entry into Factory (+)
        if (m.local_destino_id === 'loc_fabrica') {
          item.fabrica += qtyBase;
        }
        // Exit from Factory (-)
        if (m.local_origem_id === 'loc_fabrica') {
          item.fabrica -= qtyBase;
        }

        // Entry into Representative (+)
        if (m.local_destino_id && m.local_destino_id.startsWith('loc_rep')) {
          item.repsTotal += qtyBase;
          const repKey = m.local_destino_id === 'loc_rep' ? 'geral' : m.local_destino_id.replace('loc_rep_', '');
          item.repsByRep[repKey] = (item.repsByRep[repKey] || 0) + qtyBase;
        }
        // Exit from Representative (-)
        if (m.local_origem_id && m.local_origem_id.startsWith('loc_rep')) {
          item.repsTotal -= qtyBase;
          const repKey = m.local_origem_id === 'loc_rep' ? 'geral' : m.local_origem_id.replace('loc_rep_', '');
          item.repsByRep[repKey] = (item.repsByRep[repKey] || 0) - qtyBase;
        }
      }

      // Convert to package summaries
      const list: ProductStockSummary[] = [];
      for (const p of prodList) {
        const item = unitsMap[p.id];
        const pkg = getPackagingInfo(p.unidade_venda, p.fator_conversao_estoque || 1);
        const fator = pkg.fator;

        const saldoFabricaUnidades = item.fabrica;
        const saldoRepresentantesTotalUnidades = item.repsTotal;
        const saldoTotalGeralUnidades = saldoFabricaUnidades + saldoRepresentantesTotalUnidades;

        // Packages/Boxes balance:
        const saldoFabricaPacotes = Math.round((saldoFabricaUnidades / fator) * 100) / 100;
        const saldoRepresentantesTotalPacotes = Math.round((saldoRepresentantesTotalUnidades / fator) * 100) / 100;
        const saldoTotalGeralPacotes = Math.round((saldoTotalGeralUnidades / fator) * 100) / 100;

        const saldosPorRepPacotes: Record<string, number> = {};
        for (const [rKey, uVal] of Object.entries(item.repsByRep)) {
          saldosPorRepPacotes[rKey] = Math.round((uVal / fator) * 100) / 100;
        }

        // Minimum stock in packages
        const estoqueMinimoPacotes =
          p.estoque_minimo > fator ? Math.round(p.estoque_minimo / fator) : p.estoque_minimo || 2;

        list.push({
          produto: p,
          packaging: pkg,
          saldoFabricaPacotes,
          saldoRepresentantesTotalPacotes,
          saldoTotalGeralPacotes,
          saldosPorRepPacotes,
          saldoFabricaUnidades,
          saldoRepresentantesTotalUnidades,
          saldoTotalGeralUnidades,
          saldosPorRepUnidades: item.repsByRep,
          estoqueMinimoPacotes,
        });
      }

      setStockSummaries(list);
    } catch (err) {
      console.error('Erro ao carregar dados de estoque:', err);
    }
  };

  // Open Edit Stock Modal for Factory or Representative (in Packages/Boxes!)
  const handleOpenEditStock = (prod: Produto, locType: 'fabrica' | 'representante', repId?: string) => {
    setEditProduct(prod);
    setEditLocationType(locType);

    const targetRep = repId || (selectedRepId !== 'todos' ? selectedRepId : representantes[0]?.id || 'geral');
    setEditRepId(targetRep);

    const summary = stockSummaries.find((s) => s.produto.id === prod.id);
    let currentInPackages = 0;
    if (locType === 'fabrica') {
      currentInPackages = summary?.saldoFabricaPacotes || 0;
    } else {
      currentInPackages = summary?.saldosPorRepPacotes[targetRep] || 0;
    }

    setEditMode('set_total');
    setEditInputValue(String(currentInPackages));
    setEditMotivo('Ajuste de inventário físico');
    setShowEditModal(true);
  };

  // Open Transfer Modal between Factory and Representative (in Packages/Boxes!)
  const handleOpenTransfer = (prod: Produto, direction: 'fabrica_to_rep' | 'rep_to_fabrica', repId?: string) => {
    setTransferProduct(prod);
    setTransferDirection(direction);
    setTransferRepId(repId || (selectedRepId !== 'todos' ? selectedRepId : representantes[0]?.id || ''));
    setTransferQty('10'); // 10 packages
    setTransferMotivo(
      direction === 'fabrica_to_rep'
        ? 'Remessa da fábrica para pronta entrega do representante'
        : 'Devolução de mercadoria do representante para estoque central'
    );
    setShowTransferModal(true);
  };

  // Save Direct Stock Adjustment (in Packages/Boxes)
  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    const summary = stockSummaries.find((s) => s.produto.id === editProduct.id);
    const pkg = summary?.packaging || getPackagingInfo(editProduct.unidade_venda, editProduct.fator_conversao_estoque || 1);
    const fator = pkg.fator;

    const targetRepKey = editLocationType === 'representante' ? editRepId : '';
    const currentPackages =
      editLocationType === 'fabrica'
        ? summary?.saldoFabricaPacotes || 0
        : summary?.saldosPorRepPacotes[targetRepKey] || 0;

    const inputNumberPackages = parseFloat(editInputValue) || 0;
    let targetNewPackages = currentPackages;

    if (editMode === 'set_total') {
      targetNewPackages = inputNumberPackages;
    } else if (editMode === 'add') {
      targetNewPackages = currentPackages + inputNumberPackages;
    } else if (editMode === 'subtract') {
      targetNewPackages = currentPackages - inputNumberPackages;
    }

    const diffPackages = targetNewPackages - currentPackages;
    if (diffPackages === 0) {
      alert(`O saldo de ${targetNewPackages} ${pkg.plural} é idêntico ao saldo atual. Nenhuma alteração necessária.`);
      setShowEditModal(false);
      return;
    }

    const diffUnits = diffPackages * fator;
    const now = new Date().toISOString();
    const targetLocId =
      editLocationType === 'fabrica'
        ? 'loc_fabrica'
        : editRepId && editRepId !== 'geral'
        ? `loc_rep_${editRepId}`
        : 'loc_rep';

    const locationName =
      editLocationType === 'fabrica'
        ? 'Fábrica / Depósito Central'
        : `Representante (${representantes.find((r) => r.id === editRepId)?.nome_razao || 'Geral'})`;

    try {
      if (diffUnits > 0) {
        // Positive adjustment (Entry)
        await execute(
          `INSERT INTO movimento_estoque (
            id, produto_id, local_origem_id, local_destino_id, quantidade_original,
            unidade_original, quantidade_base, data_movimento, tipo_movimento, responsavel, motivo, created_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'Ajuste Inventário', ?, ?, ?)`,
          [
            `mov_adj_${Date.now()}`,
            editProduct.id,
            targetLocId,
            diffPackages,
            pkg.descricaoCompleta,
            diffUnits,
            now,
            editResponsavel || 'Administrador PraCasa',
            `Ajuste de Estoque (+${diffPackages} ${pkg.plural} / +${diffUnits} un) em ${locationName}. Motivo: ${editMotivo}`,
            now,
          ]
        );
      } else {
        // Negative adjustment (Exit)
        const absDiffPackages = Math.abs(diffPackages);
        const absDiffUnits = Math.abs(diffUnits);
        await execute(
          `INSERT INTO movimento_estoque (
            id, produto_id, local_origem_id, local_destino_id, quantidade_original,
            unidade_original, quantidade_base, data_movimento, tipo_movimento, responsavel, motivo, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, 'Ajuste Inventário', ?, ?, ?)`,
          [
            `mov_adj_${Date.now()}`,
            editProduct.id,
            targetLocId,
            absDiffPackages,
            pkg.descricaoCompleta,
            absDiffUnits,
            now,
            editResponsavel || 'Administrador PraCasa',
            `Ajuste de Estoque (-${absDiffPackages} ${pkg.plural} / -${absDiffUnits} un) em ${locationName}. Motivo: ${editMotivo}`,
            now,
          ]
        );
      }

      await persistDB();
      setShowEditModal(false);
      await loadData();
      alert(
        `Estoque de "${editProduct.nome}" ajustado com sucesso para ${targetNewPackages} ${pkg.plural} (${targetNewPackages * fator} unidades)!`
      );
    } catch (err: any) {
      alert(`Erro ao salvar ajuste de estoque: ${err.message}`);
    }
  };

  // Save Transfer between Factory and Representative (in Packages/Boxes)
  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferProduct) return;

    const qtyPackages = parseFloat(transferQty) || 0;
    if (qtyPackages <= 0) {
      alert('Informe uma quantidade de pacotes/caixas válida maior que zero.');
      return;
    }

    if (!transferRepId) {
      alert('Selecione o representante comercial.');
      return;
    }

    const summary = stockSummaries.find((s) => s.produto.id === transferProduct.id);
    const pkg = summary?.packaging || getPackagingInfo(transferProduct.unidade_venda, transferProduct.fator_conversao_estoque || 1);
    const fator = pkg.fator;
    const qtyUnits = qtyPackages * fator;

    const repName = representantes.find((r) => r.id === transferRepId)?.nome_razao || 'Representante';
    const repLocId = `loc_rep_${transferRepId}`;

    if (transferDirection === 'fabrica_to_rep') {
      const saldoFabricaPackages = summary?.saldoFabricaPacotes || 0;
      if (qtyPackages > saldoFabricaPackages) {
        if (
          !confirm(
            `Atenção: A quantidade informada (${qtyPackages} ${pkg.plural}) é maior que o saldo atual da fábrica (${saldoFabricaPackages} ${pkg.plural}). Deseja prosseguir mesmo assim?`
          )
        ) {
          return;
        }
      }
    } else {
      const saldoRepPackages = summary?.saldosPorRepPacotes[transferRepId] || 0;
      if (qtyPackages > saldoRepPackages) {
        if (
          !confirm(
            `Atenção: A quantidade informada (${qtyPackages} ${pkg.plural}) é maior que o saldo com o representante (${saldoRepPackages} ${pkg.plural}). Deseja prosseguir mesmo assim?`
          )
        ) {
          return;
        }
      }
    }

    const now = new Date().toISOString();

    try {
      if (transferDirection === 'fabrica_to_rep') {
        // Fábrica -> Representante
        await execute(
          `INSERT INTO movimento_estoque (
            id, produto_id, local_origem_id, local_destino_id, quantidade_original,
            unidade_original, quantidade_base, data_movimento, tipo_movimento, responsavel, motivo, created_at
          ) VALUES (?, ?, 'loc_fabrica', ?, ?, ?, ?, ?, 'Transferência Enviada', 'Administrador PraCasa', ?, ?)`,
          [
            `mov_transf_${Date.now()}`,
            transferProduct.id,
            repLocId,
            qtyPackages,
            pkg.descricaoCompleta,
            qtyUnits,
            now,
            `Transferência da Fábrica para ${repName} (${qtyPackages} ${pkg.plural} = ${qtyUnits} un). Motivo: ${transferMotivo}`,
            now,
          ]
        );
      } else {
        // Representante -> Fábrica (Devolução)
        await execute(
          `INSERT INTO movimento_estoque (
            id, produto_id, local_origem_id, local_destino_id, quantidade_original,
            unidade_original, quantidade_base, data_movimento, tipo_movimento, responsavel, motivo, created_at
          ) VALUES (?, ?, ?, 'loc_fabrica', ?, ?, ?, ?, 'Devolução', 'Administrador PraCasa', ?, ?)`,
          [
            `mov_transf_${Date.now()}`,
            transferProduct.id,
            repLocId,
            qtyPackages,
            pkg.descricaoCompleta,
            qtyUnits,
            now,
            `Devolução de ${repName} para Fábrica Central (${qtyPackages} ${pkg.plural} = ${qtyUnits} un). Motivo: ${transferMotivo}`,
            now,
          ]
        );
      }

      await persistDB();
      setShowTransferModal(false);
      await loadData();
      alert(`Transferência de ${qtyPackages} ${pkg.plural} (${qtyUnits} unidades) realizada com sucesso!`);
    } catch (err: any) {
      alert(`Erro na transferência: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    const exportData = stockSummaries.map((s) => ({
      SKU: s.produto.sku,
      Produto: s.produto.nome,
      Categoria: s.produto.categoria,
      'Embalagem Padrão': s.packaging.descricaoCompleta,
      'Unidades por Pacote/Caixa': s.packaging.fator,
      'Estoque Fábrica (Pacotes/Caixas)': s.saldoFabricaPacotes,
      'Estoque Fábrica (Unidades)': s.saldoFabricaUnidades,
      'Com Representantes (Pacotes/Caixas)': s.saldoRepresentantesTotalPacotes,
      'Com Representantes (Unidades)': s.saldoRepresentantesTotalUnidades,
      'Estoque Total Geral (Pacotes/Caixas)': s.saldoTotalGeralPacotes,
      'Estoque Total Geral (Unidades)': s.saldoTotalGeralUnidades,
      'Estoque Mínimo (Pacotes/Caixas)': s.estoqueMinimoPacotes,
      Situação: s.saldoTotalGeralPacotes <= s.estoqueMinimoPacotes ? 'Abaixo do Mínimo' : 'Normal',
    }));
    exportToExcel(exportData, 'controle_estoque_pacotes_pracasa');
  };

  const getRepresentativeReportData = () => {
    if (selectedRepId === 'todos') {
      return null;
    }
    const rep = representantes.find((r) => r.id === selectedRepId);
    if (!rep) return null;

    let totalGeralCaixas = 0;
    let totalGeralAvulsas = 0;
    let totalGeralUnidades = 0;
    let valorTotalEstoque = 0;

    const items: EstoqueRepItemReport[] = [];

    for (const s of stockSummaries) {
      const units = s.saldosPorRepUnidades[selectedRepId] || 0;
      if (units <= 0) continue;

      const fator = s.packaging.fator || 1;
      const fullBoxes = Math.floor(units / fator);
      const looseUnits = Math.round(units % fator);
      const precoCaixa = getProductBoxPrice(s.produto);
      const precoUnit = Number(s.produto.preco_tabela) || (fator > 0 ? precoCaixa / fator : 0);
      const valItem = Math.round(((fullBoxes * precoCaixa) + (looseUnits * precoUnit)) * 100) / 100;

      totalGeralCaixas += fullBoxes;
      totalGeralAvulsas += looseUnits;
      totalGeralUnidades += units;
      valorTotalEstoque += valItem;

      items.push({
        produto_sku: s.produto.sku,
        produto_nome: s.produto.nome,
        categoria: s.produto.categoria,
        embalagem: s.packaging.descricaoCompleta,
        fator,
        caixasFechadas: fullBoxes,
        unidadesAvulsas: looseUnits,
        totalUnidades: units,
        caixasEquivalentes: s.saldosPorRepPacotes[selectedRepId] || 0,
        precoUnitario: precoUnit,
        precoCaixa,
        valorTotalEstoque: valItem,
      });
    }

    return {
      rep,
      items,
      totalGeralCaixas,
      totalGeralAvulsas,
      totalGeralUnidades,
      valorTotalEstoque: Math.round(valorTotalEstoque * 100) / 100,
    };
  };

  const handleExportRepStockPDF = async () => {
    if (selectedRepId === 'todos') {
      alert('Por favor, selecione um Representante específico no filtro para baixar o relatório de conferência.');
      return;
    }
    const reportData = getRepresentativeReportData();
    if (!reportData || reportData.items.length === 0) {
      alert('Nenhum item com saldo em estoque encontrado para este representante.');
      return;
    }

    try {
      const empresa = ((await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1')) || {
        id: 'emp_1',
        razao_social: 'TEMPERO PRACASA LTDA',
        nome_fantasia: 'TEMPERO PRACASA',
        cnpj: '04.093.110/0001-04',
        inscricao_estadual: 'ISENTO',
        endereco: 'Rua Antônio Rodrigues, nº 05, Barra do Pojuca, Camaçari/BA - CEP 42840-000',
        telefone: '(71) 3624-0000',
        email: 'contato@temperopracasa.com.br',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }) as Empresa;

      const pdf = generateEstoqueRepresentantePDF(
        reportData.rep,
        empresa,
        reportData.items,
        reportData.totalGeralCaixas,
        reportData.totalGeralAvulsas,
        reportData.totalGeralUnidades,
        reportData.valorTotalEstoque
      );

      pdf.save(`Relatorio_Estoque_${reportData.rep.nome_razao.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(`Erro ao gerar PDF de estoque: ${err.message}`);
    }
  };

  const buildWhatsAppMessage = (
    rep: Representante,
    items: EstoqueRepItemReport[],
    totalGeralCaixas: number,
    totalGeralAvulsas: number,
    totalGeralUnidades: number,
    valorTotalEstoque: number
  ) => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');

    const lines: string[] = [
      `*TEMPERO PRACASA - CONFERÊNCIA DE ESTOQUE*`,
      `Olá, *${rep.nome_razao}*!`,
      `Segue a relação do seu estoque em posse nesta data (${dataHoje}) para conferência física:`,
      ``,
      `----------------------------------------`,
      `📦 *PRODUTOS EM SEU ESTOQUE:*`,
      `----------------------------------------`,
    ];

    items.forEach((item, idx) => {
      let saldoFormatado = '';
      if (item.caixasFechadas > 0 && item.unidadesAvulsas > 0) {
        saldoFormatado = `${item.caixasFechadas} cx + ${item.unidadesAvulsas} un avulsas`;
      } else if (item.caixasFechadas > 0) {
        saldoFormatado = `${item.caixasFechadas} cx fechada${item.caixasFechadas > 1 ? 's' : ''}`;
      } else {
        saldoFormatado = `${item.unidadesAvulsas} un avulsa${item.unidadesAvulsas > 1 ? 's' : ''}`;
      }

      lines.push(`${idx + 1}. *${item.produto_nome}* (${item.produto_sku})`);
      lines.push(`   - Saldo: *${saldoFormatado}* (${item.totalUnidades} un)`);
      lines.push(`   - Valor: *${formatCurrency(item.valorTotalEstoque)}*`);
      lines.push(``);
    });

    lines.push(`----------------------------------------`);
    lines.push(`📊 *RESUMO GERAL:*`);
    lines.push(`- *Caixas Fechadas:* ${totalGeralCaixas} cx`);
    if (totalGeralAvulsas > 0) {
      lines.push(`- *Unidades Avulsas:* ${totalGeralAvulsas} un`);
    }
    lines.push(`- *Volume Físico Total:* ${totalGeralUnidades} unidades`);
    lines.push(`💰 *VALOR TOTAL:* *${formatCurrency(valorTotalEstoque)}*`);
    lines.push(`----------------------------------------`);
    lines.push(``);
    lines.push(`📄 *Relatório formal em PDF anexado para conferência detalhada e assinatura.*`);
    lines.push(`_Por favor, realize a conferência física e nos confirme se os saldos conferem!_ 🤝`);

    return lines.join('\n');
  };

  const handleSendRepStockWhatsApp = () => {
    if (selectedRepId === 'todos') {
      alert('Por favor, selecione um Representante específico no filtro para enviar o relatório pelo WhatsApp.');
      return;
    }
    const reportData = getRepresentativeReportData();
    if (!reportData || reportData.items.length === 0) {
      alert('Nenhum item com saldo em estoque encontrado para este representante.');
      return;
    }

    const { rep, items, totalGeralCaixas, totalGeralAvulsas, totalGeralUnidades, valorTotalEstoque } = reportData;
    const rawDigits = (rep.whatsapp || rep.telefone || '').replace(/\D/g, '');
    const cleanPhone = rawDigits.length === 10 || rawDigits.length === 11 ? rawDigits : (rawDigits.length > 11 ? rawDigits.slice(-11) : rawDigits);

    const message = buildWhatsAppMessage(
      rep,
      items,
      totalGeralCaixas,
      totalGeralAvulsas,
      totalGeralUnidades,
      valorTotalEstoque
    );

    setWhatsAppReportData({
      rep,
      phone: cleanPhone,
      message,
    });
    setCopiedSuccess(false);
    setShowWhatsAppModal(true);
  };

  // Abre o WhatsApp com a conversa aberta e o texto 100% organizado no Clipboard para Ctrl+V
  const handleCopyAndOpenWhatsApp = () => {
    if (!whatsAppReportData) return;
    const digits = whatsAppReportData.phone.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      alert('Por favor, informe um número de telefone com DDD válido (ex: 75991975453).');
      return;
    }
    const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;

    // Baixa o PDF oficial
    handleExportRepStockPDF();

    // Copia o texto 100% organizado para a área de transferência
    try {
      navigator.clipboard.writeText(whatsAppReportData.message);
    } catch {
      // ignore
    }
    setCopiedSuccess(true);

    // Abre a conversa de forma limpa no WhatsApp Web para receber o Ctrl+V
    const url = `https://web.whatsapp.com/send?phone=${fullPhone}`;
    window.open(url, '_blank');
  };

  // Abre tentando pré-carregar via URL
  const handleOpenWithUrlPreload = () => {
    if (!whatsAppReportData) return;
    const digits = whatsAppReportData.phone.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      alert('Por favor, informe um número de telefone com DDD válido (ex: 75991975453).');
      return;
    }
    const fullPhone = digits.startsWith('55') ? digits : `55${digits}`;

    handleExportRepStockPDF();

    try {
      navigator.clipboard.writeText(whatsAppReportData.message);
    } catch {
      // ignore
    }
    setCopiedSuccess(true);

    const encoded = encodeURIComponent(whatsAppReportData.message);
    const url = `https://web.whatsapp.com/send?phone=${fullPhone}&text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleCopyWhatsAppMessage = async () => {
    if (!whatsAppReportData) return;
    try {
      await navigator.clipboard.writeText(whatsAppReportData.message);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = whatsAppReportData.message;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    }
  };

  // Filtered list by search
  const filteredSummaries = stockSummaries.filter((s) => {
    const matchesSearch =
      s.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.produto.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.produto.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.packaging.descricaoCompleta.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Filtered list specifically for Representative Stock
  const repFilteredSummaries = stockSummaries.filter((s) => {
    const matchesSearch =
      s.produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.produto.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.produto.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.packaging.descricaoCompleta.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (hideZeroRepStock) {
      const saldo =
        selectedRepId === 'todos'
          ? s.saldoRepresentantesTotalPacotes
          : s.saldosPorRepPacotes[selectedRepId] || 0;
      return saldo > 0;
    }

    return true;
  });

  // KPI Calculations in Packages/Boxes & Units
  const totalFabricaPackages = stockSummaries.reduce((acc, curr) => acc + curr.saldoFabricaPacotes, 0);
  const totalFabricaUnits = stockSummaries.reduce((acc, curr) => acc + curr.saldoFabricaUnidades, 0);

  const totalRepPackages = stockSummaries.reduce((acc, curr) => acc + curr.saldoRepresentantesTotalPacotes, 0);
  const totalRepUnits = stockSummaries.reduce((acc, curr) => acc + curr.saldoRepresentantesTotalUnidades, 0);

  const totalGeralPackages = stockSummaries.reduce((acc, curr) => acc + curr.saldoTotalGeralPacotes, 0);
  const totalGeralUnits = stockSummaries.reduce((acc, curr) => acc + curr.saldoTotalGeralUnidades, 0);

  const lowStockCount = stockSummaries.filter((s) => s.saldoTotalGeralPacotes <= s.estoqueMinimoPacotes).length;

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            Controle de Estoque em Pacotes & Caixas
          </h2>
          <p className="text-xs text-slate-400">
            Foco operacional em embalagens fechadas de atacado (ex: 1 pct = 12 un, caixas de 24 un, fardos de 30 un). Separação entre Fábrica e Representantes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              if (confirm('Deseja sincronizar o Estoque Local da Fábrica com as 206 caixas (12 produtos informados)?')) {
                const { applyOfficialStock } = await import('../db/seed');
                await applyOfficialStock();
                await loadData();
                alert('Estoque Local da Fábrica alimentado com sucesso com as 206 caixas!');
              }
            }}
            className="btn-secondary text-xs flex items-center gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            title="Sincronizar estoque físico inicial informado"
          >
            <Boxes className="w-4 h-4 text-amber-400" />
            <span>Alimentar Estoque Oficial (12 Itens)</span>
          </button>

          <button
            onClick={() => {
              if (produtos.length > 0) handleOpenTransfer(produtos[0], 'fabrica_to_rep');
            }}
            className="btn-secondary text-xs flex items-center gap-1.5 hover:border-amber-500/50"
          >
            <Truck className="w-4 h-4 text-amber-400" />
            <span>Transferir Pacotes Fábrica ↔ Representante</span>
          </button>

          <button onClick={handleExportExcel} className="btn-secondary text-xs flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>

          <button onClick={() => loadData()} className="btn-secondary text-xs flex items-center gap-1.5" title="Recarregar dados">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Cards (Focused in Packages/Boxes!) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Estoque Fábrica</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-amber-400 font-mono">{totalFabricaPackages.toLocaleString('pt-BR')}</span>
              <span className="text-xs text-slate-300 font-semibold">cx/pct</span>
            </div>
            <span className="text-[10px] text-slate-500 block">≈ {totalFabricaUnits.toLocaleString('pt-BR')} unidades</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Com Representantes</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-indigo-400 font-mono">{totalRepPackages.toLocaleString('pt-BR')}</span>
              <span className="text-xs text-slate-300 font-semibold">cx/pct</span>
            </div>
            <span className="text-[10px] text-slate-500 block">≈ {totalRepUnits.toLocaleString('pt-BR')} unidades</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Estoque Total PraCasa</span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-extrabold text-emerald-400 font-mono">{totalGeralPackages.toLocaleString('pt-BR')}</span>
              <span className="text-xs text-slate-300 font-semibold">cx/pct</span>
            </div>
            <span className="text-[10px] text-slate-500 block">≈ {totalGeralUnits.toLocaleString('pt-BR')} unidades</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block font-medium">Abaixo do Mínimo</span>
            <span className="text-lg font-extrabold text-rose-400 font-mono">{lowStockCount}</span>
            <span className="text-[10px] text-slate-500 block">produtos em nível crítico</span>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('fabrica')}
          className={`py-2.5 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'fabrica'
              ? 'border-amber-500 text-amber-400 bg-amber-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>🏭 Estoque da Fábrica</span>
          <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full text-[10px]">
            {totalFabricaPackages} cx/pct
          </span>
        </button>

        <button
          onClick={() => setActiveTab('representante')}
          className={`py-2.5 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'representante'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>👤 Estoque dos Representantes</span>
          <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px]">
            {totalRepPackages} cx/pct
          </span>
        </button>

        <button
          onClick={() => setActiveTab('comparativo')}
          className={`py-2.5 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'comparativo'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>📊 Comparativo Geral (Fábrica vs Representante)</span>
        </button>

        <button
          onClick={() => setActiveTab('movimentos')}
          className={`py-2.5 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
            activeTab === 'movimentos'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
          }`}
        >
          <History className="w-4 h-4" />
          <span>📜 Histórico de Movimentações</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por produto, SKU, categoria ou embalagem (ex: 12 un, 24 un)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        {/* Representative Filter dropdown for representative tab */}
        {activeTab === 'representante' && (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Filtrar Representante:</span>
              <select
                value={selectedRepId}
                onChange={(e) => setSelectedRepId(e.target.value)}
                className="input-field !py-1.5 text-xs font-semibold"
              >
                <option value="todos">Todos os Representantes (Consolidado)</option>
                {representantes.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.nome_razao} ({rep.codigo})
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-slate-900 border border-slate-800 hover:border-indigo-500/40 px-2.5 py-1.5 rounded-lg select-none transition-all">
              <input
                type="checkbox"
                checked={hideZeroRepStock}
                onChange={(e) => setHideZeroRepStock(e.target.checked)}
                className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span className="font-medium text-slate-200">Apenas itens em estoque</span>
            </label>
          </div>
        )}
      </div>

      {/* TAB 1: ESTOQUE DA FÁBRICA (Foco em Pacotes/Caixas) */}
      {activeTab === 'fabrica' && (
        <div className="glass-panel overflow-hidden rounded-xl space-y-0">
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Estoque Armazenado na Fábrica — Contagem em Pacotes & Caixas
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              {filteredSummaries.length} produtos • Estoque apurado em <strong>caixas/pacotes fechados</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Embalagem Padrão</th>
                  <th className="p-3">Saldo Fábrica (Pacotes / Caixas)</th>
                  <th className="p-3">Estoque Mínimo</th>
                  <th className="p-3">Situação</th>
                  <th className="p-3 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((s) => {
                    const isLow = s.saldoFabricaPacotes <= s.estoqueMinimoPacotes;
                    const isZero = s.saldoFabricaPacotes <= 0;

                    return (
                      <tr key={s.produto.id} className="hover:bg-slate-800/40 transition-all group">
                        <td className="p-3 font-mono font-bold text-amber-400">{s.produto.sku}</td>
                        <td className="p-3 font-medium text-slate-100">
                          <div>
                            <span className="font-bold text-slate-100">{s.produto.nome}</span>
                            <span className="text-[10px] text-slate-400 block">{s.produto.categoria}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-medium text-slate-300">
                            {s.packaging.descricaoCompleta}
                          </span>
                        </td>
                        <td className="p-3 font-mono">
                          {(() => {
                            const fator = s.packaging.fator || 1;
                            const fullBoxes = Math.floor(s.saldoFabricaUnidades / fator);
                            const looseUnits = Math.round(s.saldoFabricaUnidades % fator);
                            const hasLoose = fator > 1 && looseUnits > 0;

                            return (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {fullBoxes > 0 && (
                                    <span className="font-extrabold text-sm text-amber-400">
                                      {fullBoxes} {fullBoxes === 1 ? s.packaging.tipo : s.packaging.plural}
                                    </span>
                                  )}
                                  {hasLoose && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                      +{looseUnits} un avulsa{looseUnits > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {fullBoxes === 0 && !hasLoose && (
                                    <span className="font-bold text-sm text-slate-500">0 Caixas</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Total: <strong className="text-slate-200">{s.saldoFabricaUnidades} un</strong> {hasLoose ? `(${s.saldoFabricaPacotes} cx)` : `(100% lacradas)`}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          <span className="font-semibold text-slate-300">{s.estoqueMinimoPacotes} {s.packaging.plural}</span>
                          <span className="text-[10px] text-slate-500 block">({s.estoqueMinimoPacotes * s.packaging.fator} un)</span>
                        </td>
                        <td className="p-3">
                          {isZero ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
                              <AlertTriangle className="w-3 h-3" /> ZERADO
                            </span>
                          ) : isLow ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-max">
                              <AlertTriangle className="w-3 h-3" /> BAIXO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
                              <CheckCircle className="w-3 h-3" /> NORMAL
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditStock(s.produto, 'fabrica')}
                              className="btn-primary !py-1 !px-2.5 text-[11px] flex items-center gap-1 shadow-sm"
                              title={`Editar saldo em ${s.packaging.plural}`}
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar Estoque</span>
                            </button>

                            <button
                              onClick={() => handleOpenTransfer(s.produto, 'fabrica_to_rep')}
                              className="btn-secondary !py-1 !px-2 text-[11px] flex items-center gap-1 hover:border-indigo-500/50"
                              title={`Enviar ${s.packaging.plural} da fábrica para representante`}
                            >
                              <Truck className="w-3 h-3 text-indigo-400" />
                              <span>Enviar p/ Rep</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ESTOQUE DOS REPRESENTANTES (Foco em Pacotes/Caixas) */}
      {activeTab === 'representante' && (
        <div className="glass-panel overflow-hidden rounded-xl space-y-0">
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Mercadorias com Representantes Comerciais (Pacotes / Caixas)
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const repReport = selectedRepId !== 'todos' ? getRepresentativeReportData() : null;
                return (
                  <>
                    {repReport && repReport.items.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
                        <span className="text-[10px] text-slate-400">Total em Posse:</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          {formatCurrency(repReport.valorTotalEstoque)}
                        </span>
                      </div>
                    )}

                    {selectedRepId !== 'todos' ? (
                      <>
                        <button
                          onClick={handleExportRepStockPDF}
                          className="btn-secondary text-xs !py-1 !px-2.5 flex items-center gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 shadow-sm"
                          title="Baixar relatório oficial de conferência em PDF para conferir/assinar com o representante"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>Baixar Relatório (PDF)</span>
                        </button>

                        <button
                          onClick={handleSendRepStockWhatsApp}
                          className="btn-secondary text-xs !py-1 !px-2.5 flex items-center gap-1.5 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 shadow-sm"
                          title="Enviar conferência de estoque detalhada diretamente no WhatsApp do representante"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Enviar WhatsApp</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => alert('Selecione um representante específico no filtro "Filtrar Representante" acima para baixar o relatório de conferência em PDF ou enviar pelo WhatsApp.')}
                        className="btn-secondary text-xs !py-1 !px-2.5 flex items-center gap-1.5 text-slate-400 border-slate-800 hover:text-slate-200"
                        title="Selecione um representante no filtro para emitir o relatório"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>Relatório de Estoque Rep</span>
                      </button>
                    )}
                  </>
                );
              })()}

              <button
                onClick={() => {
                  if (produtos.length > 0)
                    handleOpenTransfer(produtos[0], 'fabrica_to_rep', selectedRepId !== 'todos' ? selectedRepId : undefined);
                }}
                className="btn-primary text-xs !py-1 !px-2.5 flex items-center gap-1.5 shadow-indigo-500/20"
                title="Transferir produtos da fábrica para o representante"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>+ Enviar Mercadoria</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Representante Responsável</th>
                  <th className="p-3">Embalagem Padrão</th>
                  <th className="p-3">Saldo com Representante</th>
                  <th className="p-3 text-right">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {repFilteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500">
                      <div className="max-w-md mx-auto space-y-2">
                        <Users className="w-10 h-10 mx-auto text-slate-600 mb-1" />
                        <p className="font-bold text-sm text-slate-300">
                          {selectedRepId !== 'todos'
                            ? `Nenhum produto em estoque com ${representantes.find((r) => r.id === selectedRepId)?.nome_razao || 'este representante'}.`
                            : 'Nenhum representante possui produtos em estoque no momento.'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {hideZeroRepStock
                            ? 'Apenas itens com saldo positivo estão sendo exibidos. Desmarque "Apenas itens em estoque" se desejar ver o catálogo completo.'
                            : 'Nenhum produto encontrado com os filtros atuais.'}
                        </p>
                        <button
                          onClick={() => {
                            if (produtos.length > 0)
                              handleOpenTransfer(produtos[0], 'fabrica_to_rep', selectedRepId !== 'todos' ? selectedRepId : undefined);
                          }}
                          className="btn-primary text-xs !py-1.5 !px-3 mx-auto mt-2 flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Transferir Mercadoria da Fábrica</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  repFilteredSummaries.map((s) => {
                    const saldoRepPackages =
                      selectedRepId === 'todos'
                        ? s.saldoRepresentantesTotalPacotes
                        : s.saldosPorRepPacotes[selectedRepId] || 0;

                    const saldoRepUnits =
                      selectedRepId === 'todos'
                        ? s.saldoRepresentantesTotalUnidades
                        : s.saldosPorRepUnidades[selectedRepId] || 0;

                    const repObj = representantes.find((r) => r.id === selectedRepId);
                    const repLabel =
                      selectedRepId === 'todos'
                        ? 'Todos os Representantes'
                        : repObj?.nome_razao || 'Representante';

                    return (
                      <tr key={s.produto.id} className="hover:bg-slate-800/40 transition-all">
                        <td className="p-3 font-mono font-bold text-amber-400">{s.produto.sku}</td>
                        <td className="p-3 font-medium text-slate-100">
                          <div>
                            <span className="font-bold text-slate-100">{s.produto.nome}</span>
                            <span className="text-[10px] text-slate-400 block">{s.produto.categoria}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {repLabel}
                          </span>
                        </td>
                        <td className="p-3 text-slate-300">
                          {s.packaging.descricaoCompleta}
                        </td>
                        <td className="p-3 font-mono">
                          {(() => {
                            const fator = s.packaging.fator || 1;
                            const fullBoxes = Math.floor(saldoRepUnits / fator);
                            const looseUnits = Math.round(saldoRepUnits % fator);
                            const hasLoose = fator > 1 && looseUnits > 0;

                            return (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {fullBoxes > 0 && (
                                    <span className="font-extrabold text-sm text-indigo-400">
                                      {fullBoxes} {fullBoxes === 1 ? s.packaging.tipo : s.packaging.plural}
                                    </span>
                                  )}
                                  {hasLoose && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm" title="Unidades avulsas decorrentes de fracionamento ou venda a granel">
                                      +{looseUnits} un avulsa{looseUnits > 1 ? 's' : ''} (A Granel)
                                    </span>
                                  )}
                                  {fullBoxes === 0 && !hasLoose && (
                                    <span className="font-bold text-sm text-slate-500">0 Caixas</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                  Total real: <strong className="text-slate-200">{saldoRepUnits} un</strong> {hasLoose ? `(${saldoRepPackages} cx equivalentes)` : `(caixas 100% lacradas)`}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditStock(s.produto, 'representante', selectedRepId !== 'todos' ? selectedRepId : undefined)}
                              className="btn-secondary !py-1 !px-2.5 text-[11px] flex items-center gap-1 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20"
                              title={`Editar saldo de ${s.packaging.plural} com o representante`}
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar Saldo Rep</span>
                            </button>

                            <button
                              onClick={() => handleOpenTransfer(s.produto, 'rep_to_fabrica', selectedRepId !== 'todos' ? selectedRepId : undefined)}
                              className="btn-secondary !py-1 !px-2 text-[11px] flex items-center gap-1 hover:border-amber-500/50"
                              title="Devolver mercadorias do representante para a fábrica central"
                            >
                              <Building2 className="w-3 h-3 text-amber-400" />
                              <span>Devolver p/ Fábrica</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VISÃO COMPARATIVA GERAL (Pacotes/Caixas Lado a Lado) */}
      {activeTab === 'comparativo' && (
        <div className="glass-panel overflow-hidden rounded-xl space-y-0">
          <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Visão Comparativa Consolidada (Pacotes / Caixas)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Controle simultâneo do estoque de fábrica e representantes por tipo de embalagem
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Embalagem</th>
                  <th className="p-3 text-center bg-amber-500/5 border-x border-slate-800">
                    🏭 Estoque Fábrica
                  </th>
                  <th className="p-3 text-center bg-indigo-500/5 border-r border-slate-800">
                    👤 Com Representantes
                  </th>
                  <th className="p-3 text-center bg-emerald-500/5 border-r border-slate-800">
                    📦 Total Geral PraCasa
                  </th>
                  <th className="p-3">Mínimo</th>
                  <th className="p-3 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((s) => {
                    const isLow = s.saldoTotalGeralPacotes <= s.estoqueMinimoPacotes;

                    return (
                      <tr key={s.produto.id} className="hover:bg-slate-800/40 transition-all">
                        <td className="p-3 font-mono font-bold text-amber-400">{s.produto.sku}</td>
                        <td className="p-3 font-medium text-slate-100">
                          <div>
                            <span className="font-bold text-slate-100">{s.produto.nome}</span>
                            <span className="text-[10px] text-slate-400 block">{s.produto.categoria}</span>
                          </div>
                        </td>
                        <td className="p-3 text-slate-400 font-medium">
                          {s.packaging.descricaoCompleta}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-amber-400 bg-amber-500/5 border-x border-slate-800">
                          {(() => {
                            const fator = s.packaging.fator || 1;
                            const full = Math.floor(s.saldoFabricaUnidades / fator);
                            const loose = Math.round(s.saldoFabricaUnidades % fator);
                            return (
                              <div>
                                <div>{full > 0 ? `${full} cx` : ''}{loose > 0 ? ` +${loose} un` : (full === 0 ? '0 cx' : '')}</div>
                                <span className="text-[10px] text-slate-500 block font-normal">({s.saldoFabricaUnidades} un)</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-400 bg-indigo-500/5 border-r border-slate-800">
                          {(() => {
                            const fator = s.packaging.fator || 1;
                            const full = Math.floor(s.saldoRepresentantesTotalUnidades / fator);
                            const loose = Math.round(s.saldoRepresentantesTotalUnidades % fator);
                            return (
                              <div>
                                <div>{full > 0 ? `${full} cx` : ''}{loose > 0 ? ` +${loose} un` : (full === 0 ? '0 cx' : '')}</div>
                                <span className="text-[10px] text-slate-500 block font-normal">({s.saldoRepresentantesTotalUnidades} un)</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-center font-mono font-extrabold text-sm text-emerald-400 bg-emerald-500/5 border-r border-slate-800">
                          {(() => {
                            const fator = s.packaging.fator || 1;
                            const full = Math.floor(s.saldoTotalGeralUnidades / fator);
                            const loose = Math.round(s.saldoTotalGeralUnidades % fator);
                            return (
                              <div>
                                <div>{full > 0 ? `${full} cx` : ''}{loose > 0 ? ` +${loose} un` : (full === 0 ? '0 cx' : '')}</div>
                                <span className="text-[10px] text-slate-400 block font-normal">({s.saldoTotalGeralUnidades} un)</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-slate-400 font-mono">
                          <span className={isLow ? 'text-rose-400 font-bold' : ''}>
                            {s.estoqueMinimoPacotes} {s.packaging.plural}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditStock(s.produto, 'fabrica')}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] px-2 flex items-center gap-1 font-semibold"
                              title="Editar estoque da fábrica"
                            >
                              <Edit2 className="w-3 h-3" /> Fábrica
                            </button>

                            <button
                              onClick={() => handleOpenEditStock(s.produto, 'representante')}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 text-[11px] px-2 flex items-center gap-1 font-semibold"
                              title="Editar estoque de representantes"
                            >
                              <Edit2 className="w-3 h-3" /> Rep
                            </button>

                            <button
                              onClick={() => handleOpenTransfer(s.produto, 'fabrica_to_rep')}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] px-2 flex items-center gap-1 font-semibold"
                              title="Transferir caixas/pacotes"
                            >
                              <Truck className="w-3 h-3" /> Transferir
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: HISTÓRICO DE MOVIMENTAÇÕES */}
      {activeTab === 'movimentos' && (
        <div className="glass-panel p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4" /> Registro Auditado de Movimentações de Estoque
            </h3>
            <span className="text-[11px] text-slate-400">{movimentos.length} movimentações registradas</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {movimentos.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">Nenhum movimento registrado até o momento.</p>
            ) : (
              movimentos.map((m) => {
                const isEntrada =
                  m.tipo_movimento.includes('Entrada') ||
                  m.tipo_movimento.includes('Recebida') ||
                  m.tipo_movimento === 'Saldo Inicial';
                const isTransfer = m.tipo_movimento.includes('Transferência') || m.tipo_movimento === 'Devolução';

                return (
                  <div
                    key={m.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs flex items-center justify-between hover:border-slate-700 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        <span className="font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded text-[10px]">
                          {m.produto_sku || 'PROD'}
                        </span>
                        <span>{m.produto_nome || 'Produto'}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isTransfer
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : isEntrada
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {m.tipo_movimento}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDate(m.data_movimento)} • Resp: {m.responsavel} {m.motivo ? `• ${m.motivo}` : ''}
                      </div>
                    </div>

                    <div className="font-mono font-extrabold text-sm text-right">
                      <span className={m.quantidade_base > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {m.quantidade_original ? `${m.quantidade_base > 0 ? '+' : ''}${m.quantidade_original}` : (m.quantidade_base > 0 ? `+${m.quantidade_base}` : m.quantidade_base)}
                      </span>
                      <span className="text-xs text-slate-400 block font-normal">
                        {m.unidade_original || 'unidades'} ({m.quantidade_base} un total)
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: EDITAR ESTOQUE (100% FOCADO EM PACOTES/CAIXAS) */}
      {showEditModal && editProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4 shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  Editar Saldo de Estoque (Pacotes / Caixas)
                </h3>
                <p className="text-xs text-slate-400">
                  Ajuste físico apurado em embalagens fechadas com conversão automática de unidades.
                </p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStockAdjustment} className="space-y-4 text-xs">
              {/* Product Info Block with Packaging Info */}
              {(() => {
                const summary = stockSummaries.find((s) => s.produto.id === editProduct.id);
                const pkg = summary?.packaging || getPackagingInfo(editProduct.unidade_venda, editProduct.fator_conversao_estoque || 1);

                return (
                  <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">
                        {editProduct.sku}
                      </span>
                      <span className="text-slate-400 text-[11px]">{editProduct.categoria}</span>
                    </div>
                    <h4 className="font-bold text-slate-100 text-sm">{editProduct.nome}</h4>
                    <div className="p-2 bg-amber-500/10 rounded border border-amber-500/20 text-amber-300 font-semibold text-[11px] flex items-center justify-between">
                      <span>📦 Embalagem Comercial: {pkg.descricaoCompleta}</span>
                      <span className="font-mono font-bold">1 {pkg.sigla.toLowerCase()} = {pkg.fator} un</span>
                    </div>
                  </div>
                );
              })()}

              {/* Location Selector */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Local do Estoque a Editar *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditLocationType('fabrica')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      editLocationType === 'fabrica'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Fábrica / Depósito Central</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditLocationType('representante')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                      editLocationType === 'representante'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Com Representante</span>
                  </button>
                </div>
              </div>

              {/* If Representative, choose which representative */}
              {editLocationType === 'representante' && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Representante Comercial *</label>
                  <select
                    value={editRepId}
                    onChange={(e) => setEditRepId(e.target.value)}
                    className="input-field"
                    required
                  >
                    {representantes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome_razao} ({r.codigo})
                      </option>
                    ))}
                    <option value="geral">Estoque de Representantes (Geral / Compartilhado)</option>
                  </select>
                </div>
              )}

              {/* Current Balance Display in Packages */}
              {(() => {
                const summary = stockSummaries.find((s) => s.produto.id === editProduct.id);
                const pkg = summary?.packaging || getPackagingInfo(editProduct.unidade_venda, editProduct.fator_conversao_estoque || 1);
                const currentPackages =
                  editLocationType === 'fabrica'
                    ? summary?.saldoFabricaPacotes || 0
                    : summary?.saldosPorRepPacotes[editRepId] || 0;

                const inputNumPackages = parseFloat(editInputValue) || 0;
                let resultingPackages = currentPackages;
                if (editMode === 'set_total') resultingPackages = inputNumPackages;
                else if (editMode === 'add') resultingPackages = currentPackages + inputNumPackages;
                else if (editMode === 'subtract') resultingPackages = currentPackages - inputNumPackages;

                const diffPackages = resultingPackages - currentPackages;
                const diffUnits = diffPackages * pkg.fator;
                const resultingUnits = resultingPackages * pkg.fator;

                return (
                  <div className="space-y-3">
                    {/* Operation Mode Tabs */}
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Modo de Operação</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode('set_total');
                            setEditInputValue(String(currentPackages));
                          }}
                          className={`p-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                            editMode === 'set_total'
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          Definir Total ({pkg.plural})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode('add');
                            setEditInputValue('5');
                          }}
                          className={`p-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                            editMode === 'add'
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          + Adicionar ({pkg.plural})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditMode('subtract');
                            setEditInputValue('5');
                          }}
                          className={`p-2 rounded-lg border text-center text-xs font-semibold transition-all ${
                            editMode === 'subtract'
                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          - Subtrair ({pkg.plural})
                        </button>
                      </div>
                    </div>

                    {/* Numeric Input in Packages/Boxes */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="font-semibold text-slate-300">
                          {editMode === 'set_total'
                            ? `Novo Saldo Físico Apurado (em ${pkg.plural}):`
                            : editMode === 'add'
                            ? `Quantidade de ${pkg.plural} a Adicionar (+):`
                            : `Quantidade de ${pkg.plural} a Dar Baixa (-):`}
                        </label>
                        <span className="text-slate-400 text-[11px]">
                          Saldo Atual: <strong className="text-amber-400">{currentPackages} {pkg.plural}</strong>
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="1"
                            required
                            value={editInputValue}
                            onChange={(e) => setEditInputValue(e.target.value)}
                            className="input-field font-mono font-extrabold text-base !py-2 text-amber-400 pr-16"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                            {pkg.sigla}
                          </span>
                        </div>

                        {/* Quick Increment Buttons in Packages */}
                        <div className="flex gap-1">
                          {['+1', '+5', '+10', '+50'].map((val) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                const cur = parseFloat(editInputValue) || 0;
                                const inc = parseFloat(val);
                                setEditInputValue(String(cur + inc));
                              }}
                              className="px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono font-bold text-xs"
                            >
                              {val} {pkg.sigla}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Equivalent Units Calculation */}
                      <div className="mt-1.5 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>
                          👉 <strong>{resultingPackages} {pkg.plural}</strong> = <span className="font-bold text-slate-200">{resultingUnits} unidades</span> no total
                        </span>
                        <span className="text-slate-500 font-mono">(1 {pkg.sigla.toLowerCase()} = {pkg.fator} un)</span>
                      </div>
                    </div>

                    {/* Live Resulting Difference Badge */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Novo Saldo Resultante:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-100 text-sm">
                          {resultingPackages} {pkg.plural} ({resultingUnits} un)
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            diffPackages > 0
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : diffPackages < 0
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {diffPackages > 0 ? `+${diffPackages} ${pkg.sigla}` : `${diffPackages} ${pkg.sigla}`} (
                          {diffUnits > 0 ? `+${diffUnits} un` : `${diffUnits} un`})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Motivo and Quick Chips */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo / Justificativa *</label>
                <input
                  type="text"
                  required
                  value={editMotivo}
                  onChange={(e) => setEditMotivo(e.target.value)}
                  className="input-field"
                  placeholder="Ex: Contagem de inventário de caixas, avaria..."
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    'Inventário Físico',
                    'Ajuste de Balanço',
                    'Produção Concluída',
                    'Avaria / Descarte',
                    'Retorno de Mostruário',
                    'Ajuste Manual',
                  ].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setEditMotivo(m)}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Responsável pelo Ajuste</label>
                <input
                  type="text"
                  required
                  value={editResponsavel}
                  onChange={(e) => setEditResponsavel(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-md font-bold"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Ajuste de Estoque</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRANSFERÊNCIA FÁBRICA <-> REPRESENTANTE (EM PACOTES/CAIXAS) */}
      {showTransferModal && transferProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4 shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-500" />
                  Transferência em Pacotes / Caixas
                </h3>
                <p className="text-xs text-slate-400">
                  Movimentação entre Fábrica e Representante com contagem em embalagens comerciais.
                </p>
              </div>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTransfer} className="space-y-4 text-xs">
              {/* Product Selector */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Produto a Transferir *</label>
                <select
                  value={transferProduct.id}
                  onChange={(e) => {
                    const found = produtos.find((p) => p.id === e.target.value);
                    if (found) setTransferProduct(found);
                  }}
                  className="input-field font-semibold"
                  required
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.nome} ({p.unidade_venda})
                    </option>
                  ))}
                </select>
              </div>

              {/* Packaging Info */}
              {(() => {
                const summary = stockSummaries.find((s) => s.produto.id === transferProduct.id);
                const pkg = summary?.packaging || getPackagingInfo(transferProduct.unidade_venda, transferProduct.fator_conversao_estoque || 1);

                return (
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 flex items-center justify-between">
                    <span className="font-semibold">📦 Embalagem: {pkg.descricaoCompleta}</span>
                    <span className="text-[11px] text-amber-400 font-mono">1 {pkg.sigla.toLowerCase()} = {pkg.fator} un</span>
                  </div>
                );
              })()}

              {/* Direction Selector */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Sentido da Transferência *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferDirection('fabrica_to_rep')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      transferDirection === 'fabrica_to_rep'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>🏭 Fábrica ➔ 👤 Representante</span>
                    <span className="text-[10px] font-normal text-slate-400">Remessa pronta entrega</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferDirection('rep_to_fabrica')}
                    className={`p-2.5 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                      transferDirection === 'rep_to_fabrica'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>👤 Representante ➔ 🏭 Fábrica</span>
                    <span className="text-[10px] font-normal text-slate-400">Devolução ao estoque central</span>
                  </button>
                </div>
              </div>

              {/* Representative Choice */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Representante Comercial *</label>
                <select
                  value={transferRepId}
                  onChange={(e) => setTransferRepId(e.target.value)}
                  className="input-field"
                  required
                >
                  <option value="">Selecione o representante...</option>
                  {representantes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nome_razao} ({r.codigo})
                    </option>
                  ))}
                </select>
              </div>

              {/* Available balance in packages */}
              {(() => {
                const summary = stockSummaries.find((s) => s.produto.id === transferProduct.id);
                const pkg = summary?.packaging || getPackagingInfo(transferProduct.unidade_venda, transferProduct.fator_conversao_estoque || 1);
                const saldoOrigemPackages =
                  transferDirection === 'fabrica_to_rep'
                    ? summary?.saldoFabricaPacotes || 0
                    : summary?.saldosPorRepPacotes[transferRepId] || 0;

                const saldoOrigemUnits =
                  transferDirection === 'fabrica_to_rep'
                    ? summary?.saldoFabricaUnidades || 0
                    : summary?.saldosPorRepUnidades[transferRepId] || 0;

                return (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center">
                    <span className="text-slate-400">Saldo Disponível na Origem:</span>
                    <span className="font-mono font-extrabold text-amber-400 text-sm">
                      {saldoOrigemPackages} {pkg.plural} ({saldoOrigemUnits} un)
                    </span>
                  </div>
                );
              })()}

              {/* Quantity in packages/boxes */}
              {(() => {
                const summary = stockSummaries.find((s) => s.produto.id === transferProduct.id);
                const pkg = summary?.packaging || getPackagingInfo(transferProduct.unidade_venda, transferProduct.fator_conversao_estoque || 1);
                const qtyNum = parseFloat(transferQty) || 0;

                return (
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Quantidade a Transferir (em {pkg.plural}) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        required
                        value={transferQty}
                        onChange={(e) => setTransferQty(e.target.value)}
                        className="input-field font-mono font-extrabold text-sm text-emerald-400 pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                        {pkg.sigla}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 mt-1 block">
                      👉 {qtyNum} {pkg.plural} = <strong>{qtyNum * pkg.fator} unidades</strong> no total (1 {pkg.sigla.toLowerCase()} = {pkg.fator} un)
                    </span>
                  </div>
                );
              })()}

              {/* Motivo */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo / Observação</label>
                <input
                  type="text"
                  value={transferMotivo}
                  onChange={(e) => setTransferMotivo(e.target.value)}
                  className="input-field"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setShowTransferModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md font-bold"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Confirmar Transferência</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WHATSAPP REPORT MODAL */}
      {showWhatsAppModal && whatsAppReportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-emerald-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Enviar Conferência de Estoque via WhatsApp</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Destinatário: <strong className="text-slate-200">{whatsAppReportData.rep.nome_razao}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Phone input */}
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <label className="block font-bold text-slate-300">
                  Número do WhatsApp com DDD:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={whatsAppReportData.phone}
                    onChange={(e) =>
                      setWhatsAppReportData({ ...whatsAppReportData, phone: e.target.value })
                    }
                    placeholder="Ex: 75991975453"
                    className="input-field font-mono font-bold text-emerald-400"
                  />
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">
                    (Sem traços ou espaços)
                  </span>
                </div>
              </div>

              {/* Message preview */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-300 flex items-center gap-1.5">
                    <span>Pré-visualização da Mensagem Formatada:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Texto organizado com quebras de linha preservadas
                  </span>
                </div>
                <textarea
                  readOnly
                  value={whatsAppReportData.message}
                  rows={12}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-300 font-mono text-[11px] leading-relaxed resize-none focus:outline-none select-all"
                />
              </div>

              {/* Informative Tip for PDF + WhatsApp combo */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 text-[11px] text-emerald-300 flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-200">
                    Como enviar a mensagem 100% organizada (sem juntar as linhas):
                  </p>
                  <p className="text-emerald-300/90 leading-relaxed">
                    O WhatsApp Web pelo navegador costuma achatar links longos em uma única linha. Para que a sua mensagem vá <strong>perfeita, com todas as quebras de linha e tópicos organizados</strong>, utilize o botão verde <strong>"Copiar Texto, Baixar PDF & Abrir Conversa"</strong>. Ele já copia o texto completo e baixa o PDF; na tela do WhatsApp, você só precisa pressionar <strong>Ctrl + V</strong> (Colar) e arrastar o PDF!
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyWhatsAppMessage}
                  className={`btn-secondary flex items-center gap-2 !py-2 !px-3 font-semibold transition-all ${
                    copiedSuccess
                      ? '!bg-emerald-500/20 !border-emerald-500/50 !text-emerald-300'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Copia o texto estruturado para você colar onde quiser"
                >
                  {copiedSuccess ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Copiado com Sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-400" />
                      <span>Copiar Texto Completo</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportRepStockPDF}
                  className="btn-secondary !py-2 !px-3 flex items-center gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                  title="Baixar apenas o arquivo PDF"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Apenas Baixar PDF</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenWithUrlPreload}
                  className="btn-secondary !py-2 !px-3 text-xs text-slate-400 hover:text-slate-200 border-slate-700"
                  title="Abre o WhatsApp com o texto pré-carregado no link direto"
                >
                  <span>Abrir com Texto no Link</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyAndOpenWhatsApp}
                  className="btn-primary !py-2 !px-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/30"
                  title="Copia o texto 100% organizado, baixa o PDF e abre a conversa do WhatsApp para colar com Ctrl+V"
                >
                  <Send className="w-4 h-4" />
                  <span>Copiar Texto, Baixar PDF & Abrir Conversa</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
