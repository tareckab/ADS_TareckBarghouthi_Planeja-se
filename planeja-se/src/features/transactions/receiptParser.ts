import type { Account, Kind } from '../finance/model';

/**
 * Interpreta o texto de um comprovante (Pix, transferência, boleto, nota fiscal)
 * e sugere os campos do formulário "Novo lançamento".
 * Função pura: não acessa tela nem rede, para ser testável com textos reais.
 */

export const CATEGORIES = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer',
  'Renda',
  'Renda extra',
  'Serviços',
  'Operação',
  'Transferência',
  'Outros',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type ReceiptField = 'amount' | 'date' | 'title' | 'category' | 'account' | 'kind';

export type ReceiptSuggestion = {
  amount?: number;
  date?: string; // AAAA-MM-DD
  title?: string;
  category?: Category;
  accountId?: string;
  kind?: Kind;
  /** Campos que o parser conseguiu identificar. */
  found: ReceiptField[];
};

type Line = { raw: string; norm: string };

/** Minúsculas, sem acento e com espaços simples — para comparar palavras-chave. */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const hasWord = (norm: string, words: string[]) =>
  words.some((word) => new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(norm));

function toLines(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((raw) => ({ raw, norm: normalize(raw) }));
}

// ---------------------------------------------------------------- valor

const MONEY = /(r\$\s*)?-?\s*(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})(?![\d,])/g;
const MONEY_NO_CENTS = /r\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?![\d,.])/g;
const AMOUNT_STRONG = ['valor total', 'total a pagar', 'valor pago', 'valor do pix', 'valor da transferencia', 'valor transferido', 'valor do pagamento', 'valor recebido', 'valor a pagar', 'total'];
const AMOUNT_WEAK = ['valor', 'quantia', 'montante', 'importancia'];
const AMOUNT_BAD = ['saldo', 'tarifa', 'taxa', 'juros', 'multa', 'desconto', 'limite', 'troco', 'tributos', 'impostos', 'aproximado', 'id', 'autenticacao', 'protocolo', 'nsu', 'codigo', 'cpf', 'cnpj', 'agencia', 'parcela'];

const toNumber = (value: string) => Number(value.replaceAll('.', '').replace(',', '.'));
const hasLetters = (norm: string) => /[a-z]{2,}/.test(norm.replace(/r\$/g, ''));

function labelScore(norm: string) {
  if (hasWord(norm, AMOUNT_BAD)) return -6;
  if (AMOUNT_STRONG.some((k) => norm.includes(k))) return 4;
  if (hasWord(norm, AMOUNT_WEAK)) return 3;
  return 0;
}

function findAmount(lines: Line[]) {
  let best: { value: number; score: number } | undefined;
  lines.forEach((line, index) => {
    const matches = [
      ...Array.from(line.norm.matchAll(MONEY), (m) => ({ text: m[2], currency: !!m[1] })),
      ...Array.from(line.norm.matchAll(MONEY_NO_CENTS), (m) => ({ text: m[1], currency: true })),
    ];
    for (const match of matches) {
      const value = toNumber(match.text);
      if (!(value > 0) || value > 10_000_000) continue;
      // O rótulo pode estar na mesma linha ("Valor: R$ 10,00") ou na linha acima ("Valor" / "R$ 10,00").
      const own = labelScore(line.norm);
      const above = !hasLetters(line.norm) && index > 0 ? labelScore(lines[index - 1].norm) : 0;
      const score = (own !== 0 ? own : above) + (match.currency ? 1 : 0);
      if (!best || score > best.score || (score === best.score && value > best.value)) {
        best = { value, score };
      }
    }
  });
  // Sem rótulo nem "R$" o número pode ser qualquer coisa (ID, agência...): não arrisca.
  return best && best.score > 0 ? Math.round(best.value * 100) / 100 : undefined;
}

// ---------------------------------------------------------------- data

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, abr: 4, abril: 4, mai: 5, maio: 5,
  jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9, out: 10, outubro: 10,
  nov: 11, novembro: 11, dez: 12, dezembro: 12,
};
const DATE_GOOD = ['data', 'realizad', 'efetuad', 'pago em', 'pagamento', 'emissao', 'emitid', 'transacao', 'agendad', 'recebid', 'enviad', 'transferencia'];
const DATE_BAD = ['vencimento', 'validade', 'nascimento', 'abertura', 'gerado em', 'impresso'];

