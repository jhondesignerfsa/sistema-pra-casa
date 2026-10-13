import { describe, it, expect } from 'vitest';
import { validateCPF, validateCNPJ, validateCpfCnpj, validateEmail } from './validators';

describe('validators', () => {
  it('validates CPF correctly', () => {
    // Standard test CPF (valid)
    expect(validateCPF('52998224725')).toBe(true);
    expect(validateCPF('529.982.247-25')).toBe(true);
    // Invalid CPFs
    expect(validateCPF('11111111111')).toBe(false);
    expect(validateCPF('12345678900')).toBe(false);
    expect(validateCPF('123')).toBe(false);
  });

  it('validates CNPJ correctly', () => {
    // Standard test CNPJ (valid)
    expect(validateCNPJ('11444777000161')).toBe(true);
    expect(validateCNPJ('11.444.777/0001-61')).toBe(true);
    // Invalid CNPJs
    expect(validateCNPJ('00000000000000')).toBe(false);
    expect(validateCNPJ('11444777000100')).toBe(false);
    expect(validateCNPJ('123')).toBe(false);
  });

  it('validates CpfOrCnpj dynamically', () => {
    expect(validateCpfCnpj('52998224725')).toBe(true);
    expect(validateCpfCnpj('11444777000161')).toBe(true);
    expect(validateCpfCnpj('12345')).toBe(false);
  });

  it('validates email addresses', () => {
    expect(validateEmail('contato@pracasa.com.br')).toBe(true);
    expect(validateEmail('invalid-email')).toBe(false);
    expect(validateEmail('test@domain')).toBe(false);
  });
});
