import { useEffect, useState, type FormEvent } from 'react';
import { Route, Check, Circle, LoaderCircle, ShieldCheck } from 'lucide-react';
import { api } from './api';

export default function Auth({ onLogin }: { onLogin: () => Promise<void> }) {
  const invite = new URLSearchParams(window.location.search).get('convite');
  const [register, setRegister] = useState(Boolean(invite));
  const [demo, setDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ demo: boolean }>('/config')
      .then((c) => setDemo(c.demo))
      .catch(() => {});
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api(
        `/auth/${register ? 'register' : 'login'}`,
        'POST',
        register
          ? {
              email,
              password,
              name: data.get('name'),
              workspace_name: invite ? 'Meu espaço' : data.get('workspace'),
              invite_token: invite,
            }
          : { email, password },
      );
      await onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function enterDemo() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', 'POST', { email: 'leo@rastro.demo', password: 'RastroDemo!2026' });
      await onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Route size={25} />
          </span>
          rastro<span className="brand-dot">.</span>
        </a>
        <div className="auth-message">
          <span className="eyebrow">CADA PEDIDO TEM UM CAMINHO</span>
          <h1>
            Do primeiro pedido
            <br />
            ao último passo.
          </h1>
          <p>Acompanhe o que foi solicitado, quem assumiu e o que acontece a seguir.</p>
          <div className="story-ticket">
            <div className="story-ticket-top">
              <span>RST · EXEMPLO</span>
              <span className="soft-pill">Acesso</span>
            </div>
            <h3>Liberar acesso ao projeto</h3>
            <div className="story-step">
              <span className="story-circle">
                <Check size={14} />
              </span>
              <div>
                <strong>Solicitação registrada</strong>
                <small>Bruno descreveu o que precisa.</small>
              </div>
            </div>
            <div className="story-step">
              <span className="story-circle">
                <Check size={14} />
              </span>
              <div>
                <strong>Responsabilidade assumida</strong>
                <small>Marina confirmou o aceite.</small>
              </div>
            </div>
            <div className="story-step last">
              <span className="story-circle outlined">
                <Circle size={12} />
              </span>
              <div>
                <strong>Próximo passo</strong>
                <small>Enviar o convite de acesso.</small>
              </div>
            </div>
          </div>
        </div>
        <footer>Informações, serviços, processos e objetos. Tudo com contexto.</footer>
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <span className="eyebrow accent">SEU ESPAÇO DE TRABALHO</span>
          <h2>
            {register
              ? invite
                ? 'Entre para a equipe'
                : 'Comece um novo rastro'
              : 'Bom ter você por aqui'}
          </h2>
          <p>
            {register
              ? 'Crie sua conta para acompanhar cada solicitação.'
              : 'Entre para continuar de onde sua equipe parou.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Seu nome
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Como podemos chamar você?"
                />
              </label>
            )}
            {register && !invite && (
              <label>
                Nome do espaço
                <input
                  name="workspace"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Sua empresa ou equipe"
                />
              </label>
            )}
            <label>
              E-mail
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="voce@empresa.com"
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={register ? 'new-password' : 'current-password'}
                required
                minLength={register ? 10 : 1}
                maxLength={128}
                placeholder={register ? 'Pelo menos 10 caracteres' : 'Sua senha'}
              />
            </label>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={18} /> : null}
              {register ? 'Criar minha conta' : 'Entrar'}
            </button>
          </form>
          {!invite && (
            <p className="auth-switch">
              {register ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
              <button
                onClick={() => {
                  setRegister(!register);
                  setError('');
                }}
              >
                {register ? 'Entrar' : 'Criar um espaço'}
              </button>
            </p>
          )}
          {demo && !register && (
            <div className="demo-block">
              <span>Quer conhecer o Rastro?</span>
              <button className="button secondary full" disabled={busy} onClick={enterDemo}>
                Explorar demonstração
              </button>
              <small>Espaço fictício com pedidos de diferentes tipos.</small>
            </div>
          )}
          <div className="auth-foot">
            <ShieldCheck size={16} />
            <span>Seu espaço e suas solicitações em uma conta.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