function isoFrom(day: number, month: number, year: number) {
  if (year < 100) year += 2000;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  if (year < 2000 || year > 2100) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findDate(lines: Line[], today: Date) {
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 1);
  const limitIso = isoFrom(limit.getDate(), limit.getMonth() + 1, limit.getFullYear())!;
  let best: { iso: string; score: number } | undefined;
  lines.forEach((line, index) => {
    const found: string[] = [];
    for (const m of line.norm.matchAll(/(?<!\d)(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/g)) {
      const iso = isoFrom(Number(m[1]), Number(m[2]), Number(m[3]));
      if (iso) found.push(iso);
    }
    for (const m of line.norm.matchAll(/(?<!\d)(\d{1,2})(?:\s+de\s+|\s*[/.-]\s*|\s+)([a-z]{3,9})\.?(?:\s+de\s+|\s*[/.-]\s*|\s+)(\d{4})(?!\d)/g)) {
      const month = MONTHS[m[2]];
      const iso = month ? isoFrom(Number(m[1]), month, Number(m[3])) : undefined;
      if (iso) found.push(iso);
    }
    const context = `${index > 0 ? lines[index - 1].norm : ''} ${line.norm}`;
    for (const iso of found) {
      if (iso > limitIso) continue; // data futura: provavelmente vencimento/validade
      let score = 0;
      if (DATE_BAD.some((k) => line.norm.includes(k))) score -= 5;
      else if (DATE_GOOD.some((k) => context.includes(k))) score += 3;
      if (!best || score > best.score) best = { iso, score };
    }
  });
  return best && best.score > -5 ? best.iso : undefined;
}

// ---------------------------------------------------------------- tipo

const INCOME_HINTS = ['pix recebido', 'voce recebeu', 'transferencia recebida', 'ted recebida', 'doc recebido', 'deposito recebido', 'credito em conta', 'comprovante de recebimento', 'recebimento de pix', 'dinheiro recebido'];
const EXPENSE_HINTS = ['pix enviado', 'voce enviou', 'voce pagou', 'transferencia enviada', 'transferencia realizada', 'ted enviada', 'pagamento efetuado', 'pagamento realizado', 'comprovante de pagamento', 'pagamento de boleto', 'nota fiscal', 'cupom fiscal', 'nfc-e', 'nfce', 'documento auxiliar', 'compra aprovada', 'compra no debito', 'compra no credito'];

function findKind(norm: string): Kind | undefined {
  const income = INCOME_HINTS.some((k) => norm.includes(k));
  const expense = EXPENSE_HINTS.some((k) => norm.includes(k));
  if (income === expense) return undefined;
  return income ? 'income' : 'expense';
}

// ---------------------------------------------------------------- bancos e conta

const BANKS: { key: string; patterns: string[] }[] = [
  { key: 'nubank', patterns: ['nubank', 'nu pagamentos', 'nu financeira'] },
  { key: 'inter', patterns: ['banco inter', 'inter&co', 'bco inter'] },
  { key: 'itau', patterns: ['itau', 'unibanco'] },
  { key: 'bradesco', patterns: ['bradesco'] },
  { key: 'santander', patterns: ['santander'] },
  // "Caixa" sozinho aparece em cupom fiscal ("Caixa: 03"), por isso exige o nome completo.
  { key: 'caixa', patterns: ['caixa economica', 'cef', 'caixa tem'] },
  { key: 'banco do brasil', patterns: ['banco do brasil', 'bco do brasil'] },
  { key: 'c6', patterns: ['c6 bank', 'banco c6', 'c6'] },
  { key: 'picpay', patterns: ['picpay'] },
  { key: 'mercado pago', patterns: ['mercado pago', 'mercadopago'] },
  { key: 'pagbank', patterns: ['pagbank', 'pagseguro'] },
  { key: 'sicredi', patterns: ['sicredi'] },
  { key: 'sicoob', patterns: ['sicoob'] },
  { key: 'btg', patterns: ['btg'] },
  { key: 'neon', patterns: ['neon'] },
  { key: 'original', patterns: ['banco original'] },
  { key: 'banrisul', patterns: ['banrisul'] },
  { key: 'xp', patterns: ['xp investimentos', 'banco xp'] },
];

function banksIn(norm: string) {
  return BANKS.filter((bank) => hasWord(norm, bank.patterns)).map((bank) => bank.key);
}

const ORIGIN_LABELS = ['origem', 'de', 'pagador', 'remetente', 'dados do pagador', 'conta de origem', 'quem pagou', 'debitado de'];
const DESTINATION_LABELS = ['destino', 'para', 'recebedor', 'favorecido', 'destinatario', 'beneficiario', 'dados do recebedor', 'conta de destino', 'quem recebeu'];

function sectionOf(norm: string): 'origin' | 'destination' | undefined {
  const head = norm.replace(/[:\-–]+$/, '').trim();
  if (ORIGIN_LABELS.some((label) => head === label || head.startsWith(`${label}:`))) return 'origin';
  if (DESTINATION_LABELS.some((label) => head === label || head.startsWith(`${label}:`) || (label.length > 4 && head.startsWith(`${label} `)))) return 'destination';
  return undefined;
}

function findAccount(lines: Line[], kind: Kind | undefined, accounts: Account[]) {
  // No cadastro da conta basta o nome curto do banco ("Inter", "Caixa").
  const accountBanks = accounts.map((account) => {
    const norm = normalize(`${account.bank} ${account.name}`);
    return { account, banks: BANKS.filter((bank) => hasWord(norm, [bank.key, ...bank.patterns])).map((bank) => bank.key) };
  });
  const mentions = { header: [] as string[], origin: [] as string[], destination: [] as string[] };
  let section: keyof typeof mentions = 'header';
  for (const line of lines) {
    section = sectionOf(line.norm) ?? section;
    mentions[section].push(...banksIn(line.norm));
  }
  // Na saída o banco do usuário é a origem; na entrada, o destino. O cabeçalho costuma ser o banco emissor.
  const order: (keyof typeof mentions)[] =
    kind === 'income' ? ['destination', 'header'] : kind === 'expense' ? ['origin', 'header'] : ['header'];
  for (const key of order) {
    for (const bank of mentions[key]) {
      const match = accountBanks.find((item) => item.banks.includes(bank));
      if (match) return match.account.id;
    }
  }
  // Último recurso: um único banco cadastrado aparece no comprovante.
  const all = new Set([...mentions.header, ...mentions.origin, ...mentions.destination]);
  const candidates = accountBanks.filter((item) => item.banks.some((bank) => all.has(bank)));
  const distinct = new Set(candidates.flatMap((item) => item.banks.filter((bank) => all.has(bank))));
  return distinct.size === 1 ? candidates[0].account.id : undefined;
}

// ---------------------------------------------------------------- descrição

const NAME_LABELS_EXPENSE = ['para', 'destinatario', 'favorecido', 'recebedor', 'nome do recebedor', 'beneficiario', 'nome do favorecido', 'estabelecimento', 'loja', 'cedente', 'empresa', 'destino'];
const NAME_LABELS_INCOME = ['de', 'pagador', 'remetente', 'nome do pagador', 'quem pagou', 'origem'];
const GENERIC = ['comprovante', 'recibo', 'nota fiscal', 'cupom', 'documento auxiliar', 'nfc-e', 'danfe', 'transferencia', 'pagamento', 'pix', 'ted', 'doc', 'valor', 'data', 'hora', 'cpf', 'cnpj', 'agencia', 'conta', 'instituicao', 'chave', 'tipo', 'id', 'autenticacao', 'situacao', 'status', 'concluid', 'aprovad', 'efetuad', 'realizad', 'via', 'consumidor', 'extrato', 'ouvidoria', 'sac', 'banco', 'endereco', 'rua', 'avenida', 'av.', 'cep', 'tel', 'fone', 'ie:', 'im:', 'nome', 'descricao', 'mensagem', 'origem', 'destino'];

function cleanName(raw: string) {
  return raw
    .replace(/^nome( completo)?\s*[:-]?\s*/i, '')
    .replace(/\s*[-–]?\s*(cpf|cnpj)\b.*$/i, '')
    .replace(/\b(ltda|eireli|s\/?a|s\.a\.|me|epp)\.?$/i, '')
    .replace(/[*•]+/g, '')
    .replace(/[\s,.:\-–]+$/, '')
    .trim();
}

function looksLikeName(value: string) {
  const norm = normalize(value);
  if (value.length < 2 || value.length > 60) return false;
  if (!/[a-z]{2,}/.test(norm)) return false;
  if ((value.match(/\d/g)?.length ?? 0) > value.length / 3) return false;
  if (banksIn(norm).length && norm.split(' ').length <= 3) return false;
  const first = norm.split(/[\s:]/)[0];
  return !GENERIC.some((word) => first === word || norm === word);
}

function nameAfterLabel(lines: Line[], labels: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const { raw, norm } = lines[i];
    for (const label of labels) {
      const short = label.length <= 4;
      const sameLine = new RegExp(`^${label}${short ? '\\s*[:\\-–]' : '\\s*[:\\-–]?'}\\s*(.+)$`).exec(norm);
      const alone = norm.replace(/[:\-–]+$/, '').trim() === label;
      if (sameLine && !alone) {
        const value = cleanName(raw.slice(raw.length - sameLine[1].length));
        if (looksLikeName(value)) return value;
      }
      if (alone) {
        for (const next of lines.slice(i + 1, i + 4)) {
          const value = cleanName(next.raw);
          if (looksLikeName(value)) return value;
        }
      }
    }
  }
  return undefined;
}

