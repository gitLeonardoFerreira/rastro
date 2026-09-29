import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  MessageSquare,
  UserCheck,
  GitBranch,
  RotateCcw,
  Send,
  Circle,
  LoaderCircle,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { api, type Detail, type Person } from './api';
import { Modal } from './Forms';
import { date, initials, kinds, priorities, statuses } from './constants';

type Action = { target: string; title: string };

export default function TicketDetail({
  ticket,
  user,
  team,
  onBack,
  onRefresh,
  notify,
}: {
  ticket: Detail;
  user: Person;
  team: Person[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
  notify: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [assigning, setAssigning] = useState(false);
  const isStaff = user.role !== 'requester';
  const isOwner = ticket.assignee?.id === user.id;
  const canConfirm = ticket.requester.id === user.id || user.role === 'admin';
  const canAccept =
    isStaff && ['open', 'assigned'].includes(ticket.status) && (!ticket.assignee || isOwner);
  const canAssign =
    isStaff &&
    !['resolved', 'closed'].includes(ticket.status) &&
    (user.role === 'admin' || !ticket.assignee || isOwner);
  async function perform(path: string, body?: unknown) {
    setBusy(true);
    setError('');
    try {
      await api(`/tickets/${ticket.id}/${path}`, 'POST', body);
      await onRefresh();
      notify('Solicitação atualizada.');
      setAction(null);
      setAssigning(false);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function postComment(e: FormEvent) {
    e.preventDefault();
    if (await perform('comments', { body: comment })) setComment('');
  }
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await perform('transition', {
      status: action!.target,
      note: form.get('note'),
      next_step: form.get('next_step') || '',
    });
  }
  async function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await perform('assign', { assignee_id: form.get('assignee'), reason: form.get('reason') });
  }
  const progress =
    ticket.status === 'open'
      ? 0
      : ticket.status === 'assigned'
        ? 1
        : ticket.status === 'accepted'
          ? 2
          : ['in_progress', 'waiting'].includes(ticket.status)
            ? 3
            : ticket.status === 'resolved'
              ? 4
              : 5;
  return (
    <section className="content detail-content">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        Voltar às solicitações
      </button>
      <div className="detail-heading">
        <div className="request-meta">
          <span>{ticket.code}</span>
          <span>·</span>
          <span>{ticket.category}</span>
          <span className={`priority ${ticket.priority}`}>{priorities[ticket.priority]}</span>
        </div>
        <div className="detail-title">
          <h1>{ticket.title}</h1>
          <span className={`status ${ticket.status}`}>{statuses[ticket.status]}</span>
        </div>
      </div>
      <div className="journey" aria-label={`Etapa atual: ${statuses[ticket.status]}`}>
        {['Registrada', 'Encaminhada', 'Assumida', 'Atendimento', 'Resolvida', 'Confirmada'].map(
          (label, index) => (
            <div
              className={`journey-step ${index <= progress ? 'reached' : ''} ${index === progress ? 'current' : ''}`}
              key={label}
            >
              <span>{index < progress ? <Check size={12} /> : index + 1}</span>
              <small>{label}</small>
            </div>
          ),
        )}
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-primary">
          <section className="panel request-description">
            <h2>O pedido</h2>
            <p>{ticket.description}</p>
            {ticket.context && (
              <div className="context-inline">
                <Layers size={18} />
                <div>
                  <small>{kinds[ticket.context.kind]}</small>
                  <strong>{ticket.context.name}</strong>
                </div>
              </div>
            )}
          </section>
          <section className="panel timeline-panel">
            <div className="panel-heading">
              <h2>O rastro desta solicitação</h2>
              <span>{ticket.events.length} acontecimentos</span>
            </div>
            <ol className="timeline">
              {ticket.events.map((event) => (
                <li key={event.id} className={event.kind === 'comment' ? 'comment-event' : ''}>
                  <div className="event-icon">
                    {event.kind === 'created' ? (
                      <Circle size={14} />
                    ) : event.kind === 'accepted' ? (
                      <UserCheck size={16} />
                    ) : event.kind === 'assigned' ? (
                      <GitBranch size={16} />
                    ) : event.kind === 'comment' ? (
                      <MessageSquare size={15} />
                    ) : event.to_status === 'closed' ? (
                      <CheckCheck size={16} />
                    ) : event.kind === 'reopened' ? (
                      <RotateCcw size={15} />
                    ) : (
                      <Check size={15} />
                    )}
                  </div>
                  <div className="event-content">
                    <div className="event-head">
                      <strong>{event.actor.name}</strong>
                      <time dateTime={event.created_at}>{date(event.created_at)}</time>
                    </div>
                    <p>{event.body}</p>
                    {event.kind !== 'comment' && event.to_status && (
                      <span className={`status ${event.to_status}`}>
                        {statuses[event.to_status]}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <form className="comment-form" onSubmit={postComment}>
              <label htmlFor="comment">Adicionar uma informação</label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                minLength={2}
                maxLength={3000}
                placeholder="Deixe contexto para quem acompanha este pedido…"
                required
              />
              <div>
                <small>Seu comentário fica registrado no histórico.</small>
                <button className="button secondary" disabled={busy || comment.trim().length < 2}>
                  <Send size={15} />
                  Comentar
                </button>
              </div>
            </form>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="next-step-card">
            <span className="eyebrow accent">PRÓXIMO PASSO</span>
            <p>{ticket.next_step}</p>
            {ticket.overdue && (
              <div className="due-warning">
                <AlertCircle size={15} />
                Prazo de resolução vencido
              </div>
            )}
            <div className="due-line">
              <Clock3 size={15} />
              <span>{date(ticket.due_at)}</span>
            </div>
          </section>
          <section className="panel people-panel">
            <h2>Quem acompanha</h2>
            <div className="person-line">
              <span className="avatar">{initials(ticket.requester.name)}</span>
              <div>
                <small>Solicitante</small>
                <strong>{ticket.requester.name}</strong>
              </div>
            </div>
            <div className="person-line">
              <span className={`avatar ${!ticket.assignee ? 'unassigned' : ''}`}>
                {ticket.assignee ? initials(ticket.assignee.name) : <UserCheck size={17} />}
              </span>
              <div>
                <small>{ticket.status === 'assigned' ? 'Encaminhado para' : 'Responsável'}</small>
                <strong>{ticket.assignee?.name || 'Ainda sem responsável'}</strong>
              </div>
            </div>
            <div className="created-line">Registrada em {date(ticket.created_at)}</div>
          </section>
          <section className="panel action-panel">
            <h2>Ações disponíveis</h2>
            {canAccept && (
              <button
                className="button primary full"
                disabled={busy}
                onClick={() => perform('accept')}
              >
                <UserCheck size={17} />
                {ticket.status === 'assigned' ? 'Confirmar aceite' : 'Assumir pedido'}
              </button>
            )}
            {isOwner && ['accepted', 'waiting'].includes(ticket.status) && (
              <button
                className="button primary full"
                onClick={() => {
                  setError('');
                  setAction({
                    target: 'in_progress',
                    title:
                      ticket.status === 'waiting' ? 'Retomar atendimento' : 'Iniciar atendimento',
                  });
                }}
              >
                {ticket.status === 'waiting' ? 'Retomar atendimento' : 'Iniciar atendimento'}
              </button>
            )}
            {isOwner && ['accepted', 'in_progress'].includes(ticket.status) && (
              <button
                className="button secondary full"
                onClick={() => {
                  setError('');
                  setAction({ target: 'waiting', title: 'Registrar uma espera' });
                }}
              >
                <Clock3 size={16} />
                Registrar espera
              </button>
            )}
            {isOwner && ['accepted', 'in_progress', 'waiting'].includes(ticket.status) && (
              <button
                className="button primary full"
                onClick={() => {
                  setError('');
                  setAction({ target: 'resolved', title: 'Registrar a solução' });
                }}
              >
                <Check size={16} />
                Marcar como resolvida
              </button>
            )}
            {canConfirm && ticket.status === 'resolved' && (
              <button
                className="button primary full"
                onClick={() => {
                  setError('');
                  setAction({ target: 'closed', title: 'Confirmar a solução' });
                }}
              >
                <CheckCheck size={17} />
                Confirmar solução
              </button>
            )}
            {canConfirm && ['resolved', 'closed'].includes(ticket.status) && (
              <button
                className="button secondary full"
                onClick={() => {
                  setError('');
                  setAction({ target: 'in_progress', title: 'Reabrir solicitação' });
                }}
              >
                <RotateCcw size={16} />
                Reabrir pedido
              </button>
            )}
            {canAssign && (
              <button
                className="button secondary full"
                onClick={() => {
                  setError('');
                  setAssigning(true);
                }}
              >
                <GitBranch size={16} />
                {ticket.assignee ? 'Transferir pedido' : 'Encaminhar pedido'}
              </button>
            )}
            {!canAccept &&
              !canAssign &&
              !(isOwner && ['accepted', 'in_progress', 'waiting'].includes(ticket.status)) &&
              !(canConfirm && ['resolved', 'closed'].includes(ticket.status)) && (
                <p className="action-hint">
                  Você pode acompanhar o histórico e adicionar informações.{' '}
                  {ticket.status === 'closed'
                    ? 'A solução já foi confirmada.'
                    : `A próxima ação está com ${ticket.status === 'resolved' ? ticket.requester.name : ticket.assignee?.name || 'a equipe responsável'}.`}
                </p>
              )}
          </section>
        </aside>
      </div>
      {action && (
        <Modal
          title={action.title}
          subtitle="Registre o que aconteceu para manter o histórico claro."
          onClose={() => setAction(null)}
        >
          <form className="modal-form" onSubmit={update}>
            <label>
              {action.target === 'resolved'
                ? 'Como o pedido foi resolvido?'
                : action.target === 'closed'
                  ? 'Confirme o resultado'
                  : action.target === 'waiting'
                    ? 'Por que está aguardando?'
                    : 'O que mudou?'}
              <textarea
                name="note"
                required
                minLength={5}
                maxLength={2000}
                autoFocus
                placeholder="Descreva o acontecimento…"
              />
            </label>
            {['in_progress', 'waiting'].includes(action.target) && (
              <label>
                Qual é o próximo passo?
                <input
                  name="next_step"
                  required
                  minLength={5}
                  maxLength={1000}
                  placeholder="Uma ação concreta para continuar o pedido"
                />
              </label>
            )}
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="button secondary" onClick={() => setAction(null)}>
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                {busy && <LoaderCircle size={17} className="spin" />}Registrar atualização
              </button>
            </div>
          </form>
        </Modal>
      )}
      {assigning && (
        <Modal
          title={ticket.assignee ? 'Transferir pedido' : 'Encaminhar pedido'}
          subtitle="A pessoa escolhida precisará confirmar que assumiu."
          onClose={() => setAssigning(false)}
        >
          <form className="modal-form" onSubmit={assign}>
            <label>
              Para quem?
              <select name="assignee" required defaultValue="">
                <option value="" disabled>
                  Escolha um responsável
                </option>
                {team
                  .filter((member) => member.role !== 'requester')
                  .map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Motivo
              <textarea
                name="reason"
                required
                minLength={5}
                maxLength={1000}
                placeholder="Explique o encaminhamento…"
              />
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
                onClick={() => setAssigning(false)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                {busy && <LoaderCircle size={17} className="spin" />}Encaminhar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
