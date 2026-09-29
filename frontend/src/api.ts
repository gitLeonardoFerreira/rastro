export type Person = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'requester';
};
export type ContextItem = { id: string; name: string; kind: string; description: string };
export type Ticket = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  requester: Person;
  assignee: Person | null;
  context: ContextItem | null;
  next_step: string;
  due_at: string;
  created_at: string;
  updated_at: string;
  overdue: boolean;
};
export type TicketEvent = {
  id: string;
  kind: string;
  body: string;
  actor: Person;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
};
export type Detail = Ticket & { events: TicketEvent[] };
export type Identity = {
  user: Person;
  workspace: { id: string; name: string };
  csrf_token: string;
  demo: boolean;
};

let csrf = '';
export function setCsrf(value: string) {
  csrf = value;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Não foi possível conectar. Confira se a API está em execução.', 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message =
      typeof data.detail === 'string'
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail
              .map((e: { msg: string; loc: string[] }) => `${e.loc.slice(1).join('.')}: ${e.msg}`)
              .join(' · ')
          : 'Não foi possível concluir esta ação.';
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
