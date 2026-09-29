import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X, LoaderCircle, Layers, Plus } from 'lucide-react';
import { api, type ContextItem, type Ticket } from './api';
import { kinds, priorities } from './constants';

export function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    dialog.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className="modal"
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-header">
        <div>
          <h2 id="modal-title">{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" aria-label="Fechar janela" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function NewRequest({
  contexts,
  selectedContext,
  onClose,
  onCreated,
}: {
  contexts: ContextItem[];
  selectedContext?: string;
  onClose: () => void;
  onCreated: (ticket: Ticket) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const tomorrow = new Date(Date.now() + 86400000);
  const defaultDue = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const ticket = await api<Ticket>('/tickets', 'POST', {
        title: form.get('title'),
        description: form.get('description'),
        category: form.get('category'),
        priority: form.get('priority'),
        context_id: form.get('context') || null,
        due_at: new Date(String(form.get('due'))).toISOString(),
      });
      onCreated(ticket);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Nova solicitação"
      subtitle="Descreva o que precisa acontecer. O próximo passo começa aqui."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          O que você precisa?
          <input
            name="title"
            required
            minLength={4}
            maxLength={160}
            placeholder="Ex.: Liberar acesso ao ambiente de testes"
            autoFocus
          />
        </label>
        <label>
          Conte os detalhes
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={6000}
            placeholder="O que está acontecendo? Qual resultado você espera?"
          />
        </label>
        <div className="form-grid">
          <label>
            Categoria
            <input
              name="category"
              list="categories"
              defaultValue="Serviços"
              required
              minLength={2}
              maxLength={60}
            />
            <datalist id="categories">
              {[
                'Acessos',
                'Compras',
                'Documentos',
                'Manutenção',
                'Pessoas',
                'Financeiro',
                'Serviços',
                'Outros',
              ].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Prioridade
            <select name="priority" defaultValue="normal">
              {Object.entries(priorities).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Prazo para resolução
          <input name="due" type="datetime-local" defaultValue={defaultDue} required />
        </label>
        <label>
          Vincular a um contexto <span className="optional">Opcional</span>
          <select name="context" defaultValue={selectedContext || ''}>
            <option value="">Pedido independente</option>
            {contexts.map((c) => (
              <option value={c.id} key={c.id}>
                {kinds[c.kind]} · {c.name}
              </option>
            ))}
          </select>
        </label>
        <p className="form-hint">
          <Layers size={15} />O contexto pode ser um objeto, documento, sistema, serviço ou
          processo.
        </p>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <LoaderCircle size={17} className="spin" /> : <Plus size={17} />}Registrar
            solicitação
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function NewContext({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      await api('/contexts', 'POST', {
        name: form.get('name'),
        kind: form.get('kind'),
        description: form.get('description'),
      });
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Novo contexto"
      subtitle="Um ponto de referência para reunir solicitações relacionadas."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          Nome
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="Ex.: Processo de entrada de colaboradores"
            autoFocus
          />
        </label>
        <label>
          Tipo
          <select name="kind">
            {Object.entries(kinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Descrição
          <textarea
            name="description"
            maxLength={2000}
            placeholder="Informações úteis sobre este contexto."
          />
        </label>
        {error && (
          <div className="error-box" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            {busy && <LoaderCircle className="spin" size={17} />}Criar contexto
          </button>
        </div>
      </form>
    </Modal>
  );
}
