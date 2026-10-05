import { ArrowRight, BadgeHelp, CircleHelp, Goal, HandCoins, Sparkles, TrendingDown } from 'lucide-react';
import type { Goal as GoalData, Page, Workspace } from '../finance/model';
import { Heading } from '../../components/finance';
import { money } from '../finance/model';

export function RecommendationsPage({
  income,
  expenses,
  balance,
  goals,
  workspace,
  onPage,
}: {
  income: number;
  expenses: number;
  balance: number;
  goals: GoalData[];
  workspace: Workspace;
  onPage: (p: Page) => void;
}) {
  const rate = income
    ? Math.max(0, Math.round(((income - expenses) / income) * 100))
    : 0;
  const ideas = [
    {
      icon: <HandCoins size={19} />,
      label: "Seu próximo passo",
      title:
        rate >= 20
          ? "Seu ritmo de economia está consistente."
          : "Que tal separar um pouquinho assim que receber?",
      body:
        rate >= 20
          ? "Manter essa constância pode levar suas metas mais longe."
          : "Começar com 5% da renda já ajuda a criar o hábito.",
      tone: "mint",
    },
    {
      icon: <TrendingDown size={19} />,
      label: "Olhar atento",
      title:
        expenses > income * 0.7 && income
          ? "As saídas ocupam boa parte das entradas."
          : "Você está mantendo as saídas em equilíbrio.",
      body: "Revise despesas recorrentes e veja se alguma pode esperar. Pequenos ajustes também contam.",
      tone: "lavender",
    },
    {
      icon: <Goal size={19} />,
      label: "Metas no radar",
      title: goals.length
        ? `Você já começou ${goals.length} ${goals.length === 1 ? "plano" : "planos"}.`
        : "Dê nome ao que você quer conquistar.",
      body: "Volte às suas metas de vez em quando e conecte as escolhas do dia a dia ao que importa.",
      tone: "peach",
    },
  ];
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="IDEIAS QUE CABEM NA SUA VIDA"
        title="Clareza também é cuidado."
        description="Recomendações simples, calculadas a partir do seu mês atual."
      />
      <section className="insight-hero">
        <Sparkles size={22} />
        <span className="eyebrow">
          UM RETRATO DE {workspace === "business" ? "SEU NEGÓCIO" : "SEU MÊS"}
        </span>
        <h2>{rate}% das entradas ficam com você.</h2>
        <p>
          Com saldo de {money(balance)} e {money(expenses)} em saídas, você tem
          espaço para escolher o próximo passo.
        </p>
        <div>
          <span>
            <small>ENTRADAS</small>
            <b>{money(income)}</b>
          </span>
          <span>
            <small>SAÍDAS</small>
            <b>{money(expenses)}</b>
          </span>
          <span>
            <small>METAS ATIVAS</small>
            <b>{goals.length}</b>
          </span>
        </div>
      </section>
      <div className="ideas-heading">
        <div>
          <span className="eyebrow">IDEIAS PARA VOCÊ</span>
          <h2>Um olhar mais de perto</h2>
        </div>
        <small>
          <CircleHelp size={14} /> Informativo, não é aconselhamento financeiro
        </small>
      </div>
      <div className="ideas-list">
        {ideas.map((idea) => (
          <article className="idea-card" key={idea.label}>
            <span className={`idea-icon ${idea.tone}`}>{idea.icon}</span>
            <div>
              <small>{idea.label}</small>
              <h3>{idea.title}</h3>
              <p>{idea.body}</p>
              <b>{idea.label.toUpperCase()}</b>
            </div>
            <ArrowRight size={17} />
          </article>
        ))}
      </div>
      <section className="help-strip">
        <BadgeHelp size={20} />
        <span>
          <b>Organizar as finanças é um processo.</b>
          <small>Reveja seus objetivos sempre que precisar.</small>
        </span>
        <button onClick={() => onPage("goals")}>
          Ver minhas metas <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
}
