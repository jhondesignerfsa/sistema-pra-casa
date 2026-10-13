import { execute, queryOne, queryAll } from './database';
import { Empresa, Produto } from '../types';

export const OFFICIAL_PRODUCTS: Partial<Produto>[] = [
  {
    id: 'prod_pracasa_35',
    sku: 'COD-35',
    nome: 'Tempero de Churrasco PraCasa 550ml (Cx c/ 09)',
    descricao: 'Tempero completo e saboroso para realçar o sabor de carnes bovinas, suínas, aves e peixes. Ideal para churrascos e grelhados.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 09 un',
    peso_liquido_kg: 0.55,
    unidade_estoque: 'Caixa c/ 09 un',
    fator_conversao_estoque: 9,
    codigo_barras: '7600000346486',
    preco_tabela: 8.99,
    preco_caixa: 80.91,
    custo_unitario: 8.99,
    preco_minimo_autorizado: 7.99,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: Caixa c/ 09. Custo total da caixa: R$ 80,91.',
  },
  {
    id: 'prod_pracasa_36',
    sku: 'COD-36',
    nome: 'Molho de Pimenta Carolina Reaper PraCasa 190ml (Cx c/ 12)',
    descricao: 'Feito com a pimenta mais ardida do mundo! Para quem busca um sabor intenso e picância extrema. Use com moderação!',
    categoria: 'Pimentas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.19,
    unidade_estoque: 'Caixa c/ 12 un',
    fator_conversao_estoque: 12,
    codigo_barras: '7600000346479',
    preco_tabela: 6.89,
    preco_caixa: 82.68,
    custo_unitario: 6.89,
    preco_minimo_autorizado: 5.99,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: Caixa c/ 12. Custo total da caixa: R$ 82,68.',
  },
  {
    id: 'prod_pracasa_37',
    sku: 'COD-37',
    nome: 'Pasta de Alho PraCasa 200g (Cx c/ 12)',
    descricao: 'Praticidade e sabor na medida certa! Alho triturado em pasta, ideal para temperar suas receitas do dia a dia com mais facilidade.',
    categoria: 'Alho e Pastas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.2,
    unidade_estoque: 'Caixa c/ 12 un',
    fator_conversao_estoque: 12,
    codigo_barras: '7600000346462',
    preco_tabela: 5.49,
    preco_caixa: 65.89,
    custo_unitario: 5.49,
    preco_minimo_autorizado: 4.80,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 180,
    observacoes: 'Embalagem: Caixa c/ 12. Custo total da caixa: R$ 65,89.',
  },
  {
    id: 'prod_pracasa_38',
    sku: 'COD-38',
    nome: 'Molho de Pimenta Vermelha PraCasa 150ml (Cx c/ 12)',
    descricao: 'Clássico e cheio de sabor! Feito com pimentas selecionadas para dar aquele toque especial às suas refeições.',
    categoria: 'Pimentas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.15,
    unidade_estoque: 'Caixa c/ 12 un',
    fator_conversao_estoque: 12,
    codigo_barras: '7600000346431',
    preco_tabela: 4.49,
    preco_caixa: 53.88,
    custo_unitario: 4.49,
    preco_minimo_autorizado: 3.99,
    estoque_minimo: 3,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: Caixa c/ 12. Custo total da caixa: R$ 53,88.',
  },
  {
    id: 'prod_pracasa_39',
    sku: 'COD-39',
    nome: 'Molho de Pimenta Cremosa PraCasa 190ml (Cx c/ 12)',
    descricao: 'Combinação perfeita de sabor e cremosidade com um toque picante. Ideal para carnes, petiscos, lanches e muito mais.',
    categoria: 'Pimentas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.19,
    unidade_estoque: 'Caixa c/ 12 un',
    fator_conversao_estoque: 12,
    codigo_barras: '7600000346424',
    preco_tabela: 6.89,
    preco_caixa: 82.68,
    custo_unitario: 6.89,
    preco_minimo_autorizado: 5.99,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: Caixa c/ 12. Custo total da caixa: R$ 82,68.',
  },
  {
    id: 'prod_pracasa_40',
    sku: 'COD-40',
    nome: 'Molho de Pimenta Verde c/ Ervas Finas PraCasa 150ml (Cx c/ 12)',
    descricao: 'Sabor leve e aromático com o toque especial das ervas finas. Combina perfeitamente com peixes, aves, saladas e pratos leves.',
    categoria: 'Pimentas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.15,
    unidade_estoque: 'Caixa c/ 12 un',
    fator_conversao_estoque: 12,
    codigo_barras: '7600000346448',
    preco_tabela: 4.89,
    preco_caixa: 58.68,
    custo_unitario: 4.89,
    preco_minimo_autorizado: 4.20,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: Caixa c/ 12. Custo total da caixa: R$ 58,68.',
  },
  {
    id: 'prod_pracasa_41',
    sku: 'COD-41',
    nome: 'Molho de Alho PraCasa 150ml (Cx c/ 12)',
    descricao: 'Cremoso e saboroso, feito com alho selecionado. Perfeito para saladas, carnes, lanches e acompanhamentos em geral.',
    categoria: 'Molhos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 12 un',
    peso_liquido_kg: 0.15,
    unidade_estoque: 'Caixa c/ 12 un',
    fator_conversao_estoque: 12,
    codigo_barras: '7600000346417',
    preco_tabela: 4.89,
    preco_caixa: 58.68,
    custo_unitario: 4.89,
    preco_minimo_autorizado: 4.20,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: Caixa c/ 12. Custo total da caixa: R$ 58,68.',
  },
  {
    id: 'prod_pracasa_farofa_20',
    sku: 'FAR-CROC-CX20',
    nome: 'Farofa Pronta Crocante PraCasa 350g (Cx c/ 20)',
    descricao: 'Farofa pronta crocante tradicional Tempero PraCasa 350g. Caixa display com 20 unidades.',
    categoria: 'Farofas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 20 un',
    peso_liquido_kg: 0.35,
    unidade_estoque: 'Caixa c/ 20 un',
    fator_conversao_estoque: 20,
    codigo_barras: '7892022410515',
    preco_tabela: 12.0,
    preco_caixa: 240.0,
    custo_unitario: 9.0,
    preco_minimo_autorizado: 10.5,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 180,
    observacoes: 'Embalagem: CX/20. Preço Tabela da Caixa: R$ 240,00.',
  },
  {
    id: 'prod_pracasa_farofa_10',
    sku: 'FAR-CROC-CX10',
    nome: 'Farofa Pronta Crocante PraCasa 350g (Cx c/ 10)',
    descricao: 'Farofa pronta crocante tradicional Tempero PraCasa 350g. Caixa com 10 unidades.',
    categoria: 'Farofas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 10 un',
    peso_liquido_kg: 0.35,
    unidade_estoque: 'Caixa c/ 10 un',
    fator_conversao_estoque: 10,
    codigo_barras: '7892022410515',
    preco_tabela: 12.0,
    preco_caixa: 120.0,
    custo_unitario: 9.0,
    preco_minimo_autorizado: 10.5,
    estoque_minimo: 3,
    status: 'ativo',
    validade_dias: 180,
    observacoes: 'Embalagem: CX/10. Preço Tabela da Caixa: R$ 120,00.',
  },
  {
    id: 'prod_pracasa_churr_spim',
    sku: 'TEMP-CHURR-SPIM',
    nome: 'Tempero para Churrasco PraCasa Sem Pimenta 500g (Fd c/ 30)',
    descricao: 'Tempero para churrasco sem pimenta 500g. Sabor autêntico sem ardência. Fardo com 30 unidades.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Fardo c/ 30 un',
    peso_liquido_kg: 0.5,
    unidade_estoque: 'Fardo c/ 30 un',
    fator_conversao_estoque: 30,
    codigo_barras: '7890270619681',
    preco_tabela: 4.18,
    preco_caixa: 125.4,
    custo_unitario: 3.15,
    preco_minimo_autorizado: 3.75,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: FD/30. Preço Tabela do Fardo: R$ 125,40.',
  },
  {
    id: 'prod_pracasa_churr_500',
    sku: 'TEMP-CHURR-500',
    nome: 'Tempero para Churrasco PraCasa Tradicional 500g (Fd c/ 30)',
    descricao: 'Tempero para churrasco tradicional 500g com sal e especiarias nobres. Fardo com 30 unidades.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Fardo c/ 30 un',
    peso_liquido_kg: 0.5,
    unidade_estoque: 'Fardo c/ 30 un',
    fator_conversao_estoque: 30,
    codigo_barras: '7890001301939',
    preco_tabela: 4.18,
    preco_caixa: 125.4,
    custo_unitario: 3.15,
    preco_minimo_autorizado: 3.75,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: FD/30. Preço Tabela do Fardo: R$ 125,40.',
  },
  {
    id: 'prod_pracasa_amac_250',
    sku: 'TEMP-AMAC-250',
    nome: 'Tempero Completo Amaciante de Carne PraCasa 250g (Cx c/ 24)',
    descricao: 'Tempero completo enriquecido com amaciante natural de carnes 250g. Caixa com 24 unidades.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 24 un',
    peso_liquido_kg: 0.25,
    unidade_estoque: 'Caixa c/ 24 un',
    fator_conversao_estoque: 24,
    codigo_barras: '7890130120234',
    preco_tabela: 5.33,
    preco_caixa: 128.0,
    custo_unitario: 3.90,
    preco_minimo_autorizado: 4.80,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: CX/24. Preço Tabela da Caixa: R$ 128,00 (R$ 5,33/un).',
  },
  {
    id: 'prod_pracasa_pote_250',
    sku: 'TEMP-COMPL-POTE',
    nome: 'Tempero Completo Pote PraCasa 250g (Cx c/ 24)',
    descricao: 'Tempero completo pote 250g com fórmula tradicional Tempero PraCasa. Caixa com 24 unidades.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 24 un',
    peso_liquido_kg: 0.25,
    unidade_estoque: 'Caixa c/ 24 un',
    fator_conversao_estoque: 24,
    codigo_barras: '7890001301946',
    preco_tabela: 5.33,
    preco_caixa: 128.0,
    custo_unitario: 3.90,
    preco_minimo_autorizado: 4.80,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: CX/24. Preço Tabela da Caixa: R$ 128,00 (R$ 5,33/un).',
  },
  {
    id: 'prod_pracasa_sal_ervas_30',
    sku: 'SAL-ERVAS-500',
    nome: 'Sal para Churrasco c/ Ervas Finas PraCasa 500g (Cx c/ 30)',
    descricao: 'Sal grosso com ervas finas selecionadas 500g. Embalagem display com 30 pacotes de 500g. Ideal para carnes nobres e grelhados.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 30 un',
    peso_liquido_kg: 0.5,
    unidade_estoque: 'Caixa c/ 30 un',
    fator_conversao_estoque: 30,
    codigo_barras: '7890270619711',
    preco_tabela: 4.30,
    preco_caixa: 129.0,
    custo_unitario: 3.20,
    preco_minimo_autorizado: 3.90,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: CX/30. Preço Tabela da Caixa: R$ 129,00 (R$ 4,30/un).',
  },
  {
    id: 'prod_pracasa_sal_temp_30',
    sku: 'SAL-TEMP-500',
    nome: 'Sal para Churrasco Temperado PraCasa 500g (Cx c/ 30)',
    descricao: 'Sal grosso temperado especial para churrasco e carnes 500g. Fórmula tradicional Tempero PraCasa. Caixa com 30 unidades.',
    categoria: 'Temperos',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 30 un',
    peso_liquido_kg: 0.5,
    unidade_estoque: 'Caixa c/ 30 un',
    fator_conversao_estoque: 30,
    codigo_barras: '7890270619728',
    preco_tabela: 4.30,
    preco_caixa: 129.0,
    custo_unitario: 3.20,
    preco_minimo_autorizado: 3.90,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 365,
    observacoes: 'Embalagem: CX/30. Preço Tabela da Caixa: R$ 129,00 (R$ 4,30/un).',
  },
  {
    id: 'prod_pracasa_farofa_temp_20',
    sku: 'FAR-TEMP-CX20',
    nome: 'Farofa Temperada PraCasa 350g (Cx c/ 20)',
    descricao: 'Farofa temperada tradicional Tempero PraCasa 350g. Caixa com 20 unidades de 350g.',
    categoria: 'Farofas',
    marca: 'Tempero PraCasa',
    unidade_venda: 'Caixa c/ 20 un',
    peso_liquido_kg: 0.35,
    unidade_estoque: 'Caixa c/ 20 un',
    fator_conversao_estoque: 20,
    codigo_barras: '7892022410522',
    preco_tabela: 6.00,
    preco_caixa: 120.0,
    custo_unitario: 4.50,
    preco_minimo_autorizado: 5.20,
    estoque_minimo: 2,
    status: 'ativo',
    validade_dias: 180,
    observacoes: 'Embalagem: CX/20. Preço Tabela da Caixa: R$ 120,00 (R$ 6,00/un).',
  },
];