function findTitle(lines: Line[], kind: Kind | undefined) {
  const labels = kind === 'income' ? [NAME_LABELS_INCOME, NAME_LABELS_EXPENSE] : [NAME_LABELS_EXPENSE, NAME_LABELS_INCOME];
  for (const group of labels) {
    const name = nameAfterLabel(lines, group);
    if (name) return name;
  }
  // Nota fiscal: a razão social costuma ser a primeira linha "de verdade".
  for (const line of lines.slice(0, 6)) {
    const value = cleanName(line.raw);
    if (looksLikeName(value)) return value;
  }
  return undefined;
}

// ---------------------------------------------------------------- categoria

const CATEGORY_RULES: { category: Category; words: string[] }[] = [
  { category: 'Renda', words: ['salario', 'folha de pagamento', 'pro-labore', 'pro labore', 'adiantamento salarial'] },
  { category: 'Transporte', words: ['posto', 'combustivel', 'combustiveis', 'gasolina', 'etanol', 'diesel', 'uber', '99app', '99 pop', 'estacionamento', 'pedagio', 'onibus', 'metro', 'shell', 'ipiranga', 'petrobras', 'auto posto'] },
  { category: 'Saúde', words: ['farmacia', 'drogaria', 'drogasil', 'droga raia', 'pague menos', 'hospital', 'clinica', 'laboratorio', 'odonto', 'odontologia', 'medico', 'academia', 'smart fit', 'unimed'] },
  { category: 'Alimentação', words: ['mercado', 'supermercado', 'supermercados', 'atacadao', 'atacadista', 'hipermercado', 'padaria', 'panificadora', 'acougue', 'hortifruti', 'restaurante', 'lanchonete', 'pizzaria', 'ifood', 'hamburgueria', 'cafeteria', 'sorveteria', 'alimentos', 'confeitaria'] },
  { category: 'Moradia', words: ['aluguel', 'condominio', 'energia eletrica', 'conta de luz', 'copel', 'cemig', 'enel', 'celesc', 'cpfl', 'rge', 'equatorial', 'sanepar', 'sabesp', 'corsan', 'copasa', 'saneamento', 'iptu', 'imobiliaria'] },
  { category: 'Serviços', words: ['internet', 'telefonia', 'vivo', 'claro', 'tim', 'fibra', 'consultoria', 'assinatura'] },
  { category: 'Lazer', words: ['cinema', 'cinemark', 'ingresso', 'ingressos', 'netflix', 'spotify', 'teatro', 'cervejaria', 'steam', 'playstation', 'disney', 'parque'] },
];

