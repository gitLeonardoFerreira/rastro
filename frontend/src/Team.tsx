import { useState, type FormEvent } from 'react';
import { Copy, LoaderCircle, Mail, UserPlus } from 'lucide-react';
import { api, type Person } from './api';
import { Modal } from './Forms';
import { initials, roles } from './constants';

export default function Team({
  members,
  user,
  notify,
}: {
  members: Person[];
  user: Person;
  notify: (message: string) => void;
}) {
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      const result = await api<{ token: string }>('/team/invites', 'POST', {
        email: data.get('email'),
        role: data.get('role'),
      });
      setLink(`${location.origin}/?convite=${encodeURIComponent(result.token)}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      notify('Link copiado.');
    } catch {
      setError('Selecione e copie o link abaixo.');
    }
  }
  return (
    <section className="content">
      <div className="page-heading">
        <div>
          <span className="eyebrow accent">RESPONSABILIDADES CLARAS</span>
          <h1>As pessoas por trás dos pedidos.</h1>
          <p>Cada pessoa tem um papel dentro deste espaço.</p>
        </div>
        {user.role === 'admin' && (
          <button
            className="button primary"
            onClick={() => {
              setLink('');
              setError('');
              setInviting(true);
            }}
          >
            <UserPlus size={18} />
            Convidar pessoa
          </button>
        )}
      </div>
      <div className="notice">
        <Mail size={19} />
        <span>
          Solicitantes acompanham seus próprios pedidos. Responsáveis atendem os pedidos do espaço.
          Administradores também gerenciam convites e encaminhamentos.
        </span>
      </div>
      <div className="team-list">
        {members.map((member) => (
          <article className="team-row" key={member.id}>
            <span className="avatar">{initials(member.name)}</span>
            <div>
              <strong>
                {member.name}
                {member.id === user.id && <small> · você</small>}
              </strong>
              <p>{member.email}</p>
            </div>
            <span className="role-tag">{roles[member.role]}</span>
          </article>
        ))}
      </div>
      {inviting && (
        <Modal
          title={link ? 'Convite pronto' : 'Convidar pessoa'}
          subtitle="O convite vale por 48 horas e só pode ser usado pelo e-mail informado."
          onClose={() => setInviting(false)}
        >
          {link ? (
            <div className="modal-form">
              <p className="form-hint">
                Compartilhe este link com a pessoa. O Rastro não envia e-mails nesta versão.
              </p>
              <label>
                Link de cadastro
                <input value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
              </label>
              {error && (
                <div className="error-box" role="alert">
                  {error}
                </div>
              )}
              <div className="modal-footer">
                <button className="button secondary" onClick={() => setInviting(false)}>
                  Fechar
                </button>
                <button className="button primary" onClick={copy}>
                  <Copy size={17} />
                  Copiar convite
                </button>
              </div>
            </div>
          ) : (
            <form className="modal-form" onSubmit={invite}>
              <label>
                E-mail da pessoa
                <input
                  name="email"
                  type="email"
                  required
                  autoFocus
                  maxLength={254}
                  placeholder="pessoa@exemplo.com"
                />
              </label>
              <label>
                Papel
                <select name="role" defaultValue="requester">
                  <option value="requester">Solicitante — abre e acompanha seus pedidos</option>
                  <option value="operator">Responsável — atende pedidos do espaço</option>
                </select>
              </label>
              {error && (
                <div className="error-box" role="alert">
                  {error}
                </div>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setInviting(false)}
                >
                  Cancelar
                </button>
                <button className="button primary" disabled={busy}>
                  {busy && <LoaderCircle size={17} className="spin" />}Gerar convite
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </section>
  );
}
