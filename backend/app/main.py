import os
import secrets
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import Base, engine, get_db, now
from .models import AuthSession, Context, Event, Invite, Ticket, User, Workspace
from .schemas import Assignment, CommentCreate, ContextCreate, InviteCreate, Login, Register, TicketCreate, Transition
from .security import COOKIE, DUMMY_HASH, admin, create_session, current_user, digest, hasher, staff, verify_password


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title='Rastro API', version='0.1.0', lifespan=lifespan,
              description='Solicitações, contextos e histórico de responsabilidade.')
auth_attempts = defaultdict(deque)
rate_lock = threading.Lock()
allowed_origins = set(os.getenv('ALLOWED_ORIGINS', 'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000').split(','))


@app.middleware('http')
async def guard(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        if origin and origin not in allowed_origins:
            return JSONResponse({'detail': 'Origem não autorizada.'}, status_code=403)
    if request.url.path in ('/api/auth/login', '/api/auth/register') and request.method == 'POST':
        key = (request.client.host if request.client else 'unknown', request.url.path)
        instant = time.monotonic()
        with rate_lock:
            attempts = auth_attempts[key]
            while attempts and attempts[0] < instant - 60:
                attempts.popleft()
            if len(attempts) >= 10:
                return JSONResponse({'detail': 'Muitas tentativas. Aguarde um minuto.'}, status_code=429)
            attempts.append(instant)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    return response


def person(user: User):
    return {'id': user.id, 'name': user.name, 'email': user.email, 'role': user.role}


def context_data(context: Context):
    return {'id': context.id, 'name': context.name, 'kind': context.kind, 'description': context.description}


def ticket_data(ticket: Ticket, db: Session):
    context = db.get(Context, ticket.context_id) if ticket.context_id else None
    assignee = db.get(User, ticket.assignee_id) if ticket.assignee_id else None
    return {
        'id': ticket.id, 'code': f'RST-{ticket.id[:6].upper()}', 'title': ticket.title,
        'description': ticket.description, 'category': ticket.category, 'priority': ticket.priority,
        'status': ticket.status, 'requester': person(db.get(User, ticket.requester_id)),
        'assignee': person(assignee) if assignee else None,
        'context': context_data(context) if context else None, 'next_step': ticket.next_step,
        'due_at': ticket.due_at, 'created_at': ticket.created_at, 'updated_at': ticket.updated_at,
        'overdue': ticket.due_at < now() and ticket.status not in ('resolved', 'closed'),
    }


def find_ticket(ticket_id: str, db: Session, user: User, *, lock=False):
    query = select(Ticket).where(Ticket.id == ticket_id, Ticket.workspace_id == user.workspace_id)
    if user.role == 'requester':
        query = query.where(Ticket.requester_id == user.id)
    if lock:
        query = query.with_for_update()
    ticket = db.scalar(query)
    if ticket is None:
        raise HTTPException(404, 'Solicitação não encontrada.')
    return ticket


def record(db, ticket, user, kind, body, old=None):
    ticket.updated_at = now()
    db.add(Event(ticket_id=ticket.id, actor_id=user.id, kind=kind, body=body,
                 from_status=old, to_status=ticket.status))


@app.get('/api/health')
def health(db: Session = Depends(get_db)):
    db.execute(text('SELECT 1'))
    return {'status': 'ok', 'database': 'postgresql'}


@app.post('/api/auth/register', status_code=201)
def register(payload: Register, response: Response, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(409, 'Não foi possível criar a conta com esse e-mail.')
    if payload.invite_token:
        invite = db.scalar(select(Invite).where(Invite.token_hash == digest(payload.invite_token)).with_for_update())
        if not invite or invite.used_at or invite.expires_at <= now() or invite.email != payload.email:
            raise HTTPException(400, 'Convite inválido, expirado ou destinado a outro e-mail.')
        workspace_id, role = invite.workspace_id, invite.role
        invite.used_at = now()
    else:
        workspace = Workspace(name=payload.workspace_name)
        db.add(workspace)
        db.flush()
        workspace_id, role = workspace.id, 'admin'
    user = User(name=payload.name, email=payload.email, password_hash=hasher.hash(payload.password),
                workspace_id=workspace_id, role=role)
    db.add(user)
    try:
        db.flush()
        create_session(db, user, response)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Não foi possível criar a conta com esse e-mail.')
    return {'user': person(user)}


@app.post('/api/auth/login')
def login(payload: Login, response: Response, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    valid = verify_password(user.password_hash if user else DUMMY_HASH, payload.password)
    if not user or not valid:
        raise HTTPException(401, 'E-mail ou senha incorretos.')
    previous = request.cookies.get(COOKIE)
    if previous:
        old = db.get(AuthSession, digest(previous))
        if old:
            db.delete(old)
    create_session(db, user, response)
    db.commit()
    return {'user': person(user)}


@app.get('/api/auth/me')
def me(request: Request, db: Session = Depends(get_db), user: User = Depends(current_user)):
    return {'user': person(user), 'workspace': {'id': user.workspace_id, 'name': db.get(Workspace, user.workspace_id).name},
            'csrf_token': request.state.auth_session.csrf_token,
            'demo': os.getenv('DEMO_ENABLED', 'false').lower() == 'true'}


@app.get('/api/config')
def public_config():
    return {'demo': os.getenv('DEMO_ENABLED', 'false').lower() == 'true'}


@app.post('/api/auth/logout', status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db), user: User = Depends(current_user)):
    db.delete(request.state.auth_session)
    db.commit()
    response.delete_cookie(COOKIE, path='/')


@app.get('/api/team')
def team(db: Session = Depends(get_db), user: User = Depends(current_user)):
    staff(user)
    return [person(member) for member in db.scalars(select(User).where(User.workspace_id == user.workspace_id).order_by(User.name))]


@app.post('/api/team/invites', status_code=201)
def invite(payload: InviteCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    admin(user)
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(409, 'Este e-mail já possui uma conta.')
    token = secrets.token_urlsafe(32)
    db.add(Invite(token_hash=digest(token), workspace_id=user.workspace_id, email=payload.email,
                  role=payload.role, expires_at=now() + timedelta(days=2)))
    db.commit()
    return {'token': token, 'expires_in_hours': 48}


@app.get('/api/contexts')
def contexts(db: Session = Depends(get_db), user: User = Depends(current_user)):
    return [context_data(item) for item in db.scalars(select(Context).where(Context.workspace_id == user.workspace_id).order_by(Context.name))]


@app.post('/api/contexts', status_code=201)
def add_context(payload: ContextCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    staff(user)
    context = Context(workspace_id=user.workspace_id, **payload.model_dump())
    db.add(context)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Já existe um contexto com esse nome e tipo.')
    return context_data(context)


@app.get('/api/tickets')
def tickets(limit: int = 50, offset: int = 0, q: str = '', view: str = 'all', context_id: str = '',
            priority: str = '', db: Session = Depends(get_db), user: User = Depends(current_user)):
    query = select(Ticket).where(Ticket.workspace_id == user.workspace_id)
    if user.role == 'requester':
        query = query.where(Ticket.requester_id == user.id)
    if q.strip():
        # Escape LIKE wildcards: search input is literal, never SQL code.
        term = '%' + q.strip()[:160].replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        query = query.where(or_(Ticket.title.ilike(term, escape='\\'), Ticket.description.ilike(term, escape='\\'),
                               Ticket.category.ilike(term, escape='\\')))
    if view == 'unaccepted':
        query = query.where(Ticket.status.in_(('open', 'assigned')))
    elif view == 'mine':
        query = query.where(Ticket.assignee_id == user.id, Ticket.status.not_in(('resolved', 'closed')))
    elif view == 'confirm':
        query = query.where(Ticket.status == 'resolved')
        if user.role != 'admin':
            query = query.where(Ticket.requester_id == user.id)
    elif view == 'closed':
        query = query.where(Ticket.status == 'closed')
    elif view == 'overdue':
        query = query.where(Ticket.due_at < now(), Ticket.status.not_in(('resolved', 'closed')))
    elif view != 'all':
        raise HTTPException(422, 'Filtro inválido.')
    if context_id:
        query = query.where(Ticket.context_id == context_id)
    if priority:
        query = query.where(Ticket.priority == priority)
    query = query.order_by(Ticket.updated_at.desc(), Ticket.id).offset(max(0, offset)).limit(max(1, min(200, limit)))
    return [ticket_data(ticket, db) for ticket in db.scalars(query)]


@app.post('/api/tickets', status_code=201)
def create_ticket(payload: TicketCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    if payload.context_id:
        context = db.get(Context, payload.context_id)
        if not context or context.workspace_id != user.workspace_id:
            raise HTTPException(400, 'Contexto inválido para este espaço.')
    ticket = Ticket(workspace_id=user.workspace_id, requester_id=user.id, **payload.model_dump())
    db.add(ticket)
    db.flush()
    record(db, ticket, user, 'created', 'Registrou a solicitação. Aguardando alguém assumir.')
    db.commit()
    return ticket_data(ticket, db)


@app.get('/api/tickets/{ticket_id}')
def detail(ticket_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ticket = find_ticket(ticket_id, db, user)
    data = ticket_data(ticket, db)
    data['events'] = [
        {'id': event.id, 'kind': event.kind, 'body': event.body, 'actor': person(db.get(User, event.actor_id)),
         'from_status': event.from_status, 'to_status': event.to_status, 'created_at': event.created_at}
        for event in db.scalars(select(Event).where(Event.ticket_id == ticket.id).order_by(Event.created_at, Event.id))
    ]
    return data


@app.post('/api/tickets/{ticket_id}/accept')
def accept(ticket_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)):
    staff(user)
    ticket = find_ticket(ticket_id, db, user, lock=True)
    if ticket.status not in ('open', 'assigned'):
        raise HTTPException(409, 'Este pedido já foi assumido. Atualize a página.')
    if ticket.assignee_id and ticket.assignee_id != user.id:
        raise HTTPException(403, 'Este pedido foi encaminhado a outra pessoa.')
    old = ticket.status
    ticket.assignee_id, ticket.status = user.id, 'accepted'
    ticket.next_step = 'Responsável confirmou o aceite. Aguardando início do atendimento.'
    record(db, ticket, user, 'accepted', 'Confirmou que assumiu a responsabilidade pelo pedido.', old)
    db.commit()
    return ticket_data(ticket, db)


@app.post('/api/tickets/{ticket_id}/assign')
def assign(ticket_id: str, payload: Assignment, db: Session = Depends(get_db), user: User = Depends(current_user)):
    staff(user)
    ticket = find_ticket(ticket_id, db, user, lock=True)
    if user.role != 'admin' and ticket.assignee_id not in (None, user.id):
        raise HTTPException(403, 'Somente o responsável ou administrador pode transferir este pedido.')
    if ticket.status in ('resolved', 'closed'):
        raise HTTPException(409, 'Reabra o pedido antes de transferir.')
    member = db.get(User, payload.assignee_id)
    if not member or member.workspace_id != user.workspace_id or member.role == 'requester':
        raise HTTPException(400, 'Escolha um responsável deste espaço.')
    old = ticket.status
    ticket.assignee_id, ticket.status = member.id, 'assigned'
    ticket.next_step = f'Aguardando {member.name} confirmar o aceite.'
    record(db, ticket, user, 'assigned', f'Encaminhou para {member.name}. Motivo: {payload.reason}', old)
    db.commit()
    return ticket_data(ticket, db)


@app.post('/api/tickets/{ticket_id}/transition')
def transition(ticket_id: str, payload: Transition, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ticket = find_ticket(ticket_id, db, user, lock=True)
    target = payload.status
    confirmation = target == 'closed' and ticket.status == 'resolved'
    reopening = target == 'in_progress' and ticket.status in ('resolved', 'closed')
    if confirmation or reopening:
        if user.id != ticket.requester_id and user.role != 'admin':
            raise HTTPException(403, 'Somente o solicitante ou administrador pode confirmar ou reabrir.')
    else:
        staff(user)
        if ticket.assignee_id != user.id:
            raise HTTPException(403, 'Somente quem assumiu pode atualizar o atendimento.')
    transitions = {
        'accepted': {'in_progress', 'waiting', 'resolved'},
        'in_progress': {'waiting', 'resolved'}, 'waiting': {'in_progress', 'resolved'},
        'resolved': {'closed', 'in_progress'}, 'closed': {'in_progress'},
    }
    if target not in transitions.get(ticket.status, set()):
        raise HTTPException(409, 'Esta mudança não é permitida no estado atual.')
    if target in ('in_progress', 'waiting') and len(payload.next_step) < 5:
        raise HTTPException(422, 'Descreva o próximo passo com pelo menos 5 caracteres.')
    old = ticket.status
    ticket.status = target
    ticket.next_step = ('Aguardando o solicitante confirmar a solução.' if target == 'resolved'
                        else 'Solução confirmada. Solicitação concluída.' if target == 'closed'
                        else payload.next_step)
    record(db, ticket, user, 'reopened' if reopening else 'transition', payload.note, old)
    db.commit()
    return ticket_data(ticket, db)


@app.post('/api/tickets/{ticket_id}/comments', status_code=201)
def comment(ticket_id: str, payload: CommentCreate, db: Session = Depends(get_db), user: User = Depends(current_user)):
    ticket = find_ticket(ticket_id, db, user, lock=True)
    record(db, ticket, user, 'comment', payload.body)
    db.commit()
    return {'ok': True}
