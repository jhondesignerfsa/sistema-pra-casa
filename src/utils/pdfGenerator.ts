import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Pedido, Representante, Cliente, Empresa, Comissao } from '../types';
import { formatCurrency, formatDate } from './formatters';
import { LOGO_PRACASA_PNG, LOGO_PRACASA_BADGE_PNG } from './logoPraCasa';

function numeroPorExtenso(num: number): string {
  const map: Record<number, string> = {
    1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
    6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
    11: 'onze', 12: 'doze', 13: 'treze', 14: 'quatorze', 15: 'quinze',
    18: 'dezoito', 20: 'vinte', 25: 'vinte e cinco'
  };
  return map[Math.round(num)] || String(num);
}

export function generateContratoRepresentacaoPDF(
  rep: Representante,
  empresa: Empresa,
  dadosExtra?: any
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 18;
  const contentWidth = 174;
  let y = 14;

  const now = new Date();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const diaAssinatura = now.getDate();
  const mesAssinatura = meses[now.getMonth()];
  const anoAssinatura = now.getFullYear();

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > 268) {
      doc.addPage();
      y = 22;
      return true;
    }
    return false;
  };

  // Header Logo PraCasa (Alta Qualidade)
  try {
    doc.addImage(LOGO_PRACASA_PNG, 'PNG', 105 - 20, y, 40, 24.8);
    y += 27;
  } catch (e) {
    y += 6;
  }

  // Header Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(153, 27, 27);
  doc.text('TEMPERO PRACASA', 105, y, { align: 'center' });
  y += 5.5;
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('CONTRATO DE REPRESENTAÇÃO COMERCIAL AUTÔNOMA', 105, y, { align: 'center' });
  y += 9;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);

  // Parties & Qualification
  const razaoEmpresa = empresa.razao_social || 'TEMPERO PRACASA FÁBRICA DE MOLHOS E ESPECIARIAS LTDA';
  const cnpjEmpresa = empresa.cnpj || '04.093.110/0001-04';
  const endEmpresa = empresa.endereco || 'Rua Antônio Rodrigues, nº 05, Barra do Pojuca, Camaçari/BA';
  const repLegalEmpresa = `${empresa.responsavel_legal || 'Representante Legal'}${empresa.cargo_responsavel ? ', ' + empresa.cargo_responsavel : ''}${empresa.cpf_responsavel ? ', CPF nº ' + empresa.cpf_responsavel : ''}`;

  const nomeRep = `${rep.nome_razao}${rep.nome_fantasia ? ' (' + rep.nome_fantasia + ')' : ''}`;
  const docRep = rep.cpf_cnpj ? `${rep.tipo === 'PF' ? 'CPF' : 'CNPJ'} sob nº ${rep.cpf_cnpj}` : 'documento a conferir';
  const endRep = rep.endereco || 'endereço cadastral a preencher';
  const coreRep = `inscrição no CORE ${rep.core_numero ? rep.core_numero + '/' + (rep.core_uf || 'BA') : '[NÚMERO/UF]'}`;
  const repLegalRep = rep.tipo === 'PJ' && rep.rep_legal_nome
    ? `, neste ato representado por ${rep.rep_legal_nome}${rep.rep_legal_cpf ? ', CPF nº ' + rep.rep_legal_cpf : ''}`
    : rep.tipo === 'PJ'
    ? ', neste ato representado por seus sócios administradores'
    : '';

  const introText =
    `REPRESENTADA: ${razaoEmpresa}, inscrita no CNPJ sob nº ${cnpjEmpresa}, com endereço na ${endEmpresa}, representada por ${repLegalEmpresa}.\n\n` +
    `REPRESENTANTE: ${nomeRep}, ${docRep}, com endereço em ${endRep}, ${coreRep}${repLegalRep}.\n\n` +
    `As partes celebram o presente contrato, regido pela Lei nº 4.886/1965, com suas alterações, e pelas cláusulas seguintes.`;

  const introLines = doc.splitTextToSize(introText, contentWidth);
  checkPageBreak(introLines.length * 4.2);
  doc.text(introLines, margin, y);
  y += introLines.length * 4.2 + 5;

  // The 12 Clauses
  const pctComissao = rep.percentual_comissao || 10;
  const pctExtenso = numeroPorExtenso(pctComissao);

  const zonaAtuacao = rep.territorio || '[DESCREVER MUNICÍPIOS/ESTADOS/REGIÃO]';
  const exclusividadeTerritorial = rep.exclusividade_territorial ? 'COM' : 'SEM';
  const exclusividadeOutras = rep.exclusividade_outras_representadas ? 'EXCLUSIVA' : 'NÃO EXCLUSIVA';
  const regrasVendasDiretas = rep.regras_vendas_diretas || 'as condições comerciais gerais e prazos alinhados previamente';
  const dataInicioStr = rep.data_inicio ? formatDate(rep.data_inicio) : '[DATA DE INÍCIO]';

  const clausulas = [
    {
      titulo: '1. OBJETO',
      texto: 'O REPRESENTANTE, com autonomia e sem vínculo de emprego, promoverá a intermediação de negócios mercantis, prospectando clientes, divulgando e apresentando os produtos da REPRESENTADA e encaminhando pedidos para análise e aprovação. Os produtos abrangem condimentos, especiarias, molhos de pimenta e itens correlatos constantes do catálogo vigente. O REPRESENTANTE não compra mercadorias para revenda por força deste instrumento.'
    },
    {
      titulo: '2. ÁREA DE ATUAÇÃO E EXCLUSIVIDADE',
      texto: `A zona de atuação será ${zonaAtuacao}. A representação terá ${exclusividadeTerritorial} exclusividade territorial e será ${exclusividadeOutras} em relação a outras representadas, observadas as limitações legais e a vedação de conflito de interesses. A REPRESENTADA poderá ou não realizar vendas diretas na zona, conforme ${regrasVendasDiretas}; comissões por vendas diretas ou de terceiros observarão a exclusividade ajustada e a Lei nº 4.886/1965. Qualquer alteração territorial deverá ser formalizada por escrito, respeitada a legislação.`
    },
    {
      titulo: '3. CAPTAÇÃO E PEDIDOS',
      texto: 'O REPRESENTANTE encaminhará pedidos com identificação do cliente, itens, quantidades, preços e condições solicitadas. A REPRESENTADA avaliará crédito, estoque e condições comerciais, comunicando por escrito eventual recusa nos prazos legais aplicáveis. O REPRESENTANTE não poderá conceder descontos, alterar prazos, prometer entregas, receber valores de clientes ou assumir obrigações em nome da REPRESENTADA sem autorização expressa.'
    },
    {
      titulo: `4. COMISSÃO DE ${pctComissao}%`,
      texto: `Pelos negócios realizados por sua intermediação e demais negócios legalmente comissionáveis, o REPRESENTANTE receberá comissão de ${pctComissao}% (${pctExtenso} por cento), calculada sobre o valor total das mercadorias constantes das operações correspondentes, nos termos do art. 32, §4º, da Lei nº 4.886/1965. O frete cobrado separadamente, quando não integrar o valor das mercadorias, não compõe a base de cálculo. A forma de faturamento não poderá ser utilizada para reduzir artificialmente a base legal de comissão.`
    },
    {
      titulo: '5. AQUISIÇÃO DO DIREITO E PAGAMENTO',
      texto: 'O direito à comissão surge com o pagamento do pedido ou proposta pelo comprador, inclusive proporcionalmente aos recebimentos parcelados. A REPRESENTADA pagará as comissões devidas até o dia 15 do mês subsequente à liquidação da respectiva fatura, fornecendo demonstrativo das operações e cópias das notas fiscais correspondentes, conforme a legislação. Valores pagos fora do prazo serão corrigidos monetariamente nos termos da legislação aplicável.'
    },
    {
      titulo: '6. RESPONSABILIDADES DA REPRESENTADA',
      texto: 'Compete à REPRESENTADA fornecer tabela de preços e materiais comerciais atualizados, analisar pedidos, emitir documentos fiscais, faturar, receber pagamentos, organizar a entrega e atender reclamações relativas à fabricação e qualidade. Condições de pagamento dos compradores, retirada ou entrega, frete e trocas por defeitos ou avarias serão definidas entre fábrica e comprador em cada venda. Alterações de tabela de preços serão comunicadas ao REPRESENTANTE preferencialmente com antecedência mínima de 15 dias, ressalvadas circunstâncias justificadas e os direitos legais.'
    },
    {
      titulo: '7. RESPONSABILIDADES DO REPRESENTANTE',
      texto: 'Compete ao REPRESENTANTE atuar com diligência e boa-fé, manter informações atualizadas sobre negociações e clientes, respeitar orientações comerciais lícitas, preservar a imagem da marca, não prometer condições não autorizadas e observar regras de proteção de dados. O REPRESENTANTE organizará seus próprios meios, horários e despesas de atuação, salvo reembolso previamente acordado por escrito, sem subordinação típica de emprego.'
    },
    {
      titulo: '8. CARTEIRA, REGISTROS E PRESTAÇÃO DE CONTAS',
      texto: 'As partes manterão registros identificáveis de clientes prospectados, pedidos encaminhados, aceitos, faturados, recebidos e comissões devidas. A atribuição de vendas ao REPRESENTANTE será apurada pelos registros e pelas regras de exclusividade territorial pactuadas, sem prejuízo de direitos previstos em lei. Divergências deverão ser comunicadas por escrito para conferência.'
    },
    {
      titulo: '9. CONFIDENCIALIDADE E DADOS',
      texto: 'As partes manterão sigilo sobre preços não públicos, carteira de clientes, condições comerciais e informações estratégicas, salvo exigência legal. Dados pessoais serão tratados apenas para finalidades legítimas relacionadas à representação, com medidas adequadas de segurança e observância da LGPD. Ao término, materiais e dados serão devolvidos ou tratados conforme obrigações legais.'
    },
    {
      titulo: '10. PRAZO E RESCISÃO',
      texto: `Este contrato vigorará por prazo indeterminado a partir de ${dataInicioStr}. Sua rescisão observará os motivos justos previstos na Lei nº 4.886/1965. Em rescisão sem justa causa pela REPRESENTADA, será devida a indenização legal mínima de 1/12 do total das retribuições auferidas durante a representação, observados os critérios legais. Nos contratos por prazo indeterminado vigentes por mais de seis meses, a denúncia sem justa causa observará aviso prévio mínimo de 30 dias ou pagamento substitutivo legal, quando cabível. Comissões pendentes e pedidos em carteira terão tratamento conforme a lei.`
    },
    {
      titulo: '11. AUTONOMIA E REGULARIDADE',
      texto: 'A relação tem natureza de representação comercial autônoma. O REPRESENTANTE declara que providenciará e manterá a regularidade de seu registro profissional no CORE competente e de suas obrigações fiscais, quando aplicáveis. A execução prática deverá preservar a autonomia pactuada; a mera declaração contratual não afasta eventual reconhecimento de vínculo se presentes seus requisitos legais.'
    },
    {
      titulo: '12. DISPOSIÇÕES GERAIS E FORO',
      texto: 'Qualquer alteração deste instrumento deverá ser formalizada por escrito. A tolerância pontual não implica renúncia a direitos. Questões não previstas serão regidas pela legislação aplicável. Para controvérsias decorrentes da representação comercial, observar-se-á o foro legalmente competente, especialmente a regra do domicílio do representante prevista na Lei nº 4.886/1965, quando aplicável.'
    }
  ];

  clausulas.forEach((c) => {
    const textLines = doc.splitTextToSize(c.texto, contentWidth);
    const blockHeight = 6 + textLines.length * 4.2 + 3;

    checkPageBreak(blockHeight);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text(c.titulo, margin, y);
    y += 5;

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(textLines, margin, y);
    y += textLines.length * 4.2 + 3.5;
  });

  // Assinaturas
  checkPageBreak(75);

  y += 4;
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(153, 27, 27);
  doc.text('ASSINATURAS', margin, y);
  y += 6;

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(`Camaçari/BA, ${diaAssinatura} de ${mesAssinatura} de ${anoAssinatura}.`, margin, y);
  y += 14;

  // Signatures lines
  doc.text('____________________________________________________', margin, y);
  y += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.text(`REPRESENTADA: ${razaoEmpresa}`, margin, y);
  y += 4;
  doc.setFont('Helvetica', 'normal');
  doc.text(repLegalEmpresa, margin, y);
  y += 14;

  doc.text('____________________________________________________', margin, y);
  y += 4.5;
  doc.setFont('Helvetica', 'bold');
  doc.text(`REPRESENTANTE: ${nomeRep}`, margin, y);
  y += 4;
  doc.setFont('Helvetica', 'normal');
  doc.text(docRep, margin, y);
  y += 14;

  doc.text('________________________________________', margin, y);
  doc.text('________________________________________', 110, y);
  y += 4.5;
  doc.text('TESTEMUNHA 1 — Nome e CPF', margin, y);
  doc.text('TESTEMUNHA 2 — Nome e CPF', 110, y);
  y += 10;

  // Pontos a validar box
  checkPageBreak(30);

  doc.setDrawColor(217, 119, 6);
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');
  y += 5;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 83, 9);
  doc.text('PONTOS A VALIDAR ANTES DE ASSINAR:', margin + 3, y);
  y += 4;

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  const checklist =
    '1. Conferir razão social e CNPJ da fábrica.  2. Identificar representante e CORE.  3. Delimitar território.\n' +
    '4. Escolher e detalhar exclusividade e vendas diretas.  5. Definir data de início e eventual política de despesas.\n' +
    '6. Revisar com advogado, inclusive base de comissão, documentos fiscais e rotina comercial.';
  const checkLines = doc.splitTextToSize(checklist, contentWidth - 6);
  doc.text(checkLines, margin + 3, y);

  // Headers and Footers with Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);

    if (p > 1) {
      try {
        doc.addImage(LOGO_PRACASA_BADGE_PNG, 'PNG', margin, 6, 14, 7.8);
      } catch {}
      doc.text('TEMPERO PRACASA — CONTRATO DE REPRESENTAÇÃO COMERCIAL AUTÔNOMA', margin + 17, 11);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, 15, margin + contentWidth, 15);
    }

    doc.text('Tempero PraCasa • Fábrica de Molhos e Especiarias — Lei nº 4.886/1965', margin, 289);
    doc.text(`Página ${p} de ${totalPages}`, margin + contentWidth, 289, { align: 'right' });
  }

  return doc;
}

