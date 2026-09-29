import hashlib
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from .db import get_db, now
from .models import AuthSession, User

hasher = PasswordHasher()
COOKIE = 'rastro_session'
SESSION_SECONDS = 60 * 60 * 24 * 7
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(24))


def digest(value: str):
    return hashlib.sha256(value.encode()).hexdigest()


def verify_password(stored: str, candidate: str):
    try:
        return hasher.verify(stored, candidate)
    except (VerificationError, InvalidHashError):
        return False


def create_session(db: Session, user: User, response: Response):
    import os
    token = secrets.token_urlsafe(32)
    db.add(AuthSession(token_hash=digest(token), user_id=user.id,
                       csrf_token=secrets.token_urlsafe(32), expires_at=now() + timedelta(seconds=SESSION_SECONDS)))
    response.set_cookie(COOKIE, token, httponly=True, samesite='lax',
                        secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true',
                        max_age=SESSION_SECONDS, path='/')


def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE)
    session = db.get(AuthSession, digest(token)) if token else None
    if session is None or session.expires_at <= now():
        raise HTTPException(401, 'Sua sessão expirou. Entre novamente.')
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        provided = request.headers.get('x-csrf-token', '')
        if not secrets.compare_digest(session.csrf_token, provided):
            raise HTTPException(403, 'Recarregue a página antes de continuar.')
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(401, 'Sessão inválida.')
    request.state.auth_session = session
    return user


def staff(user: User):
    if user.role not in ('admin', 'operator'):
        raise HTTPException(403, 'Esta ação exige um responsável ou administrador.')


def admin(user: User):
    if user.role != 'admin':
        raise HTTPException(403, 'Esta ação exige um administrador.')
