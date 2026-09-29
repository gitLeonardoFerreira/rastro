"""Dados fictícios, criados somente quando a demonstração é explicitamente habilitada."""
import os
from datetime import timedelta

from sqlalchemy import select

from .db import Base, SessionLocal, engine, now
from .models import Context, Event, Ticket, User, Workspace
from .security import hasher


def seed():
    if os.getenv('DEMO_ENABLED', 'false').lower() != 'true':
        raise SystemExit('Defina DEMO_ENABLED=true somente para um ambiente de demonstração.')
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == 'leo@rastro.demo')):
            print('Demonstração já existe; dados preservados.')
            return
        workspace = Workspace(name='Estúdio Horizonte · demonstração')
        db.add(workspace)
        db.flush()
        password = hasher.hash('RastroDemo!2026')
        users = [User(workspace_id=workspace.id, name=name, email=email, role=role, password_hash=password)
                 for name, email, role in [('Leo Barbosa', 'leo@rastro.demo', 'admin'),
                                         ('Marina Costa', 'marina@rastro.demo', 'operator'),
                                         ('Bruno Lima', 'bruno@rastro.demo', 'requester')]]
        db.add_all(users)
        db.flush()
        leo, marina, bruno = users
        contexts = [Context(workspace_id=workspace.id, name=name, kind=kind, description=description)
                    for name, kind, description in [
                        ('Repositório do projeto Atlas', 'system', 'Ambiente de desenvolvimento da equipe.'),
                        ('Contrato do fornecedor', 'document', 'Minuta aguardando conferência.'),
                        ('Impressora · sala 03', 'object', 'Equipamento compartilhado do escritório.'),
                        ('Entrada de novos colaboradores', 'process', 'Preparação de acessos e materiais.'),
                        ('Revisão de orçamento', 'service', 'Conferência antes da aprovação da compra.')]]
        db.add_all(contexts)
        db.flush()
        instant = now()
        rows = [
            ('Liberar acesso ao repositório Atlas', 'Preciso acessar o repositório para começar a integração da API. O convite ainda não chegou.', 'Acessos', 'urgent', 'open', contexts[0], bruno, None, -3, 28),
            ('Conferir a nova versão do contrato', 'O fornecedor enviou a minuta revisada. Precisamos conferir os dados antes da assinatura.', 'Documentos', 'high', 'assigned', contexts[1], bruno, marina, 6, 16),
            ('Substituir o toner da impressora', 'A impressão está saindo com falhas. Já verificamos o papel e o nível do toner está baixo.', 'Manutenção', 'normal', 'waiting', contexts[2], bruno, marina, 24, 20),
            ('Preparar os acessos da nova integrante', 'A nova integrante começa nesta semana e precisa de e-mail e acesso ao ambiente de testes.', 'Pessoas', 'high', 'in_progress', contexts[3], leo, leo, 12, 8),
            ('Revisar orçamento dos equipamentos', 'Os valores atualizados estão no orçamento. Confira se os itens atendem à solicitação original.', 'Compras', 'normal', 'resolved', contexts[4], leo, marina, 36, 30),
            ('Comprar adaptador para a sala de reunião', 'Precisamos de um adaptador USB-C para conectar os notebooks ao projetor da sala de reunião.', 'Compras', 'low', 'open', None, bruno, None, 48, 2),
        ]
        for title, description, category, priority, status, context, requester, assignee, due_hours, age_hours in rows:
            created = instant - timedelta(hours=age_hours)
            ticket = Ticket(workspace_id=workspace.id, title=title, description=description,
                            category=category, priority=priority, status=status,
                            context_id=context.id if context else None, requester_id=requester.id,
                            assignee_id=assignee.id if assignee else None, created_at=created,
                            updated_at=created + timedelta(minutes=15), due_at=instant + timedelta(hours=due_hours))
            ticket.next_step = {
                'open': 'Aguardando alguém assumir a solicitação.',
                'assigned': 'Aguardando Marina confirmar o aceite.',
                'waiting': 'Aguardar a entrega do toner, prevista para amanhã de manhã.',
                'in_progress': 'Criar a conta de e-mail e enviar o convite para o ambiente de testes.',
                'resolved': 'Aguardando o solicitante confirmar a solução.'}[status]
            db.add(ticket)
            db.flush()
            db.add(Event(ticket_id=ticket.id, actor_id=requester.id, kind='created', body='Registrou a solicitação.',
                         to_status='open', created_at=created))
            if assignee:
                db.add(Event(ticket_id=ticket.id, actor_id=leo.id, kind='assigned', body=f'Encaminhou para {assignee.name}.',
                             from_status='open', to_status='assigned', created_at=created + timedelta(minutes=5)))
            if status in ('waiting', 'in_progress', 'resolved'):
                db.add(Event(ticket_id=ticket.id, actor_id=assignee.id, kind='accepted', body='Confirmou o aceite do pedido.',
                             from_status='assigned', to_status='accepted', created_at=created + timedelta(minutes=10)))
                db.add(Event(ticket_id=ticket.id, actor_id=assignee.id, kind='transition', body=ticket.next_step,
                             from_status='accepted', to_status=status, created_at=created + timedelta(minutes=15)))
        db.commit()
        print('Demonstração criada: 3 pessoas, 5 contextos, 6 solicitações fictícias.')


if __name__ == '__main__':
    seed()
