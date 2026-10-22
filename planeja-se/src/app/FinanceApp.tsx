import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowRight, Bell, BriefcaseBusiness, Check, ChevronDown, Gauge, Goal, Landmark, LogOut, Menu, ShieldCheck, Sparkles, Wallet, X } from 'lucide-react';
import type { Account, Data, Kind, Modal, Movement, Page, Store, User, Workspace } from '../features/finance/model';
import { ApiError, financeApi, type ApiData, type Credentials, type WorkspaceInfo } from '../features/finance/api';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { TransactionsPage, MovementFormModal } from '../features/transactions/TransactionsPage';
import { AccountsPage, AccountFormModal } from '../features/accounts/AccountsPage';
import { GoalsPage, GoalFormModal, GoalDepositModal } from '../features/goals/GoalsPage';
import { RecommendationsPage } from '../features/recommendations/RecommendationsPage';
import { AuthPage } from '../features/auth/AuthPage';
import '../styles/app.css';

const nav: { id: Page; label: string; icon: typeof Gauge }[] = [
  { id: 'home', label: 'Visi\u00e3o geral', icon: Gauge },
  { id: 'movements', label: 'Movimenta\u00e7\u00f5es', icon: ArrowLeftRight },
  { id: 'accounts', label: 'Contas', icon: Landmark },
  { id: 'goals', label: 'Metas e objetivos', icon: Goal },
  { id: 'help', label: 'Ajuda e recomenda\u00e7\u00f5es', icon: Sparkles },
];

const WORKSPACE_KEY = 'planeja-se-workspace';

function emptyData(): Data {
  return { accounts: [], movements: [], goals: [], activity: [] };
}