// Nomes de banco não podem virar categoria ("Mercado Pago" não é Alimentação).
const BANK_NAMES = new RegExp(BANKS.flatMap((bank) => bank.patterns).map((p) => p.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')).join('|'), 'g');

function findCategory(lines: Line[], title: string | undefined, kind: Kind | undefined): Category | undefined {
  const body = lines
    .map((line) => line.norm.replace(BANK_NAMES, ' '))
    .filter((norm) => !/(ouvidoria|sac|atendimento|central de|duvidas)/.test(norm))
    .join(' \n ');
  // O nome do recebedor pesa mais que o resto do texto.
  for (const source of [title ? normalize(title) : '', body]) {
    if (!source) continue;
    const rule = CATEGORY_RULES.find((item) => hasWord(source, item.words));
    if (rule && (rule.category !== 'Renda' || kind !== 'expense')) return rule.category;
  }
  if (hasWord(body, ['pix', 'ted', 'doc', 'transferencia'])) return 'Transferência';
  return undefined;
}

// ---------------------------------------------------------------- principal

export function parseReceipt(text: string, accounts: Account[], today = new Date()): ReceiptSuggestion {
  const lines = toLines(text);
  const all = normalize(text);
  const kind = findKind(all);
  const amount = findAmount(lines);
  const date = findDate(lines, today);
  const title = findTitle(lines, kind ?? 'expense');
  const category = findCategory(lines, title, kind);
  // Sem pista do tipo, o formulário já começa como saída: interpreta o comprovante como saída.
  const accountId = findAccount(lines, kind ?? 'expense', accounts);

  const suggestion: ReceiptSuggestion = { amount, date, title, category, accountId, kind, found: [] };
  (['amount', 'date', 'title', 'category', 'account', 'kind'] as const).forEach((field) => {
    const value = field === 'account' ? accountId : suggestion[field];
    if (value !== undefined) suggestion.found.push(field);
  });
  return suggestion;
}
