export type UserRole = 'admin' | 'comercial' | 'financeiro' | 'consulta';

export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  email: string;
  responsavel_legal: string;
  cargo_responsavel: string;
  cpf_responsavel: string;
  logotipo_path?: string;
  dados_emissao?: string;
  comissao_padrao_pct: number;
  estoque_minimo_padrao: number;
  intervalo_recompra_dias: number;
  politica_backup: string;
  updated_at: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  ativo: boolean;
  ultimo_acesso?: string;
  created_at: string;
}

export type RepresentanteType = 'PF' | 'PJ';
export type RepresentanteStatus = 'prospecto' | 'documentacao_pendente' | 'ativo' | 'suspenso' | 'encerrado';

export interface ContatoSeguranca {
  id: string;
  nome: string;
  parentesco_relacao: string;
  telefone: string;
  observacao?: string;
}

export interface Representante {
  id: string;
  codigo: string;
  tipo: RepresentanteType;
  nome_razao: string;
  nome_fantasia?: string;
  cpf_cnpj: string;
  rg?: string;
  data_nascimento?: string;
  endereco: string;
  telefone: string;
  whatsapp: string;
  email: string;
  core_numero: string;
  core_uf: string;
  rep_legal_nome?: string;
  rep_legal_cpf?: string;
  dados_bancarios_pix?: string;
  territorio: string;
  exclusividade_territorial: boolean;
  exclusividade_condicoes?: string;
  exclusividade_outras_representadas: boolean;
  regras_vendas_diretas?: string;
  percentual_comissao: number;
  data_inicio: string;
  status: RepresentanteStatus;
  observacoes_internas?: string;
  possui_estoque_proprio: boolean;
  contatos_seguranca?: string;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id: string;
  codigo: string;
  razao_social: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  inscricao_estadual?: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  contato_compras: string;
  telefone: string;
  whatsapp: string;
  email: string;
  horario_recebimento?: string;
  representante_id: string;
  representante_nome?: string;
  condicoes_comerciais?: string;
  condicoes_pagamento: string;
  modalidade_frete: 'CIF' | 'FOB' | 'Retirada';
  status: 'ativo' | 'inativo';
  data_primeira_compra?: string;
  data_ultima_compra?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface UnidadeCliente {
  id: string;
  cliente_matriz_id: string;
  nome_unidade: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  contato_recebimento: string;
  telefone: string;
  status: 'ativo' | 'inativo';
}

export interface Produto {
  id: string;
  sku: string;
  nome: string;
  descricao?: string;
  categoria: string;
  marca: string;
  unidade_venda: string; // Ex: Caixa, Pacote, Unidade, Kg
  peso_liquido_kg: number;
  unidade_estoque: string; // Ex: Unidade, Kg
  fator_conversao_estoque: number; // Quantas unidades_estoque equivalem a 1 unidade_venda
  codigo_barras?: string;
  preco_tabela: number;
  preco_caixa?: number;
  custo_unitario?: number;
  preco_minimo_autorizado?: number;
  estoque_minimo: number;
  status: 'ativo' | 'inativo';
  lote_padrao?: string;
  validade_dias?: number;
  imagem_path?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversaoUnidade {
  id: string;
  produto_id: string;
  de_unidade: string;
  para_unidade: string;
  fator_multiplicador: number;
}

export interface HistoricoPreco {
  id: string;
  produto_id: string;
  preco_anterior: number;
  preco_novo: number;
  motivo?: string;
  usuario_id: string;
  data_alteracao: string;
}

export type OrderStatus =
  | 'Rascunho'
  | 'Enviado para análise'
  | 'Aguardando aprovação'
  | 'Aprovado'
  | 'Recusado'
  | 'Aguardando estoque'
  | 'Aguardando faturamento'
  | 'Faturado'
  | 'Em separação'
  | 'Enviado/Em entrega'
  | 'Entregue'
  | 'Parcialmente entregue'
  | 'Cancelado'
  | 'Devolvido';

export interface ItemPedido {
  id?: string;
  pedido_id?: string;
  produto_id: string;
  produto_sku: string;
  produto_nome: string;
  unidade: string;
  tipo_embalagem?: 'caixa' | 'unidade';
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  subtotal: number;
}

export interface Pedido {
  id: string;
  numero: string;
  data_hora: string;
  representante_id: string;
  representante_nome?: string;
  cliente_id: string;
  cliente_nome?: string;
  unidade_cliente_id?: string;
  subtotal: number;
  valor_frete: number;
  desconto_total: number;
  valor_total: number;
  condicao_pagamento: string;
  data_solicitada_entrega: string;
  observacoes?: string;
  status: OrderStatus;
  origem: 'fábrica' | 'representante' | 'importado';
  referencia_externa?: string;
  comissao_calculada?: number;
  items: ItemPedido[];
  created_at: string;
  updated_at: string;
}

export type LocalEstoqueType = 'Fábrica/Depósito' | 'Estoque Representante' | 'Estoque Consignado' | 'Supermercado';

export interface LocalEstoque {
  id: string;
  nome: string;
  tipo: LocalEstoqueType;
  responsavel_id?: string;
  descricao?: string;
}

export type MovimentoType =
  | 'Saldo Inicial'
  | 'Entrada Produção/Compra'
  | 'Transferência Recebida'
  | 'Transferência Enviada'
  | 'Saída Venda/Entrega'
  | 'Devolução'
  | 'Perda/Avaria'
  | 'Ajuste Inventário'
  | 'Reserva Pedido'
  | 'Liberação Reserva';

export interface MovimentoEstoque {
  id: string;
  produto_id: string;
  produto_sku?: string;
  produto_nome?: string;
  local_origem_id?: string;
  local_destino_id?: string;
  quantidade_original: number;
  unidade_original: string;
  quantidade_base: number;
  data_movimento: string;
  tipo_movimento: MovimentoType;
  pedido_id?: string;
  nota_fiscal_id?: string;
  responsavel: string;
  motivo?: string;
  lote?: string;
  validade?: string;
  anexo_id?: string;
  created_at: string;
}

export interface SaldoEstoque {
  produto_id: string;
  local_id: string;
  local_nome?: string;
  saldo_atual: number;
  saldo_reservado: number;
  saldo_disponivel: number;
}

export interface VendaHistorica {
  id: string;
  representante_id: string;
  cliente_nome: string;
  cliente_cnpj?: string;
  produto_nome: string;
  produto_sku?: string;
  data_venda: string;
  quantidade: number;
  unidade: string;
  valor_total: number;
  numero_documento?: string;
  origem_arquivo?: string;
  nivel_conferencia: 'Informada pelo Representante' | 'Confirmada pela Fábrica' | 'Comprovada por Documento';
  estoque_descontado: boolean;
  created_at: string;
}

export interface NotaFiscal {
  id: string;
  chave_acesso: string;
  numero: string;
  serie: string;
  data_emissao: string;
  valor_total: number;
  emitente_cnpj: string;
  emitente_nome: string;
  destinatario_cnpj: string;
  destinatario_nome: string;
  pedido_id?: string;
  cliente_id?: string;
  representante_id?: string;
  status_conferencia: 'Pendente' | 'Conferida' | 'Divergente';
  observacoes?: string;
  created_at: string;
}

export type ContratoType = 'Representação Comercial Autônoma' | 'Fornecimento';
export type ContratoStatus = 'rascunho' | 'revisao' | 'aprovado' | 'enviado' | 'assinado' | 'encerrado';

export interface Contrato {
  id: string;
  tipo: ContratoType;
  numero: string;
  representante_id?: string;
  cliente_id?: string;
  data_inicio: string;
  status: ContratoStatus;
  dados_preenchidos_json: string; // JSON String with contract variables
  versao_modelo: string;
  arquivo_pdf_path?: string;
  arquivo_assinado_path?: string;
  created_at: string;
  updated_at: string;
}

export interface Comissao {
  id: string;
  representante_id: string;
  representante_nome?: string;
  pedido_id: string;
  pedido_numero?: string;
  nota_fiscal_id?: string;
  valor_base_calculo: number;
  percentual_aplicado: number;
  valor_comissao: number;
  status: 'estimada' | 'adquirida' | 'liberada' | 'paga' | 'estornada';
  data_prevista_pagamento: string;
  data_pagamento?: string;
  comprovante_anexo_id?: string;
  observacao?: string;
  created_at: string;
}

export interface Recebimento {
  id: string;
  pedido_id: string;
  nota_fiscal_id?: string;
  data_recebimento: string;
  valor_recebido: number;
  forma_pagamento: string;
  comprovante_anexo_id?: string;
}

export interface AlertaRecompra {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  produto_id: string;
  produto_nome: string;
  data_ultima_compra: string;
  intervalo_dias_estimado: number;
  data_prevista_recompra: string;
  tipo_estimativa: 'Histórico Médio' | 'Regra Manual';
  estoque_informado_supermercado?: number;
  status: 'pendente' | 'snoozed' | 'contatado' | 'pedido_criado' | 'dispensado';
  motivo_dispensa?: string;
  created_at: string;
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: 'ligação' | 'whatsapp' | 'reunião' | 'visita' | 'email' | 'documento' | 'outro';
  prioridade: 'baixa' | 'média' | 'alta' | 'urgente';
  data_vencimento: string;
  responsavel: string;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada';
  representante_id?: string;
  cliente_id?: string;
  pedido_id?: string;
  alerta_recompra_id?: string;
  created_at: string;
}

export interface Interacao {
  id: string;
  tipo: 'ligação' | 'whatsapp' | 'reunião' | 'visita' | 'email';
  data_hora: string;
  resumo: string;
  detalhes?: string;
  usuario_nome: string;
  representante_id?: string;
  cliente_id?: string;
  pedido_id?: string;
}

export interface Anexo {
  id: string;
  nome_original: string;
  nome_armazenado: string;
  caminho_relativo: string;
  mime_type: string;
  tamanho_bytes: number;
  categoria: 'contrato' | 'nota_fiscal' | 'xml' | 'comprovante' | 'imagem' | 'planilha' | 'outro';
  hash_sha256?: string;
  entidade_tipo: string; // 'representante', 'cliente', 'pedido', 'produto', 'nota_fiscal', 'contrato', 'comissao'
  entidade_id: string;
  usuario_id: string;
  created_at: string;
}

export interface LogAuditoria {
  id: string;
  data_hora: string;
  usuario_nome: string;
  acao: 'Criação' | 'Alteração' | 'Exclusão' | 'Exportação' | 'Mudança Status' | 'Backup' | 'Restauração';
  entidade: string;
  entidade_id?: string;
  detalhes: string;
  valores_anteriores_json?: string;
  valores_novos_json?: string;
}
