/**
 * Regras de negócio de desempenho (RF06/HU08) e recomendação de gastos (RF07/HU09).
 * Funções puras: recebem os totais já somados do banco e devolvem os indicadores,
 * o que permite recalculá-los a cada requisição (RNF10) e testá-los isoladamente.
 *
 * Convenções (alinhadas ao DVP):
 * - Receitas, despesas, saldo e progresso de metas usam apenas transações CONFIRMADAS.
 * - A recomendação de gasto considera despesas confirmadas + PENDENTES, porque uma
 *   despesa pendente já é um compromisso do mês.
 * - Transações CANCELADAS (estornadas) não entram em nenhum cálculo.
 */

const round = (value: number) => Math.round(value * 100) / 100;

export type Performance = {
  income: number;
  expenses: number;
  result: number;
  previousResult: number;
  /** Variação % do resultado em relação ao mês anterior; null quando não há base de comparação. */
  change: number | null;
};

export function performance(
  current: { income: number; expenses: number },
  previous: { income: number; expenses: number },
): Performance {
  const result = round(current.income - current.expenses);
  const previousResult = round(previous.income - previous.expenses);
  const change = previousResult === 0
    ? null
    : Math.round(((result - previousResult) / Math.abs(previousResult)) * 1000) / 10;
  return { income: round(current.income), expenses: round(current.expenses), result, previousResult, change };
}

export type Recommendation =
  | { status: 'no-budget' }
  | {
      status: 'ok' | 'warning' | 'exceeded';
      limit: number;
      /** Despesas confirmadas + pendentes do mês. */
      committed: number;
      remaining: number;
      daysLeft: number;
      /** Quanto ainda pode gastar por dia até o fim do mês. */
      dailyAllowance: number;
      /** Gasto projetado para o mês inteiro mantendo o ritmo atual. */
      projected: number;
    };

/**
 * @param limit meta de gasto do mês (do workspace ou soma das metas por categoria); null se não houver.
 * @param month 'AAAA-MM' de referência.
 */
export function recommendation(
  limit: number | null,
  spent: { confirmed: number; pending: number },
  month: string,
  today = new Date(),
): Recommendation {
  if (!limit || limit <= 0) return { status: 'no-budget' };
  const [year, monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const todayKey = today.getFullYear() * 12 + today.getMonth();
  const monthKey = year * 12 + (monthNumber - 1);

  // Dias já decorridos e restantes (contando hoje) conforme o mês esteja no passado, presente ou futuro.
  const elapsed = monthKey < todayKey ? daysInMonth : monthKey > todayKey ? 0 : today.getDate();
  const daysLeft = monthKey < todayKey ? 0 : monthKey > todayKey ? daysInMonth : daysInMonth - today.getDate() + 1;

  const committed = round(spent.confirmed + spent.pending);
  const remaining = round(limit - committed);
  const dailyAllowance = daysLeft > 0 ? round(Math.max(0, remaining) / daysLeft) : 0;
  const projected = round(
    elapsed > 0 && daysLeft > 0 ? (spent.confirmed / elapsed) * daysInMonth + spent.pending : committed,
  );
  const status = committed > limit ? 'exceeded' : projected > limit ? 'warning' : 'ok';
  return { status, limit: round(limit), committed, remaining, daysLeft, dailyAllowance, projected };
}
