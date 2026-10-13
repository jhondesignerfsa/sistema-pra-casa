import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Edit2,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Trash2,
  X,
  MessageSquare,
  AlertCircle,
  Building2,
  Users,
  Warehouse,
  Package,
} from 'lucide-react';
import { queryAll, execute, queryOne, persistDB } from '../db/database';
import { Pedido, ItemPedido, Produto, Cliente, Representante, Empresa, OrderStatus } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToExcel } from '../utils/excelImport';
import { generatePedidoPDF } from '../utils/pdfGenerator';

export const getProductBoxPrice = (prod: Partial<Produto>): number => {
  const fator = Number(prod.fator_conversao_estoque) || 1;
  const unit = Number(prod.preco_tabela) || 0;

  if (prod.preco_caixa && prod.preco_caixa > 0) {
    // If box price was mistakenly set to individual bottle price (under R$ 15), multiply by factor
    if (prod.preco_caixa < 15 && fator > 1) {
      return Math.round(prod.preco_caixa * fator * 100) / 100;
    }
    return prod.preco_caixa;
  }

  if (fator > 1 && unit > 0) {
    return Math.round(unit * fator * 100) / 100;
  }
  return unit;
};

export const PedidosModule: React.FC = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [stockBalances, setStockBalances] = useState<
    Record<string, {
      fabricaUnits: number;
      fabricaBoxes: number;
      repsUnits: Record<string, number>;
      repsBoxes: Record<string, number>;
    }>
  >({});
  const [unrestockedItems, setUnrestockedItems] = useState<{
    item: ItemPedido;
    origem: string;
    repId: string;
    pedNumero: string;
  }[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Pedido>>({
    numero: '',
    representante_id: '',
    cliente_id: '',
    subtotal: 0,
    valor_frete: 0,
    desconto_total: 0,
    valor_total: 0,
    condicao_pagamento: '30 dias',
    data_solicitada_entrega: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    observacoes: '',
    status: 'Rascunho',
    origem: 'fábrica',
  });

  const [cartItems, setCartItems] = useState<ItemPedido[]>([]);
  const [statusReason, setStatusReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const pList = await queryAll<Produto>("SELECT * FROM produto WHERE status = 'ativo' ORDER BY nome ASC");
      for (const p of pList) {
        p.preco_caixa = getProductBoxPrice(p);
      }
      setProdutos(pList);

      const cList = await queryAll<Cliente>('SELECT * FROM cliente ORDER BY nome_fantasia ASC');
      setClientes(cList);

      const rList = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(rList);

      const pData = await queryAll<Pedido>(`
        SELECT p.*, r.nome_razao as representante_nome, c.nome_fantasia as cliente_nome
        FROM pedido p
        LEFT JOIN representante r ON p.representante_id = r.id
        LEFT JOIN cliente c ON p.cliente_id = c.id
        ORDER BY p.created_at DESC
      `);

      for (const ped of pData) {
        ped.items = await queryAll<ItemPedido>('SELECT * FROM item_pedido WHERE pedido_id = ?', [ped.id]);
      }

      // Calculate real-time stock balances in packages/boxes for all products
      const movList = await queryAll<any>('SELECT * FROM movimento_estoque');
      const balances: Record<string, { fabrica: number; reps: Record<string, number> }> = {};

      for (const p of pList) {
        balances[p.id] = { fabrica: 0, reps: {} };
      }

      for (const m of movList) {
        if (!balances[m.produto_id]) {
          balances[m.produto_id] = { fabrica: 0, reps: {} };
        }
        const b = balances[m.produto_id];
        const qty = Number(m.quantidade_base) || 0;

        if (m.local_destino_id === 'loc_fabrica') b.fabrica += qty;
        if (m.local_origem_id === 'loc_fabrica') b.fabrica -= qty;

        if (m.local_destino_id && m.local_destino_id.startsWith('loc_rep')) {
          const rKey = m.local_destino_id === 'loc_rep' ? 'geral' : m.local_destino_id.replace('loc_rep_', '');
          b.reps[rKey] = (b.reps[rKey] || 0) + qty;
        }
        if (m.local_origem_id && m.local_origem_id.startsWith('loc_rep')) {
          const rKey = m.local_origem_id === 'loc_rep' ? 'geral' : m.local_origem_id.replace('loc_rep_', '');
          b.reps[rKey] = (b.reps[rKey] || 0) - qty;
        }
      }

      const finalBalances: Record<string, {
        fabricaUnits: number;
        fabricaBoxes: number;
        repsUnits: Record<string, number>;
        repsBoxes: Record<string, number>;
      }> = {};

      for (const p of pList) {
        const raw = balances[p.id] || { fabrica: 0, reps: {} };
        const fator = Number(p.fator_conversao_estoque) || 1;
        const repPackages: Record<string, number> = {};
        const repUnits: Record<string, number> = {};
        for (const [rId, uCount] of Object.entries(raw.reps)) {
          repUnits[rId] = Math.round(uCount * 100) / 100;
          repPackages[rId] = Math.round((uCount / fator) * 100) / 100;
        }
        finalBalances[p.id] = {
          fabricaUnits: Math.round(raw.fabrica * 100) / 100,
          fabricaBoxes: Math.round((raw.fabrica / fator) * 100) / 100,
          repsUnits: repUnits,
          repsBoxes: repPackages,
        };
      }
      setStockBalances(finalBalances);

      setPedidos(pData);
    } catch (err) {
      console.error('Erro ao carregar pedidos:', err);
    }
  };

  const handleOpenModal = (ped?: Pedido) => {
    setUnrestockedItems([]);
    if (ped) {
      setEditingId(ped.id);
      setFormData(ped);
      setCartItems(ped.items || []);
    } else {
      setEditingId(null);
      const nextNum = `PED-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      setFormData({
        numero: nextNum,
        representante_id: representantes[0]?.id || '',
        cliente_id: clientes[0]?.id || '',
        subtotal: 0,
        valor_frete: 0,
        desconto_total: 0,
        valor_total: 0,
        condicao_pagamento: clientes[0]?.condicoes_pagamento || '30 dias',
        data_solicitada_entrega: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        observacoes: '',
        status: 'Rascunho',
        origem: 'fábrica',
      });
      setCartItems([]);
    }
    setShowModal(true);
  };

  const handleAddItem = (valueStr: string) => {
    const [prodId, rawTipo] = valueStr.split(':') as [string, ('caixa' | 'unidade' | undefined)];
    const tipo: 'caixa' | 'unidade' = rawTipo === 'unidade' ? 'unidade' : 'caixa';
    const prod = produtos.find((p) => p.id === prodId);
    if (!prod) return;

    const fator = Number(prod.fator_conversao_estoque) || 1;
    const isAvulso = tipo === 'unidade';
    const unitPrice = isAvulso ? (Number(prod.preco_tabela) || 0) : getProductBoxPrice(prod);
    const unidadeStr = isAvulso ? 'A Granel (Avulso)' : (prod.unidade_venda || `Caixa c/ ${fator} un`);

    const existingIdx = cartItems.findIndex(
      (i) => i.produto_id === prodId && (i.tipo_embalagem || 'caixa') === tipo
    );
    if (existingIdx >= 0) {
      const updated = [...cartItems];
      updated[existingIdx].quantidade += 1;
      const desc = updated[existingIdx].desconto_pct || 0;
      updated[existingIdx].subtotal = updated[existingIdx].quantidade * updated[existingIdx].preco_unitario * (1 - desc / 100);
      setCartItems(updated);
    } else {
      setCartItems([
        ...cartItems,
        {
          produto_id: prod.id,
          produto_sku: prod.sku,
          produto_nome: prod.nome,
          unidade: unidadeStr,
          tipo_embalagem: tipo,
          quantidade: 1,
          preco_unitario: unitPrice,
          desconto_pct: 0,
          subtotal: unitPrice,
        },
      ]);
    }
  };

  const handleToggleEmbalagem = (index: number, newTipo: 'caixa' | 'unidade') => {
    const updated = [...cartItems];
    const item = updated[index];
    const prod = produtos.find((p) => p.id === item.produto_id);
    if (!prod) return;

    const fator = Number(prod.fator_conversao_estoque) || 1;
    const isAvulso = newTipo === 'unidade';
    const newPrice = isAvulso ? (Number(prod.preco_tabela) || 0) : getProductBoxPrice(prod);
    const newUnidade = isAvulso ? 'A Granel (Avulso)' : (prod.unidade_venda || `Caixa c/ ${fator} un`);
    const desc = item.desconto_pct || 0;

    updated[index] = {
      ...item,
      tipo_embalagem: newTipo,
      unidade: newUnidade,
      preco_unitario: newPrice,
      subtotal: item.quantidade * newPrice * (1 - desc / 100),
    };
    setCartItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const item = cartItems[index];
    const isExistingDeductingOrder =
      editingId &&
      [
        'Aprovado',
        'Aguardando faturamento',
        'Faturado',
        'Em separação',
        'Enviado/Em entrega',
        'Entregue',
        'Parcialmente entregue',
      ].includes(formData.status || '');

    const originName =
      formData.origem === 'representante'
        ? 'Estoque do Representante'
        : 'Estoque da Fábrica / Matriz';

    if (isExistingDeductingOrder) {
      const repor = window.confirm(
        `📦 REPOSIÇÃO DO PRODUTO AO ESTOQUE:\n\n` +
        `Você está removendo o item "${item.produto_nome}" (${item.quantidade} ${item.unidade || 'un'}) deste pedido.\n\n` +
        `Deseja REPOR/DEVOLVER este produto de volta para o ${originName}?\n\n` +
        `• Clique [OK] para REPOR (o produto voltará ao estoque disponível ao salvar o pedido)\n` +
        `• Clique [CANCELAR] para NÃO REPOR (a saída de estoque será mantida como perda/avaria)`
      );

      if (!repor) {
        setUnrestockedItems((prev) => [
          ...prev,
          {
            item,
            origem: formData.origem || 'fábrica',
            repId: formData.representante_id || '',
            pedNumero: formData.numero || '',
          },
        ]);
      }
    }

    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
  };

  const handleUpdateItem = (index: number, field: keyof ItemPedido, val: any) => {
    const updated = [...cartItems];
    const item = { ...updated[index], [field]: val };

    if (field === 'quantidade' || field === 'preco_unitario' || field === 'desconto_pct') {
      const qty = parseFloat(item.quantidade as any) || 0;
      const unitPrice = parseFloat(item.preco_unitario as any) || 0;
      const desc = parseFloat(item.desconto_pct as any) || 0;
      item.subtotal = qty * unitPrice * (1 - desc / 100);
    }

    updated[index] = item;
    setCartItems(updated);
  };

  const calculateTotals = () => {
    const subtotal = cartItems.reduce((acc, curr) => acc + (curr.subtotal || 0), 0);
    const frete = parseFloat(formData.valor_frete as any) || 0;
    const desc = parseFloat(formData.desconto_total as any) || 0;
    const total = subtotal + frete - desc;
    return { subtotal, total };
  };

  const syncStockMovementsForPedido = async (
    pedId: string,
    pedNumero: string,
    status: OrderStatus,
    origem: string,
    representanteId: string,
    clienteId: string,
    items: ItemPedido[]
  ) => {
    const now = new Date().toISOString();

    // 1. Remove previous movements associated with this order to avoid duplicates
    await execute('DELETE FROM movimento_estoque WHERE pedido_id = ? OR motivo LIKE ?', [
      pedId,
      `%Pedido ${pedNumero}%`,
    ]);

    // Active deduction statuses: stock is deducted for confirmed/processing/delivered orders
    const deductingStatuses: OrderStatus[] = [
      'Aprovado',
      'Aguardando faturamento',
      'Faturado',
      'Em separação',
      'Enviado/Em entrega',
      'Entregue',
      'Parcialmente entregue',
    ];

    if (!deductingStatuses.includes(status)) {
      await persistDB();
      return;
    }

    const isRepOrigin = origem === 'representante';
    const originLocId = isRepOrigin && representanteId ? `loc_rep_${representanteId}` : 'loc_fabrica';
    const repObj = representantes.find((r) => r.id === representanteId);
    const cliObj = clientes.find((c) => c.id === clienteId);
    const originName = isRepOrigin && repObj
      ? `Estoque do Representante (${repObj.nome_razao})`
      : 'Estoque da Fábrica / Matriz';

    for (const item of items) {
      const prod: Produto | null | undefined =
        produtos.find((p) => p.id === item.produto_id) ||
        (await queryOne<Produto>('SELECT * FROM produto WHERE id = ?', [item.produto_id]));
      const fator = Number(prod?.fator_conversao_estoque) || 1;
      const isAvulso =
        item.tipo_embalagem === 'unidade' ||
        item.unidade?.toLowerCase().includes('granel') ||
        item.unidade?.toLowerCase().includes('avulso');
      const qtySold = Number(item.quantidade) || 0;
      const qtyUnits = isAvulso ? qtySold : (qtySold * fator);
      const embalagemLabel = isAvulso ? 'A Granel (Avulso)' : (item.unidade || `Caixa c/ ${fator} un`);

      await execute(
        `INSERT INTO movimento_estoque (
          id, produto_id, local_origem_id, local_destino_id, quantidade_original,
          unidade_original, quantidade_base, data_movimento, tipo_movimento,
          pedido_id, responsavel, motivo, created_at
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `mov_venda_${Date.now()}_${item.produto_id}_${Math.floor(Math.random() * 1000)}`,
          item.produto_id,
          originLocId,
          qtySold,
          embalagemLabel,
          qtyUnits,
          now,
          isRepOrigin ? 'Saída Venda (Estoque Representante)' : 'Saída Venda (Estoque Fábrica)',
          pedId,
          'Sistema de Vendas',
          `Venda Pedido ${pedNumero} (${status}) para ${cliObj?.nome_fantasia || 'Cliente'} [${embalagemLabel}] — Saída: ${originName}`,
          now,
        ]
      );
    }
    await persistDB();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      alert('Adicione pelo menos 1 item ao pedido.');
      return;
    }

    const { subtotal, total } = calculateTotals();
    const now = new Date().toISOString();
    const rep = representantes.find((r) => r.id === formData.representante_id);
    const comissaoPct = rep ? rep.percentual_comissao : 10.0;
    const comissaoCalculada = (subtotal * comissaoPct) / 100;

    try {
      let pedId = editingId;

      if (editingId) {
        await execute(
          `UPDATE pedido SET
            numero = ?, representante_id = ?, cliente_id = ?, subtotal = ?, valor_frete = ?,
            desconto_total = ?, valor_total = ?, condicao_pagamento = ?, data_solicitada_entrega = ?,
            observacoes = ?, status = ?, origem = ?, comissao_calculada = ?, updated_at = ?
          WHERE id = ?`,
          [
            formData.numero,
            formData.representante_id,
            formData.cliente_id,
            subtotal,
            formData.valor_frete || 0,
            formData.desconto_total || 0,
            total,
            formData.condicao_pagamento,
            formData.data_solicitada_entrega,
            formData.observacoes,
            formData.status,
            formData.origem || 'fábrica',
            comissaoCalculada,
            now,
            editingId,
          ]
        );

        await execute('DELETE FROM item_pedido WHERE pedido_id = ?', [editingId]);
      } else {
        pedId = `ped_${Date.now()}`;
        await execute(
          `INSERT INTO pedido (
            id, numero, data_hora, representante_id, cliente_id, subtotal, valor_frete,
            desconto_total, valor_total, condicao_pagamento, data_solicitada_entrega, observacoes,
            status, origem, comissao_calculada, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pedId,
            formData.numero,
            now,
            formData.representante_id,
            formData.cliente_id,
            subtotal,
            formData.valor_frete || 0,
            formData.desconto_total || 0,
            total,
            formData.condicao_pagamento,
            formData.data_solicitada_entrega,
            formData.observacoes,
            formData.status || 'Rascunho',
            formData.origem || 'fábrica',
            comissaoCalculada,
            now,
            now,
          ]
        );
      }

      // Save item list
      for (const item of cartItems) {
        await execute(
          `INSERT INTO item_pedido (id, pedido_id, produto_id, produto_sku, produto_nome, unidade, tipo_embalagem, quantidade, preco_unitario, desconto_pct, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            pedId,
            item.produto_id,
            item.produto_sku,
            item.produto_nome,
            item.unidade,
            item.tipo_embalagem || 'caixa',
            item.quantidade,
            item.preco_unitario,
            item.desconto_pct || 0,
            item.subtotal,
          ]
        );
      }

      // Sync inventory deduction according to origin and status
      await syncStockMovementsForPedido(
        pedId!,
        formData.numero!,
        (formData.status || 'Rascunho') as OrderStatus,
        formData.origem || 'fábrica',
        formData.representante_id || '',
        formData.cliente_id || '',
        cartItems
      );

      // Process any items removed where user explicitly chose NOT to restock (loss/damage write-off)
      for (const ur of unrestockedItems) {
        const prod = produtos.find((p) => p.id === ur.item.produto_id) || (await queryOne<Produto>('SELECT * FROM produto WHERE id = ?', [ur.item.produto_id]));
        const fator = Number(prod?.fator_conversao_estoque) || 1;
        const isAvulso = ur.item.tipo_embalagem === 'unidade' || ur.item.unidade?.toLowerCase().includes('granel') || ur.item.unidade?.toLowerCase().includes('avulso');
        const qtySold = Number(ur.item.quantidade) || 0;
        const qtyUnits = isAvulso ? qtySold : (qtySold * fator);
        const originLocId = ur.origem === 'representante' && ur.repId ? `loc_rep_${ur.repId}` : 'loc_fabrica';

        await execute(
          `INSERT INTO movimento_estoque (
            id, produto_id, local_origem_id, local_destino_id, quantidade_original,
            unidade_original, quantidade_base, data_movimento, tipo_movimento,
            pedido_id, responsavel, motivo, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          [
            `mov_baixa_removido_${Date.now()}_${ur.item.produto_id}_${Math.floor(Math.random() * 1000)}`,
            ur.item.produto_id,
            originLocId,
            qtySold,
            ur.item.unidade || 'Unidade',
            qtyUnits,
            now,
            'Baixa Sem Retorno (Item Removido)',
            'Sistema de Vendas',
            `Item ${ur.item.produto_nome} removido do Pedido ${ur.pedNumero} com opção de NÃO repor estoque (perda/avaria)`,
            now,
          ]
        );
      }
      setUnrestockedItems([]);

      // Record calculated commission if Approved/Faturado
      if (formData.status === 'Aprovado' || formData.status === 'Faturado') {
        const existingCom = await queryOne('SELECT id FROM comissao WHERE pedido_id = ?', [pedId]);
        if (!existingCom) {
          await execute(
            `INSERT INTO comissao (id, representante_id, pedido_id, valor_base_calculo, percentual_aplicado, valor_comissao, status, data_prevista_pagamento, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'estimada', ?, ?)`,
            [
              `com_${Date.now()}`,
              formData.representante_id,
              pedId,
              subtotal,
              comissaoPct,
              comissaoCalculada,
              new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
              now,
            ]
          );
        }
      }

      setShowModal(false);
      await loadData();
    } catch (err: any) {
      alert(`Erro ao salvar pedido: ${err.message}`);
    }
  };

  const handleDuplicate = (ped: Pedido) => {
    const newNum = `PED-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setEditingId(null);
    setFormData({
      ...ped,
      numero: newNum,
      status: 'Rascunho',
      data_hora: new Date().toISOString(),
    });
    setCartItems(ped.items || []);
    setShowModal(true);
  };

  const handleUpdateStatus = async (ped: Pedido, newStatus: OrderStatus) => {
    const reason = prompt(`Confirma a alteração do status do pedido ${ped.numero} para "${newStatus}"? Justificativa/Observação:`);
    if (reason === null) return;

    try {
      const now = new Date().toISOString();
      await execute('UPDATE pedido SET status = ?, observacoes = COALESCE(observacoes, "") || ?, updated_at = ? WHERE id = ?', [
        newStatus,
        `\n[${now.slice(0, 10)}] Status alterado para ${newStatus}. Motivo: ${reason}`,
        now,
        ped.id,
      ]);

      await syncStockMovementsForPedido(
        ped.id,
        ped.numero,
        newStatus,
        ped.origem || 'fábrica',
        ped.representante_id,
        ped.cliente_id,
        ped.items || []
      );

      await loadData();
    } catch (err: any) {
      alert(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleExportPDF = async (ped: Pedido) => {
    const empresa = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (!empresa) {
      alert('Empresa não cadastrada.');
      return;
    }
    const rep = ped.representante_id ? (representantes.find(r => r.id === ped.representante_id) || await queryOne<Representante>('SELECT * FROM representante WHERE id = ?', [ped.representante_id])) : undefined;
    const cli = ped.cliente_id ? (clientes.find(c => c.id === ped.cliente_id) || await queryOne<Cliente>('SELECT * FROM cliente WHERE id = ?', [ped.cliente_id])) : undefined;
    const pdf = generatePedidoPDF(ped, empresa, rep || undefined, cli || undefined);
    pdf.save(`Pedido_${ped.numero}.pdf`);
  };

  const handleSendWhatsApp = (ped: Pedido) => {
    const cli = clientes.find((c) => c.id === ped.cliente_id);
    const phone = cli ? cli.whatsapp.replace(/[^0-9]/g, '') : '';
    const text = encodeURIComponent(
      `Olá! Segue resumo do Pedido Nº *${ped.numero}* de Tempero PraCasa:\n\n` +
        `Cliente: *${ped.cliente_nome}*\n` +
        `Valor Total: *${formatCurrency(ped.valor_total)}*\n` +
        `Status: *${ped.status}*\n` +
        `Entrega Prevista: *${formatDate(ped.data_solicitada_entrega)}*\n\n` +
        `Agradecemos a parceria!`
    );

    const url = phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleDeletePedido = async (ped: Pedido) => {
    const isDeductingStatus = [
      'Aprovado',
      'Aguardando faturamento',
      'Faturado',
      'Em separação',
      'Enviado/Em entrega',
      'Entregue',
      'Parcialmente entregue',
    ].includes(ped.status);

    const originName = ped.origem === 'representante'
      ? (ped.representante_nome ? `Estoque do Representante (${ped.representante_nome})` : 'Estoque do Representante')
      : 'Estoque da Fábrica / Matriz';

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir o Pedido Nº ${ped.numero} (${ped.cliente_nome || 'Cliente'})?\n\n` +
      `Esta ação removerá o pedido permanentemente do sistema.`
    );
    if (!confirmDelete) return;

    let shouldRestock = true;
    if (isDeductingStatus) {
      shouldRestock = window.confirm(
        `📦 REPOSIÇÃO DE ESTOQUE:\n\n` +
        `Os produtos deste pedido já haviam sido baixados do ${originName}.\n\n` +
        `Deseja REPOR/DEVOLVER as mercadorias de volta para o estoque?\n\n` +
        `• Clique [OK] para REPOR NO ESTOQUE (As mercadorias voltam a ficar disponíveis no ${originName})\n` +
        `• Clique [CANCELAR] para NÃO REPOR (A baixa de estoque será mantida como perda/avaria/entrega efetuada)`
      );
    }

    try {
      if (shouldRestock) {
        // Restock: remove linked inventory movement deductions
        await execute('DELETE FROM movimento_estoque WHERE pedido_id = ? OR motivo LIKE ?', [
          ped.id,
          `%Pedido ${ped.numero}%`,
        ]);
      } else {
        // Do NOT restock: preserve movement exit, decouple from deleted order
        await execute(
          `UPDATE movimento_estoque
           SET pedido_id = NULL,
               tipo_movimento = 'Baixa Sem Retorno (Pedido Excluído)',
               motivo = motivo || ' [Mantida baixa sem reposição - Pedido excluído]'
           WHERE pedido_id = ? OR motivo LIKE ?`,
          [ped.id, `%Pedido ${ped.numero}%`]
        );
      }

      // Cascade delete order records
      await execute('DELETE FROM item_pedido WHERE pedido_id = ?', [ped.id]);
      await execute('DELETE FROM comissao WHERE pedido_id = ?', [ped.id]);
      await execute('DELETE FROM recebimento WHERE pedido_id = ?', [ped.id]);
      await execute('DELETE FROM pedido WHERE id = ?', [ped.id]);

      await persistDB();
      if (showModal && editingId === ped.id) {
        setShowModal(false);
      }
      await loadData();
      alert(`Pedido ${ped.numero} excluído com sucesso! ${shouldRestock ? `(Mercadorias repostas no ${originName})` : `(Baixa de estoque mantida sem reposição)`}`);
    } catch (err: any) {
      alert(`Erro ao excluir pedido: ${err.message}`);
    }
  };

  const filteredPedidos = pedidos.filter((p) => {
    const matchesSearch =
      p.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cliente_nome && p.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.representante_nome && p.representante_nome.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const { subtotal, total } = calculateTotals();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-500" />
            Pedidos de Venda & Emissão
          </h2>
          <p className="text-xs text-slate-400">
            Crie pedidos, acompanhe o fluxo de aprovação, faturamento, PDF e envio pelo WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => handleOpenModal()} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Novo Pedido</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por número do pedido, cliente ou representante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status</option>
            <option value="Rascunho">Rascunho</option>
            <option value="Enviado para análise">Enviado p/ Análise</option>
            <option value="Aguardando aprovação">Aguardando Aprovação</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Faturado">Faturado</option>
            <option value="Entregue">Entregue</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="p-3">Nº Pedido</th>
                <th className="p-3">Data</th>
                <th className="p-3">Supermercado Cliente</th>
                <th className="p-3">Representante</th>
                <th className="p-3">Origem Estoque</th>
                <th className="p-3">Valor Total</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    Nenhum pedido de venda registrado.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((ped) => (
                  <tr key={ped.id} className="hover:bg-slate-800/40 transition-all">
                    <td className="p-3 font-mono font-bold text-amber-400">{ped.numero}</td>
                    <td className="p-3 text-slate-400">{formatDate(ped.data_hora)}</td>
                    <td className="p-3 font-medium text-slate-100">{ped.cliente_nome || '-'}</td>
                    <td className="p-3 text-slate-300">{ped.representante_nome || '-'}</td>
                    <td className="p-3">
                      {ped.origem === 'representante' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                          <Users className="w-3 h-3 text-cyan-400" />
                          <span>Estoque Rep</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          <Building2 className="w-3 h-3 text-amber-400" />
                          <span>Fábrica</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-emerald-400">{formatCurrency(ped.valor_total)}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          ped.status === 'Faturado' || ped.status === 'Entregue'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : ped.status === 'Aprovado'
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : ped.status === 'Cancelado'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {ped.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleSendWhatsApp(ped)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-emerald-400 transition-all"
                        title="Enviar no WhatsApp"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleExportPDF(ped)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all"
                        title="Exportar PDF do Pedido"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(ped)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-cyan-400 transition-all"
                        title="Duplicar Pedido (Recompra Rápida)"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleOpenModal(ped)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all"
                        title="Editar Pedido"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeletePedido(ped)}
                        className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all"
                        title="Excluir Pedido"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          <div className="glass-panel w-full max-w-4xl p-6 rounded-xl space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100">
                {editingId ? `Editar Pedido ${formData.numero}` : 'Novo Pedido de Venda'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Nº do Pedido *</label>
                  <input
                    type="text"
                    required
                    value={formData.numero || ''}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Supermercado Cliente *</label>
                  <select
                    required
                    value={formData.cliente_id}
                    onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Selecione o cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome_fantasia} ({c.cidade})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Representante Commercial *</label>
                  <select
                    required
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
                  <label className="block font-semibold text-slate-300 mb-1">Status do Fluxo *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="input-field font-bold text-amber-400"
                  >
                    <option value="Rascunho">Rascunho</option>
                    <option value="Enviado para análise">Enviado para análise</option>
                    <option value="Aguardando aprovação">Aguardando aprovação</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Recusado">Recusado</option>
                    <option value="Aguardando faturamento">Aguardando faturamento</option>
                    <option value="Faturado">Faturado</option>
                    <option value="Em separação">Em separação</option>
                    <option value="Entregue">Entregue</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              {/* Origem do Estoque: Fábrica vs Representante */}
              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="font-bold text-slate-200 flex items-center gap-2">
                    <Warehouse className="w-4 h-4 text-amber-400" />
                    <span>Origem do Estoque da Venda *</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    O estoque será abatido automaticamente deste local ao aprovar/faturar
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, origem: 'fábrica' })}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                      formData.origem === 'fábrica'
                        ? 'bg-amber-500/15 border-amber-500/50 text-white ring-1 ring-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${formData.origem === 'fábrica' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>Estoque da Fábrica</span>
                        {formData.origem === 'fábrica' && (
                          <span className="text-[10px] bg-amber-500/25 text-amber-300 px-1.5 py-0.5 rounded font-bold">Ativo</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Depósito Central / Matriz (Camaçari)
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, origem: 'representante' })}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                      formData.origem === 'representante'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-white ring-1 ring-cyan-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${formData.origem === 'representante' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>Estoque do Representante</span>
                        {formData.origem === 'representante' && (
                          <span className="text-[10px] bg-cyan-500/25 text-cyan-300 px-1.5 py-0.5 rounded font-bold">Ativo</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {representantes.find((r) => r.id === formData.representante_id)?.nome_razao
                          ? `Estoque de ${representantes.find((r) => r.id === formData.representante_id)?.nome_razao}`
                          : 'Selecione o representante acima'}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Items Selection */}
              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-200">Itens do Pedido</h4>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddItem(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="input-field text-xs !py-1"
                    >
                      <option value="">+ Adicionar produto ao pedido...</option>
                      {produtos.map((p) => {
                        const isRep = formData.origem === 'representante';
                        const repId = formData.representante_id || '';
                        const b = stockBalances[p.id];
                        const availBoxes = isRep ? (b?.repsBoxes[repId] || 0) : (b?.fabricaBoxes || 0);
                        const availUnits = isRep ? (b?.repsUnits[repId] || 0) : (b?.fabricaUnits || 0);
                        const boxPrice = getProductBoxPrice(p);
                        const unitPrice = Number(p.preco_tabela) || 0;
                        const fator = Number(p.fator_conversao_estoque) || 1;

                        return (
                          <optgroup key={p.id} label={`${p.sku} - ${p.nome}`}>
                            <option value={`${p.id}:caixa`}>
                              📦 Caixa c/ {fator} un ({formatCurrency(boxPrice)}) — Disp: {availBoxes} cx
                            </option>
                            <option value={`${p.id}:unidade`}>
                              ✨ A Granel / Avulso ({formatCurrency(unitPrice)} un) — Disp: {availUnits} un
                            </option>
                          </optgroup>
                        );
                      })}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-2">SKU</th>
                        <th className="p-2">Produto</th>
                        <th className="p-2">Tipo / Embalagem</th>
                        <th className="p-2 text-center">Disp. Origem</th>
                        <th className="p-2 w-20">Qtd</th>
                        <th className="p-2 w-28">Preço Unit.</th>
                        <th className="p-2 w-20">Desc %</th>
                        <th className="p-2">Subtotal</th>
                        <th className="p-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {cartItems.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-4 text-center text-slate-500">
                            Nenhum item adicionado ao pedido.
                          </td>
                        </tr>
                      ) : (
                        cartItems.map((item, idx) => {
                          const isRep = formData.origem === 'representante';
                          const repId = formData.representante_id || '';
                          const b = stockBalances[item.produto_id];
                          const prod = produtos.find((p) => p.id === item.produto_id);
                          const fator = Number(prod?.fator_conversao_estoque) || 1;
                          const isAvulso = item.tipo_embalagem === 'unidade';
                          const avail = isRep
                            ? (isAvulso ? (b?.repsUnits[repId] || 0) : (b?.repsBoxes[repId] || 0))
                            : (isAvulso ? (b?.fabricaUnits || 0) : (b?.fabricaBoxes || 0));
                          const isShortage = avail < item.quantidade;

                          return (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="p-2 font-mono text-amber-400 font-bold">{item.produto_sku}</td>
                              <td className="p-2 font-medium">
                                <div>{item.produto_nome}</div>
                                {isAvulso ? (
                                  <span className="text-[10px] text-amber-400 font-medium bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20">
                                    Venda A Granel (Unidade Avulsa)
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">
                                    Caixa c/ {fator} un
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <select
                                  value={item.tipo_embalagem || 'caixa'}
                                  onChange={(e) => handleToggleEmbalagem(idx, e.target.value as 'caixa' | 'unidade')}
                                  className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                                >
                                  <option value="caixa">📦 Caixa c/ {fator} un</option>
                                  <option value="unidade">✨ A Granel (Avulso)</option>
                                </select>
                              </td>
                              <td className="p-2 text-center">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    isShortage
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}
                                  title={`Disponível no ${isRep ? 'Representante' : 'Estoque da Fábrica'}: ${avail} ${isAvulso ? 'unidades avulsas' : 'caixas'}`}
                                >
                                  {avail} {isAvulso ? 'un' : 'cx'} {isShortage && '⚠️'}
                                </span>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantidade}
                                  onChange={(e) => handleUpdateItem(idx, 'quantidade', e.target.value)}
                                  className="input-field !py-0.5 text-center font-bold"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.preco_unitario}
                                  onChange={(e) => handleUpdateItem(idx, 'preco_unitario', e.target.value)}
                                  className="input-field !py-0.5 font-mono"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={item.desconto_pct || 0}
                                  onChange={(e) => handleUpdateItem(idx, 'desconto_pct', e.target.value)}
                                  className="input-field !py-0.5 text-center"
                                />
                              </td>
                              <td className="p-2 font-bold text-emerald-400">{formatCurrency(item.subtotal)}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="p-1 rounded text-slate-500 hover:text-rose-400"
                                  title="Remover item do pedido"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

              {/* Summary Bar */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1">Subtotal Itens</label>
                  <div className="font-bold text-slate-200 text-sm">{formatCurrency(subtotal)}</div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Valor Frete (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.valor_frete || 0}
                    onChange={(e) => setFormData({ ...formData, valor_frete: parseFloat(e.target.value) || 0 })}
                    className="input-field !py-1"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Desconto Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.desconto_total || 0}
                    onChange={(e) => setFormData({ ...formData, desconto_total: parseFloat(e.target.value) || 0 })}
                    className="input-field !py-1"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">VALOR TOTAL FINAL</label>
                  <div className="font-extrabold text-emerald-400 text-base">{formatCurrency(total)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Condição de Pagamento</label>
                  <input
                    type="text"
                    value={formData.condicao_pagamento || ''}
                    onChange={(e) => setFormData({ ...formData, condicao_pagamento: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data Solicitada de Entrega</label>
                  <input
                    type="date"
                    value={formData.data_solicitada_entrega || ''}
                    onChange={(e) => setFormData({ ...formData, data_solicitada_entrega: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observações do Pedido</label>
                <textarea
                  rows={2}
                  value={formData.observacoes || ''}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                <div>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        const ped = pedidos.find((p) => p.id === editingId);
                        if (ped) handleDeletePedido(ped);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Pedido</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Salvar Pedido
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