export function generateContratoFornecimentoPDF(
  cliente: Cliente,
  empresa: Empresa,
  dadosExtra: any
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 15;
  let y = 14;

  // Header Logo PraCasa
  try {
    doc.addImage(LOGO_PRACASA_PNG, 'PNG', 105 - 20, y, 40, 24.8);
    y += 27;
  } catch (e) {
    y += 6;
  }

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(153, 27, 27);
  doc.text('CONTRATO DE FORNECIMENTO PRACASA', 105, y, { align: 'center' });
  y += 10;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  const intro = `FORNECEDOR: ${empresa.razao_social}, CNPJ nº ${empresa.cnpj}, com sede em ${empresa.endereco}.\n\n` +
    `CLIENTE/COMPRADOR: ${cliente.razao_social} (${cliente.nome_fantasia}), CNPJ/CPF nº ${cliente.cpf_cnpj}, com sede/endereço em ${cliente.endereco}, ${cliente.cidade}/${cliente.uf}.\n\n` +
    `As partes acordam o fornecimento regular de produtos da linha Tempero PraCasa sob as condições abaixo:`;

  const lines = doc.splitTextToSize(intro, 180);
  doc.text(lines, margin, y);
  y += lines.length * 5 + 6;

  const clausulas = [
    { titulo: '1. OBJETO E FORNECIMENTO', texto: `Fornecimento contínuo de molhos de pimenta, condimentos e especiarias conforme pedidos faturados.` },
    { titulo: '2. PREÇOS E CONDIÇÕES DE PAGAMENTO', texto: `Os preços seguirão a tabela vigente. As condições de pagamento acordadas são: ${cliente.condicoes_pagamento}. Modalidade de frete: ${cliente.modalidade_frete}.` },
    { titulo: '3. POLÍTICA DE TROCA E AVARIAS', texto: `Trocas por avaria de transporte ou defeito de fabricação serão atendidas mediante notificação formal e envio de laudo/foto em até 7 dias úteis após o recebimento.` },
    { titulo: '4. VIGÊNCIA E RESCISÃO', texto: `Contrato por prazo indeterminado, podendo ser denunciado por qualquer das partes mediante aviso prévio de 30 dias.` }
  ];

  clausulas.forEach(c => {
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(153, 27, 27);
    doc.text(c.titulo, margin, y);
    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const txt = doc.splitTextToSize(c.texto, 180);
    doc.text(txt, margin, y);
    y += txt.length * 5 + 4;
  });

  y += 15;
  doc.text('________________________________________', margin, y);
  doc.text('________________________________________', 110, y);
  y += 5;
  doc.text(`FORNECEDOR: ${empresa.razao_social}`, margin, y);
  doc.text(`CLIENTE: ${cliente.razao_social}`, 110, y);

  return doc;
}

