export function formatCurrency(value: number): string {
  if (isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      // Check if already in DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
      return dateStr;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return dateStr;
  }
}

export function maskCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '').slice(0, 11);
  return clean
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskCNPJ(cnpj: string): string {
  const clean = cnpj.replace(/\D/g, '').slice(0, 14);
  return clean
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function maskCpfCnpj(val: string): string {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 11) {
    return maskCPF(clean);
  }
  return maskCNPJ(clean);
}

export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
}

export function maskCEP(cep: string): string {
  const clean = cep.replace(/\D/g, '').slice(0, 8);
  return clean.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}
