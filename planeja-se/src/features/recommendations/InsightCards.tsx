import { AlertTriangle, ArrowRight, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import type { Summary } from '../finance/model';
import { money } from '../finance/model';
import { Progress } from '../../components/finance';

/** RF07/HU09: quanto ainda pode gastar no mês, com alerta quando a projeção passa da meta. */
export function SpendingCard({ summary, onSetBudget }: { summary: Summary | null; onSetBudget: () => void }) {
  const r = summary?.recommendation;
  if (!r || r.status === "no-budget")
    return (
      <section className="panel spending-card is-empty">
        <span className="eyebrow">QUANTO AINDA POSSO GASTAR</span>
        <h2>Sem meta de gasto para este mês</h2>
        <p>Defina um limite (geral ou por categoria) para receber uma recomendação diária.</p>
        <button className="text-action" onClick={onSetBudget}>
          Definir meta do mês <ArrowRight size={15} />
        </button>
      </section>
    );
  const remaining = Math.max(0, r.remaining);
  return (
    <section className={`panel spending-card status-${r.status}`}>
      <span className="eyebrow">QUANTO AINDA POSSO GASTAR</span>
      <h2>
        {r.status === "exceeded" ? (
          <>Meta ultrapassada em {money(-r.remaining)}</>
        ) : (
          <>
            {money(r.dailyAllowance)} <small>por dia</small>
          </>
        )}
      </h2>
      <p>
        {r.status === "exceeded"
          ? "Evite novas saídas até o fim do mês ou revise a meta."
          : `${money(remaining)} restantes em ${r.daysLeft} ${r.daysLeft === 1 ? "dia" : "dias"}.`}
      </p>
      <Progress value={r.committed} max={r.limit} />
      <div className="spending-card-foot">
        <span>
          {money(r.committed)} de {money(r.limit)}
          {r.scope === "categories" ? " (metas por categoria)" : ""}
        </span>
        {r.status === "warning" && (
          <b className="alert" role="status">
            <AlertTriangle size={14} /> No ritmo atual, o mês fecha em {money(r.projected)}
          </b>
        )}
      </div>
    </section>
  );
}

/** RF06/HU08: percentual de ganho ou perda do mês em relação ao mês anterior. */
export function PerformanceBadge({ summary }: { summary: Summary | null }) {
  const p = summary?.performance;
  if (!p) return null;
  if (p.change === null)
    return (
      <small className="performance-badge neutral">
        <Gauge size={13} /> Sem mês anterior para comparar
      </small>
    );
  const up = p.change >= 0;
  return (
    <small className={`performance-badge ${up ? "gain" : "loss"}`} title={`Resultado do mês anterior: ${money(p.previousResult)}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? "+" : ""}
      {p.change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% vs. mês anterior
    </small>
  );
}