export function generatePedidoPDF(
  pedido: Pedido,
  empresa: Empresa,
  representante?: Representante,
  cliente?: Cliente
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const contentWidth = 182;
  let y = 12;

  // 1. Official Logo (Top Left)
  try {
    doc.addImage(LOGO_PRACASA_PNG, 'PNG', margin, y, 38, 23.5);
  } catch (e) {
    console.error('Erro ao adicionar logo:', e);
  }

  // 2. Company Info (Center / Beside Logo)
  const compX = margin + 42; // 56mm
  const compW = 72; // Ends at 128mm (leaves 4mm gap before boxX at 132mm)

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(153, 27, 27); // Brand carmine red
  doc.text(empresa.nome_fantasia || 'TEMPERO PRACASA', compX, y + 4);

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Fábrica de Molhos, Temperos & Especiarias', compX, y + 8.5);

  doc.text(`CNPJ: ${empresa.cnpj || '04.093.110/0001-04'}`, compX, y + 12.5);

  // Split address safely so it NEVER cuts off
  const enderecoFull = empresa.endereco || 'Rua Antônio Rodrigues, nº 05, Barra do Pojuca, Camaçari/BA - CEP 42840-000';
  const endLines = doc.splitTextToSize(enderecoFull, compW);
  doc.text(endLines[0] || '', compX, y + 16.5);
  if (endLines[1]) {
    doc.text(endLines[1], compX, y + 20);
    doc.text(`Tel/Whats: ${empresa.telefone || '(71) 3624-0000'}`, compX, y + 23.5);
  } else {
    doc.text(`Tel/Whats: ${empresa.telefone || '(71) 3624-0000'}`, compX, y + 20.5);
  }

  // 3. Order Badge Box (Top Right - Modern Corporate PraCasa Design)
  const boxX = 132;
  const boxW = 64;
  const boxH = 26;

  // Box background & border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'FD');

  // Top header banner in box
  doc.setFillColor(153, 27, 27); // PraCasa Carmine Red
  doc.roundedRect(boxX, y, boxW, 6.5, 2, 2, 'F');
  doc.rect(boxX, y + 4, boxW, 2.5, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PEDIDO DE VENDA', boxX + boxW / 2, y + 4.5, { align: 'center' });

  // Order Number
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`Nº ${pedido.numero}`, boxX + boxW / 2, y + 12, { align: 'center' });

  // Emission date
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Emissão: ${formatDate(pedido.data_hora)}`, boxX + 4, y + 17.5);

  // Status Badge Pill
  const isApproved = pedido.status === 'Aprovado';
  const isDelivered = pedido.status === 'Faturado' || pedido.status === 'Entregue';
  const isCanceled = pedido.status === 'Cancelado' || pedido.status === 'Recusado';

  const pillBg: [number, number, number] = isDelivered ? [220, 252, 231] : isApproved ? [224, 242, 254] : isCanceled ? [254, 226, 226] : [254, 243, 199];
  const pillText: [number, number, number] = isDelivered ? [21, 128, 61] : isApproved ? [3, 105, 161] : isCanceled ? [185, 28, 28] : [180, 83, 9];

  const statusStr = pedido.status.toUpperCase();
  const pillW = doc.getTextWidth(statusStr) + 6;
  const pillX = boxX + boxW - pillW - 4;
  const pillY = y + 15;

  doc.setFillColor(pillBg[0], pillBg[1], pillBg[2]);
  doc.roundedRect(pillX, pillY, pillW, 4.5, 1, 1, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(pillText[0], pillText[1], pillText[2]);
  doc.text(statusStr, pillX + pillW / 2, pillY + 3.2, { align: 'center' });

  // Channel identification in box
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Canal Representação Comercial', boxX + 4, y + 23);

  y += 29;

  // 4. Commercial Representation Strip (Highlighting Representative)
  const repNome = pedido.representante_nome || representante?.nome_razao || 'Representante Autorizado';
  const repCode = representante?.codigo ? `[${representante.codigo}] ` : '';
  const repCore = representante?.core_numero ? ` • CORE: ${representante.core_numero}/${representante.core_uf || 'BA'}` : '';
  const repTel = (representante?.whatsapp || representante?.telefone) ? ` • Tel: ${representante?.whatsapp || representante?.telefone}` : '';

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 8, 1.2, 1.2, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(153, 27, 27);
  doc.text('REPRESENTAÇÃO COMERCIAL AUTÔNOMA:', margin + 3, y + 5.2);

  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${repCode}${repNome}`, margin + 63, y + 5.2);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`${repCore}${repTel}`, margin + contentWidth - 3, y + 5.2, { align: 'right' });

  y += 11;

  // 5. Client & Commercial Operations Card (2 Clear Columns)
  const opBoxH = pedido.observacoes ? 27 : 22;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, opBoxH, 1.5, 1.5, 'FD');

  // Column divider
  const colSplitX = margin + 96;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(colSplitX, y + 2, colSplitX, y + (pedido.observacoes ? 20 : opBoxH - 2));

  // LEFT COLUMN: CLIENTE / DESTINATÁRIO
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27);
  doc.text('DADOS DO CLIENTE / COMPRADOR', margin + 3, y + 4.5);

  doc.setFontSize(7.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Supermercado / Cliente:', margin + 3, y + 9);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const cliNome = pedido.cliente_nome || cliente?.nome_fantasia || cliente?.razao_social || '-';
  doc.text(cliNome, margin + 36, y + 9);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('CNPJ / Documento:', margin + 3, y + 13.5);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(cliente?.cpf_cnpj || 'Inscrito', margin + 36, y + 13.5);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Localidade / Cidade:', margin + 3, y + 18);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const locStr = cliente?.cidade ? `${cliente.cidade} / ${cliente.uf || 'BA'}` : 'Bahia / BA';
  doc.text(locStr, margin + 36, y + 18);

  // RIGHT COLUMN: CONDIÇÕES & LOGÍSTICA
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27);
  doc.text('CONDIÇÕES COMERCIAIS & LOGÍSTICA', colSplitX + 4, y + 4.5);

  doc.setFontSize(7.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Cond. Pagamento:', colSplitX + 4, y + 9);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${pedido.condicao_pagamento || 'A Combinar'}`, colSplitX + 32, y + 9);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Previsão Entrega:', colSplitX + 4, y + 13.5);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${formatDate(pedido.data_solicitada_entrega)}`, colSplitX + 32, y + 13.5);

  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Origem do Estoque:', colSplitX + 4, y + 18);
  doc.setFont('Helvetica', 'bold');
  if (pedido.origem === 'representante') {
    doc.setTextColor(3, 105, 161); // Sky 700
    doc.text('Estoque do Representante (Pronta Entrega)', colSplitX + 32, y + 18);
  } else {
    doc.setTextColor(180, 83, 9); // Amber 700
    doc.text('Estoque da Fábrica / Matriz', colSplitX + 32, y + 18);
  }

  // OBSERVATION ROW (IF ANY)
  if (pedido.observacoes) {
    doc.setDrawColor(226, 232, 240);
    doc.line(margin + 2, y + 21, margin + contentWidth - 2, y + 21);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Observações: ${pedido.observacoes}`, margin + 3, y + 25);
  }

  y += opBoxH + 4;

  // 5. Items Table (Wholesale Packaging & A Granel Friendly)
  const tableData = (pedido.items || []).map((item, index) => {
    const isAvulso = item.tipo_embalagem === 'unidade' || item.unidade?.toLowerCase().includes('granel') || item.unidade?.toLowerCase().includes('avulso');
    const embalagem = isAvulso ? 'A Granel (Avulso)' : (item.unidade || 'Caixa');
    return [
      index + 1,
      item.produto_sku,
      item.produto_nome,
      embalagem,
      `${item.quantidade} ${isAvulso ? 'un' : 'cx'}`,
      formatCurrency(item.preco_unitario),
      item.desconto_pct ? `${item.desconto_pct}%` : '-',
      formatCurrency(item.subtotal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'SKU', 'Produto / Item', 'Embalagem / Tipo', 'Qtd', 'Preço Unit.', 'Desc.', 'Subtotal']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [185, 28, 28], // PraCasa Carmine Red
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 20, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 24 },
      4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
    },
    styles: {
      cellPadding: 2,
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // 6. Financial Summary Box (Right aligned)
  const sumW = 75;
  const sumX = margin + contentWidth - sumW;
  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(251, 146, 60);
  doc.roundedRect(sumX, finalY, sumW, 28, 1.5, 1.5, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal Mercadorias:', sumX + 3, finalY + 5.5);
  doc.text(formatCurrency(pedido.subtotal), sumX + sumW - 3, finalY + 5.5, { align: 'right' });

  doc.text('Frete:', sumX + 3, finalY + 10.5);
  doc.text(formatCurrency(pedido.valor_frete || 0), sumX + sumW - 3, finalY + 10.5, { align: 'right' });

  doc.text('Descontos Concedidos:', sumX + 3, finalY + 15.5);
  doc.text(`- ${formatCurrency(pedido.desconto_total || 0)}`, sumX + sumW - 3, finalY + 15.5, { align: 'right' });

  doc.setDrawColor(251, 146, 60);
  doc.line(sumX + 3, finalY + 18, sumX + sumW - 3, finalY + 18);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(153, 27, 27);
  doc.text('VALOR TOTAL:', sumX + 3, finalY + 24);
  doc.text(formatCurrency(pedido.valor_total), sumX + sumW - 3, finalY + 24, { align: 'right' });

  // 7. Signatures / Authorization Block
  const sigY = finalY + 38;
  if (sigY < 265) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin + 5, sigY, margin + 75, sigY);
    doc.line(margin + contentWidth - 75, sigY, margin + contentWidth - 5, sigY);

    doc.setFontSize(7.5);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('SUPERMERCADO / CLIENTE RESPONSÁVEL', margin + 40, sigY + 4, { align: 'center' });
    doc.text('REPRESENTANTE COMERCIAL / TEMPERO PRACASA', margin + contentWidth - 40, sigY + 4, { align: 'center' });
  }

  // 8. Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tempero PraCasa • O verdadeiro sabor caseiro! • Barra do Pojuca, Camaçari/BA`, margin, 290);
    doc.text(`Página ${p} de ${totalPages} • Pedido Nº ${pedido.numero}`, margin + contentWidth, 290, { align: 'right' });
  }

  return doc;
}

