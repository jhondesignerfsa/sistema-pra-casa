import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  FileSpreadsheet,
  FileText,
  Edit2,
  Archive,
  X,
  Upload,
  CheckCircle,
  AlertTriangle,
  Building2,
  FileCheck,
  Shield,
  ShieldAlert,
  Paperclip,
  Trash2,
  Eye,
  Download,
  Image as ImageIcon,
  File,
  Phone,
  User,
  ExternalLink,
  MessageCircle,
  ShoppingCart,
  ShoppingBag,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { queryAll, execute, queryOne } from '../db/database';
import { Representante, Empresa, ContatoSeguranca, Anexo, Pedido, ItemPedido, Cliente } from '../types';
import { formatCurrency, formatDate, maskCPF, maskCNPJ, maskPhone } from '../utils/formatters';
import { exportToExcel, parseExcelOrCSV } from '../utils/excelImport';
import { generateContratoRepresentacaoPDF, generatePedidoPDF } from '../utils/pdfGenerator';

const DOC_CATEGORIES = [
  { value: 'rg_cnh', label: '🪪 Documento de Identificação (RG / CNH)' },
  { value: 'comprovante_residencia', label: '🏠 Comprovante de Residência' },
  { value: 'core', label: '🔖 Certidão / Carteira CORE' },
  { value: 'contrato_social_cnpj', label: '📜 Contrato Social / Cartão CNPJ' },
  { value: 'foto_perfil', label: '👤 Foto de Perfil / Documento Pessoal' },
  { value: 'outro', label: '📝 Outros Documentos / Procuração' },
];

const RELACOES_SEGURANCA = [
  'Cônjuge / Esposo(a)',
  'Mãe / Pai',
  'Filho(a)',
  'Irmão(ã)',
  'Sócio(a) / Parceiro Comercial',
  'Referência Comercial',
  'Familiar',
  'Amigo(a) / Outro',
];

