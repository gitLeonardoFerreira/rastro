from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from app.db import SessionLocal, now
from app.models import AuthSession, Invite, Ticket
from app.security import COOKIE, digest
from conftest import member, register


def ticket(client, **overrides):
    data = {'title': 'Liberar acesso ao projeto', 'description': 'Preciso acessar o repositório para continuar o trabalho.', 'category': 'Acessos', 'priority': 'high', 'due_at': (now() + timedelta(days=1)).isoformat()}
    result = client.post('/api/tickets', json=data | overrides)
    assert result.status_code == 201, result.text
    return result.json()


def change(client, identifier, status, **overrides):
    return client.post(f'/api/tickets/{identifier}/transition', json={'status': status, 'note': f'Atualização para {status}', 'next_step': 'Verificar o acesso ao projeto'} | overrides)


def test_sessions_csrf_origin_logout_and_password_spaces(client_factory):
    client = client_factory()
    assert client.get('/api/tickets').status_code == 401
    identity = register(client, password='  RastroTest!2026  ')
    cookie = client.cookies.get(COOKIE)
    with SessionLocal() as db:
        assert db.get(AuthSession, digest(cookie)).user_id == identity['user']['id']
    response = client.post('/api/contexts', headers={'X-CSRF-Token': ''}, json={'name': 'Atlas', 'kind': 'system'})
    assert response.status_code == 403
    assert client.post('/api/auth/logout', headers={'Origin': 'https://attacker.test'}).status_code == 403
    assert client.post('/api/auth/logout').status_code == 204
    assert client.get('/api/auth/me').status_code == 401
    assert client.post('/api/auth/login', json={'email': 'admin@example.test', 'password': 'RastroTest!2026'}).status_code == 401
    result = client.post('/api/auth/login', json={'email': 'ADMIN@example.test', 'password': '  RastroTest!2026  '})
    assert result.status_code == 200
    assert 'HttpOnly' in result.headers['set-cookie'] and 'SameSite=lax' in result.headers['set-cookie']
    assert 'password_hash' not in result.json()['user']


def test_complete_handoff_confirmation_reopening_and_history(client_factory):
    admin_client = client_factory(); register(admin_client)
    operator, op = member(admin_client, client_factory, 'operator@example.test', 'operator')
    requester, req = member(admin_client, client_factory, 'requester@example.test', 'requester')
    request = ticket(requester); identifier = request['id']; path = f'/api/tickets/{identifier}'
    assert requester.post(path + '/accept').status_code == 403
    assert change(admin_client, identifier, 'resolved').status_code == 403
    assert admin_client.post(path + '/assign', json={'assignee_id': op['user']['id'], 'reason': 'Equipe de acesso responsável'}).json()['status'] == 'assigned'
    assert admin_client.post(path + '/accept').status_code == 403
    assert operator.post(path + '/accept').json()['status'] == 'accepted'
    assert operator.post(path + '/accept').status_code == 409
    assert change(operator, identifier, 'closed').status_code == 409
    assert change(operator, identifier, 'in_progress', next_step='').status_code == 422
    for state in ('in_progress', 'waiting', 'in_progress', 'resolved'):
        result = change(operator, identifier, state)
        assert result.status_code == 200, result.text
    assert change(operator, identifier, 'closed').status_code == 403
    assert change(requester, identifier, 'closed').json()['status'] == 'closed'
    assert change(requester, identifier, 'in_progress').json()['status'] == 'in_progress'
    assert requester.post(path + '/comments', json={'body': 'O acesso continua indisponível.'}).status_code == 201
    detail = requester.get(path).json()
    assert [e['kind'] for e in detail['events']] == ['created', 'assigned', 'accepted', 'transition', 'transition', 'transition', 'transition', 'transition', 'reopened', 'comment']
    assert detail['events'][-1]['actor']['id'] == req['user']['id']
    assert detail['assignee']['id'] == op['user']['id']


def test_workspace_isolation_and_requester_permissions(client_factory):
    first = client_factory(); first_id = register(first)
    context = first.post('/api/contexts', json={'name': 'Contrato Atlas', 'kind': 'document'}).json()
    first_ticket = ticket(first, context_id=context['id'])
    other = client_factory(); register(other, email='other@example.test')
    assert other.get('/api/tickets').json() == []
    assert other.get('/api/contexts').json() == []
    assert other.get(f"/api/tickets/{first_ticket['id']}").status_code == 404
    invalid = other.post('/api/tickets', json={'title': 'Outro pedido', 'description': 'Um contexto de outra organização', 'category': 'Documentos', 'context_id': context['id'], 'due_at': (now() + timedelta(days=1)).isoformat()})
    assert invalid.status_code == 400
    foreign_ticket = ticket(other)
    assert other.post(f"/api/tickets/{foreign_ticket['id']}/assign", json={'assignee_id': first_id['user']['id'], 'reason': 'Responsável externo'}).status_code == 400
    requester, _ = member(first, client_factory, 'requester@example.test', 'requester')
    own = ticket(requester)
    assert [t['id'] for t in requester.get('/api/tickets').json()] == [own['id']]
    assert requester.get(f"/api/tickets/{first_ticket['id']}").status_code == 404
    assert requester.get('/api/team').status_code == 403
    assert requester.post('/api/contexts', json={'name': 'Novo', 'kind': 'object'}).status_code == 403
    assert requester.post('/api/team/invites', json={'email': 'new@example.test', 'role': 'operator'}).status_code == 403


