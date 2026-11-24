import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Bell, Check, Gauge, Goal, Landmark, LogOut, Menu, Clock, Sparkles, X } from 'lucide-react';
import type { Account, Data, Kind, Modal, Movement, MovementInput, MovementStatus, Page, Store, Summary, User, Workspace } from '../features/finance/model';
import { currentMonth, isConfirmed } from '../features/finance/model';
import { ApiError, financeApi, type ApiData, type BudgetInput, type Credentials, type WorkspaceInfo } from '../features/finance/api';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { TransactionsPage, MovementFormModal } from '../features/transactions/TransactionsPage';
import { AccountsPage, AccountFormModal } from '../features/accounts/AccountsPage';
import { GoalsPage, GoalFormModal, GoalDepositModal, BudgetFormModal } from '../features/goals/GoalsPage';
import { CategoriesModal } from '../features/transactions/CategoriesModal';
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { AuthPage } from '../features/auth/AuthPage';
import { BrandMark } from '../components/BrandMark';
import { ProfileModal, UserAvatar } from '../features/profile/ProfileModal';
import { clearProfiles, useProfile } from '../features/profile/profile';
import '../styles/app.css';

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);
  const date = now.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '');
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return <time dateTime={now.toISOString()}>{date} · {time}</time>;
}

const nav: { id: Page; label: string; icon: typeof Gauge }[] = [
  { id: 'home', label: 'Vis\u00e3o geral', icon: Gauge },
  { id: 'movements', label: 'Movimenta\u00e7\u00f5es', icon: ArrowLeftRight },
  { id: 'accounts', label: 'Contas', icon: Landmark },
  { id: 'goals', label: 'Metas e objetivos', icon: Goal },
  { id: 'help', label: 'Ajuda e recomenda\u00e7\u00f5es', icon: Sparkles },
];

function emptyData(): Data {
  return { accounts: [], movements: [], categories: [], goals: [], activity: [] };
}

