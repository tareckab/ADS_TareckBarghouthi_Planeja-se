import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { User } from '../finance/model';

export function AuthPage({
  onBack,
  onSubmit,
}: {
  onBack: () => void;
  onSubmit: (user: User) => void;
}) {
  const [register, setRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <main className="auth-screen">
      <section className="auth-art">
        <button className="wordmark" onClick={onBack}>
          <span className="brand-symbol">
            <i />
            <i />
            <i />
          </span>
          <span>
            planeja<span>-</span>se
          </span>
        </button>
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
        <button className="back-to-app" onClick={onBack}>
          <ArrowRight size={15} /> Voltar para o painel
        </button>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: name.trim() || email.split("@")[0], email });
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
              minLength={6}
              autoComplete={register ? "new-password" : "current-password"}
              placeholder="Pelo menos 6 caracteres"
              required
            />
          </label>
          <button className="button-primary auth-submit">
            {register ? "Criar conta" : "Entrar"} <ArrowRight size={16} />
          </button>
          <div className="auth-toggle">
            {register ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
            <button type="button" onClick={() => setRegister(!register)}>
              {register ? "Entrar" : "Criar conta"}
            </button>
          </div>
          <small className="auth-disclaimer">
            <ShieldCheck size={15} /> Acesso demonstrativo; dados salvos neste
            navegador.
          </small>
        </form>
      </section>
    </main>
  );
}