// Estoque Oficial informado pela PraCasa para o Estoque Local (Fábrica / Depósito Central)
export const OFFICIAL_FACTORY_STOCK: Record<string, number> = {
  prod_pracasa_38: 31, // Pimenta Vermelha (31 cx)
  prod_pracasa_36: 21, // Carolina Reaper (21 cx)
  prod_pracasa_40: 30, // Pimenta c/ Ervas Finas (30 cx)
  prod_pracasa_39: 25, // Pimenta Cremosa (25 cx)
  prod_pracasa_41: 15, // Molho de Alho (15 cx)
  prod_pracasa_35: 19, // Tempero de Churrasco (19 cx)
  prod_pracasa_37: 24, // Pasta de Alho (24 cx)
  prod_pracasa_farofa_20: 3, // Farofa Crocante (3 cx)
  prod_pracasa_pote_250: 11, // Tempero Completo (11 cx)
  prod_pracasa_amac_250: 19, // Tempero c/ Amaciante (19 cx)
  prod_pracasa_sal_temp_30: 4, // Sal para Churrasco (4 cx)
  prod_pracasa_sal_ervas_30: 4, // Sal para Churrasco c/ Ervas Finas (4 cx)
};

export async function applyOfficialStock(force: boolean = false) {
  const now = new Date().toISOString();

  // Se não for forçado, verifica se já existem movimentos de saldo inicial na fábrica
  if (!force) {
    const existingMovs = await queryAll(`
      SELECT id FROM movimento_estoque 
      WHERE local_destino_id = 'loc_fabrica' 
        AND (id LIKE 'mov_inv_oficial_%' OR tipo_movimento = 'Saldo Inicial')
    `);
    if (existingMovs.length >= 12) {
      return;
    }
  }

  // Limpa saldos iniciais anteriores da fábrica para evitar duplicidade
  await execute(`
    DELETE FROM movimento_estoque 
    WHERE local_destino_id = 'loc_fabrica' 
      AND (id LIKE 'mov_init_%' OR id LIKE 'mov_inv_oficial_%' OR tipo_movimento = 'Saldo Inicial')
  `);

  // Insere o estoque oficial exato informado para cada um dos 12 produtos usando INSERT OR REPLACE
  for (const [prodId, caixas] of Object.entries(OFFICIAL_FACTORY_STOCK)) {
    const p = OFFICIAL_PRODUCTS.find((item) => item.id === prodId);
    if (!p) continue;

    const fator = p.fator_conversao_estoque || 1;
    const unidades = caixas * fator;

    await execute(`
      INSERT OR REPLACE INTO movimento_estoque (
        id, produto_id, local_origem_id, local_destino_id, quantidade_original,
        unidade_original, quantidade_base, data_movimento, tipo_movimento,
        responsavel, motivo, created_at
      ) VALUES (?, ?, NULL, 'loc_fabrica', ?, ?, ?, ?, 'Saldo Inicial', 'Gestão PraCasa', ?, ?)
    `, [
      `mov_inv_oficial_${prodId}`,
      prodId,
      caixas,
      p.unidade_venda,
      unidades,
      now,
      `Inventário Oficial PraCasa - ${p.nome} (${caixas} cx)`,
      now,
    ]);
  }

  const { persistDB } = await import('./database');
  await persistDB();
}