async function loadStore(
  user: User,
  workspaces: WorkspaceInfo[],
  preferredWorkspace: Workspace,
): Promise<{ store: Store; workspaceIds: Record<Workspace, string> }> {
  const workspaceIds = Object.fromEntries(
    workspaces.map(({ id, kind }) => [kind, id]),
  ) as Partial<Record<Workspace, string>>;
  if (!workspaceIds.personal || !workspaceIds.business) {
    throw new Error('A conta não possui os espaços pessoal e empresarial configurados.');
  }

  const [personal, business] = await Promise.all([
    financeApi.data(workspaceIds.personal),
    financeApi.data(workspaceIds.business),
  ]);
  return {
    workspaceIds: workspaceIds as Record<Workspace, string>,
    store: {
      user,
      workspace: preferredWorkspace,
      data: { personal, business },
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
      if (!financeApi.getToken()) {
        setBooting(false);
        return;
      }
      try {
        const [user, workspaces] = await Promise.all([
          financeApi.me(),
          financeApi.workspaces(),
        ]);
        const preferred = localStorage.getItem(WORKSPACE_KEY) === 'business'
          ? 'business'
          : 'personal';
        const session = await loadStore(user, workspaces, preferred);
        if (active) {
          setStore(session.store);
          setWorkspaceIds(session.workspaceIds);
          setSignedIn(true);
          setAuthError('');
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) financeApi.clearToken();
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

  const data = store.data[store.workspace];
  const currentMonth = new Date().getMonth();
  const monthly = data.movements.filter(
    (m) => new Date(`${m.date}T12:00:00`).getMonth() === currentMonth,
  );
  const income = monthly
    .filter((m) => m.kind === "income")
    .reduce((s, m) => s + m.amount, 0);
  const expenses = monthly
    .filter((m) => m.kind === "expense")
    .reduce((s, m) => s + m.amount, 0);
  const accountBalance = (account: Account) =>
    account.opening +
    data.movements
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
      financeApi.setToken(session.token);
      authenticated = true;
      const loaded = await loadStore(
        session.user,
        session.workspaces,
        'personal',
      );
      setStore(loaded.store);
      setWorkspaceIds(loaded.workspaceIds);
      localStorage.setItem(WORKSPACE_KEY, 'personal');
      setSignedIn(true);
      notice(credentials.mode === 'register' ? 'Conta criada com sucesso.' : `Bem-vindo(a), ${session.user.name.split(' ')[0]}.`);
    } catch (error) {
      if (!authenticated) financeApi.clearToken();
      setAuthError(errorMessage(error));
    } finally {
      setAuthLoading(false);
    }
  };

  const signOut = () => {
    financeApi.clearToken();
    setModal(null);
    setSignedIn(false);
    setAuthError('');
  };

  const reloadWorkspace = async (workspace: Workspace) => {
    const workspaceId = workspaceIds[workspace];
    if (!workspaceId) throw new Error('Espaço de trabalho não encontrado.');
    const latestData: ApiData = await financeApi.data(workspaceId);
    setStore((current) => ({
      ...current,
      data: { ...current.data, [workspace]: latestData },
    }));
  };

  const runMutation = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      await action();
      await reloadWorkspace(store.workspace);
      setModal(null);
      notice(successMessage);
    } catch (error) {
      notice(errorMessage(error), true);
    }
  };

  const addMovement = (movement: Omit<Movement, 'id'>) =>
    runMutation(
      () => financeApi.createMovement(workspaceIds[store.workspace]!, movement),
      'Movimentação registrada.',
    );

  const changeWorkspace = async (workspace: Workspace) => {
    try {
      await reloadWorkspace(workspace);
      setStore((current) => ({ ...current, workspace }));
      localStorage.setItem(WORKSPACE_KEY, workspace);
      setAccountFilter('all');
    } catch (error) {
      notice(errorMessage(error), true);
    }
  };

  const handleSignOut = () => {
    signOut();
  };
  const filtered = data.movements.filter(
    (m) =>
      (kindFilter === "all" || m.kind === kindFilter) &&
      (accountFilter === "all" || m.account === accountFilter) &&
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
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            planeja<span>-</span>se
          </span>
        </button>
        <div className="workspace-picker">
          <span className={`workspace-mark ${store.workspace}`}>
            {store.workspace === "personal" ? (
              <Wallet size={17} />
            ) : (
              <BriefcaseBusiness size={17} />
            )}
          </span>
          <label htmlFor="workspace">ESPAÇO DE TRABALHO</label>
          <select
            id="workspace"
            value={store.workspace}
            onChange={(e) => void changeWorkspace(e.target.value as Workspace)}
          >
            <option value="personal">Pessoal</option>
            <option value="business">Empresarial</option>
          </select>
          <ChevronDown size={14} />
        </div>
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
            <span className="user-avatar">
              {store.user.name[0]?.toUpperCase()}
            </span>
            <span>
              <b>{store.user.name}</b>
              <small>
                {store.workspace === "business"
                  ? "Perfil empresarial"
                  : "Plano gratuito"}
              </small>
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
              <ShieldCheck size={15} /> Sincronizado com a API
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
              aria-label="Sair da conta"
              onClick={handleSignOut}
            >
              {store.user.name[0]?.toUpperCase()}
            </button>
          </div>
        </header>
        <div className="content-wrap w-full  px-[38px] pb-[45px] pt-[35px] max-[1100px]:px-[25px] max-[760px]:px-4 max-[760px]:pb-[30px] max-[760px]:pt-6 max-[480px]:px-3 max-[480px]:pb-[25px] max-[480px]:pt-[21px]">
          {page === "home" && (
            <DashboardPage
              name={store.user.name}
              workspace={store.workspace}
              balance={balance}
              income={income}
              expenses={expenses}
              movements={data.movements}
              accounts={data.accounts}
              accountBalance={accountBalance}
              goals={data.goals}
              onAdd={() => setModal("movement")}
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
              activity={data.activity}
              onAdd={() => setModal("movement")}
            />
          )}
          {page === "accounts" && (
            <AccountsPage
              accounts={data.accounts}
              movements={data.movements}
              accountBalance={accountBalance}
              onAdd={() => setModal("account")}
            />
          )}
          {page === "goals" && (
            <GoalsPage
              goals={data.goals}
              onAdd={() => setModal("goal")}
              onDeposit={(id) => {
                setDepositGoal(id);
                setModal("deposit");
              }}
            />
          )}
          {page === "help" && (
            <RecommendationsPage
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
      {modal === "movement" && (
        <MovementFormModal
          accounts={data.accounts}
          onClose={() => setModal(null)}
          onSave={addMovement}
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