export interface EstoqueRepItemReport {
  produto_sku: string;
  produto_nome: string;
  categoria: string;
  embalagem: string;
  fator: number;
  caixasFechadas: number;
  unidadesAvulsas: number;
  totalUnidades: number;
  caixasEquivalentes: number;
  precoUnitario: number;
  precoCaixa: number;
  valorTotalEstoque: number;
}

export function generateEstoqueRepresentantePDF(
  rep: Representante,
  empresa: Empresa,
  items: EstoqueRepItemReport[],
  totalGeralCaixas: number,
  totalGeralAvulsas: number,
  totalGeralUnidades: number,
  valorTotalEstoque: number
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 14;
  const contentWidth = 182;
  let y = 12;

  // 1. Official Logo (Top Left)
  try {
    doc.addImage(LOGO_PRACASA_PNG, 'PNG', margin, y, 38, 23.5);
  } catch (e) {
    console.error('Erro ao adicionar logo:', e);
  }

  // 2. Company Info (Center / Beside Logo)
  const compX = margin + 42;
  const compW = 72;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(153, 27, 27); // Brand carmine red
  doc.text(empresa.nome_fantasia || 'TEMPERO PRACASA', compX, y + 4);

  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Fábrica de Molhos, Temperos & Especiarias', compX, y + 8.5);
  doc.text(`CNPJ: ${empresa.cnpj || '04.093.110/0001-04'}`, compX, y + 12.5);

  const enderecoFull = empresa.endereco || 'Rua Antônio Rodrigues, nº 05, Barra do Pojuca, Camaçari/BA - CEP 42840-000';
  const endLines = doc.splitTextToSize(enderecoFull, compW);
  doc.text(endLines[0] || '', compX, y + 16.5);
  if (endLines[1]) {
    doc.text(endLines[1], compX, y + 20);
    doc.text(`Tel/Whats: ${empresa.telefone || '(71) 3624-0000'}`, compX, y + 23.5);
  } else {
    doc.text(`Tel/Whats: ${empresa.telefone || '(71) 3624-0000'}`, compX, y + 20.5);
  }

  // 3. Document Badge Box (Top Right)
  const boxX = 132;
  const boxW = 64;
  const boxH = 26;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, 'FD');

  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(boxX, y, boxW, 6.5, 2, 2, 'F');
  doc.rect(boxX, y + 4, boxW, 2.5, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CONFERÊNCIA DE ESTOQUE', boxX + boxW / 2, y + 4.5, { align: 'center' });

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('ESTOQUE DO REPRESENTANTE', boxX + boxW / 2, y + 12, { align: 'center' });

  const now = new Date();
  const dataEmissao = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Posição: ${dataEmissao}`, boxX + 4, y + 16.5);

  doc.text(`Cód. Rep: ${rep.codigo || 'REP-614'}`, boxX + 4, y + 21.8);

  // Status Badge Pill (aligned beside representative code, no collision with date)
  const pillW = 26;
  const pillX = boxX + boxW - pillW - 3.5;
  const pillY = y + 18.5;
  doc.setFillColor(224, 242, 254);
  doc.roundedRect(pillX, pillY, pillW, 4.5, 1, 1, 'F');
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(3, 105, 161);
  doc.text('AUDITORIA / ATUAL', pillX + pillW / 2, pillY + 3.2, { align: 'center' });

  y += 29;

  // 4. Representative Qualification Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 16, 1.5, 1.5, 'FD');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(153, 27, 27);
  doc.text('REPRESENTANTE COMERCIAL DETENTOR DAS MERCADORIAS:', margin + 3, y + 4.5);

  doc.setFontSize(8.5);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${rep.nome_razao}`, margin + 3, y + 9.5);

  doc.setFontSize(7.5);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const docStr = rep.cpf_cnpj ? `CPF/CNPJ: ${rep.cpf_cnpj}` : '';
  const coreStr = rep.core_numero ? ` • CORE: ${rep.core_numero}/${rep.core_uf || 'BA'}` : '';
  const telStr = (rep.whatsapp || rep.telefone) ? ` • Tel/Whats: ${rep.whatsapp || rep.telefone}` : '';
  const terrStr = rep.territorio ? ` • Região: ${rep.territorio}` : '';
  doc.text(`${docStr}${coreStr}${telStr}${terrStr}`, margin + 3, y + 14);

  y += 19;

  // 5. Four Summary Metrics Cards
  const cardW = (contentWidth - 9) / 4;
  const cardH = 13.5;

  const cards = [
    { label: 'CAIXAS FECHADAS', val: `${totalGeralCaixas} cx`, color: [30, 41, 59], bg: [241, 245, 249] },
    { label: 'AVULSAS (A GRANEL)', val: `${totalGeralAvulsas} un`, color: [180, 83, 9], bg: [254, 243, 199] },
    { label: 'VOLUME TOTAL FÍSICO', val: `${totalGeralUnidades} un`, color: [3, 105, 161], bg: [224, 242, 254] },
    { label: 'VALOR TOTAL ESTOQUE', val: formatCurrency(valorTotalEstoque), color: [21, 128, 61], bg: [220, 252, 231] },
  ];

  cards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(cx, y, cardW, cardH, 1, 1, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 2.5, y + 4);

    doc.setFontSize(9);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.val, cx + 2.5, y + 10);
  });

  y += cardH + 4;

  // 6. Detailed Inventory Table
  const tableData = items.map((it, idx) => {
    const fullDesc = it.caixasFechadas > 0 ? `${it.caixasFechadas} cx` : '-';
    const looseDesc = it.unidadesAvulsas > 0 ? `+${it.unidadesAvulsas} un` : '-';

    return [
      idx + 1,
      it.produto_sku,
      it.produto_nome,
      it.embalagem,
      fullDesc,
      looseDesc,
      `${it.totalUnidades} un`,
      formatCurrency(it.precoCaixa),
      formatCurrency(it.valorTotalEstoque),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      '#',
      'SKU',
      'Produto / Descrição',
      'Embalagem',
      'Cx Fechadas',
      'A Granel',
      'Total (Un)',
      'Preço Cx',
      'Valor Estoque'
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Dark Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { cellWidth: 7, halign: 'center' },
      1: { cellWidth: 19, fontStyle: 'bold' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22 },
      4: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 18, halign: 'center' },
      6: { cellWidth: 18, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 18, halign: 'right' },
      8: { cellWidth: 23, halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
    },
    styles: {
      cellPadding: 1.8,
    },
  });

  let finalY = (doc as any).lastAutoTable.finalY + 5;

  if (finalY + 45 > 280) {
    doc.addPage();
    finalY = 20;
  }

  // 7. Total Summary Card & Audit Note
  const sumCardH = 26;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, finalY, contentWidth, sumCardH, 1.5, 1.5, 'FD');

  // Top header banner inside card
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, finalY, contentWidth, 7, 1.5, 1.5, 'F');
  doc.rect(margin, finalY + 4, contentWidth, 3, 'F');

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `TOTAL CONSOLIDADO: ${items.length} ITENS | ${totalGeralCaixas} CX FECHADAS + ${totalGeralAvulsas} UN AVULSAS (${totalGeralUnidades} UN)`,
    margin + 3,
    finalY + 4.8
  );

  doc.setFontSize(8.5);
  doc.setTextColor(153, 27, 27);
  doc.text(`VALOR TOTAL: ${formatCurrency(valorTotalEstoque)}`, margin + contentWidth - 3, finalY + 4.8, { align: 'right' });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 2, finalY + 7.5, margin + contentWidth - 2, finalY + 7.5);

  // Legal / Audit Declaration text below with plenty of room
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  const termoLines = doc.splitTextToSize(
    'DECLARAÇÃO DE CONFERÊNCIA: As partes confirmam que a relação física acima espelha fielmente as mercadorias sob responsabilidade do REPRESENTANTE nesta data, destinadas à intermediação mercantil e pronta entrega da marca Tempero PraCasa.',
    contentWidth - 6
  );
  doc.text(termoLines, margin + 3, finalY + 12.5);

  finalY += sumCardH + 8;

  // 8. Signatures Block
  if (finalY + 22 < 280) {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.4);
    doc.line(margin + 5, finalY, margin + 78, finalY);
    doc.line(margin + contentWidth - 78, finalY, margin + contentWidth - 5, finalY);

    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${rep.nome_razao.toUpperCase()}\nRepresentante Comercial Autônomo`, margin + 41.5, finalY + 4, { align: 'center' });
    doc.text(`TEMPERO PRACASA LTDA\nControle de Estoque & Expedição`, margin + contentWidth - 41.5, finalY + 4, { align: 'center' });
  }

  // 9. Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`Tempero PraCasa • O verdadeiro sabor caseiro! • Barra do Pojuca, Camaçari/BA`, margin, 290);
    doc.text(`Página ${p} de ${totalPages} • Conferência de Estoque: ${rep.nome_razao}`, margin + contentWidth, 290, { align: 'right' });
  }

  return doc;
}