export async function seedOfficialProducts(force: boolean = false) {
  const now = new Date().toISOString();

  if (!force) {
    const existing = await queryAll('SELECT id FROM produto LIMIT 1');
    if (existing.length > 0) {
      return;
    }
  }

  for (const p of OFFICIAL_PRODUCTS) {
    const exists = await queryOne('SELECT id, imagem_path FROM produto WHERE id = ?', [p.id]);
    if (!exists) {
      await execute(`
        INSERT INTO produto (
          id, sku, nome, descricao, categoria, marca, unidade_venda, peso_liquido_kg,
          unidade_estoque, fator_conversao_estoque, codigo_barras, preco_tabela, preco_caixa, custo_unitario,
          preco_minimo_autorizado, estoque_minimo, status, validade_dias, imagem_path, observacoes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.id,
        p.sku,
        p.nome,
        p.descricao || '',
        p.categoria,
        p.marca || 'Tempero PraCasa',
        p.unidade_venda,
        p.peso_liquido_kg || 0,
        p.unidade_estoque || 'Unidade',
        p.fator_conversao_estoque || 1,
        p.codigo_barras || '',
        p.preco_tabela || 0,
        p.preco_caixa || (p.preco_tabela ? p.preco_tabela * (p.fator_conversao_estoque || 1) : null),
        p.custo_unitario || 0,
        p.preco_minimo_autorizado || 0,
        p.estoque_minimo || 10,
        p.status || 'ativo',
        p.validade_dias || 365,
        p.imagem_path || null,
        p.observacoes || '',
        now,
        now,
      ]);
    }
    // Quando o produto já existe, NÃO sobrescrevemos preco_tabela, observacoes, etc.,
    // garantindo que qualquer alteração de preço salva pelo usuário seja 100% mantida!
  }

  // Alimenta o estoque local da fábrica com os dados oficiais (se ainda não existir)
  await applyOfficialStock();

  // Garante a persistência no storage
  const { persistDB } = await import('./database');
  await persistDB();
}

export async function seedInitialData() {
  const now = new Date().toISOString();

  // Check if company exists
  const emp = await queryOne<Empresa>('SELECT * FROM empresa LIMIT 1');
  if (!emp) {
    await execute(`
      INSERT INTO empresa (
        id, razao_social, nome_fantasia, cnpj, endereco, telefone, whatsapp, email,
        responsavel_legal, cargo_responsavel, cpf_responsavel, comissao_padrao_pct,
        estoque_minimo_padrao, intervalo_recompra_dias, politica_backup, updated_at
      ) VALUES (
        'emp_1',
        'TEMPERO PRACASA FÁBRICA DE MOLHOS E ESPECIARIAS LTDA',
        'Tempero PraCasa',
        '04.093.110/0001-04',
        'Rua Antônio Rodrigues, nº 05, Barra do Pojuca, Camaçari/BA - CEP 42840-000',
        '(71) 3624-0000',
        '(71) 99999-0000',
        'contato@temperopracasa.com.br',
        'João Paulo Santos',
        'Diretor Comercial',
        '000.000.000-00',
        10.0,
        15,
        15,
        'Backup Diário Automático',
        ?
      )
    `, [now]);

    // Initial Warehouses
    await execute(`INSERT OR IGNORE INTO local_estoque (id, nome, tipo, descricao) VALUES ('loc_fabrica', 'Fábrica / Depósito Central', 'Fábrica/Depósito', 'Depósito principal da fábrica de molhos e especiarias')`);
    await execute(`INSERT OR IGNORE INTO local_estoque (id, nome, tipo, descricao) VALUES ('loc_rep', 'Estoque em Posse de Representante', 'Estoque Representante', 'Mercadorias com representantes comerciais para pronta entrega')`);
    await execute(`INSERT OR IGNORE INTO local_estoque (id, nome, tipo, descricao) VALUES ('loc_consignado', 'Estoque Consignado', 'Estoque Consignado', 'Produtos em consignação em supermercados parceiros')`);
    await execute(`INSERT OR IGNORE INTO local_estoque (id, nome, tipo, descricao) VALUES ('loc_super', 'Estoque Informado pelo Supermercado', 'Supermercado', 'Contagem física informada pelos clientes supermercados')`);

    // Initial User
    await execute(`INSERT OR IGNORE INTO usuario (id, nome, email, perfil, ativo, created_at) VALUES ('usr_admin', 'Administrador PraCasa', 'admin@temperopracasa.com.br', 'admin', 1, ?)`, [now]);
  }

  // Always make sure official products exist in the database
  await seedOfficialProducts();
}

export async function loadDemoData() {
  const now = new Date().toISOString();

  // Make sure official products are loaded
  await seedOfficialProducts();

  // Demo Representative
  await execute(`
    INSERT OR REPLACE INTO representante (
      id, codigo, tipo, nome_razao, nome_fantasia, cpf_cnpj, endereco, telefone, whatsapp, email,
      core_numero, core_uf, territorio, exclusividade_territorial, percentual_comissao, data_inicio,
      status, possui_estoque_proprio, created_at, updated_at
    ) VALUES (
      'rep_demo_1', 'REP-001', 'PF', 'Carlos Alberto Silva', 'Carlos Representações', '123.456.789-00',
      'Av. Tancredo Neves, 1200 - Salvador/BA', '(71) 98888-1111', '(71) 98888-1111', 'carlos.rep@email.com',
      'CORE-BA 45892', 'BA', 'Região Metropolitana de Salvador e Litoral Norte', 1, 10.0, '2026-01-15',
      'ativo', 0, ?, ?
    )
  `, [now, now]);

  // Demo Customer Supermarket
  await execute(`
    INSERT OR REPLACE INTO cliente (
      id, codigo, razao_social, nome_fantasia, cpf_cnpj, endereco, cidade, uf, cep,
      contato_compras, telefone, whatsapp, email, representante_id, condicoes_pagamento, modalidade_frete,
      status, created_at, updated_at
    ) VALUES (
      'cli_demo_1', 'CLI-001', 'SUPERMERCADO NOVO BRASIL LTDA', 'Supermercado Novo Brasil', '12.345.678/0001-90',
      'Rua Getúlio Vargas, 450 - Centro', 'Camaçari', 'BA', '42800-000',
      'Marcos Gerente de Compras', '(71) 3621-5555', '(71) 99777-2222', 'compras@novobrasil.com.br',
      'rep_demo_1', '30/60 dias', 'FOB', 'ativo', ?, ?
    )
  `, [now, now]);

  // Demo Order
  await execute(`
    INSERT OR REPLACE INTO pedido (
      id, numero, data_hora, representante_id, cliente_id, subtotal, valor_frete, desconto_total,
      valor_total, condicao_pagamento, status, origem, comissao_calculada, created_at, updated_at
    ) VALUES (
      'ped_demo_1', 'PED-2026-001', ?, 'rep_demo_1', 'cli_demo_1', 480.00, 20.00, 0, 500.00, '30/60 dias',
      'Faturado', 'representante', 48.00, ?, ?
    )
  `, [now, now, now]);

  await execute(`
    INSERT OR REPLACE INTO item_pedido (
      id, pedido_id, produto_id, produto_sku, produto_nome, unidade, quantidade, preco_unitario, subtotal
    ) VALUES (
      'item_demo_1', 'ped_demo_1', 'prod_pracasa_38', 'COD-38', 'Molho de Pimenta PraCasa Vermelha Tradicional 150ml', 'Caixa c/ 12 un', 10, 4.49, 44.90
    )
  `);

  // Demo Commission
  await execute(`
    INSERT OR REPLACE INTO comissao (
      id, representante_id, pedido_id, valor_base_calculo, percentual_aplicado, valor_comissao,
      status, data_prevista_pagamento, created_at
    ) VALUES (
      'com_demo_1', 'rep_demo_1', 'ped_demo_1', 480.00, 10.0, 48.00, 'liberada', '2026-11-15', ?
    )
  `, [now]);
}

export async function clearDemoData() {
  await execute("DELETE FROM item_pedido WHERE id LIKE '%_demo_%'");
  await execute("DELETE FROM pedido WHERE id LIKE '%_demo_%'");
  await execute("DELETE FROM comissao WHERE id LIKE '%_demo_%'");
  await execute("DELETE FROM cliente WHERE id LIKE '%_demo_%'");
  await execute("DELETE FROM representante WHERE id LIKE '%_demo_%'");
}
