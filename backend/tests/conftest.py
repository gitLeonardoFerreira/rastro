import os

import pytest
from sqlalchemy.engine import make_url

# Tests destroy only their own database. Never use the developer's .env implicitly.
test_url = os.environ.get('TEST_DATABASE_URL')
if not test_url or make_url(test_url).database != 'rastro_test':
    raise RuntimeError('Defina TEST_DATABASE_URL apontando explicitamente para rastro_test.')
os.environ['DATABASE_URL'] = test_url
os.environ['DEMO_ENABLED'] = 'false'

from app.db import Base, engine  # noqa: E402
from app.main import app, auth_attempts  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(autouse=True)
def clean_test_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    auth_attempts.clear()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def client_factory():
    clients = []
    def factory():
        client = TestClient(app)
        clients.append(client)
        return client
    yield factory
    for client in clients:
        client.close()


def register(client, email='admin@example.test', *, token=None, name='Admin Teste', password='RastroTest!2026'):
    result = client.post('/api/auth/register', json={'email': email, 'password': password, 'name': name, 'workspace_name': 'Equipe Teste', 'invite_token': token})
    assert result.status_code == 201, result.text
    identity = client.get('/api/auth/me').json()
    client.headers['X-CSRF-Token'] = identity['csrf_token']
    return identity


def member(admin_client, factory, email, role):
    result = admin_client.post('/api/team/invites', json={'email': email, 'role': role})
    assert result.status_code == 201, result.text
    client = factory()
    identity = register(client, email=email, token=result.json()['token'], name=role.title())
    return client, identity
