import { useState } from 'react';
import { ArrowRight, BriefcaseBusiness, ShieldCheck, Wallet } from 'lucide-react';
import type { Credentials } from '../finance/api';
import type { Workspace } from '../finance/model';

export function AuthPage({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (credentials: Credentials) => void;
  submitting: boolean;
  error: string;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState('');
  return (
    <main className="auth-screen">
      <section className="auth-art">
        <div className="wordmark">
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            planeja<span>-</span>se
          </span>
        </div>
        <div>
          <span className="eyebrow">CUIDAR DO SEU FUTURO COMEÇA AGORA</span>
          <h1>
            O seu dinheiro.
            <br />
            As suas escolhas.
          </h1>
          <p>
            Um lugar tranquilo para entender o presente e planejar o que vem
            depois.
          </p>
        </div>
        <small>Planejar também é uma forma de cuidado.</small>
      </section>
      <section className="auth-content">
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (register && !workspace) {
              setWorkspaceError('Escolha o tipo de espaço de trabalho para continuar.');
              return;
            }
            onSubmit({
              mode: register ? 'register' : 'login',
              name: name.trim(),
              ...(workspace ? { workspace } : {}),
              email,
              password,
            });
          }}
        >
          <span className="eyebrow">
            {register ? "UM NOVO COMEÇO" : "QUE BOM TER VOCÊ DE VOLTA"}
          </span>
          <h2>{register ? "Crie seu espaço." : "Entre na sua conta."}</h2>
          <p>
            {register
              ? "Vamos dar o primeiro passo juntos."
              : "Suas finanças continuam esperando por você."}
          </p>
          {register && (
            <label className="form-label">
              Seu nome
              <input
                autoComplete="name"
                placeholder="Como podemos te chamar?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          )}
          {register && (
            <fieldset className="form-label workspace-choice">
              <legend>Como você vai usar o Planeja-se?</legend>
              <div className="workspace-options" role="radiogroup" aria-label="Tipo de espaço de trabalho">
                <button
                  type="button"
                  className={workspace === 'personal' ? 'is-selected' : ''}
                  role="radio"
                  aria-checked={workspace === 'personal'}
                  onClick={() => {
                    setWorkspace('personal');
                    setWorkspaceError('');
                  }}
                >
                  <Wallet size={18} />
                  <span>
                    <strong>Pessoal</strong>
                    <small>Organize suas finanças pessoais</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={workspace === 'business' ? 'is-selected' : ''}
                  role="radio"
                  aria-checked={workspace === 'business'}
                  onClick={() => {
                    setWorkspace('business');
                    setWorkspaceError('');
                  }}
                >
                  <BriefcaseBusiness size={18} />
                  <span>
                    <strong>Empresarial</strong>
                    <small>Organize as finanças do seu negócio</small>
                  </span>
                </button>
              </div>
              {workspaceError && <span className="workspace-error" role="alert">{workspaceError}</span>}
            </fieldset>
          )}
          <label className="form-label">
            E-mail
            <input
              type="email"
              autoComplete="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="form-label">
            Senha
            <input
              type="password"
              minLength={register ? 8 : 1}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder={register ? "Pelo menos 8 caracteres" : "Sua senha"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error" role="alert" style={{ color: '#a3483f', fontSize: 12 }}>{error}</p>}
          <button className="button-primary auth-submit" disabled={submitting}>
            {submitting ? "Conectando..." : register ? "Criar conta" : "Entrar"} <ArrowRight size={16} />
          </button>
          <div className="auth-toggle">
            {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button type="button" onClick={() => setRegister(!register)}>
              {register ? "Entrar" : "Criar conta"}
            </button>
          </div>
          <small className="auth-disclaimer">
            <ShieldCheck size={15} /> Seus dados são sincronizados com sua conta
            no Planeja-se.
          </small>
        </form>
      </section>
    </main>
  );
}
