export type Page = "home" | "movements" | "accounts" | "goals" | "help";
export type Workspace = "personal" | "business";
export type Kind = "income" | "expense";
export type MovementStatus = "pending" | "confirmed" | "cancelled";
export type Priority = "urgent" | "normal" | "low";
export type Movement = {
  id: string;
  title: string;
  /** Nome da categoria (somente leitura, vem da API). */
  category: string;
  categoryId: string;
  amount: number;
  kind: Kind;
  date: string;
  account: string;
  status: MovementStatus;
  priority: Priority;
};
export type MovementInput = Omit<Movement, "id" | "category">;
export type Category = { id: string; name: string; kind: Kind; usage: number };
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
export type Activity = { id: string; title: string; detail: string; date: string; author?: string | null };
export type Data = {
  movements: Movement[];
  accounts: Account[];
  categories: Category[];
  goals: Goal[];
  activity: Activity[];
};
export type Budget = {
  id: string;
  kind: Kind;
  categoryId: string | null;
  category: string | null;
  amount: number;
  achieved: number;
  pending: number;
  percent: number;
};
export type Recommendation =
  | { status: "no-budget"; scope: null }
  | {
      status: "ok" | "warning" | "exceeded";
      scope: "workspace" | "categories";
      limit: number;
      committed: number;
      remaining: number;
      daysLeft: number;
      dailyAllowance: number;
      projected: number;
    };
export type Summary = {
  month: string;
  performance: {
    income: number;
    expenses: number;
    result: number;
    previousResult: number;
    change: number | null;
  };
  pendingExpenses: number;
  budgets: Budget[];
  recommendation: Recommendation;
};
export type User = { name: string; email: string };
export type Store = {
  user: User;
  workspace: Workspace;
  data: Record<Workspace, Data>;
};
export type Modal = "movement" | "account" | "goal" | "deposit" | "profile" | "budget" | "categories" | null;

export const STATUS_LABEL: Record<MovementStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Urgente",
  normal: "Normal",
  low: "Baixa",
};
/** Só transações confirmadas afetam saldos e totais; pendentes são compromissos e canceladas foram estornadas. */
export const isConfirmed = (movement: Movement) => movement.status === "confirmed";
export const currentMonth = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
// Máscara de moeda: digita-se só números e o campo mostra 1.234,56 (centavos à direita).
export const maskCurrency = (raw: string, allowNegative = false) => {
  const negative = allowNegative && raw.trim().startsWith("-");
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
  if (!digits) return negative ? "-" : "";
  const padded = digits.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${integer},${padded.slice(-2)}`;
};
export const parseCurrency = (value: string) => {
  const parsed = Number(value.replaceAll(".", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
// Primeira letra de cada palavra em maiúscula ("viagem para europa" -> "Viagem para Europa").
// Conectivos ficam em minúscula e palavras com maiúsculas internas (iPhone, PIX) são preservadas.
const lowerWords = new Set(["a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "para", "com", "por", "ao", "à"]);
export const toTitleCase = (text: string) =>
  text
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, index) => {
      if (!word) return word;
      const lower = word.toLocaleLowerCase("pt-BR");
      const mixedCase = word !== lower && word !== word.toLocaleUpperCase("pt-BR");
      if (mixedCase) return word;
      if (index > 0 && lowerWords.has(lower)) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
export const isoDate = (daysAgo = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