async function loadStore(
  user: User,
  workspaces: WorkspaceInfo[],
): Promise<{ store: Store; workspaceIds: Partial<Record<Workspace, string>>; summary: Summary }> {
  const workspaceIds = Object.fromEntries(
    workspaces.map(({ id, kind }) => [kind, id]),
  ) as Partial<Record<Workspace, string>>;
  const selectedWorkspace = workspaces.find(({ kind }) => kind === 'personal')
    ?? workspaces.find(({ kind }) => kind === 'business');
  if (!selectedWorkspace) {
    throw new Error('A conta não possui um espaço de trabalho configurado.');
  }

  const [selectedData, summary] = await Promise.all([
    financeApi.data(selectedWorkspace.id),
    financeApi.summary(selectedWorkspace.id, currentMonth()),
  ]);
  const workspace = selectedWorkspace.kind;
  return {
    workspaceIds,
    summary,
    store: {
      user,
      workspace,
      data: {
        personal: workspace === 'personal' ? selectedData : emptyData(),
        business: workspace === 'business' ? selectedData : emptyData(),
      },
    },
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

export default function FinanceApp() {
  const [store, setStore] = useState<Store>({
    user: { name: '', email: '' },
    workspace: 'personal',
    data: { personal: emptyData(), business: emptyData() },
  });
  const [workspaceIds, setWorkspaceIds] = useState<Partial<Record<Workspace, string>>>({});
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState<Page>("home");
  const [modal, setModal] = useState<Modal>(null);
  const [depositGoal, setDepositGoal] = useState("");
  const [editing, setEditing] = useState<Movement | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | MovementStatus>("all");
  const [signedIn, setSignedIn] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [toastIsError, setToastIsError] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [accountFilter, setAccountFilter] = useState("all");

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      if (!financeApi.getSession()) {
        setBooting(false);
        return;
      }
      try {
        const [user, workspaces] = await Promise.all([
          financeApi.me(),
          financeApi.workspaces(),
        ]);
        const session = await loadStore(user, workspaces);
        if (active) {
          setStore(session.store);
          setWorkspaceIds(session.workspaceIds);
          setSummary(session.summary);
          setSignedIn(true);
          setAuthError('');
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) financeApi.clearSession();
        if (active) setAuthError(errorMessage(error));
      } finally {
        if (active) setBooting(false);
      }
    };
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const { profile, save: saveProfile } = useProfile(store.user.email);
  const displayName = profile.nickname || store.user.name.split(' ')[0] || store.user.name;
  const data = store.data[store.workspace];
  const now = new Date();
  const currentYear = now.getFullYear();
  const monthNumber = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = `${currentYear}-${monthNumber}-01`;
  const monthEnd = `${currentYear}-${monthNumber}-${String(
    new Date(currentYear, now.getMonth() + 1, 0).getDate(),
  ).padStart(2, '0')}`;
  // Totais e saldos consideram apenas transações confirmadas (pendentes e canceladas ficam de fora).
  const confirmed = data.movements.filter(isConfirmed);
  const monthly = confirmed.filter(
    (movement) => movement.date >= monthStart && movement.date <= monthEnd,
  );
  const income = monthly
    .filter((m) => m.kind === "income")
    .reduce((s, m) => s + m.amount, 0);
  const expenses = monthly
    .filter((m) => m.kind === "expense")
    .reduce((s, m) => s + m.amount, 0);
  const accountBalance = (account: Account) =>
    account.opening +
    confirmed
      .filter((m) => m.account === account.id)
      .reduce((s, m) => s + (m.kind === "income" ? m.amount : -m.amount), 0);
  const balance = data.accounts.reduce((s, a) => s + accountBalance(a), 0);
  const notice = (message: string, isError = false) => {
    setToast(message);
    setToastIsError(isError);
    window.setTimeout(() => setToast(""), 3600);
  };
  const authenticate = async (credentials: Credentials) => {
    setAuthLoading(true);
    setAuthError('');
    let authenticated = false;
    try {
      const session = await financeApi.authenticate(credentials);
      financeApi.setSession(session.session);
      authenticated = true;
      const loaded = await loadStore(
        session.user,
        session.workspaces,
      );
      setStore(loaded.store);
      setWorkspaceIds(loaded.workspaceIds);
      setSummary(loaded.summary);
      setSignedIn(true);
      notice(credentials.mode === 'register' ? 'Conta criada com sucesso.' : `Bem-vindo(a), ${session.user.name.split(' ')[0]}.`);
    } catch (error) {
      if (!authenticated) financeApi.clearSession();
      setAuthError(errorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await financeApi.logout();
    } catch (error) {
      notice(errorMessage(error), true);
    } finally {
      financeApi.clearSession();
      clearProfiles();
      setModal(null);
      setSignedIn(false);
      setAuthError('');
    }
  };

  const reloadWorkspace = async (workspace: Workspace) => {
    const workspaceId = workspaceIds[workspace];
    if (!workspaceId) throw new Error('Espaço de trabalho não encontrado.');
    // Indicadores recalculados a cada alteração (RNF10).
    const [latestData, latestSummary]: [ApiData, Summary] = await Promise.all([
      financeApi.data(workspaceId),
      financeApi.summary(workspaceId, currentMonth()),
    ]);
    setStore((current) => ({
      ...current,
      data: { ...current.data, [workspace]: latestData },
    }));
    setSummary(latestSummary);
  };

  const runMutation = async (action: () => Promise<unknown>, successMessage: string, close = true) => {
    try {
      await action();
      await reloadWorkspace(store.workspace);
      if (close) {
        setModal(null);
        setEditing(null);
      }
      notice(successMessage);
      return true;
    } catch (error) {
      notice(errorMessage(error), true);
      return false;
    }
  };

  const workspaceId = () => workspaceIds[store.workspace]!;
  const saveMovement = (movement: MovementInput) =>
    editing
      ? runMutation(
          () => financeApi.updateMovement(workspaceId(), editing.id, movement),
          'Lançamento atualizado.',
        )
      : runMutation(
          () => financeApi.createMovement(workspaceId(), movement),
          movement.status === 'pending' ? 'Lançamento salvo como pendente.' : 'Movimentação registrada.',
        );
  const changeStatus = (movement: Movement, status: MovementStatus) =>
    runMutation(
      () => financeApi.updateMovement(workspaceId(), movement.id, { status }),
      status === 'cancelled'
        ? 'Lançamento cancelado. Ele não entra mais nos saldos.'
        : movement.kind === 'income' ? 'Recebimento confirmado.' : 'Pagamento confirmado.',
    );
  const openNewMovement = () => {
    setEditing(null);
    setModal("movement");
  };
  const openMovement = (movement: Movement) => {
    setEditing(movement);
    setModal("movement");
  };

  const handleSignOut = () => void signOut();
  const filtered = data.movements.filter(
    (m) =>
      (kindFilter === "all" || m.kind === kindFilter) &&
      (accountFilter === "all" || m.account === accountFilter) &&
      (statusFilter === "all" || m.status === statusFilter) &&
      `${m.title} ${m.category}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (booting)
    return (
      <main className="auth-screen" aria-live="polite">
        <p className="auth-disclaimer">Conectando ao Planeja-se...</p>
      </main>
    );

  if (!signedIn)
    return (
      <AuthPage
        onSubmit={authenticate}
        submitting={authLoading}
        error={authError}
      />
    );

  return (
    <div className="app-frame flex min-h-screen bg-app-bg">
          <aside className={`side-nav fixed inset-y-0 left-0 z-20 flex min-h-screen w-[258px] shrink-0 flex-col border-r border-app-border bg-white px-[17px] pb-[15px] pt-[26px] transition-transform ${mobileNav ? "translate-x-0" : "-translate-x-full"} min-[761px]:relative min-[761px]:translate-x-0`}>
        <button
          className="wordmark"
          onClick={() => setPage("home")}
          aria-label="Planeja-se, início"
        >
          <BrandMark />
          <span>
            planeja<span>-</span>se
          </span>
        </button>
        <span className="nav-overline">MENU</span>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "is-active" : ""}`}
              onClick={() => {
                setPage(id);
                setMobileNav(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === "help" && <i className="nav-count">3</i>}
            </button>
          ))}
        </nav>
        <div className="side-footer">
          <div className="sidebar-callout">
            <Sparkles size={16} />
            <strong>
              Pequenos passos,
              <br />
              grandes planos.
            </strong>
            <span>Seu futuro financeiro começa hoje.</span>
            <button onClick={() => setPage("help")}>
              Ver meu plano <ArrowRight size={14} />
            </button>
          </div>
          <div className="side-profile">
            <UserAvatar name={displayName} photo={profile.photo} />
            <span>
              <b>{displayName}</b>
              
            </span>
            <button
              className="icon-btn"
              title="Sair"
              aria-label="Sair"
              onClick={handleSignOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-scrim fixed inset-0 z-[19] hidden bg-[#17261d70] max-[760px]:block min-[761px]:hidden"
          onClick={() => setMobileNav(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="main-area min-w-0 flex-1">
        <header className="topbar flex h-[65px] items-center justify-between border-b border-[#e8ece6] bg-white px-[38px] max-[760px]:h-[58px] max-[760px]:px-4">
          <button
            className="icon-btn hidden min-[761px]:hidden max-[760px]:grid"
            aria-label="Abrir menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Planeja-se</span>
            <i>/</i>
            <b>{nav.find((item) => item.id === page)?.label}</b>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <Clock size={15} /> <LiveClock />
            </span>
            <button
              className="icon-btn notification-btn"
              aria-label="Notificações"
              title="Notificações"
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className="user-avatar top-avatar"
              aria-label="Abrir perfil"
              title="Seu perfil"
              onClick={() => setModal("profile")}
            >
              {profile.photo ? <img src={profile.photo} alt="" /> : displayName[0]?.toUpperCase()}
            </button>
          </div>
        </header>
        <div className="content-wrap w-full  px-[38px] pb-[45px] pt-[35px] max-[1100px]:px-[25px] max-[760px]:px-4 max-[760px]:pb-[30px] max-[760px]:pt-6 max-[480px]:px-3 max-[480px]:pb-[25px] max-[480px]:pt-[21px]">
          {page === "home" && (
            <DashboardPage
              name={displayName}
              workspace={store.workspace}
              balance={balance}
              income={income}
              expenses={expenses}
              movements={data.movements}
              accounts={data.accounts}
              accountBalance={accountBalance}
              goals={data.goals}
              summary={summary}
              onAdd={openNewMovement}
              onPage={setPage}
            />
          )}
          {page === "movements" && (
            <TransactionsPage
              movements={filtered}
              accounts={data.accounts}
              search={search}
              setSearch={setSearch}
              kind={kindFilter}
              setKind={setKindFilter}
              account={accountFilter}
              setAccount={setAccountFilter}
              status={statusFilter}
              setStatus={setStatusFilter}
              activity={data.activity}
              onAdd={openNewMovement}
              onOpen={openMovement}
              onCategories={() => setModal("categories")}
            />
          )}
          {page === "accounts" && (
            <AccountsPage
              accounts={data.accounts}
              movements={data.movements}
              accountBalance={accountBalance}
              onAdd={() => setModal("account")}
              onOpen={openMovement}
            />
          )}
          {page === "goals" && (
            <GoalsPage
              goals={data.goals}
              summary={summary}
              onAddBudget={() => setModal("budget")}
              onDeleteBudget={(id) =>
                void runMutation(() => financeApi.deleteBudget(workspaceId(), id), 'Meta mensal removida.')
              }
              onAdd={() => setModal("goal")}
              onDeposit={(id) => {
                setDepositGoal(id);
                setModal("deposit");
              }}
            />
          )}
          {page === "help" && (
            <RecommendationsPage
              summary={summary}
              income={income}
              expenses={expenses}
              balance={balance}
              goals={data.goals}
              workspace={store.workspace}
              onPage={setPage}
            />
          )}
        </div>
      </main>
      {toast && (
        <div className={`toast fixed bottom-5 right-[22px] z-[110] flex items-center gap-2 rounded-[5px] border bg-white px-3.5 py-3 shadow-lg max-[480px]:bottom-3 max-[480px]:left-3 max-[480px]:right-3 ${toastIsError ? 'border-[#eed4d1] text-[#a3483f]' : 'border-[#d9e7dc] text-[#466a50]'}`} role={toastIsError ? 'alert' : 'status'}>
          <Check size={16} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Dispensar">
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "profile" && (
        <ProfileModal
          name={store.user.name}
          email={store.user.email}
          profile={profile}
          onClose={() => setModal(null)}
          onSave={(next) => {
            const ok = saveProfile(next);
            if (ok) {
              setModal(null);
              setToastIsError(false);
              setToast("Perfil atualizado.");
            }
            return ok;
          }}
          onSignOut={() => {
            setModal(null);
            handleSignOut();
          }}
        />
      )}
      {modal === "movement" && (
        <MovementFormModal
          key={editing?.id ?? "new"}
          accounts={data.accounts}
          categories={data.categories}
          movement={editing ?? undefined}
          recommendation={summary?.recommendation}
          onClose={() => {
            setModal(null);
            setEditing(null);
          }}
          onSave={saveMovement}
          onStatus={(status) => {
            if (editing) void changeStatus(editing, status);
          }}
        />
      )}
      {modal === "categories" && (
        <CategoriesModal
          categories={data.categories}
          onClose={() => setModal(null)}
          onCreate={(category) =>
            runMutation(() => financeApi.createCategory(workspaceId(), category), 'Categoria criada.', false)
          }
          onDelete={(id) =>
            void runMutation(() => financeApi.deleteCategory(workspaceId(), id), 'Categoria removida.', false)
          }
        />
      )}
      {modal === "budget" && (
        <BudgetFormModal
          categories={data.categories}
          budgets={summary?.budgets ?? []}
          month={currentMonth()}
          onClose={() => setModal(null)}
          onSave={(budget: BudgetInput) =>
            runMutation(() => financeApi.saveBudget(workspaceId(), budget), 'Meta mensal salva.')
          }
        />
      )}
      {modal === "account" && (
        <AccountFormModal
          onClose={() => setModal(null)}
          onSave={(account) =>
            runMutation(
              () => financeApi.createAccount(workspaceIds[store.workspace]!, account),
              'Conta adicionada.',
            )
          }
        />
      )}
      {modal === "goal" && (
        <GoalFormModal
          onClose={() => setModal(null)}
          onSave={(goal) =>
            runMutation(
              () => financeApi.createGoal(workspaceIds[store.workspace]!, goal),
              'Meta criada.',
            )
          }
        />
      )}
      {modal === "deposit" && (
        <GoalDepositModal
          goal={data.goals.find((g) => g.id === depositGoal)}
          onClose={() => setModal(null)}
          onSave={(amount) =>
            runMutation(
              () => financeApi.deposit(workspaceIds[store.workspace]!, depositGoal, amount),
              'Aporte atualizado na meta.',
            )
          }
        />
      )}
    </div>
  );
}
