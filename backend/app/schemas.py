from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

Status = Literal['open', 'assigned', 'accepted', 'in_progress', 'waiting', 'resolved', 'closed']
Priority = Literal['low', 'normal', 'high', 'urgent']
ContextKind = Literal['object', 'document', 'system', 'service', 'process', 'team', 'other']


class Payload(BaseModel):
    model_config = ConfigDict(extra='forbid')

    @field_validator('*', mode='before')
    @classmethod
    def trim_text(cls, value, info: ValidationInfo):
        # A password's spaces are meaningful; other text fields are normalized.
        return value.strip() if isinstance(value, str) and info.field_name != 'password' else value


class EmailPayload(Payload):
    email: str = Field(min_length=3, max_length=254)

    @field_validator('email')
    @classmethod
    def email_shape(cls, value):
        if value.count('@') != 1 or any(char.isspace() for char in value) or not value.split('@')[0] or '.' not in value.rsplit('@', 1)[1]:
            raise ValueError('Informe um e-mail válido.')
        return value.lower()


class Login(EmailPayload):
    password: str = Field(min_length=1, max_length=128)


class Register(Login):
    name: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=10, max_length=128)
    workspace_name: str = Field(default='Meu espaço', min_length=2, max_length=100)
    invite_token: str | None = Field(default=None, max_length=100)


class ContextCreate(Payload):
    name: str = Field(min_length=2, max_length=120)
    kind: ContextKind
    description: str = Field(default='', max_length=2000)


class TicketCreate(Payload):
    title: str = Field(min_length=4, max_length=160)
    description: str = Field(min_length=10, max_length=6000)
    category: str = Field(min_length=2, max_length=60)
    priority: Priority = 'normal'
    context_id: str | None = Field(default=None, max_length=36)
    due_at: datetime

    @field_validator('due_at')
    @classmethod
    def future_due(cls, value):
        if value.tzinfo is None:
            raise ValueError('O prazo precisa incluir o fuso horário.')
        if value <= datetime.now(timezone.utc):
            raise ValueError('Escolha um prazo futuro.')
        return value


class CommentCreate(Payload):
    body: str = Field(min_length=2, max_length=3000)


class Assignment(Payload):
    assignee_id: str = Field(min_length=36, max_length=36)
    reason: str = Field(min_length=5, max_length=1000)


class Transition(Payload):
    status: Status
    note: str = Field(min_length=5, max_length=2000)
    next_step: str = Field(default='', max_length=1000)


class InviteCreate(EmailPayload):
    role: Literal['operator', 'requester']
