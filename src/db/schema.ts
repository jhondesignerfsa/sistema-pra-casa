export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS empresa (
  id TEXT PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  endereco TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  responsavel_legal TEXT,
  cargo_responsavel TEXT,
  cpf_responsavel TEXT,
  logotipo_path TEXT,
  dados_emissao TEXT,
  comissao_padrao_pct REAL DEFAULT 10.0,
  estoque_minimo_padrao REAL DEFAULT 10,
  intervalo_recompra_dias INTEGER DEFAULT 15,
  politica_backup TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuario (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  perfil TEXT NOT NULL,
  ativo INTEGER DEFAULT 1,
  ultimo_acesso TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS representante (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  nome_razao TEXT NOT NULL,
  nome_fantasia TEXT,
  cpf_cnpj TEXT,
  rg TEXT,
  data_nascimento TEXT,
  endereco TEXT,
  telefone TEXT,
  whatsapp TEXT,
  email TEXT,
  core_numero TEXT,
  core_uf TEXT,
  rep_legal_nome TEXT,
  rep_legal_cpf TEXT,
  dados_bancarios_pix TEXT,
  territorio TEXT,
  exclusividade_territorial INTEGER DEFAULT 1,
  exclusividade_condicoes TEXT,
  exclusividade_outras_representadas INTEGER DEFAULT 0,
  regras_vendas_diretas TEXT,
  percentual_comissao REAL DEFAULT 10.0,
  data_inicio TEXT NOT NULL,
  status TEXT NOT NULL,
  observacoes_internas TEXT,
  possui_estoque_proprio INTEGER DEFAULT 0,
  contatos_seguranca TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cliente (
  id TEXT PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  endereco TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  cep TEXT NOT NULL,
  contato_compras TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT NOT NULL,
  horario_recebimento TEXT,
  representante_id TEXT NOT NULL,
  condicoes_comerciais TEXT,
  condicoes_pagamento TEXT DEFAULT '30 dias',
  modalidade_frete TEXT DEFAULT 'FOB',
  status TEXT DEFAULT 'ativo',
  data_primeira_compra TEXT,
  data_ultima_compra TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (representante_id) REFERENCES representante(id)
);

CREATE TABLE IF NOT EXISTS unidade_cliente (
  id TEXT PRIMARY KEY,
  cliente_matriz_id TEXT NOT NULL,
  nome_unidade TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  endereco TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf TEXT NOT NULL,
  cep TEXT NOT NULL,
  contato_recebimento TEXT,
  telefone TEXT,
  status TEXT DEFAULT 'ativo',
  FOREIGN KEY (cliente_matriz_id) REFERENCES cliente(id)
);

CREATE TABLE IF NOT EXISTS produto (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL,
  marca TEXT DEFAULT 'Tempero PraCasa',
  unidade_venda TEXT NOT NULL,
  peso_liquido_kg REAL DEFAULT 0,
  unidade_estoque TEXT NOT NULL,
  fator_conversao_estoque REAL DEFAULT 1,
  codigo_barras TEXT,
  preco_tabela REAL NOT NULL,
  preco_caixa REAL,
  custo_unitario REAL,
  preco_minimo_autorizado REAL,
  estoque_minimo REAL DEFAULT 10,
  status TEXT DEFAULT 'ativo',
  lote_padrao TEXT,
  validade_dias INTEGER,
  imagem_path TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historico_preco (
  id TEXT PRIMARY KEY,
  produto_id TEXT NOT NULL,
  preco_anterior REAL NOT NULL,
  preco_novo REAL NOT NULL,
  motivo TEXT,
  usuario_id TEXT,
  data_alteracao TEXT NOT NULL,
  FOREIGN KEY (produto_id) REFERENCES produto(id)
);

CREATE TABLE IF NOT EXISTS pedido (
  id TEXT PRIMARY KEY,
  numero TEXT UNIQUE NOT NULL,
  data_hora TEXT NOT NULL,
  representante_id TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  unidade_cliente_id TEXT,
  subtotal REAL NOT NULL,
  valor_frete REAL DEFAULT 0,
  desconto_total REAL DEFAULT 0,
  valor_total REAL NOT NULL,
  condicao_pagamento TEXT NOT NULL,
  data_solicitada_entrega TEXT,
  observacoes TEXT,
  status TEXT NOT NULL,
  origem TEXT DEFAULT 'fábrica',
  referencia_externa TEXT,
  comissao_calculada REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (representante_id) REFERENCES representante(id),
  FOREIGN KEY (cliente_id) REFERENCES cliente(id)
);

CREATE TABLE IF NOT EXISTS item_pedido (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  produto_id TEXT NOT NULL,
  produto_sku TEXT NOT NULL,
  produto_nome TEXT NOT NULL,
  unidade TEXT NOT NULL,
  tipo_embalagem TEXT DEFAULT 'caixa',
  quantidade REAL NOT NULL,
  preco_unitario REAL NOT NULL,
  desconto_pct REAL DEFAULT 0,
  subtotal REAL NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedido(id),
  FOREIGN KEY (produto_id) REFERENCES produto(id)
);

CREATE TABLE IF NOT EXISTS local_estoque (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  responsavel_id TEXT,
  descricao TEXT
);

CREATE TABLE IF NOT EXISTS movimento_estoque (
  id TEXT PRIMARY KEY,
  produto_id TEXT NOT NULL,
  local_origem_id TEXT,
  local_destino_id TEXT,
  quantidade_original REAL NOT NULL,
  unidade_original TEXT NOT NULL,
  quantidade_base REAL NOT NULL,
  data_movimento TEXT NOT NULL,
  tipo_movimento TEXT NOT NULL,
  pedido_id TEXT,
  nota_fiscal_id TEXT,
  responsavel TEXT NOT NULL,
  motivo TEXT,
  lote TEXT,
  validade TEXT,
  anexo_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (produto_id) REFERENCES produto(id)
);

CREATE TABLE IF NOT EXISTS venda_historica (
  id TEXT PRIMARY KEY,
  representante_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  cliente_cnpj TEXT,
  produto_nome TEXT NOT NULL,
  produto_sku TEXT,
  data_venda TEXT NOT NULL,
  quantidade REAL NOT NULL,
  unidade TEXT NOT NULL,
  valor_total REAL NOT NULL,
  numero_documento TEXT,
  origem_arquivo TEXT,
  nivel_conferencia TEXT DEFAULT 'Informada pelo Representante',
  estoque_descontado INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (representante_id) REFERENCES representante(id)
);

CREATE TABLE IF NOT EXISTS nota_fiscal (
  id TEXT PRIMARY KEY,
  chave_acesso TEXT UNIQUE,
  numero TEXT NOT NULL,
  serie TEXT,
  data_emissao TEXT NOT NULL,
  valor_total REAL NOT NULL,
  emitente_cnpj TEXT NOT NULL,
  emitente_nome TEXT NOT NULL,
  destinatario_cnpj TEXT NOT NULL,
  destinatario_nome TEXT NOT NULL,
  pedido_id TEXT,
  cliente_id TEXT,
  representante_id TEXT,
  status_conferencia TEXT DEFAULT 'Pendente',
  observacoes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contrato (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  numero TEXT NOT NULL,
  representante_id TEXT,
  cliente_id TEXT,
  data_inicio TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho',
  dados_preenchidos_json TEXT NOT NULL,
  versao_modelo TEXT DEFAULT '1.0',
  arquivo_pdf_path TEXT,
  arquivo_assinado_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comissao (
  id TEXT PRIMARY KEY,
  representante_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  nota_fiscal_id TEXT,
  valor_base_calculo REAL NOT NULL,
  percentual_aplicado REAL NOT NULL,
  valor_comissao REAL NOT NULL,
  status TEXT DEFAULT 'estimada',
  data_prevista_pagamento TEXT NOT NULL,
  data_pagamento TEXT,
  comprovante_anexo_id TEXT,
  observacao TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (representante_id) REFERENCES representante(id),
  FOREIGN KEY (pedido_id) REFERENCES pedido(id)
);

CREATE TABLE IF NOT EXISTS recebimento (
  id TEXT PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  nota_fiscal_id TEXT,
  data_recebimento TEXT NOT NULL,
  valor_recebido REAL NOT NULL,
  forma_pagamento TEXT NOT NULL,
  comprovante_anexo_id TEXT,
  FOREIGN KEY (pedido_id) REFERENCES pedido(id)
);

CREATE TABLE IF NOT EXISTS alerta_recompra (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  produto_id TEXT NOT NULL,
  data_ultima_compra TEXT NOT NULL,
  intervalo_dias_estimado INTEGER DEFAULT 15,
  data_prevista_recompra TEXT NOT NULL,
  tipo_estimativa TEXT DEFAULT 'Regra Manual',
  estoque_informado_supermercado REAL,
  status TEXT DEFAULT 'pendente',
  motivo_dispensa TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES cliente(id),
  FOREIGN KEY (produto_id) REFERENCES produto(id)
);

CREATE TABLE IF NOT EXISTS tarefa (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL,
  prioridade TEXT DEFAULT 'média',
  data_vencimento TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  representante_id TEXT,
  cliente_id TEXT,
  pedido_id TEXT,
  alerta_recompra_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interacao (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  data_hora TEXT NOT NULL,
  resumo TEXT NOT NULL,
  detalhes TEXT,
  usuario_nome TEXT NOT NULL,
  representante_id TEXT,
  cliente_id TEXT,
  pedido_id TEXT
);

CREATE TABLE IF NOT EXISTS anexo (
  id TEXT PRIMARY KEY,
  nome_original TEXT NOT NULL,
  nome_armazenado TEXT NOT NULL,
  caminho_relativo TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho_bytes INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  hash_sha256 TEXT,
  entidade_tipo TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  usuario_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_auditoria (
  id TEXT PRIMARY KEY,
  data_hora TEXT NOT NULL,
  usuario_nome TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT,
  detalhes TEXT NOT NULL,
  valores_anteriores_json TEXT,
  valores_novos_json TEXT
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_cliente_rep ON cliente(representante_id);
CREATE INDEX IF NOT EXISTS idx_cliente_cnpj ON cliente(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_rep_cnpj ON representante(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_produto_sku ON produto(sku);
CREATE INDEX IF NOT EXISTS idx_pedido_rep ON pedido(representante_id);
CREATE INDEX IF NOT EXISTS idx_pedido_cli ON pedido(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedido_status ON pedido(status);
CREATE INDEX IF NOT EXISTS idx_mov_prod ON movimento_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_anexo_ent ON anexo(entidade_tipo, entidade_id);
CREATE INDEX IF NOT EXISTS idx_comissao_rep ON comissao(representante_id);
CREATE INDEX IF NOT EXISTS idx_alerta_cli ON alerta_recompra(cliente_id);
`;
