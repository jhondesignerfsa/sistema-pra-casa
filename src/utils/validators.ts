export function validateCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let sum = 0;
  let rev: number;
  for (let i = 1; i <= 9; i++) sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
  rev = (sum * 10) % 11;
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(clean.substring(10, 11))) return false;

  return true;
}

export function validateCNPJ(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  let size = clean.length - 2;
  let numbers = clean.substring(0, size);
  const digits = clean.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = clean.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

export function validateCpfCnpj(val: string): boolean {
  const clean = val.replace(/\D/g, '');
  if (clean.length === 11) return validateCPF(clean);
  if (clean.length === 14) return validateCNPJ(clean);
  return false;
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}
