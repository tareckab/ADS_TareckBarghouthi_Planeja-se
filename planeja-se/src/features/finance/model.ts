export type Page = "home" | "movements" | "accounts" | "goals" | "help";
export type Workspace = "personal" | "business";
export type Kind = "income" | "expense";
export type Movement = {
  id: string;
  title: string;
  category: string;
  amount: number;
  kind: Kind;
  date: string;
  account: string;
};
export type Account = {
  id: string;
  name: string;
  bank: string;
  type: string;
  opening: number;
  color: string;
};
export type Goal = {
  id: string;
  title: string;
  saved: number;
  target: number;
  color: string;
};
export type Activity = { id: string; title: string; detail: string; date: string };
export type Data = {
  movements: Movement[];
  accounts: Account[];
  goals: Goal[];
  activity: Activity[];
};
export type User = { name: string; email: string };
export type Store = {
  user: User;
  workspace: Workspace;
  data: Record<Workspace, Data>;
};
export type Modal = "movement" | "account" | "goal" | "deposit" | null;

export const STORE_KEY = "planeja-se-mvp-v1";
export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const isoDate = (daysAgo = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
};
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export function starter(business = false): Data {
  const accounts: Account[] = business
    ? [
        {
          id: "biz-main",
          name: "Conta empresarial",
          bank: "Nubank",
          type: "Conta corrente",
          opening: 18450,
          color: "lavender",
        },
        {
          id: "biz-save",
          name: "Reserva da empresa",
          bank: "C6 Bank",
          type: "Investimento",
          opening: 8200,
          color: "mint",
        },
      ]
    : [
        {
          id: "main",
          name: "Conta principal",
          bank: "Nubank",
          type: "Conta corrente",
          opening: 6320,
          color: "lavender",
        },
        {
          id: "reserve",
          name: "Reserva",
          bank: "Inter",
          type: "Poupança",
          opening: 4180,
          color: "mint",
        },
        {
          id: "card",
          name: "Cartão de crédito",
          bank: "C6 Bank",
          type: "Cartão",
          opening: -860,
          color: "peach",
        },
      ];
  const movements: Movement[] = business
    ? [
        {
          id: "b1",
          title: "Projeto Aurora",
          category: "Serviços",
          amount: 7800,
          kind: "income",
          date: isoDate(1),
          account: accounts[0].id,
        },
        {
          id: "b2",
          title: "Aluguel do escritório",
          category: "Moradia",
          amount: 2450,
          kind: "expense",
          date: isoDate(2),
          account: accounts[0].id,
        },
        {
          id: "b3",
          title: "Assinaturas de software",
          category: "Operação",
          amount: 389.9,
          kind: "expense",
          date: isoDate(3),
          account: accounts[0].id,
        },
        {
          id: "b4",
          title: "Consultoria mensal",
          category: "Serviços",
          amount: 5200,
          kind: "income",
          date: isoDate(5),
          account: accounts[0].id,
        },
      ]
    : [
        {
          id: "m1",
          title: "Salário",
          category: "Renda",
          amount: 6800,
          kind: "income",
          date: isoDate(1),
          account: accounts[0].id,
        },
        {
          id: "m2",
          title: "Mercado da semana",
          category: "Alimentação",
          amount: 284.65,
          kind: "expense",
          date: isoDate(1),
          account: accounts[0].id,
        },
        {
          id: "m3",
          title: "Academia",
          category: "Saúde",
          amount: 119.9,
          kind: "expense",
          date: isoDate(2),
          account: accounts[0].id,
        },
        {
          id: "m4",
          title: "Freelance de design",
          category: "Renda extra",
          amount: 950,
          kind: "income",
          date: isoDate(3),
          account: accounts[0].id,
        },
        {
          id: "m5",
          title: "Conta de luz",
          category: "Moradia",
          amount: 176.42,
          kind: "expense",
          date: isoDate(4),
          account: accounts[0].id,
        },
        {
          id: "m6",
          title: "Café com amigos",
          category: "Lazer",
          amount: 68,
          kind: "expense",
          date: isoDate(6),
          account: accounts[0].id,
        },
      ];
  const goals: Goal[] = business
    ? [
        {
          id: "g-b1",
          title: "Capital de giro",
          target: 30000,
          saved: 18650,
          color: "green",
        },
        {
          id: "g-b2",
          title: "Equipamentos novos",
          target: 12000,
          saved: 4200,
          color: "blue",
        },
      ]
    : [
        {
          id: "g-1",
          title: "Viagem de férias",
          target: 8000,
          saved: 5240,
          color: "green",
        },
        {
          id: "g-2",
          title: "Reserva de emergência",
          target: 15000,
          saved: 9300,
          color: "blue",
        },
        {
          id: "g-3",
          title: "Notebook novo",
          target: 6000,
          saved: 2100,
          color: "orange",
        },
      ];
  return {
    accounts,
    movements,
    goals,
    activity: movements
      .slice(0, 3)
      .map((m, i) => ({
        id: `a${i}`,
        title: `${m.kind === "income" ? "Entrada" : "Saída"} registrada: ${m.title}`,
        detail: `${money(m.amount)} · ${accounts.find((a) => a.id === m.account)?.name}`,
        date: i ? `${i + 1} dias atrás` : "Hoje",
      })),
  };
}
export function freshStore(): Store {
  return {
    user: { name: "Marina Costa", email: "marina@email.com" },
    workspace: "personal",
    data: { personal: starter(), business: starter(true) },
  };
}
export function readStore(): Store {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return JSON.parse(saved) as Store;
  } catch {
    localStorage.removeItem(STORE_KEY);
  }
  return freshStore();
}