def test_invite_email_expiry_and_single_use(client_factory):
    admin = client_factory(); register(admin)
    token = admin.post('/api/team/invites', json={'email': 'invited@example.test', 'role': 'operator'}).json()['token']
    candidate = client_factory()
    payload = {'name': 'Pessoa Convidada', 'email': 'wrong@example.test', 'password': 'RastroTest!2026', 'invite_token': token}
    assert candidate.post('/api/auth/register', json=payload).status_code == 400
    identity = register(candidate, email='invited@example.test', token=token)
    assert identity['user']['role'] == 'operator'
    assert identity['workspace']['id'] == admin.get('/api/auth/me').json()['workspace']['id']
    with SessionLocal() as db:
        assert db.get(Invite, digest(token)).used_at is not None
    assert client_factory().post('/api/auth/register', json=payload | {'email': 'invited@example.test'}).status_code == 409
    expired = admin.post('/api/team/invites', json={'email': 'expired@example.test', 'role': 'requester'}).json()['token']
    with SessionLocal() as db:
        db.get(Invite, digest(expired)).expires_at = now() - timedelta(seconds=1); db.commit()
    assert candidate.post('/api/auth/register', json=payload | {'email': 'expired@example.test', 'invite_token': expired}).status_code == 400


def test_concurrent_acceptance_has_one_owner_and_one_event(client_factory):
    admin = client_factory(); register(admin)
    operator, _ = member(admin, client_factory, 'operator@example.test', 'operator')
    identifier = ticket(admin)['id']
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda c: c.post(f'/api/tickets/{identifier}/accept'), [admin, operator]))
    assert sorted(response.status_code for response in results) == [200, 409]
    detail = admin.get(f'/api/tickets/{identifier}').json()
    assert sum(e['kind'] == 'accepted' for e in detail['events']) == 1
    winner = next(response.json() for response in results if response.status_code == 200)
    assert detail['assignee']['id'] == winner['assignee']['id']


def test_search_filters_pagination_and_validation(client_factory):
    client = client_factory(); register(client)
    first = ticket(client, title='Revisar documento Atlas', priority='urgent')
    second = ticket(client, title='Ajustar sistema Boreal', priority='low')
    assert [t['id'] for t in client.get('/api/tickets?q=Atlas').json()] == [first['id']]
    assert [t['id'] for t in client.get('/api/tickets?priority=low').json()] == [second['id']]
    assert client.get('/api/tickets?q=%25').json() == []
    assert len(client.get('/api/tickets?limit=1').json()) == 1
    assert client.get('/api/tickets?limit=1&offset=1').json()[0]['id'] == first['id']
    assert client.get('/api/tickets?view=unknown').status_code == 422
    assert client.post('/api/tickets', json={'title': 'xx', 'description': 'curta', 'category': 'A', 'due_at': now().isoformat()}).status_code == 422
    assert client.post('/api/tickets', json={'title': 'Título válido', 'description': 'Descrição válida', 'category': 'Acessos', 'due_at': (now() + timedelta(days=1)).replace(tzinfo=None).isoformat()}).status_code == 422
    assert client.get('/api/tickets?view=confirm').json() == []
    client.post(f"/api/tickets/{first['id']}/accept")
    assert [t['id'] for t in client.get('/api/tickets?view=mine').json()] == [first['id']]
    assert [t['id'] for t in client.get('/api/tickets?view=unaccepted').json()] == [second['id']]
    with SessionLocal() as db:
        db.get(Ticket, first['id']).due_at = now() - timedelta(hours=1)
        db.commit()
    assert [t['id'] for t in client.get('/api/tickets?view=overdue').json()] == [first['id']]
    assert change(client, first['id'], 'resolved').status_code == 200
    assert client.get('/api/tickets?view=overdue').json() == []


def test_login_rate_limit(client_factory):
    client = client_factory()
    for _ in range(10):
        assert client.post('/api/auth/login', json={'email': 'unknown@example.test', 'password': 'wrong'}).status_code == 401
    assert client.post('/api/auth/login', json={'email': 'unknown@example.test', 'password': 'wrong'}).status_code == 429
