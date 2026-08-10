import { describe, it, expect } from 'vitest';
import { statusLabel } from '../src/utils/status';

describe('statusLabel', () => {
  it('traduz status conhecidos', () => {
    expect(statusLabel('pendente')).toBe('Pendente');
    expect(statusLabel('pronto')).toBe('Pronto');
    expect(statusLabel('cancelado')).toBe('Cancelado');
  });

  it('retorna o próprio valor para status desconhecido', () => {
    expect(statusLabel('algo_novo')).toBe('algo_novo');
  });
});
