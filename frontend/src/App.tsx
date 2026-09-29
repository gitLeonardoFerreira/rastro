import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Route,
  Inbox,
  Layers,
  Plus,
  Search,
  LogOut,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Users,
  CheckCircle2,
  RefreshCw,
  FlaskConical,
  X,
} from 'lucide-react';
import Auth from './Auth';
import Team from './Team';
import TicketDetail from './TicketDetail';
import { NewContext, NewRequest } from './Forms';
import {
  api,
  ApiError,
  setCsrf,
  type Identity,
  type Ticket,
  type Detail,
  type ContextItem,
  type Person,
} from './api';
import {
  statuses,
  priorities,
  kinds,
  roles,
  initials,
  date,
  categoryIcon,
  contextIcons,
} from './constants';

type Page = 'requests' | 'contexts' | 'team';
const tabs = {
  all: 'Todas',
  unaccepted: 'Sem aceite',
  mine: 'Comigo',
  overdue: 'Prazo vencido',
  confirm: 'Confirmar',
  closed: 'Concluídas',
};
const PAGE_SIZE = 50;
export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [booting, setBooting] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [contexts, setContexts] = useState<ContextItem[]>([]);
  const [team, setTeam] = useState<Person[]>([]);
  const [page, setPage] = useState<Page>('requests');
  const [selected, setSelected] = useState<Detail | null>(null);
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [contextId, setContextId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addingContext, setAddingContext] = useState(false);
  const [toast, setToast] = useState('');
  const loadVersion = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4500);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const loadIdentity = useCallback(async () => {
    const data = await api<Identity>('/auth/me');
    ++loadVersion.current;
    setTickets([]);
    setContexts([]);
    setTeam([]);
    setSelected(null);
    setCsrf(data.csrf_token);
    setIdentity(data);
  }, []);
  useEffect(() => {
    loadIdentity()
      .catch(() => {})
      .finally(() => setBooting(false));
  }, [loadIdentity]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) {
      setIdentity(null);
      setSelected(null);
      setCsrf('');
    } else setError((err as Error).message);
  }, []);
  const loadTickets = useCallback(
    async (offset = 0) => {
      const version = ++loadVersion.current;
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          q: search,
          view,
          priority,
          context_id: contextId,
        });
        const result = await api<Ticket[]>(`/tickets?${params}`);
        if (version !== loadVersion.current) return;
        setTickets((previous) =>
          offset
            ? [...previous, ...result.filter((item) => !previous.some((t) => t.id === item.id))]
            : result,
        );
        setMore(result.length === PAGE_SIZE);
      } catch (err) {
        if (version === loadVersion.current) handleError(err);
      } finally {
        if (version === loadVersion.current) setLoading(false);
      }
    },
    [search, view, priority, contextId, handleError],
  );
  useEffect(() => {
    if (!identity) return;
    let active = true;
    Promise.all([
      api<ContextItem[]>('/contexts'),
      identity.user.role !== 'requester' ? api<Person[]>('/team') : Promise.resolve([]),
    ])
      .then(([c, t]) => {
        if (active) {
          setContexts(c);
          setTeam(t);
        }
      })
      .catch(handleError);
    return () => {
      active = false;
    };
  }, [identity, handleError]);
  useEffect(() => {
    if (identity) void loadTickets();
  }, [identity, loadTickets]);
  async function openTicket(id: string, changeUrl = true) {
    setError('');
    try {
      const detail = await api<Detail>(`/tickets/${id}`);
      setSelected(detail);
      setPage('requests');
      window.scrollTo(0, 0);
      if (changeUrl) history.pushState({}, '', `?pedido=${id}`);
    } catch (err) {
      handleError(err);
    }
  }
  useEffect(() => {
    if (!identity) return;
    const sync = () => {
      const id = new URLSearchParams(location.search).get('pedido');
      if (id) void openTicket(id, false);
      else setSelected(null);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
    // Identity changes invalidate the visible request; URL is the source of deep links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  function navigate(next: Page) {
    setSelected(null);
    setPage(next);
    setError('');
    window.scrollTo(0, 0);
    history.pushState({}, '', '/');
  }
  async function refreshDetail() {
    if (!selected) return;
    setSelected(await api<Detail>(`/tickets/${selected.id}`));
    await loadTickets();
  }
  async function logout() {
    try {
      await api('/auth/logout', 'POST');
      setIdentity(null);
      setCsrf('');
      setTickets([]);
      setSelected(null);
      history.replaceState({}, '', '/');
    } catch (err) {
      handleError(err);
    }
  }
  async function switchDemo(email: string) {
    try {
      await api('/auth/login', 'POST', { email, password: 'RastroDemo!2026' });
      setSelected(null);
      setView('all');
      setContextId('');
      setQuery('');
      setPriority('');
      setPage('requests');
      history.replaceState({}, '', '/');
      await loadIdentity();
      notify('Perfil de demonstração alterado.');
    } catch (err) {
      handleError(err);
    }
  }
  if (booting)
    return (
      <div className="boot">
        <Route size={36} />
        <LoaderCircle className="spin" size={22} />
        <span>Abrindo seu espaço…</span>
      </div>
    );
  if (!identity) return <Auth onLogin={loadIdentity} />;
  const isStaff = identity.user.role !== 'requester';
  const filteredContexts = contexts.filter((c) =>
    `${c.name} ${c.description} ${kinds[c.kind]}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const isDemoAccount = identity.demo && identity.user.email.endsWith('@rastro.demo');
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('requests');
          }}
        >
          <span className="brand-mark">
            <Route size={25} />
          </span>
          rastro<span className="brand-dot">.</span>
        </a>
        <div className="workspace-card">
          <span className="workspace-icon">{identity.workspace.name[0]}</span>
          <div>
            <strong>{identity.workspace.name.split(' · ')[0]}</strong>
            <small>{isDemoAccount ? 'Demonstração' : 'Espaço de trabalho'}</small>
          </div>
        </div>
        <nav>
          <button
            className={`nav-item ${page === 'requests' ? 'active' : ''}`}
            aria-current={page === 'requests' ? 'page' : undefined}
            onClick={() => navigate('requests')}
          >
            <Inbox size={19} />
            Solicitações
          </button>
          <button
            className={`nav-item ${page === 'contexts' ? 'active' : ''}`}
            aria-current={page === 'contexts' ? 'page' : undefined}
            onClick={() => {
              setQuery('');
              navigate('contexts');
            }}
          >
            <Layers size={19} />
            Contextos
          </button>
          {isStaff && (
            <button
              className={`nav-item ${page === 'team' ? 'active' : ''}`}
              aria-current={page === 'team' ? 'page' : undefined}
              onClick={() => navigate('team')}
            >
              <Users size={19} />
              Pessoas
            </button>
          )}
        </nav>
        <div className="profile">
          <span className="avatar">{initials(identity.user.name)}</span>
          <div>
            <strong>{identity.user.name}</strong>
            <small>{roles[identity.user.role]}</small>
          </div>
          <button aria-label="Sair da conta" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </header>
      <main className="workspace-main">
        <header className="topbar">
          <span>
            Espaço de trabalho <ChevronRight size={14} />
            {page === 'requests' ? 'Solicitações' : page === 'contexts' ? 'Contextos' : 'Pessoas'}
          </span>
          <span className="account-label">
            <span className="avatar tiny">{initials(identity.user.name)}</span>
            {identity.user.name.split(' ')[0]}
          </span>
        </header>
        {isDemoAccount && (
          <div className="demo-toolbar">
            <span>
              <FlaskConical size={15} />
              Dados fictícios para explorar o fluxo
            </span>
            <label>
              Testar como
              <select
                aria-label="Perfil de demonstração"
                value={identity.user.email}
                onChange={(e) => void switchDemo(e.target.value)}
              >
                <option value="leo@rastro.demo">Leo · administrador</option>
                <option value="marina@rastro.demo">Marina · responsável</option>
                <option value="bruno@rastro.demo">Bruno · solicitante</option>
              </select>
            </label>
          </div>
        )}
        {selected ? (
          <TicketDetail
            key={selected.id}
            ticket={selected}
            user={identity.user}
            team={team}
            onBack={() => navigate('requests')}
            onRefresh={refreshDetail}
            notify={notify}
          />
        ) : page === 'team' ? (
          <Team members={team} user={identity.user} notify={notify} />
        ) : page === 'contexts' ? (
          <section className="content">
            <div className="page-heading">
              <div>
                <span className="eyebrow accent">TUDO TEM UM CONTEXTO</span>
                <h1>Uma memória para cada assunto.</h1>
                <p>Reúna pedidos ligados a sistemas, documentos, serviços, processos e mais.</p>
              </div>
              {isStaff && (
                <button className="button primary" onClick={() => setAddingContext(true)}>
                  <Plus size={18} />
                  Novo contexto
                </button>
              )}
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <label className="search context-search">
              <Search size={18} />
              <input
                aria-label="Buscar contextos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar contexto…"
              />
            </label>
            <div className="context-grid">
              {filteredContexts.map((context) => {
                const Icon = contextIcons[context.kind as keyof typeof contextIcons] || Layers;
                return (
                  <button
                    className="context-card"
                    key={context.id}
                    onClick={() => {
                      setContextId(context.id);
                      setQuery('');
                      setView('all');
                      setPriority('');
                      navigate('requests');
                    }}
                  >
                    <span className="context-card-icon">
                      <Icon size={24} />
                    </span>
                    <small>{kinds[context.kind]}</small>
                    <h3>{context.name}</h3>
                    <p>
                      {context.description || 'Um ponto de referência para os pedidos da equipe.'}
                    </p>
                    <span className="context-card-link">
                      Ver solicitações <ChevronRight size={15} />
                    </span>
                  </button>
                );
              })}
            </div>
            {!filteredContexts.length && (
              <div className="empty">
                <Layers size={30} />
                <h3>Nenhum contexto encontrado</h3>
                <p>
                  {query
                    ? 'Experimente buscar outro termo.'
                    : 'Comece criando um ponto de referência para sua equipe.'}
                </p>
              </div>
            )}
          </section>
        ) : (
          <section className="content">
            <div className="page-heading">
              <div>
                <span className="eyebrow accent">SOLICITAÇÕES EM MOVIMENTO</span>
                <h1>O próximo passo começa aqui.</h1>
                <p>
                  {isStaff
                    ? 'Acompanhe os pedidos e mantenha cada responsabilidade clara.'
                    : 'Abra seus pedidos e acompanhe quem está cuidando de cada um.'}
                </p>
              </div>
              <button className="button primary" onClick={() => setCreating(true)}>
                <Plus size={18} />
                Nova solicitação
              </button>
            </div>
            {error && (
              <div className="error-box" role="alert">
                {error}
              </div>
            )}
            <div className="inbox-tools">
              <div className="tabs" aria-label="Filtrar solicitações">
                {Object.entries(tabs)
                  .filter(([key]) => isStaff || key !== 'mine')
                  .map(([key, label]) => (
                    <button
                      key={key}
                      className={view === key ? 'active' : ''}
                      aria-pressed={view === key}
                      onClick={() => setView(key)}
                    >
                      {label}
                    </button>
                  ))}
              </div>
              <label className="search">
                <Search size={18} />
                <input
                  aria-label="Buscar solicitações"
                  placeholder="Buscar solicitação…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
            </div>
            <div className="filters">
              <select
                aria-label="Filtrar prioridade"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="">Todas as prioridades</option>
                {Object.entries(priorities).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar contexto"
                value={contextId}
                onChange={(e) => setContextId(e.target.value)}
              >
                <option value="">Todos os contextos</option>
                {contexts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {contextId && (
                <button
                  className="icon-button"
                  aria-label="Limpar contexto"
                  onClick={() => setContextId('')}
                >
                  <X size={15} />
                </button>
              )}
              <button
                className="icon-button refresh-button"
                aria-label="Atualizar solicitações"
                disabled={loading}
                onClick={() => void loadTickets()}
              >
                <RefreshCw size={16} className={loading ? 'spin' : ''} />
              </button>
            </div>
            <div className="request-list" aria-busy={loading}>
              {tickets.map((ticket, index) => {
                const Icon = categoryIcon(ticket.category);
                return (
                  <button
                    className="request-row"
                    style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
                    key={ticket.id}
                    onClick={() => void openTicket(ticket.id)}
                  >
                    <span className={`category-icon ${ticket.category.toLowerCase()}`}>
                      <Icon size={21} />
                    </span>
                    <div className="request-main">
                      <div className="request-meta">
                        <span>{ticket.code}</span>
                        <span>·</span>
                        <span>{ticket.category}</span>
                        {ticket.priority === 'urgent' && (
                          <span className="priority urgent">Urgente</span>
                        )}
                        {ticket.overdue && <span className="overdue">Prazo vencido</span>}
                      </div>
                      <h3>{ticket.title}</h3>
                      <p>{ticket.next_step}</p>
                    </div>
                    <div className="request-state">
                      <span className={`status ${ticket.status}`}>{statuses[ticket.status]}</span>
                      <small>
                        <Clock3 size={13} />
                        {date(ticket.due_at)}
                      </small>
                    </div>
                    <ChevronRight size={18} />
                  </button>
                );
              })}
              {!tickets.length && (
                <div className="empty">
                  {loading ? <LoaderCircle size={30} className="spin" /> : <Inbox size={30} />}
                  <h3>{loading ? 'Buscando solicitações…' : 'Nenhum pedido por aqui'}</h3>
                  <p>
                    {loading
                      ? 'Consultando o seu espaço.'
                      : query || view !== 'all' || contextId || priority
                        ? 'Experimente outros filtros ou registre uma nova solicitação.'
                        : 'Registre um pedido para começar a construir seu rastro.'}
                  </p>
                </div>
              )}
            </div>
            <footer className="list-footer">
              {tickets.length}{' '}
              {tickets.length === 1 ? 'solicitação carregada' : 'solicitações carregadas'}
              {more && (
                <button
                  className="button secondary load-more"
                  disabled={loading}
                  onClick={() => void loadTickets(tickets.length)}
                >
                  Carregar mais
                </button>
              )}
            </footer>
          </section>
        )}
      </main>
      {creating && (
        <NewRequest
          contexts={contexts}
          selectedContext={contextId}
          onClose={() => setCreating(false)}
          onCreated={(ticket) => {
            setCreating(false);
            notify('Solicitação registrada.');
            void loadTickets();
            void openTicket(ticket.id);
          }}
        />
      )}
      {addingContext && (
        <NewContext
          onClose={() => setAddingContext(false)}
          onCreated={() => {
            setAddingContext(false);
            notify('Contexto criado.');
            api<ContextItem[]>('/contexts').then(setContexts).catch(handleError);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
