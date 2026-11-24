import { describe, expect, it } from 'vitest';
import type { Account } from '../finance/model';
import { parseReceipt } from './receiptParser';

const accounts: Account[] = [
  { id: 'nu', name: 'Conta principal', bank: 'Nubank', type: 'Conta corrente', opening: 0, color: 'lavender' },
  { id: 'inter', name: 'Reserva', bank: 'Inter', type: 'Poupança', opening: 0, color: 'mint' },
  { id: 'itau', name: 'Salário', bank: 'Itaú', type: 'Conta corrente', opening: 0, color: 'peach' },
];
const today = new Date(2026, 10, 23); // 23/11/2026

describe('parseReceipt', () => {
  it('comprovante Pix do Nubank (rótulos em linhas separadas)', () => {
    const text = `Comprovante de transferência
23 NOV 2026 - 14:32:10
Valor
R$ 150,00
Tipo de transferência
Pix
Destino
Nome
Mercado Bom Preço
CPF/CNPJ
12.345.678/0001-90
Instituição
BANCO INTER S.A.
Origem
Nome
Fulano de Tal
Instituição
NU PAGAMENTOS - IP
Agência
0001
ID da transação: E18236120202611231732s0123456789`;
    const r = parseReceipt(text, accounts, today);
    expect(r.amount).toBe(150);
    expect(r.date).toBe('2026-11-23');
    expect(r.title).toBe('Mercado Bom Preço');
    expect(r.category).toBe('Alimentação');
    expect(r.accountId).toBe('nu'); // origem = Nubank, não o banco do destino
  });

  it('Pix recebido no Itaú: entrada, pagador como descrição e conta de destino', () => {
    const text = `Itaú
Pix recebido
Você recebeu R$ 1.250,90
em 20/11/2026 às 09:15
De: Empresa Exemplo Serviços LTDA
CNPJ: 11.222.333/0001-44
Instituição: Banco do Brasil
Para: Fulano de Tal
Instituição: Itaú Unibanco
Saldo disponível R$ 3.400,00`;
    const r = parseReceipt(text, accounts, today);
    expect(r.kind).toBe('income');
    expect(r.amount).toBe(1250.9); // ignora o saldo
    expect(r.date).toBe('2026-11-20');
    expect(r.title).toBe('Empresa Exemplo Serviços');
    expect(r.accountId).toBe('itau');
  });

  it('cupom fiscal (NFC-e): total, razão social e categoria', () => {
    const text = `SUPERMERCADO BOA COMPRA LTDA
CNPJ: 01.234.567/0001-89
Av. Brasil, 1500 - Passo Fundo/RS
DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA
ARROZ 5KG 1 UN X 27,90 27,90
FEIJAO 1KG 2 UN X 8,49 16,98
QTD. TOTAL DE ITENS 3
VALOR TOTAL R$ 44,88
Desconto R$ 2,00
VALOR A PAGAR R$ 42,88
Cartão de Débito 42,88
Valor aproximado dos tributos R$ 6,10
Emissão: 18/11/2026 19:02:33
Caixa: 03`;
    const r = parseReceipt(text, accounts, today);
    expect(r.kind).toBe('expense');
    expect([44.88, 42.88]).toContain(r.amount);
    expect(r.amount).not.toBe(6.1);
    expect(r.date).toBe('2026-11-18');
    expect(r.title).toBe('SUPERMERCADO BOA COMPRA');
    expect(r.category).toBe('Alimentação');
    expect(r.accountId).toBeUndefined(); // cupom não informa o banco
  });

  it('boleto de energia: ignora vencimento futuro e usa data do pagamento', () => {
    const text = `Banco Inter
Comprovante de pagamento de boleto
Beneficiário: COPEL DISTRIBUICAO S.A.
Vencimento: 10/12/2026
Data do pagamento: 21/11/2026
Valor do documento: R$ 187,45
Valor pago: R$ 187,45
Autenticação: 1A2B.3C4D.5E6F`;
    const r = parseReceipt(text, accounts, today);
    expect(r.kind).toBe('expense');
    expect(r.amount).toBe(187.45);
    expect(r.date).toBe('2026-11-21');
    expect(r.title).toBe('COPEL DISTRIBUICAO');
    expect(r.category).toBe('Moradia');
    expect(r.accountId).toBe('inter');
  });

  it('data por extenso e valor sem centavos', () => {
    const text = `Transferência realizada
Valor: R$ 80
Para: Posto Ipiranga Centro
Realizada em 5 de novembro de 2026`;
    const r = parseReceipt(text, accounts, today);
    expect(r.amount).toBe(80);
    expect(r.date).toBe('2026-11-05');
    expect(r.title).toBe('Posto Ipiranga Centro');
    expect(r.category).toBe('Transporte');
  });

  it('Mercado Pago não vira categoria Alimentação', () => {
    const text = `Mercado Pago
Pix enviado
R$ 35,00
Para: João da Silva
22/11/2026`;
    const r = parseReceipt(text, accounts, today);
    expect(r.category).toBe('Transferência');
    expect(r.title).toBe('João da Silva');
  });

  it('não inventa campos em texto sem informação útil', () => {
    const r = parseReceipt('lorem ipsum 12345\nfoto borrada', accounts, today);
    expect(r.amount).toBeUndefined();
    expect(r.date).toBeUndefined();
    expect(r.accountId).toBeUndefined();
    expect(r.kind).toBeUndefined();
    expect(r.found).not.toContain('amount');
  });

  it('texto de OCR com acentos perdidos e espaços extras', () => {
    const text = `COMPROVANTE   PIX
pix enviado
Valor   R$ 59,90
Data 22/11/26
Favorecido   Drogaria Sao Joao`;
    const r = parseReceipt(text, accounts, today);
    expect(r.amount).toBe(59.9);
    expect(r.date).toBe('2026-11-22');
    expect(r.title).toBe('Drogaria Sao Joao');
    expect(r.category).toBe('Saúde');
  });
});
