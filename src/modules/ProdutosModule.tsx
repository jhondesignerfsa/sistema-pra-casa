import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Edit2,
  Archive,
  History,
  X,
  Upload,
  Image as ImageIcon,
  Camera,
  Trash2,
  LayoutGrid,
  List,
  Barcode,
  Eye,
  CheckCircle,
  Tag,
  DollarSign,
  Layers,
  Sparkles,
  Calculator,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { Produto, HistoricoPreco } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportToExcel, parseExcelOrCSV } from '../utils/excelImport';
import { seedOfficialProducts } from '../db/seed';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_PRACASA_PNG } from '../utils/logoPraCasa';

const CATEGORIAS_SUGERIDAS = [
  'Molhos',
  'Pimentas',
  'Alho e Pastas',
  'Temperos',
  'Farofas',
  'Condimentos e Especiarias',
  'Outros',
];

export const ProdutosModule: React.FC = () => {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedProductHistory, setSelectedProductHistory] = useState<HistoricoPreco[]>([]);
  const [historyProductName, setHistoryProductName] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [motivoPreco, setMotivoPreco] = useState('');
  const [previewZoomImage, setPreviewZoomImage] = useState<string | null>(null);

  // Estados para Precificação Cheia da Caixa / Fardo (Cálculo Automático)
  const [boxPrecoTabela, setBoxPrecoTabela] = useState<string>('');
  const [boxCusto, setBoxCusto] = useState<string>('');
  const [boxPrecoMinimo, setBoxPrecoMinimo] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formData, setFormData] = useState<Partial<Produto>>({
    sku: '',
    nome: '',
    descricao: '',
    categoria: 'Molhos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.2,
    unidade_estoque: 'Unidade',
    fator_conversao_estoque: 12,
    codigo_barras: '',
    preco_tabela: 0,
    custo_unitario: 0,
    preco_minimo_autorizado: 0,
    estoque_minimo: 10,
    status: 'ativo',
    validade_dias: 365,
    imagem_path: '',
    observacoes: '',
  });

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      let data = await queryAll<Produto>('SELECT * FROM produto ORDER BY nome ASC');
      if (data.length === 0) {
        await seedOfficialProducts();
        data = await queryAll<Produto>('SELECT * FROM produto ORDER BY nome ASC');
      }
      setProdutos(data);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
    }
  };

  const handleOpenModal = (prod?: Produto, focusImage: boolean = false) => {
    if (prod) {
      setEditingId(prod.id);
      setFormData({ ...prod });
      const fator = Number(prod.fator_conversao_estoque) || 1;
      const initialBoxPrice = prod.preco_caixa && prod.preco_caixa > 0
        ? prod.preco_caixa
        : (prod.preco_tabela ? prod.preco_tabela * fator : 0);
      setBoxPrecoTabela(initialBoxPrice > 0 ? initialBoxPrice.toFixed(2) : '');
      setBoxCusto(prod.custo_unitario ? (prod.custo_unitario * fator).toFixed(2) : '');
      setBoxPrecoMinimo(prod.preco_minimo_autorizado ? (prod.preco_minimo_autorizado * fator).toFixed(2) : '');
    } else {
      setEditingId(null);
      setFormData({
        sku: `COD-${Math.floor(10 + Math.random() * 90)}`,
        nome: '',
        descricao: '',
        categoria: 'Molhos',
        marca: 'Tempero PraCasa',
        unidade_venda: 'Caixa c/ 12 un',
        peso_liquido_kg: 0.2,
        unidade_estoque: 'Unidade',
        fator_conversao_estoque: 12,
        codigo_barras: '',
        preco_tabela: 0,
        preco_caixa: undefined,
        custo_unitario: 0,
        preco_minimo_autorizado: 0,
        estoque_minimo: 2,
        status: 'ativo',
        validade_dias: 365,
        imagem_path: '',
        observacoes: '',
      });
      setBoxPrecoTabela('');
      setBoxCusto('');
      setBoxPrecoMinimo('');
    }
    setMotivoPreco('');
    setShowModal(true);

    if (focusImage) {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 250);
    }
  };

  // Funções de Cálculo Automático e Bidirecional de Preços (Caixa <-> Unidade)
  const handleBoxPrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBoxPrecoTabela(val);
    const cleanVal = val.replace(',', '.');
    const boxNum = parseFloat(cleanVal);
    const fator = Number(formData.fator_conversao_estoque) || 1;
    if (!isNaN(boxNum) && fator > 0) {
      const unit = Math.round((boxNum / fator) * 100) / 100;
      setFormData((prev) => ({ ...prev, preco_caixa: boxNum, preco_tabela: unit }));
    } else {
      setFormData((prev) => ({ ...prev, preco_caixa: undefined }));
    }
  };

  const handleUnitPrecoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleanVal = val.replace(',', '.');
    const unit = parseFloat(cleanVal);
    const fator = Number(formData.fator_conversao_estoque) || 1;
    const calcBox = !isNaN(unit) && fator > 0 ? Math.round(unit * fator * 100) / 100 : 0;
    setFormData((prev) => ({
      ...prev,
      preco_tabela: isNaN(unit) ? 0 : unit,
      preco_caixa: calcBox > 0 ? calcBox : undefined,
    }));
    if (!isNaN(unit) && fator > 0) {
      setBoxPrecoTabela(calcBox.toFixed(2));
    }
  };

  const handleBoxCustoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBoxCusto(val);
    const boxNum = parseFloat(val.replace(',', '.'));
    const fator = Number(formData.fator_conversao_estoque) || 1;
    if (!isNaN(boxNum) && fator > 0) {
      const unit = Math.round((boxNum / fator) * 100) / 100;
      setFormData((prev) => ({ ...prev, custo_unitario: unit }));
    }
  };

  const handleUnitCustoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleanVal = val.replace(',', '.');
    const unit = parseFloat(cleanVal);
    setFormData((prev) => ({ ...prev, custo_unitario: isNaN(unit) ? 0 : unit }));
    const fator = Number(formData.fator_conversao_estoque) || 1;
    if (!isNaN(unit) && fator > 0) {
      setBoxCusto((unit * fator).toFixed(2));
    }
  };

  const handleBoxPrecoMinimoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBoxPrecoMinimo(val);
    const boxNum = parseFloat(val.replace(',', '.'));
    const fator = Number(formData.fator_conversao_estoque) || 1;
    if (!isNaN(boxNum) && fator > 0) {
      const unit = Math.round((boxNum / fator) * 100) / 100;
      setFormData((prev) => ({ ...prev, preco_minimo_autorizado: unit }));
    }
  };

  const handleUnitPrecoMinimoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleanVal = val.replace(',', '.');
    const unit = parseFloat(cleanVal);
    setFormData((prev) => ({ ...prev, preco_minimo_autorizado: isNaN(unit) ? 0 : unit }));
    const fator = Number(formData.fator_conversao_estoque) || 1;
    if (!isNaN(unit) && fator > 0) {
      setBoxPrecoMinimo((unit * fator).toFixed(2));
    }
  };

  const handleFatorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFator = parseFloat(e.target.value) || 1;
    setFormData((prev) => ({ ...prev, fator_conversao_estoque: newFator }));

    const boxNum = parseFloat(boxPrecoTabela.replace(',', '.'));
    if (!isNaN(boxNum) && newFator > 0) {
      const unit = Math.round((boxNum / newFator) * 100) / 100;
      setFormData((prev) => ({ ...prev, preco_caixa: boxNum, preco_tabela: unit }));
    } else if (formData.preco_tabela) {
      const calcBox = Math.round(formData.preco_tabela * newFator * 100) / 100;
      setBoxPrecoTabela(calcBox.toFixed(2));
      setFormData((prev) => ({ ...prev, preco_caixa: calcBox }));
    }

    const boxCostNum = parseFloat(boxCusto.replace(',', '.'));
    if (!isNaN(boxCostNum) && newFator > 0) {
      const unitCost = Math.round((boxCostNum / newFator) * 100) / 100;
      setFormData((prev) => ({ ...prev, custo_unitario: unitCost }));
    } else if (formData.custo_unitario) {
      setBoxCusto((formData.custo_unitario * newFator).toFixed(2));
    }

    const boxMinNum = parseFloat(boxPrecoMinimo.replace(',', '.'));
    if (!isNaN(boxMinNum) && newFator > 0) {
      const unitMin = Math.round((boxMinNum / newFator) * 100) / 100;
      setFormData((prev) => ({ ...prev, preco_minimo_autorizado: unitMin }));
    } else if (formData.preco_minimo_autorizado) {
      setBoxPrecoMinimo((formData.preco_minimo_autorizado * newFator).toFixed(2));
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
      if (window.electronAPI && window.electronAPI.saveAttachment) {
        const buffer = await file.arrayBuffer();
        const bytes = Array.from(new Uint8Array(buffer));
        const savedPath = await window.electronAPI.saveAttachment({
          fileName: file.name,
          buffer: bytes,
        });
        setFormData((prev) => ({ ...prev, imagem_path: savedPath }));
      } else {
        // Web base64 DataURL fallback
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setFormData((prev) => ({ ...prev, imagem_path: dataUrl }));
      }
    } catch (err: any) {
      alert(`Erro ao carregar foto do produto: ${err.message}`);
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, imagem_path: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.nome.trim()) {
      alert('Informe o nome do produto.');
      return;
    }

    const now = new Date().toISOString();
    const safeSku = formData.sku?.trim() || `SKU-${Date.now().toString().slice(-5)}`;

    try {
      const fatorEstoqueNum = Number(formData.fator_conversao_estoque) || 1;
      const precoTabelaNum = typeof formData.preco_tabela === 'number' ? formData.preco_tabela : parseFloat(String(formData.preco_tabela || 0).replace(',', '.')) || 0;
      const precoCaixaNum = typeof formData.preco_caixa === 'number' 
        ? formData.preco_caixa 
        : (formData.preco_caixa ? parseFloat(String(formData.preco_caixa).replace(',', '.')) : null) || (boxPrecoTabela ? parseFloat(boxPrecoTabela.replace(',', '.')) : null) || (precoTabelaNum * fatorEstoqueNum);
      const custoUnitarioNum = typeof formData.custo_unitario === 'number' ? formData.custo_unitario : parseFloat(String(formData.custo_unitario || 0).replace(',', '.')) || 0;
      const precoMinimoNum = typeof formData.preco_minimo_autorizado === 'number' ? formData.preco_minimo_autorizado : parseFloat(String(formData.preco_minimo_autorizado || 0).replace(',', '.')) || 0;

      if (editingId) {
        const oldProd = await queryOne<Produto>('SELECT * FROM produto WHERE id = ?', [editingId]);
        if (oldProd && Math.abs(oldProd.preco_tabela - precoTabelaNum) > 0.0001) {
          await execute(
            `INSERT INTO historico_preco (id, produto_id, preco_anterior, preco_novo, motivo, usuario_id, data_alteracao)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              `hist_${Date.now()}`,
              editingId,
              oldProd.preco_tabela,
              precoTabelaNum,
              motivoPreco || 'Alteração manual de preço',
              'usr_admin',
              now,
            ]
          );
        }

        await execute(
          `UPDATE produto SET
            sku = ?, nome = ?, descricao = ?, categoria = ?, marca = ?, unidade_venda = ?,
            peso_liquido_kg = ?, unidade_estoque = ?, fator_conversao_estoque = ?, codigo_barras = ?,
            preco_tabela = ?, preco_caixa = ?, custo_unitario = ?, preco_minimo_autorizado = ?, estoque_minimo = ?,
            status = ?, validade_dias = ?, imagem_path = ?, observacoes = ?, updated_at = ?
          WHERE id = ?`,
          [
            safeSku,
            formData.nome.trim(),
            formData.descricao || '',
            formData.categoria || 'Geral',
            formData.marca || 'Tempero PraCasa',
            formData.unidade_venda || 'Unidade',
            formData.peso_liquido_kg || 0,
            formData.unidade_estoque || 'Unidade',
            fatorEstoqueNum,
            formData.codigo_barras || '',
            precoTabelaNum,
            precoCaixaNum,
            custoUnitarioNum,
            precoMinimoNum,
            formData.estoque_minimo || 0,
            formData.status || 'ativo',
            formData.validade_dias || 365,
            formData.imagem_path || null,
            formData.observacoes || '',
            now,
            editingId,
          ]
        );
      } else {
        const newId = `prod_custom_${Date.now()}`;
        await execute(
          `INSERT INTO produto (
            id, sku, nome, descricao, categoria, marca, unidade_venda, peso_liquido_kg,
            unidade_estoque, fator_conversao_estoque, codigo_barras, preco_tabela, preco_caixa, custo_unitario,
            preco_minimo_autorizado, estoque_minimo, status, validade_dias, imagem_path, observacoes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            safeSku,
            formData.nome.trim(),
            formData.descricao || '',
            formData.categoria || 'Geral',
            formData.marca || 'Tempero PraCasa',
            formData.unidade_venda || 'Unidade',
            formData.peso_liquido_kg || 0,
            formData.unidade_estoque || 'Unidade',
            fatorEstoqueNum,
            formData.codigo_barras || '',
            precoTabelaNum,
            precoCaixaNum,
            custoUnitarioNum,
            precoMinimoNum,
            formData.estoque_minimo || 0,
            formData.status || 'ativo',
            formData.validade_dias || 365,
            formData.imagem_path || null,
            formData.observacoes || '',
            now,
            now,
          ]
        );
      }

      setShowModal(false);
      await loadProdutos();
    } catch (err: any) {
      alert(`Erro ao salvar produto: ${err.message}`);
    }
  };

  const handleOpenHistory = async (prod: Produto) => {
    setHistoryProductName(prod.nome);
    const history = await queryAll<HistoricoPreco>(
      'SELECT * FROM historico_preco WHERE produto_id = ? ORDER BY data_alteracao DESC',
      [prod.id]
    );
    setSelectedProductHistory(history);
    setShowHistoryModal(true);
  };

  const handleToggleStatus = async (prod: Produto) => {
    const newStatus = prod.status === 'ativo' ? 'inativo' : 'ativo';
    if (confirm(`Deseja alterar o status do produto "${prod.nome}" para ${newStatus.toUpperCase()}?`)) {
      await execute('UPDATE produto SET status = ?, updated_at = ? WHERE id = ?', [
        newStatus,
        new Date().toISOString(),
        prod.id,
      ]);
      await loadProdutos();
    }
  };

  const handleDeleteProduct = async (id: string, nome?: string) => {
    const prodName = nome || formData.nome || 'este produto';
    if (!confirm(`Tem certeza de que deseja EXCLUIR DEFINITIVAMENTE o produto "${prodName}"?\n\nEsta ação apagará o item do catálogo e todos os seus vínculos.`)) {
      return;
    }

    try {
      // Remove registros dependentes para manter a integridade
      await execute('DELETE FROM historico_preco WHERE produto_id = ?', [id]);
      await execute('DELETE FROM movimento_estoque WHERE produto_id = ?', [id]);
      await execute('DELETE FROM item_pedido WHERE produto_id = ?', [id]);
      await execute('DELETE FROM produto WHERE id = ?', [id]);

      setShowModal(false);
      await loadProdutos();
      alert(`Produto "${prodName}" excluído com sucesso!`);
    } catch (err: any) {
      alert(`Erro ao excluir produto: ${err.message}`);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    try {
      doc.addImage(LOGO_PRACASA_PNG, 'PNG', 14, 10, 36, 22.3);
    } catch {}

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(153, 27, 27);
    doc.text('CATÁLOGO E TABELA DE PREÇOS — TEMPERO PRACASA', 54, 16);
    doc.setFontSize(8.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} | Total de Itens: ${filteredProdutos.length}`, 54, 22);
    doc.text('Fábrica de Molhos, Condimentos & Especiarias • Venda em Caixas, Fardos e Pacotes', 54, 27);

    const rows = filteredProdutos.map((p) => [
      p.sku,
      p.codigo_barras || '-',
      p.nome,
      p.categoria,
      p.unidade_venda,
      formatCurrency(p.preco_tabela),
      p.fator_conversao_estoque > 1
        ? formatCurrency(
            p.preco_caixa && p.preco_caixa > 0
              ? p.preco_caixa
              : p.preco_tabela * p.fator_conversao_estoque
          )
        : formatCurrency(p.preco_tabela),
      p.status.toUpperCase(),
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['SKU', 'EAN-13', 'Produto', 'Categoria', 'Embalagem Venda', 'Preço Unit.', 'Preço Caixa/Fd', 'Status']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
    });

    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Tempero PraCasa • O verdadeiro sabor caseiro! • Barra do Pojuca, Camaçari/BA', 14, 290);
      doc.text(`Página ${p} de ${totalPages}`, 196, 290, { align: 'right' });
    }

    doc.save(`Catalogo_Produtos_PraCasa_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleExportExcel = () => {
    const exportData = filteredProdutos.map((p) => ({
      SKU: p.sku,
      'Código de Barras (EAN)': p.codigo_barras || '-',
      Nome: p.nome,
      Categoria: p.categoria,
      Marca: p.marca,
      'Unidade Venda': p.unidade_venda,
      'Preço Tabela (R$)': p.preco_tabela,
      'Custo (R$)': p.custo_unitario || '-',
      'Estoque Mínimo': p.estoque_minimo,
      Status: p.status,
      Descrição: p.descricao || '',
    }));
    exportToExcel(exportData, 'catalogo_produtos_pracasa');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const records = await parseExcelOrCSV(file);
      if (records.length === 0) {
        alert('Nenhum registro encontrado na planilha.');
        return;
      }

      let importedCount = 0;
      const now = new Date().toISOString();

      for (const row of records) {
        const sku = row.SKU || row.sku || `SKU-IMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const nome = row.Nome || row.nome || row.Produto || row['Descrição'];
        if (!nome) continue;

        const cat = row.Categoria || row.categoria || 'Temperos';
        const preco = parseFloat(row.Preco || row.preco || row['Preço Tabela (R$)'] || row['PREÇO TABELA']) || 10.0;
        const ean = row.EAN || row.ean || row['EAN-13'] || row['Código de Barras'] || '';
        const uVenda = row['Unidade Venda'] || row.unidade_venda || row.EMB || 'Unidade';

        const existing = await queryOne<Produto>('SELECT id FROM produto WHERE sku = ? OR codigo_barras = ?', [sku, ean]);
        if (existing) {
          await execute(
            `UPDATE produto SET nome = ?, categoria = ?, preco_tabela = ?, codigo_barras = ?, updated_at = ? WHERE id = ?`,
            [nome, cat, preco, ean, now, existing.id]
          );
        } else {
          await execute(
            `INSERT INTO produto (id, sku, nome, categoria, marca, unidade_venda, unidade_estoque, fator_conversao_estoque, codigo_barras, preco_tabela, estoque_minimo, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'Tempero PraCasa', ?, 'Unidade', 1, ?, ?, 12, 'ativo', ?, ?)`,
            [`prod_imp_${Date.now()}_${Math.floor(Math.random() * 1000)}`, sku, nome, cat, uVenda, ean, preco, now, now]
          );
        }
        importedCount++;
      }

      alert(`Importação concluída! ${importedCount} produtos processados.`);
      setShowImportModal(false);
      await loadProdutos();
    } catch (err: any) {
      alert(`Erro na importação: ${err.message}`);
    }
  };

  const categories = Array.from(new Set(produtos.map((p) => p.categoria)));

  const filteredProdutos = produtos.filter((p) => {
    const matchesSearch =
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.codigo_barras && p.codigo_barras.includes(searchTerm)) ||
      p.categoria.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = categoryFilter === 'todos' || p.categoria === categoryFilter;
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-6 h-6 text-amber-500" />
            Catálogo de Produtos & Tabela de Preços
          </h2>
          <p className="text-xs text-slate-400">
            Catálogo oficial Tempero PraCasa. Visualize, edite fotos, preços, embalagens, códigos EAN e descrições.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'grid' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Cards com Fotos"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-all ${
                viewMode === 'table' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Visualização em Tabela"
            >
              <List className="w-3.5 h-3.5" />
              <span>Tabela</span>
            </button>
          </div>

          <button onClick={() => setShowImportModal(true)} className="btn-secondary text-xs">
            <Upload className="w-4 h-4" />
            <span>Importar</span>
          </button>
          <button onClick={handleExportExcel} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel</span>
          </button>
          <button onClick={handleExportPDF} className="btn-secondary text-xs">
            <FileText className="w-4 h-4 text-rose-400" />
            <span>Catálogo PDF</span>
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, SKU, código de barras EAN ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input-field"
          >
            <option value="todos">Todas as Categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
        </div>
      </div>

      {/* Products Content: Grid or Table */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProdutos.length === 0 ? (
            <div className="col-span-full glass-panel p-10 text-center text-slate-500 text-xs">
              Nenhum produto encontrado com os filtros atuais.
            </div>
          ) : (
            filteredProdutos.map((prod) => (
              <div
                key={prod.id}
                className="glass-panel p-4 rounded-xl flex flex-col justify-between hover:border-amber-500/40 transition-all space-y-3 group"
              >
                <div className="space-y-3">
                  {/* Photo Section */}
                  <div className="h-44 w-full bg-slate-950/70 rounded-lg border border-slate-800/80 overflow-hidden relative flex items-center justify-center">
                    {prod.imagem_path ? (
                      <>
                        <img
                          src={prod.imagem_path}
                          alt={prod.nome}
                          className="h-full w-full object-contain p-2 group-hover:scale-105 transition-all cursor-pointer"
                          onClick={() => setPreviewZoomImage(prod.imagem_path || null)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewZoomImage(prod.imagem_path || null)}
                          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-300 hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-all shadow"
                          title="Ampliar foto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center space-y-2 text-slate-500">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-medium text-slate-400">Sem foto</span>
                        <button
                          type="button"
                          onClick={() => handleOpenModal(prod, true)}
                          className="text-[10px] text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Adicionar Foto</span>
                        </button>
                      </div>
                    )}

                    {/* Status Pill on Photo */}
                    <span
                      className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        prod.status === 'ativo'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {prod.status}
                    </span>
                  </div>

                  {/* Badges & SKU */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {prod.sku}
                    </span>
                    <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded text-[10px] border border-slate-800">
                      {prod.categoria}
                    </span>
                  </div>

                  {/* Name and Description */}
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm line-clamp-2 leading-tight" title={prod.nome}>
                      {prod.nome}
                    </h3>
                    {prod.descricao && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-snug">
                        {prod.descricao}
                      </p>
                    )}
                  </div>

                  {/* Price & Unit Block */}
                  <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[11px]">Preço Unitário:</span>
                      <span className="font-extrabold text-emerald-400 text-sm font-mono">
                        {formatCurrency(prod.preco_tabela)}
                      </span>
                    </div>

                    {prod.fator_conversao_estoque > 1 && (
                      <div className="flex justify-between items-baseline text-[11px]">
                        <span className="text-amber-400 font-medium">Preço Caixa / Fd:</span>
                        <span className="font-bold text-amber-300 font-mono">
                          {formatCurrency(
                            prod.preco_caixa && prod.preco_caixa > 0
                              ? prod.preco_caixa
                              : prod.preco_tabela * prod.fator_conversao_estoque
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Embalagem:</span>
                      <span className="text-slate-200 font-medium truncate max-w-[130px]">{prod.unidade_venda}</span>
                    </div>

                    {prod.codigo_barras && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5 border-t border-slate-800">
                        <span className="flex items-center gap-1">
                          <Barcode className="w-3 h-3 text-slate-500" /> EAN:
                        </span>
                        <span>{prod.codigo_barras}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="border-t border-slate-800 pt-2.5 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleOpenHistory(prod)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-all text-xs flex items-center gap-1"
                    title="Histórico de Preços"
                  >
                    <History className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleOpenModal(prod)}
                    className="btn-primary text-xs !py-1 !px-3 flex-1 flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar & Foto</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(prod)}
                    className={`p-1.5 rounded hover:bg-slate-800 transition-all ${
                      prod.status === 'ativo' ? 'text-slate-500 hover:text-amber-400' : 'text-slate-500 hover:text-emerald-400'
                    }`}
                    title={prod.status === 'ativo' ? 'Inativar Produto' : 'Ativar Produto'}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteProduct(prod.id, prod.nome)}
                    className="p-1.5 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-all"
                    title="Excluir Produto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Table View */
        <div className="glass-panel overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Foto</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">EAN-13</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Embalagem</th>
                  <th className="p-3">Preço Unit.</th>
                  <th className="p-3">Preço Cx / Fd</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProdutos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredProdutos.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-800/40 transition-all">
                      <td className="p-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                          {prod.imagem_path ? (
                            <img
                              src={prod.imagem_path}
                              alt={prod.nome}
                              className="w-full h-full object-contain cursor-pointer"
                              onClick={() => setPreviewZoomImage(prod.imagem_path || null)}
                            />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400">{prod.sku}</td>
                      <td className="p-3 font-mono text-slate-400">{prod.codigo_barras || '-'}</td>
                      <td className="p-3 font-medium text-slate-100">{prod.nome}</td>
                      <td className="p-3">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 border border-slate-700/50">
                          {prod.categoria}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300">{prod.unidade_venda}</td>
                      <td className="p-3 font-bold text-emerald-400 font-mono">
                        {formatCurrency(prod.preco_tabela)}
                      </td>
                      <td className="p-3 font-bold text-amber-300 font-mono">
                        {prod.fator_conversao_estoque > 1
                          ? formatCurrency(
                              prod.preco_caixa && prod.preco_caixa > 0
                                ? prod.preco_caixa
                                : prod.preco_tabela * prod.fator_conversao_estoque
                            )
                          : formatCurrency(prod.preco_tabela)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            prod.status === 'ativo'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {prod.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenHistory(prod)}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all"
                          title="Histórico de Preços"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(prod)}
                          className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-all"
                          title="Editar Produto & Foto"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(prod)}
                          className={`p-1.5 rounded hover:bg-slate-700 transition-all ${
                            prod.status === 'ativo' ? 'text-slate-400 hover:text-amber-400' : 'text-slate-400 hover:text-emerald-400'
                          }`}
                          title={prod.status === 'ativo' ? 'Inativar' : 'Ativar'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id, prod.nome)}
                          className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-all"
                          title="Excluir Produto"
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
      )}

      {/* Modal Add / Edit Product */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl p-6 rounded-xl space-y-4 my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-500" />
                  {editingId ? 'Editar Produto & Foto' : 'Novo Produto Tempero PraCasa'}
                </h3>
                <p className="text-xs text-slate-400">
                  Preencha os dados, altere fotos, valores, embalagens e informações comerciais.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
              {/* Product Photo Upload Area */}
              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                <label className="block font-semibold text-slate-200 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-500" />
                  Foto do Produto (Imagem PNG, JPG, JPEG, WEBP)
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Photo Preview Box */}
                  <div className="w-32 h-32 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center relative group shrink-0">
                    {formData.imagem_path ? (
                      <>
                        <img
                          src={formData.imagem_path}
                          alt="Pré-visualização"
                          className="h-full w-full object-contain p-1"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute top-1 right-1 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded shadow"
                          title="Remover foto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2 text-slate-500 space-y-1">
                        <ImageIcon className="w-8 h-8 mx-auto text-slate-600" />
                        <span className="text-[10px] block text-slate-500">Nenhuma foto</span>
                      </div>
                    )}
                  </div>

                  {/* Actions for Photo */}
                  <div className="flex-1 space-y-2 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingImage}
                        className="btn-secondary !py-2 !px-3 text-xs flex items-center gap-2"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>{formData.imagem_path ? 'Trocar Foto' : 'Selecionar Foto do Computador'}</span>
                      </button>

                      {formData.imagem_path && (
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="p-2 text-slate-400 hover:text-rose-400 rounded bg-slate-800 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Ou cole o link direto da imagem se preferir:
                    </div>
                    <input
                      type="text"
                      placeholder="https://exemplo.com/foto_produto.jpg"
                      value={formData.imagem_path || ''}
                      onChange={(e) => setFormData({ ...formData, imagem_path: e.target.value })}
                      className="input-field text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Product Basic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">SKU / Código Único *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku || ''}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Nome Comercial *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Molho de Pimenta Carolina Reaper 190ml"
                    value={formData.nome || ''}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="input-field font-semibold text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Código de Barras (EAN-13)</label>
                  <input
                    type="text"
                    placeholder="Ex: 7600000346479"
                    value={formData.codigo_barras || ''}
                    onChange={(e) => setFormData({ ...formData, codigo_barras: e.target.value })}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Categoria *</label>
                  <input
                    type="text"
                    required
                    list="categorias-list"
                    value={formData.categoria || ''}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="input-field"
                  />
                  <datalist id="categorias-list">
                    {CATEGORIAS_SUGERIDAS.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Status do Produto</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="input-field"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>

                {/* SEÇÃO DE PRECIFICAÇÃO DA CAIXA E EMBALAGEM COM CÁLCULO AUTOMÁTICO */}
                <div className="md:col-span-3 bg-slate-950/85 border border-amber-500/35 rounded-xl p-4 space-y-4 shadow-lg shadow-black/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Calculator className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                          Precificação da Caixa & Cálculo Automático
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Altere o <b>valor cheio da caixa</b> (ex: R$ 65,89) ou o <b>preço unitário</b> — o sistema divide e sincroniza automaticamente.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Configuração da Embalagem & Fator de Conversão */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-200 mb-1">
                        Embalagem / Unid. Venda *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Caixa c/ 12 un"
                        value={formData.unidade_venda || ''}
                        onChange={(e) => setFormData({ ...formData, unidade_venda: e.target.value })}
                        className="input-field text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center justify-between">
                        <span>Qtd de Itens na Caixa / Fardo *</span>
                        <span className="text-[10px] text-slate-400 font-normal">Fator Divisor</span>
                      </label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required
                        placeholder="Ex: 12"
                        value={formData.fator_conversao_estoque || 1}
                        onChange={handleFatorChange}
                        className="input-field font-bold text-amber-400 font-mono text-xs bg-slate-900 border-amber-500/40"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Estoque Mínimo em Caixas (Alerta)
                      </label>
                      <input
                        type="number"
                        value={formData.estoque_minimo || 2}
                        onChange={(e) =>
                          setFormData({ ...formData, estoque_minimo: parseInt(e.target.value) || 0 })
                        }
                        className="input-field text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* 3 Cards de Valores: Preço Tabela, Custo, Preço Mínimo */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                    {/* Card 1: Preço de Tabela / Venda */}
                    <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" /> PREÇO DE VENDA (TABELA)
                        </span>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-500/20">
                          {formData.fator_conversao_estoque || 1} un/cx
                        </span>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-200 font-semibold block mb-1">
                          Valor Cheio da Caixa (R$)
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-amber-500/50 bg-slate-950 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/20">
                          <span className="bg-slate-800/90 text-amber-400 text-xs font-mono font-bold px-3 flex items-center border-r border-slate-700/80 select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 65.89"
                            value={boxPrecoTabela}
                            onChange={handleBoxPrecoChange}
                            className="bg-transparent text-amber-300 font-mono font-extrabold text-sm px-3 py-2 w-full outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 font-medium block mb-1">
                          Preço Unitário / Pacote (R$) *
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                          <span className="bg-slate-800/90 text-emerald-400 text-xs font-mono font-bold px-3 flex items-center border-r border-slate-700/80 select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            required
                            placeholder="Ex: 5.49"
                            value={formData.preco_tabela ?? 0}
                            onChange={handleUnitPrecoChange}
                            className="bg-transparent text-emerald-400 font-mono font-bold text-xs px-3 py-2 w-full outline-none"
                          />
                        </div>
                      </div>

                      {boxPrecoTabela && Number(formData.fator_conversao_estoque) > 0 && (
                        <div className="text-[10px] text-slate-400 bg-slate-950/80 p-1.5 rounded border border-slate-800 text-center font-mono">
                          R$ {Number(boxPrecoTabela).toFixed(2)} ÷ {formData.fator_conversao_estoque} un = <span className="text-emerald-400 font-bold">R$ {Number(formData.preco_tabela || 0).toFixed(2)}/un</span>
                        </div>
                      )}
                    </div>

                    {/* Card 2: Custo de Produção */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-[11px] font-bold text-slate-300">
                          CUSTO DE PRODUÇÃO
                        </span>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                          Custo da Caixa Cheia (R$)
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500/20">
                          <span className="bg-slate-800/90 text-slate-400 text-xs font-mono font-bold px-3 flex items-center border-r border-slate-700/80 select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 45.00"
                            value={boxCusto}
                            onChange={handleBoxCustoChange}
                            className="bg-transparent text-slate-200 font-mono font-bold text-sm px-3 py-2 w-full outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 font-medium block mb-1">
                          Custo Unitário (R$)
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500/20">
                          <span className="bg-slate-800/90 text-slate-400 text-xs font-mono font-bold px-3 flex items-center border-r border-slate-700/80 select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.custo_unitario ?? 0}
                            onChange={handleUnitCustoChange}
                            className="bg-transparent text-slate-300 font-mono text-xs px-3 py-2 w-full outline-none"
                          />
                        </div>
                      </div>

                      {boxCusto && Number(formData.fator_conversao_estoque) > 0 && (
                        <div className="text-[10px] text-slate-400 bg-slate-950/80 p-1.5 rounded border border-slate-800 text-center font-mono">
                          R$ {Number(boxCusto).toFixed(2)} ÷ {formData.fator_conversao_estoque} un = <span className="text-slate-200 font-bold">R$ {Number(formData.custo_unitario || 0).toFixed(2)}/un</span>
                        </div>
                      )}
                    </div>

                    {/* Card 3: Preço Mínimo Autorizado */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-[11px] font-bold text-slate-300">
                          PREÇO MÍNIMO (DESCONTO MÁX)
                        </span>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                          Preço Mínimo da Caixa (R$)
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500/20">
                          <span className="bg-slate-800/90 text-slate-400 text-xs font-mono font-bold px-3 flex items-center border-r border-slate-700/80 select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 58.00"
                            value={boxPrecoMinimo}
                            onChange={handleBoxPrecoMinimoChange}
                            className="bg-transparent text-slate-200 font-mono font-bold text-sm px-3 py-2 w-full outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] text-slate-400 font-medium block mb-1">
                          Preço Mínimo Unitário (R$)
                        </label>
                        <div className="flex rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-500/20">
                          <span className="bg-slate-800/90 text-slate-400 text-xs font-mono font-bold px-3 flex items-center border-r border-slate-700/80 select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.preco_minimo_autorizado ?? 0}
                            onChange={handleUnitPrecoMinimoChange}
                            className="bg-transparent text-slate-300 font-mono text-xs px-3 py-2 w-full outline-none"
                          />
                        </div>
                      </div>

                      {boxPrecoMinimo && Number(formData.fator_conversao_estoque) > 0 && (
                        <div className="text-[10px] text-slate-400 bg-slate-950/80 p-1.5 rounded border border-slate-800 text-center font-mono">
                          R$ {Number(boxPrecoMinimo).toFixed(2)} ÷ {formData.fator_conversao_estoque} un = <span className="text-slate-200 font-bold">R$ {Number(formData.preco_minimo_autorizado || 0).toFixed(2)}/un</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-300 mb-1">Descrição Comercial Detalhada</label>
                  <textarea
                    rows={2}
                    placeholder="Características, ingredientes, diferenciais de sabor para o catálogo..."
                    value={formData.descricao || ''}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-semibold text-slate-300 mb-1">Observações Internas</label>
                  <input
                    type="text"
                    placeholder="Observações de lote, fornecedor ou produção..."
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {editingId && (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                  <label className="block font-semibold text-amber-400 mb-1">
                    Motivo da Alteração de Preço (Registrado no Histórico)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Reajuste de custos / nova tabela de fábrica"
                    value={motivoPreco}
                    onChange={(e) => setMotivoPreco(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-3 border-t border-slate-800 pt-3">
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-[11px] text-slate-500">
                    {editingId ? 'Editando produto existente.' : 'Criando novo item de catálogo.'}
                  </span>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(editingId, formData.nome)}
                      className="btn-danger text-xs !py-1.5 !px-3 flex items-center gap-1.5"
                      title="Excluir produto definitivamente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir Produto</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primary">
                    Salvar Produto com Ajustes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Price History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Histórico de Preços: {historyProductName}
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {selectedProductHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  Nenhuma alteração de preço registrada para este produto.
                </p>
              ) : (
                selectedProductHistory.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-400">{formatDate(h.data_alteracao)}</span>
                      <span className="text-amber-400">
                        {formatCurrency(h.preco_anterior)} →{' '}
                        <strong className="text-emerald-400">{formatCurrency(h.preco_novo)}</strong>
                      </span>
                    </div>
                    {h.motivo && <p className="text-[11px] text-slate-400 italic">Motivo: {h.motivo}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Upload className="w-4 h-4 text-amber-500" />
                Importar Planilha de Produtos
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Selecione um arquivo CSV ou Excel (.xlsx) contendo as colunas: <strong>SKU, Nome, Categoria, Preço, EAN-13, EMB</strong>.
            </p>

            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleImportFile}
              className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-400 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Image Lightbox Preview Modal */}
      {previewZoomImage && (
        <div
          onClick={() => setPreviewZoomImage(null)}
          className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewZoomImage(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-full border border-slate-700 shadow-xl"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewZoomImage}
              alt="Visualização do produto"
              className="max-h-[80vh] max-w-full rounded-xl shadow-2xl object-contain border border-slate-800 bg-slate-950/90"
            />
          </div>
        </div>
      )}
    </div>
  );
};