export const RepresentantesModule: React.FC = () => {
  const [representantes, setRepresentantes] = useState<Representante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dados' | 'contatos' | 'documentos'>('dados');

  const [selectedRep, setSelectedRep] = useState<Representante | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeRepId, setActiveRepId] = useState<string>('');

  // Attachments, sales and details cache
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [repSalesStats, setRepSalesStats] = useState<Record<string, { total_pedidos: number; total_valor: number }>>({});
  const [detailsAttachments, setDetailsAttachments] = useState<Anexo[]>([]);
  const [detailsPedidos, setDetailsPedidos] = useState<Pedido[]>([]);
  const [detailsTab, setDetailsTab] = useState<'geral' | 'pedidos' | 'documentos'>('geral');

  // Modal Safety Contacts State
  const [safetyContacts, setSafetyContacts] = useState<ContatoSeguranca[]>([]);
  const [newContactName, setNewContactName] = useState('');
  const [newContactRel, setNewContactRel] = useState(RELACOES_SEGURANCA[0]);
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactObs, setNewContactObs] = useState('');

  // Modal Attachments State
  const [attachments, setAttachments] = useState<Anexo[]>([]);
  const [selectedDocCategory, setSelectedDocCategory] = useState(DOC_CATEGORIES[0].value);
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form Data (Only nome_razao is strictly required)
  const [formData, setFormData] = useState<Partial<Representante>>({
    codigo: '',
    tipo: 'PF',
    nome_razao: '',
    nome_fantasia: '',
    cpf_cnpj: '',
    rg: '',
    data_nascimento: '',
    endereco: '',
    telefone: '',
    whatsapp: '',
    email: '',
    core_numero: '',
    core_uf: 'BA',
    rep_legal_nome: '',
    rep_legal_cpf: '',
    dados_bancarios_pix: '',
    territorio: '',
    exclusividade_territorial: true,
    exclusividade_condicoes: '',
    exclusividade_outras_representadas: false,
    regras_vendas_diretas: '',
    percentual_comissao: 10.0,
    data_inicio: new Date().toISOString().slice(0, 10),
    status: 'ativo',
    observacoes_internas: '',
    possui_estoque_proprio: false,
  });

  useEffect(() => {
    loadRepresentantes();
  }, []);

  const loadRepresentantes = async () => {
    try {
      const data = await queryAll<Representante>('SELECT * FROM representante ORDER BY nome_razao ASC');
      setRepresentantes(data);

      // Load attachment counts
      const counts = await queryAll<{ entidade_id: string; total: number }>(
        `SELECT entidade_id, COUNT(*) as total FROM anexo WHERE entidade_tipo = 'representante' GROUP BY entidade_id`
      );
      const countMap: Record<string, number> = {};
      counts.forEach((c) => {
        countMap[c.entidade_id] = c.total;
      });
      setAttachmentCounts(countMap);

      // Load sales stats per representative
      const sales = await queryAll<{ representante_id: string; total_pedidos: number; total_valor: number }>(
        `SELECT representante_id, COUNT(*) as total_pedidos, SUM(valor_total) as total_valor FROM pedido GROUP BY representante_id`
      );
      const salesMap: Record<string, { total_pedidos: number; total_valor: number }> = {};
      sales.forEach((s) => {
        salesMap[s.representante_id] = {
          total_pedidos: s.total_pedidos || 0,
          total_valor: s.total_valor || 0,
        };
      });
      setRepSalesStats(salesMap);
    } catch (err) {
      console.error('Erro ao carregar representantes:', err);
    }
  };

  const loadAttachmentsForRep = async (repId: string) => {
    try {
      const docs = await queryAll<Anexo>(
        `SELECT * FROM anexo WHERE entidade_tipo = 'representante' AND entidade_id = ? ORDER BY created_at DESC`,
        [repId]
      );
      setAttachments(docs);
    } catch (err) {
      console.error('Erro ao carregar anexos:', err);
    }
  };

  const handleOpenModal = async (rep?: Representante, defaultTab: 'dados' | 'contatos' | 'documentos' = 'dados') => {
    setActiveTab(defaultTab);
    if (rep) {
      setEditingId(rep.id);
      setActiveRepId(rep.id);
      setFormData(rep);

      // Parse safety contacts
      try {
        const parsed = rep.contatos_seguranca ? JSON.parse(rep.contatos_seguranca) : [];
        setSafetyContacts(Array.isArray(parsed) ? parsed : []);
      } catch {
        setSafetyContacts([]);
      }

      await loadAttachmentsForRep(rep.id);
    } else {
      const newId = `rep_${Date.now()}`;
      setEditingId(null);
      setActiveRepId(newId);
      setFormData({
        codigo: `REP-${Math.floor(100 + Math.random() * 900)}`,
        tipo: 'PF',
        nome_razao: '',
        nome_fantasia: '',
        cpf_cnpj: '',
        rg: '',
        data_nascimento: '',
        endereco: '',
        telefone: '',
        whatsapp: '',
        email: '',
        core_numero: '',
        core_uf: 'BA',
        rep_legal_nome: '',
        rep_legal_cpf: '',
        dados_bancarios_pix: '',
        territorio: '',
        exclusividade_territorial: true,
        exclusividade_condicoes: '',
        exclusividade_outras_representadas: false,
        regras_vendas_diretas: '',
        percentual_comissao: 10.0,
        data_inicio: new Date().toISOString().slice(0, 10),
        status: 'ativo',
        observacoes_internas: '',
        possui_estoque_proprio: false,
      });
      setSafetyContacts([]);
      setAttachments([]);
    }

    setNewContactName('');
    setNewContactRel(RELACOES_SEGURANCA[0]);
    setNewContactPhone('');
    setNewContactObs('');
    setShowModal(true);
  };

  const handleAddSafetyContact = () => {
    if (!newContactName.trim()) {
      alert('Informe ao menos o nome do contato de segurança.');
      return;
    }
    const newContact: ContatoSeguranca = {
      id: `cs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      nome: newContactName.trim(),
      parentesco_relacao: newContactRel,
      telefone: newContactPhone.trim(),
      observacao: newContactObs.trim(),
    };
    setSafetyContacts([...safetyContacts, newContact]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactObs('');
  };

  const handleRemoveSafetyContact = (id: string) => {
    setSafetyContacts(safetyContacts.filter((c) => c.id !== id));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await processAndSaveAttachment(file, selectedDocCategory);
      }
      await loadAttachmentsForRep(activeRepId);
    } catch (err: any) {
      alert(`Erro ao anexar arquivo: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleElectronSelectFile = async () => {
    if (window.electronAPI) {
      setIsUploading(true);
      try {
        const fileData = await window.electronAPI.selectFile([
          {
            name: 'Documentos e Imagens (PDF, PNG, JPG)',
            extensions: ['pdf', 'png', 'jpg', 'jpeg', 'webp'],
          },
        ]);

        if (fileData) {
          const savedRelativePath = await window.electronAPI.saveAttachment({
            fileName: fileData.fileName,
            buffer: fileData.buffer,
          });

          const isPdf = fileData.fileName.toLowerCase().endsWith('.pdf');
          const mime = isPdf ? 'application/pdf' : 'image/jpeg';
          const now = new Date().toISOString();

          await execute(
            `INSERT INTO anexo (id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, categoria, entidade_tipo, entidade_id, usuario_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'representante', ?, 'usr_admin', ?)`,
            [
              `anx_${Date.now()}`,
              fileData.fileName,
              savedRelativePath,
              savedRelativePath,
              mime,
              fileData.buffer.length,
              selectedDocCategory,
              activeRepId,
              now,
            ]
          );

          await loadAttachmentsForRep(activeRepId);
        }
      } catch (err: any) {
        alert(`Erro ao selecionar arquivo: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    } else {
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  const processAndSaveAttachment = async (file: File, category: string) => {
    const now = new Date().toISOString();
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const mime = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

    if (window.electronAPI && window.electronAPI.saveAttachment) {
      const buffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));
      const savedRelativePath = await window.electronAPI.saveAttachment({
        fileName: file.name,
        buffer: bytes,
      });

      await execute(
        `INSERT INTO anexo (id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, categoria, entidade_tipo, entidade_id, usuario_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'representante', ?, 'usr_admin', ?)`,
        [
          `anx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file.name,
          savedRelativePath,
          savedRelativePath,
          mime,
          file.size,
          category,
          activeRepId,
          now,
        ]
      );
    } else {
      // Browser fallback using base64 data URL
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await execute(
        `INSERT INTO anexo (id, nome_original, nome_armazenado, caminho_relativo, mime_type, tamanho_bytes, categoria, entidade_tipo, entidade_id, usuario_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'representante', ?, 'usr_admin', ?)`,
        [
          `anx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          file.name,
          file.name,
          dataUrl,
          mime,
          file.size,
          category,
          activeRepId,
          now,
        ]
      );
    }
  };

  const handleOpenAttachment = async (anx: Anexo) => {
    if (anx.mime_type.startsWith('image/') || anx.caminho_relativo.startsWith('data:image/')) {
      setPreviewImage(anx.caminho_relativo);
      return;
    }

    if (window.electronAPI && window.electronAPI.openAttachment && !anx.caminho_relativo.startsWith('data:')) {
      const ok = await window.electronAPI.openAttachment(anx.caminho_relativo);
      if (!ok) alert(`Não foi possível abrir o anexo pelo sistema: ${anx.nome_original}`);
    } else {
      // Open data URL or download
      const w = window.open();
      if (w) {
        w.document.write(
          `<iframe src="${anx.caminho_relativo}" style="width:100%; height:100%; border:none;" title="${anx.nome_original}"></iframe>`
        );
      }
    }
  };

  const handleDeleteAttachment = async (anxId: string) => {
    if (!confirm('Deseja realmente excluir este documento do representante?')) return;
    try {
      await execute('DELETE FROM anexo WHERE id = ?', [anxId]);
      await loadAttachmentsForRep(activeRepId);
    } catch (err: any) {
      alert(`Erro ao excluir anexo: ${err.message}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only Nome Completo / Razão Social is strictly required
    if (!formData.nome_razao || !formData.nome_razao.trim()) {
      alert('Por favor, informe ao menos o Nome Completo ou Razão Social do representante.');
      setActiveTab('dados');
      return;
    }

    const now = new Date().toISOString();
    const safeCodigo = formData.codigo?.trim() || `REP-${Math.floor(100 + Math.random() * 900)}`;
    const jsonSafety = JSON.stringify(safetyContacts);

    try {
      if (editingId) {
        await execute(
          `UPDATE representante SET
            codigo = ?, tipo = ?, nome_razao = ?, nome_fantasia = ?, cpf_cnpj = ?, rg = ?,
            data_nascimento = ?, endereco = ?, telefone = ?, whatsapp = ?, email = ?, core_numero = ?,
            core_uf = ?, rep_legal_nome = ?, rep_legal_cpf = ?, dados_bancarios_pix = ?, territorio = ?,
            exclusividade_territorial = ?, exclusividade_condicoes = ?, exclusividade_outras_representadas = ?,
            regras_vendas_diretas = ?, percentual_comissao = ?, data_inicio = ?, status = ?,
            observacoes_internas = ?, possui_estoque_proprio = ?, contatos_seguranca = ?, updated_at = ?
          WHERE id = ?`,
          [
            safeCodigo,
            formData.tipo || 'PF',
            formData.nome_razao.trim(),
            formData.nome_fantasia || '',
            formData.cpf_cnpj || '',
            formData.rg || '',
            formData.data_nascimento || '',
            formData.endereco || '',
            formData.telefone || '',
            formData.whatsapp || '',
            formData.email || '',
            formData.core_numero || '',
            formData.core_uf || '',
            formData.rep_legal_nome || '',
            formData.rep_legal_cpf || '',
            formData.dados_bancarios_pix || '',
            formData.territorio || '',
            formData.exclusividade_territorial ? 1 : 0,
            formData.exclusividade_condicoes || '',
            formData.exclusividade_outras_representadas ? 1 : 0,
            formData.regras_vendas_diretas || '',
            formData.percentual_comissao ?? 10.0,
            formData.data_inicio || now.slice(0, 10),
            formData.status || 'ativo',
            formData.observacoes_internas || '',
            formData.possui_estoque_proprio ? 1 : 0,
            jsonSafety,
            now,
            editingId,
          ]
        );
      } else {
        await execute(
          `INSERT INTO representante (
            id, codigo, tipo, nome_razao, nome_fantasia, cpf_cnpj, rg, data_nascimento,
            endereco, telefone, whatsapp, email, core_numero, core_uf, rep_legal_nome, rep_legal_cpf,
            dados_bancarios_pix, territorio, exclusividade_territorial, exclusividade_condicoes,
            exclusividade_outras_representadas, regras_vendas_diretas, percentual_comissao, data_inicio,
            status, observacoes_internas, possui_estoque_proprio, contatos_seguranca, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            activeRepId,
            safeCodigo,
            formData.tipo || 'PF',
            formData.nome_razao.trim(),
            formData.nome_fantasia || '',
            formData.cpf_cnpj || '',
            formData.rg || '',
            formData.data_nascimento || '',
            formData.endereco || '',
            formData.telefone || '',
            formData.whatsapp || '',
            formData.email || '',
            formData.core_numero || '',
            formData.core_uf || '',
            formData.rep_legal_nome || '',
            formData.rep_legal_cpf || '',
            formData.dados_bancarios_pix || '',
            formData.territorio || '',
            formData.exclusividade_territorial ? 1 : 0,
            formData.exclusividade_condicoes || '',
            formData.exclusividade_outras_representadas ? 1 : 0,
            formData.regras_vendas_diretas || '',
            formData.percentual_comissao ?? 10.0,
            formData.data_inicio || now.slice(0, 10),
            formData.status || 'ativo',
            formData.observacoes_internas || '',
            formData.possui_estoque_proprio ? 1 : 0,
            jsonSafety,
            now,
            now,
          ]
        );
      }

      setShowModal(false);
      await loadRepresentantes();
    } catch (err: any) {
      alert(`Erro ao salvar representante: ${err.message}`);
    }
  };

  const handleGenerateContract = async (rep: Representante) => {
    const empresa = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (!empresa) {
      alert('Dados da empresa não configurados.');
      return;
    }

    const pdf = generateContratoRepresentacaoPDF(rep, empresa, {});
    pdf.save(`Contrato_Representacao_${rep.codigo}_${rep.nome_razao.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
  };

  const handleOpenDetails = async (rep: Representante, initialTab: 'geral' | 'pedidos' | 'documentos' = 'geral') => {
    setSelectedRep(rep);
    setDetailsTab(initialTab);
    try {
      const docs = await queryAll<Anexo>(
        `SELECT * FROM anexo WHERE entidade_tipo = 'representante' AND entidade_id = ? ORDER BY created_at DESC`,
        [rep.id]
      );
      setDetailsAttachments(docs);

      const pedidosList = await queryAll<Pedido>(
        `SELECT p.*, c.nome_fantasia as cliente_fantasia FROM pedido p LEFT JOIN cliente c ON p.cliente_id = c.id WHERE p.representante_id = ? ORDER BY p.data_hora DESC`,
        [rep.id]
      );
      for (const ped of pedidosList) {
        const items = await queryAll<ItemPedido>('SELECT * FROM item_pedido WHERE pedido_id = ?', [ped.id]);
        ped.items = items;
      }
      setDetailsPedidos(pedidosList);
    } catch {
      setDetailsAttachments([]);
      setDetailsPedidos([]);
    }
    setShowDetailsModal(true);
  };

  const handleDownloadPedidoPDF = async (ped: Pedido) => {
    const empresa = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
    if (!empresa) {
      alert('Dados da empresa não cadastrados.');
      return;
    }
    const rep = selectedRep || (ped.representante_id ? await queryOne<Representante>('SELECT * FROM representante WHERE id = ?', [ped.representante_id]) : undefined);
    const cli = ped.cliente_id ? await queryOne<Cliente>('SELECT * FROM cliente WHERE id = ?', [ped.cliente_id]) : undefined;
    const pdf = generatePedidoPDF(ped, empresa, rep || undefined, cli || undefined);
    pdf.save(`Pedido_${ped.numero}_${rep?.nome_razao.replace(/[^a-zA-Z0-9]/g, '_') || 'PraCasa'}.pdf`);
  };

  const handleExportExcel = () => {
    const exportData = filteredReps.map((r) => ({
      Código: r.codigo,
      Tipo: r.tipo,
      'Nome / Razão Social': r.nome_razao,
      'CPF / CNPJ': r.cpf_cnpj || '-',
      'CORE N°': r.core_numero ? `${r.core_numero}/${r.core_uf}` : '-',
      Território: r.territorio || '-',
      'Comissão (%)': r.percentual_comissao,
      WhatsApp: r.whatsapp || '-',
      Email: r.email || '-',
      Status: r.status,
    }));
    exportToExcel(exportData, 'representantes_pracasa');
  };

  const filteredReps = representantes.filter((r) => {
    const matchesSearch =
      r.nome_razao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.cpf_cnpj && r.cpf_cnpj.includes(searchTerm)) ||
      (r.territorio && r.territorio.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'todos' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" />
            Representantes Comerciais
          </h2>
          <p className="text-xs text-slate-400">
            Gestão cadastral, contatos de segurança, upload de documentos (PDF/Imagens), regras e contratos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={handleExportExcel} className="btn-secondary text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exportar Planilha</span>
          </button>
          <button onClick={() => handleOpenModal()} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            <span>Novo Representante</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, código, CPF/CNPJ ou território..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-9"
          />
        </div>

        <div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativo</option>
            <option value="prospecto">Prospecto</option>
            <option value="documentacao_pendente">Doc. Pendente</option>
            <option value="suspenso">Suspenso</option>
            <option value="encerrado">Encerrado</option>
          </select>
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReps.length === 0 ? (
          <div className="col-span-full glass-panel p-8 text-center text-slate-500 text-xs">
            Nenhum representante encontrado.
          </div>
        ) : (
          filteredReps.map((rep) => {
            let safetyCount = 0;
            try {
              const parsed = rep.contatos_seguranca ? JSON.parse(rep.contatos_seguranca) : [];
              safetyCount = Array.isArray(parsed) ? parsed.length : 0;
            } catch {
              safetyCount = 0;
            }
            const docsCount = attachmentCounts[rep.id] || 0;

            return (
              <div
                key={rep.id}
                className="glass-panel p-4 rounded-xl space-y-3 hover:border-amber-500/40 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {rep.codigo} ({rep.tipo})
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        rep.status === 'ativo'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-100 text-sm truncate">{rep.nome_razao}</h3>
                    {rep.nome_fantasia && <p className="text-xs text-slate-400 truncate">{rep.nome_fantasia}</p>}
                  </div>

                  {/* Core indicators */}
                  <div className="text-xs text-slate-300 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-400">CPF/CNPJ:</span>
                      <span className="font-mono">{rep.cpf_cnpj || 'Não informado'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">CORE:</span>
                      <span>{rep.core_numero ? `${rep.core_numero}/${rep.core_uf}` : 'Opcional / Pendente'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Comissão:</span>
                      <span className="font-bold text-emerald-400">{rep.percentual_comissao}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Posse Estoque:</span>
                      <span className={rep.possui_estoque_proprio ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                        {rep.possui_estoque_proprio ? 'Sim (Mercadoria em posse)' : 'Não (Intermediação)'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5 border-t border-slate-800/60">
                      <span className="text-slate-400">Vendas / Pedidos:</span>
                      <span className="font-bold text-amber-400">
                        {(repSalesStats[rep.id]?.total_pedidos || 0) > 0 ? (
                          `${repSalesStats[rep.id].total_pedidos} ped. (${formatCurrency(repSalesStats[rep.id].total_valor)})`
                        ) : (
                          <span className="text-slate-500 font-normal">0 pedidos</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Badges for Safety Contacts and Attachments */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {safetyCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        <ShieldAlert className="w-3 h-3 text-indigo-400" />
                        {safetyCount} {safetyCount === 1 ? 'Contato Seg.' : 'Contatos Seg.'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                        <Shield className="w-3 h-3" />
                        Sem contatos seg.
                      </span>
                    )}

                    {docsCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(rep, 'documentos')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all cursor-pointer"
                        title="Ver documentos anexados deste representante"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{docsCount} {docsCount === 1 ? 'Doc Anexo' : 'Docs Anexos'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenModal(rep, 'documentos')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
                        title="Anexar documentos para este representante"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>+ Anexar Doc</span>
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400">
                    <strong className="text-slate-300">Território:</strong> {rep.territorio || 'Geral / Não especificado'}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex items-center justify-between gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleGenerateContract(rep)}
                    className="btn-secondary text-[11px] !py-1 !px-2"
                    title="Gerar PDF Contrato de Representação"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                    <span>Contrato</span>
                  </button>

                  <button
                    onClick={() => handleOpenDetails(rep, 'pedidos')}
                    className={`p-1.5 rounded text-[11px] px-2 font-semibold flex items-center gap-1 transition-all ${
                      (repSalesStats[rep.id]?.total_pedidos || 0) > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title="Ver Histórico de Pedidos de Venda"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pedidos ({repSalesStats[rep.id]?.total_pedidos || 0})</span>
                  </button>

                  <button
                    onClick={() => handleOpenDetails(rep, 'geral')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] px-2 font-semibold"
                    title="Ver Ficha Cadastral Completa"
                  >
                    Ficha
                  </button>

                  <button
                    onClick={() => handleOpenModal(rep, 'documentos')}
                    className={`p-1.5 rounded text-[11px] px-2 flex items-center gap-1 font-semibold transition-all ${
                      docsCount > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title="Documentos e Anexos do Representante"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Docs ({docsCount})</span>
                  </button>

                  <button
                    onClick={() => handleOpenModal(rep, 'dados')}
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Editar Dados Cadastrais"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Representative Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-xl space-y-4 my-8 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-500" />
                  {editingId ? 'Editar Representante Comercial' : 'Novo Representante Comercial'}
                </h3>
                <p className="text-xs text-slate-400">
                  Preencha os dados cadastrais, anexe documentos (PDF e Imagens) e cadastre contatos de segurança.
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('dados')}
                className={`py-2 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                  activeTab === 'dados'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <User className="w-4 h-4" />
                Dados Principais
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('contatos')}
                className={`py-2 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                  activeTab === 'contatos'
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                Contatos de Segurança
                {safetyContacts.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px]">
                    {safetyContacts.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('documentos')}
                className={`py-2 px-4 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 border-b-2 ${
                  activeTab === 'documentos'
                    ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                Documentos & Anexos (PDF / Imagens)
                {attachments.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px]">
                    {attachments.length}
                  </span>
                )}
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="overflow-y-auto flex-1 pr-1">
              {/* TAB 1: Dados Principais */}
              {activeTab === 'dados' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-slate-400 flex items-center justify-between">
                    <span>
                      Nota: Apenas o <strong className="text-amber-400">Nome Completo / Razão Social</strong> é
                      estritamente obrigatório. Todos os demais campos são opcionais.
                    </span>
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      Cadastro Flexível
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Tipo</label>
                      <select
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value as any })}
                        className="input-field"
                      >
                        <option value="PF">Pessoa Física (PF)</option>
                        <option value="PJ">Pessoa Jurídica (PJ)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Código Único (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: REP-101"
                        value={formData.codigo || ''}
                        onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                        className="input-field font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Status Cadastral</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                        className="input-field"
                      >
                        <option value="ativo">Ativo</option>
                        <option value="prospecto">Prospecto</option>
                        <option value="documentacao_pendente">Doc. Pendente</option>
                        <option value="suspenso">Suspenso</option>
                        <option value="encerrado">Encerrado</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold text-amber-400 mb-1">
                        Nome Completo / Razão Social *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nome do representante comercial"
                        value={formData.nome_razao || ''}
                        onChange={(e) => setFormData({ ...formData, nome_razao: e.target.value })}
                        className="input-field !border-amber-500/40"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Nome Fantasia (Se PJ)</label>
                      <input
                        type="text"
                        placeholder="Nome fantasia (opcional)"
                        value={formData.nome_fantasia || ''}
                        onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">CPF / CNPJ (Opcional)</label>
                      <input
                        type="text"
                        placeholder={formData.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                        value={formData.cpf_cnpj || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            cpf_cnpj: formData.tipo === 'PF' ? maskCPF(e.target.value) : maskCNPJ(e.target.value),
                          })
                        }
                        className="input-field font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">RG / Identidade (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Número do RG"
                        value={formData.rg || ''}
                        onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Data Início / Atividade</label>
                      <input
                        type="date"
                        value={formData.data_inicio || ''}
                        onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">N° Registro CORE (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: 45892"
                        value={formData.core_numero || ''}
                        onChange={(e) => setFormData({ ...formData, core_numero: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">UF CORE</label>
                      <input
                        type="text"
                        maxLength={2}
                        placeholder="BA"
                        value={formData.core_uf || 'BA'}
                        onChange={(e) => setFormData({ ...formData, core_uf: e.target.value.toUpperCase() })}
                        className="input-field uppercase"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Telefone / WhatsApp (Opcional)</label>
                      <input
                        type="text"
                        placeholder="(00) 00000-0000"
                        value={formData.whatsapp || ''}
                        onChange={(e) => setFormData({ ...formData, whatsapp: maskPhone(e.target.value) })}
                        className="input-field"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-semibold text-slate-300 mb-1">E-mail de Contato (Opcional)</label>
                      <input
                        type="email"
                        placeholder="representante@email.com"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Percentual Comissão (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.percentual_comissao ?? 10.0}
                        onChange={(e) =>
                          setFormData({ ...formData, percentual_comissao: parseFloat(e.target.value) || 0 })
                        }
                        className="input-field font-bold text-emerald-400"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block font-semibold text-slate-300 mb-1">Endereço Completo (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Rua, Número, Bairro, Cidade, Estado, CEP"
                        value={formData.endereco || ''}
                        onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                        className="input-field"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label className="block font-semibold text-slate-300 mb-1">
                        Território de Atuação (Municípios/Região) (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Salvador, Região Metropolitana, Feira de Santana..."
                        value={formData.territorio || ''}
                        onChange={(e) => setFormData({ ...formData, territorio: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </div>

                  {formData.tipo === 'PJ' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">
                          Representante Legal (Nome) (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Nome do sócio administrador"
                          value={formData.rep_legal_nome || ''}
                          onChange={(e) => setFormData({ ...formData, rep_legal_nome: e.target.value })}
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-300 mb-1">
                          CPF Representante Legal (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="000.000.000-00"
                          value={formData.rep_legal_cpf || ''}
                          onChange={(e) => setFormData({ ...formData, rep_legal_cpf: maskCPF(e.target.value) })}
                          className="input-field"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="flex flex-wrap items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.exclusividade_territorial ?? true}
                          onChange={(e) =>
                            setFormData({ ...formData, exclusividade_territorial: e.target.checked })
                          }
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span>Possui Exclusividade Territorial</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.possui_estoque_proprio ?? false}
                          onChange={(e) => setFormData({ ...formData, possui_estoque_proprio: e.target.checked })}
                          className="rounded border-slate-700 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-amber-400 font-semibold">Mantém Estoque Físico com o Representante</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Dados Bancários / Chave Pix (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Banco, Agência, Conta / Chave Pix para repasse de comissões"
                      value={formData.dados_bancarios_pix || ''}
                      onChange={(e) => setFormData({ ...formData, dados_bancarios_pix: e.target.value })}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">
                      Observações Internas (Opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Anotações comerciais, histórico de negociação, preferências..."
                      value={formData.observacoes_internas || ''}
                      onChange={(e) => setFormData({ ...formData, observacoes_internas: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Contatos de Segurança & Emergência */}
              {activeTab === 'contatos' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-lg text-indigo-200">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <ShieldAlert className="w-4 h-4 text-indigo-400" />
                      Contatos de Segurança & Referência Fornecidos pelo Representante
                    </div>
                    <p className="text-[11px] text-indigo-300/80">
                      Cadastre contatos de segurança que o representante nos informa (como cônjuge, familiares, sócios ou
                      referências comerciais) para localização rápida, emergências ou validações de segurança.
                    </p>
                  </div>

                  {/* Add Contact Form */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-indigo-400" /> Adicionar Contato de Segurança
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block font-semibold text-slate-400 mb-1">Nome Completo</label>
                        <input
                          type="text"
                          placeholder="Ex: Maria dos Santos"
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                          className="input-field"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-400 mb-1">Relação / Vínculo</label>
                        <select
                          value={newContactRel}
                          onChange={(e) => setNewContactRel(e.target.value)}
                          className="input-field"
                        >
                          {RELACOES_SEGURANCA.map((rel) => (
                            <option key={rel} value={rel}>
                              {rel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-400 mb-1">Telefone / WhatsApp</label>
                        <input
                          type="text"
                          placeholder="(00) 00000-0000"
                          value={newContactPhone}
                          onChange={(e) => setNewContactPhone(maskPhone(e.target.value))}
                          className="input-field"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-400 mb-1">Observações Adicionais</label>
                        <input
                          type="text"
                          placeholder="Ex: Esposa, mora no mesmo endereço / Ligar apenas se não atender"
                          value={newContactObs}
                          onChange={(e) => setNewContactObs(e.target.value)}
                          className="input-field"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddSafetyContact}
                          className="btn-primary w-full !py-2.5 text-xs bg-indigo-600 hover:bg-indigo-500"
                        >
                          <Plus className="w-4 h-4" /> Incluir Contato
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* List of Safety Contacts */}
                  <div className="space-y-2">
                    <h4 className="font-semibold text-slate-300">
                      Contatos Registrados ({safetyContacts.length})
                    </h4>

                    {safetyContacts.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        Nenhum contato de segurança cadastrado ainda para este representante. Preencha os campos acima
                        para adicionar.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {safetyContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-start justify-between gap-2 hover:border-slate-700 transition-all"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-200">{contact.nome}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  {contact.parentesco_relacao}
                                </span>
                              </div>

                              {contact.telefone && (
                                <div className="flex items-center gap-2 text-slate-300 font-mono">
                                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{contact.telefone}</span>
                                  <a
                                    href={`https://wa.me/55${contact.telefone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-emerald-400 hover:underline flex items-center gap-0.5 text-[10px]"
                                  >
                                    <MessageCircle className="w-3 h-3" /> WhatsApp
                                  </a>
                                </div>
                              )}

                              {contact.observacao && (
                                <p className="text-[11px] text-slate-400 italic">Obs: {contact.observacao}</p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveSafetyContact(contact.id)}
                              className="text-slate-500 hover:text-rose-400 p-1"
                              title="Remover Contato"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Documentos & Anexos (PDF e Imagens) */}
              {activeTab === 'documentos' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-900/60 rounded-lg text-emerald-200">
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <Paperclip className="w-4 h-4 text-emerald-400" />
                      Upload de Imagens e PDFs de Documentos do Representante
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Anexe cópias digitais de documentos pessoais (RG, CNH, CPF), comprovante de endereço, certidão
                      CORE, contrato social ou fotos do representante. Suporta formatos{' '}
                      <strong>PDF, PNG, JPG, JPEG e WEBP</strong>.
                    </p>
                  </div>

                  {/* Upload Controls */}
                  <div className="p-4 bg-slate-900 rounded-lg border border-slate-800 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                      <div className="md:col-span-2">
                        <label className="block font-semibold text-slate-300 mb-1">
                          Categoria / Tipo do Documento
                        </label>
                        <select
                          value={selectedDocCategory}
                          onChange={(e) => setSelectedDocCategory(e.target.value)}
                          className="input-field"
                        >
                          {DOC_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        {/* Hidden input for web & drag/drop */}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            if (window.electronAPI) {
                              handleElectronSelectFile();
                            } else if (fileInputRef.current) {
                              fileInputRef.current.click();
                            }
                          }}
                          disabled={isUploading}
                          className="btn-primary w-full !py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-xs flex items-center justify-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{isUploading ? 'Processando...' : 'Subir Arquivo (PDF / Imagem)'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Drag-and-drop zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-900/60"
                    >
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <Paperclip className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-slate-200">
                          Clique aqui para selecionar ou arraste arquivos (PDF, PNG, JPG, WEBP)
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Os documentos ficarão salvos no repositório digital vinculados a este representante.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Attachments List */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-slate-300 flex items-center gap-2">
                      Documentos Anexados ({attachments.length})
                    </h4>

                    {attachments.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-lg">
                        Nenhum documento anexado ainda. Utilize a área acima para subir imagens ou PDFs do representante.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {attachments.map((anx) => {
                          const isImage =
                            anx.mime_type.startsWith('image/') ||
                            anx.nome_original.match(/\.(png|jpe?g|webp)$/i);
                          const isPdf =
                            anx.mime_type.includes('pdf') || anx.nome_original.toLowerCase().endsWith('.pdf');
                          const catLabel =
                            DOC_CATEGORIES.find((c) => c.value === anx.categoria)?.label || 'Documento';

                          return (
                            <div
                              key={anx.id}
                              className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-2 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                            >
                              <div className="space-y-2">
                                {/* Thumbnail / Icon Preview */}
                                <div className="h-28 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center relative group">
                                  {isImage ? (
                                    <>
                                      <img
                                        src={anx.caminho_relativo}
                                        alt={anx.nome_original}
                                        className="h-full w-full object-cover group-hover:scale-105 transition-all cursor-pointer"
                                        onClick={() => handleOpenAttachment(anx)}
                                      />
                                      <div
                                        onClick={() => handleOpenAttachment(anx)}
                                        className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-slate-200 transition-all cursor-pointer"
                                      >
                                        <Eye className="w-4 h-4" />
                                        <span className="text-[10px]">Visualizar Imagem</span>
                                      </div>
                                    </>
                                  ) : isPdf ? (
                                    <div
                                      onClick={() => handleOpenAttachment(anx)}
                                      className="flex flex-col items-center gap-1 cursor-pointer group-hover:scale-105 transition-all text-rose-400"
                                    >
                                      <FileText className="w-10 h-10" />
                                      <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 px-2 py-0.5 rounded text-rose-300">
                                        Documento PDF
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1 text-slate-400">
                                      <File className="w-8 h-8" />
                                      <span className="text-[10px]">Arquivo</span>
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <span className="text-[10px] text-emerald-400 font-semibold block truncate">
                                    {catLabel}
                                  </span>
                                  <h5 className="font-bold text-slate-200 truncate text-xs" title={anx.nome_original}>
                                    {anx.nome_original}
                                  </h5>
                                  <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                                    <span>{(anx.tamanho_bytes / 1024).toFixed(1)} KB</span>
                                    <span>{formatDate(anx.created_at)}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="border-t border-slate-800 pt-2 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAttachment(anx)}
                                  className="btn-secondary !py-1 !px-2 text-[11px] flex-1 text-slate-200"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Visualizar</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteAttachment(anx.id)}
                                  className="p-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-all"
                                  title="Excluir Anexo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-3">
              <span className="text-[11px] text-slate-500">
                {activeTab === 'dados' && 'Dados cadastrais do representante.'}
                {activeTab === 'contatos' && `${safetyContacts.length} contatos de segurança vinculados.`}
                {activeTab === 'documentos' && `${attachments.length} documentos anexados.`}
              </span>

              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={handleSave} className="btn-primary">
                  Salvar Representante
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Sheet Modal / Representative Sales Dashboard */}
      {showDetailsModal && selectedRep && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" />
                  {selectedRep.nome_razao}
                </h3>
                <p className="text-xs text-slate-400">
                  Painel do Representante Comercial • Código {selectedRep.codigo} • CORE {selectedRep.core_numero ? `${selectedRep.core_numero}/${selectedRep.core_uf}` : 'Pendente'}
                </p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="text-slate-400 hover:text-slate-200 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDetailsTab('geral')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  detailsTab === 'geral'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Dados Cadastrais & Contatos</span>
              </button>

              <button
                type="button"
                onClick={() => setDetailsTab('pedidos')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  detailsTab === 'pedidos'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Histórico de Pedidos</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${detailsPedidos.length > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  {detailsPedidos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDetailsTab('documentos')}
                className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  detailsTab === 'documentos'
                    ? 'border-amber-500 text-amber-400 bg-amber-500/10 rounded-t'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Paperclip className="w-4 h-4" />
                <span>Documentos & Anexos</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${detailsAttachments.length > 0 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  {detailsAttachments.length}
                </span>
              </button>
            </div>

            {/* TAB 1: GERAL (DADOS CADASTRAIS & CONTATOS) */}
            {detailsTab === 'geral' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Tipo:</span>
                    <span className="font-bold text-slate-200">{selectedRep.tipo}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">CPF / CNPJ:</span>
                    <span className="font-mono font-bold text-slate-200">{selectedRep.cpf_cnpj || 'Não informado'}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Registro CORE:</span>
                    <span className="font-bold text-slate-200">
                      {selectedRep.core_numero ? `${selectedRep.core_numero}/${selectedRep.core_uf}` : 'Opcional / Pendente'}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block">Comissão Acordada:</span>
                    <span className="font-bold text-emerald-400">{selectedRep.percentual_comissao}%</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 col-span-2">
                    <span className="text-slate-500 block">WhatsApp / Telefone:</span>
                    <span className="text-slate-200">{selectedRep.whatsapp || 'Não informado'}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 col-span-2">
                    <span className="text-slate-500 block">E-mail:</span>
                    <span className="text-slate-200">{selectedRep.email || 'Não informado'}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 col-span-full">
                    <span className="text-slate-500 block">Endereço:</span>
                    <span className="text-slate-200">{selectedRep.endereco || 'Não informado'}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 col-span-full">
                    <span className="text-slate-500 block">Território de Atuação:</span>
                    <span className="text-slate-200">{selectedRep.territorio || 'Geral / Não especificado'}</span>
                  </div>
                  {selectedRep.dados_bancarios_pix && (
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 col-span-full">
                      <span className="text-slate-500 block">Dados Bancários / Chave Pix:</span>
                      <span className="text-slate-200 font-mono">{selectedRep.dados_bancarios_pix}</span>
                    </div>
                  )}
                </div>

                {/* Resumo Rápido de Vendas */}
                <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 rounded-lg border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-slate-100 flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      Atividade Comercial de Vendas
                    </h5>
                    <p className="text-slate-400 text-[11px]">
                      {detailsPedidos.length > 0 ? (
                        <>
                          Este representante possui <strong className="text-amber-300">{detailsPedidos.length} pedidos</strong> faturados/emitidos, totalizando{' '}
                          <strong className="text-emerald-400">
                            {formatCurrency(detailsPedidos.reduce((acc, p) => acc + (p.valor_total || 0), 0))}
                          </strong>.
                        </>
                      ) : (
                        'Nenhum pedido de venda registrado para este representante até o momento.'
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDetailsTab('pedidos')}
                    className="btn-secondary !py-1 !px-2.5 text-[11px] text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                  >
                    <span>Ver Histórico de Pedidos ({detailsPedidos.length})</span>
                  </button>
                </div>

                {/* Contatos de Segurança */}
                <div className="space-y-2 border-t border-slate-800 pt-3">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Contatos de Segurança & Emergência Informados
                  </h4>

                  {(() => {
                    let contacts: ContatoSeguranca[] = [];
                    try {
                      const parsed = selectedRep.contatos_seguranca ? JSON.parse(selectedRep.contatos_seguranca) : [];
                      contacts = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      contacts = [];
                    }

                    if (contacts.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 italic bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                          Nenhum contato de segurança cadastrado para este representante.
                        </p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {contacts.map((c) => (
                          <div key={c.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-200">{c.nome}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300">
                                {c.parentesco_relacao}
                              </span>
                            </div>
                            {c.telefone && (
                              <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{c.telefone}</span>
                                <a
                                  href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:underline flex items-center gap-0.5 text-[10px]"
                                >
                                  <MessageCircle className="w-3 h-3" /> WhatsApp
                                </a>
                              </div>
                            )}
                            {c.observacao && <p className="text-[11px] text-slate-400 italic">{c.observacao}</p>}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB 2: HISTÓRICO DE PEDIDOS DE VENDA */}
            {detailsTab === 'pedidos' && (
              <div className="space-y-4">
                {/* Order KPI Cards */}
                {(() => {
                  const totalVendas = detailsPedidos.reduce((acc, p) => acc + (p.valor_total || 0), 0);
                  const totalComissoes = totalVendas * ((selectedRep.percentual_comissao || 10) / 100);
                  const ticketMedio = detailsPedidos.length > 0 ? totalVendas / detailsPedidos.length : 0;

                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">Total de Pedidos</span>
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-amber-400" />
                          <span className="text-base font-bold text-slate-100">{detailsPedidos.length}</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">Faturamento Intermediado</span>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span className="text-base font-bold text-emerald-400">{formatCurrency(totalVendas)}</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">Comissão ({selectedRep.percentual_comissao}%)</span>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-indigo-400" />
                          <span className="text-base font-bold text-indigo-400">{formatCurrency(totalComissoes)}</span>
                        </div>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-slate-400 block text-[11px]">Ticket Médio / Pedido</span>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-200">{formatCurrency(ticketMedio)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Orders List Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-amber-400" />
                      Relação de Pedidos Vinculados ao Representante
                    </h4>
                    <span className="text-[11px] text-slate-500">{detailsPedidos.length} registros encontrados</span>
                  </div>

                  {detailsPedidos.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-xl text-xs space-y-2">
                      <p>Nenhum pedido de venda registrado para este representante até o momento.</p>
                      <p className="text-[11px] text-slate-600">
                        Os novos pedidos emitidos com este representante selecionado aparecerão automaticamente aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                      <table className="w-full text-xs text-left text-slate-300">
                        <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-2.5">Nº Pedido</th>
                            <th className="p-2.5">Data Emissão</th>
                            <th className="p-2.5">Supermercado Cliente</th>
                            <th className="p-2.5">Itens / Embalagens</th>
                            <th className="p-2.5">Valor Total</th>
                            <th className="p-2.5">Comissão Estimada</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5 text-right">PDF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {detailsPedidos.map((ped) => {
                            const comissaoEstimada = (ped.valor_total || 0) * ((selectedRep.percentual_comissao || 10) / 100);
                            const totalCaixas = (ped.items || []).reduce((acc, i) => acc + (i.quantidade || 0), 0);

                            return (
                              <tr key={ped.id} className="hover:bg-slate-800/40 transition-all">
                                <td className="p-2.5 font-mono font-bold text-amber-400">{ped.numero}</td>
                                <td className="p-2.5 text-slate-400">{formatDate(ped.data_hora)}</td>
                                <td className="p-2.5 font-medium text-slate-200">{ped.cliente_nome || '-'}</td>
                                <td className="p-2.5 text-slate-400">
                                  {ped.items && ped.items.length > 0 ? (
                                    <span title={ped.items.map(i => `${i.quantidade}x ${i.produto_nome}`).join(', ')}>
                                      {ped.items.length} itens ({totalCaixas} cx/pct)
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="p-2.5 font-bold text-emerald-400">{formatCurrency(ped.valor_total)}</td>
                                <td className="p-2.5 text-indigo-300 font-medium">{formatCurrency(comissaoEstimada)}</td>
                                <td className="p-2.5">
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
                                <td className="p-2.5 text-right">
                                  <button
                                    onClick={() => handleDownloadPedidoPDF(ped)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition-all"
                                    title="Baixar PDF Oficial do Pedido"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DOCUMENTOS ANEXADOS */}
            {detailsTab === 'documentos' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4" />
                    Documentos Físicos e Arquivos Anexados ({detailsAttachments.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleOpenModal(selectedRep, 'documentos');
                    }}
                    className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Fazer Upload de Novo Documento
                  </button>
                </div>

                {detailsAttachments.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-xl text-xs space-y-2">
                    <p>Nenhum documento físico ou imagem anexada até o momento.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleOpenModal(selectedRep, 'documentos');
                      }}
                      className="btn-primary text-xs"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Anexar Documento Agora</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {detailsAttachments.map((anx) => {
                      const isPdf = anx.mime_type.includes('pdf') || anx.nome_original.toLowerCase().endsWith('.pdf');
                      return (
                        <div
                          key={anx.id}
                          className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1.5 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              {isPdf ? (
                                <FileText className="w-4 h-4 text-rose-400" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-emerald-400" />
                              )}
                              <span className="font-bold text-slate-200 truncate text-[11px]" title={anx.nome_original}>
                                {anx.nome_original}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 block pt-0.5">
                              {(anx.tamanho_bytes / 1024).toFixed(1)} KB • {formatDate(anx.created_at)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(anx)}
                            className="btn-secondary !py-1 !px-2 text-[10px] w-full mt-1"
                          >
                            <Eye className="w-3 h-3 text-emerald-400" />
                            <span>Visualizar Arquivo</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex justify-between items-center gap-3 pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-500">
                {detailsTab === 'geral' && 'Ficha cadastral completa e contatos do representante.'}
                {detailsTab === 'pedidos' && `${detailsPedidos.length} pedidos de venda associados a este representante.`}
                {detailsTab === 'documentos' && `${detailsAttachments.length} documentos anexados no repositório digital.`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleGenerateContract(selectedRep);
                  }}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <FileText className="w-4 h-4 text-rose-400" />
                  <span>Emitir Contrato PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="btn-primary text-xs"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-full border border-slate-700 shadow-xl"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Visualização do documento"
              className="max-h-[85vh] max-w-full rounded-lg shadow-2xl object-contain border border-slate-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};
