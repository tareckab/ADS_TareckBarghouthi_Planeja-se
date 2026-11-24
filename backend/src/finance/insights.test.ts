import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { performance, recommendation } from './insights.js';

const today = new Date(2026, 10, 21); // 21/11/2026 -> 10 dias restantes contando hoje (nov tem 30)

describe('performance (HU08)', () => {
  it('calcula a variação do resultado em relação ao mês anterior', () => {
    const r = performance({ income: 5000, expenses: 3500 }, { income: 5000, expenses: 4000 });
    assert.equal(r.result, 1500);
    assert.equal(r.previousResult, 1000);
    assert.equal(r.change, 50);
  });

  it('variação negativa quando o resultado piora, inclusive vindo de prejuízo', () => {
    assert.equal(performance({ income: 1000, expenses: 1500 }, { income: 1000, expenses: 1200 }).change, -150);
    assert.equal(performance({ income: 1000, expenses: 1100 }, { income: 1000, expenses: 1200 }).change, 50);
  });

  it('sem base de comparação devolve null', () => {
    assert.equal(performance({ income: 100, expenses: 0 }, { income: 0, expenses: 0 }).change, null);
  });
});

describe('recommendation (HU09)', () => {
  it('sem meta de gasto informa a ausência', () => {
    assert.deepEqual(recommendation(null, { confirmed: 100, pending: 0 }, '2026-11', today), { status: 'no-budget' });
  });

  it('distribui o saldo da meta pelos dias restantes, contando pendentes', () => {
    const r = recommendation(3000, { confirmed: 1800, pending: 200 }, '2026-11', today);
    assert.ok(r.status === 'ok');
    assert.equal(r.committed, 2000);
    assert.equal(r.remaining, 1000);
    assert.equal(r.daysLeft, 10);
    assert.equal(r.dailyAllowance, 100);
    // ritmo: 1800 em 21 dias -> 2571,43 no mês + 200 pendentes = 2771,43
    assert.equal(r.projected, 2771.43);
  });

  it('alerta quando o gasto projetado passa da meta', () => {
    const r = recommendation(2500, { confirmed: 2000, pending: 0 }, '2026-11', today);
    assert.equal(r.status, 'warning');
  });

  it('estourou: nada a gastar por dia', () => {
    const r = recommendation(1000, { confirmed: 900, pending: 300 }, '2026-11', today);
    assert.ok(r.status === 'exceeded');
    assert.equal(r.remaining, -200);
    assert.equal(r.dailyAllowance, 0);
  });

  it('mês futuro usa todos os dias; mês passado não tem dias restantes', () => {
    const future = recommendation(3100, { confirmed: 0, pending: 0 }, '2026-12', today);
    assert.ok(future.status !== 'no-budget' && future.daysLeft === 31 && future.dailyAllowance === 100);
    const past = recommendation(1000, { confirmed: 500, pending: 0 }, '2026-10', today);
    assert.ok(past.status !== 'no-budget' && past.daysLeft === 0 && past.dailyAllowance === 0);
  });
});
