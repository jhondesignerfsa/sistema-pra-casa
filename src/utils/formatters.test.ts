import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  maskCPF,
  maskCNPJ,
  maskCpfCnpj,
  maskPhone,
  maskCEP,
} from './formatters';

describe('formatters', () => {
  it('formats currency correctly in BRL', () => {
    expect(formatCurrency(1250.5)).toContain('1.250,50');
    expect(formatCurrency(0)).toContain('0,00');
    expect(formatCurrency(NaN)).toBe('R$ 0,00');
  });

  it('formats date and date time correctly', () => {
    const formatted = formatDate('2026-03-15T10:30:00Z');
    expect(formatted).toBe('15/03/2026');

    const formattedDT = formatDateTime('2026-03-15T10:30:00Z');
    expect(formattedDT).toContain('15/03/2026');
  });

  it('applies masks for CPF and CNPJ correctly', () => {
    expect(maskCPF('52998224725')).toBe('529.982.247-25');
    expect(maskCNPJ('11444777000161')).toBe('11.444.777/0001-61');
    expect(maskCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(maskCpfCnpj('11444777000161')).toBe('11.444.777/0001-61');
  });

  it('applies masks for phone and CEP correctly', () => {
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
    expect(maskPhone('1133334444')).toBe('(11) 3333-4444');
    expect(maskCEP('13500000')).toBe('13500-000');
  });
});
