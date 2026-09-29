import {
  Box,
  FileText,
  Laptop,
  Wrench,
  Workflow,
  Users,
  Layers,
  KeyRound,
  ShoppingBag,
  Inbox,
} from 'lucide-react';

export const statuses: Record<string, string> = {
  open: 'Sem responsável',
  assigned: 'Aceite pendente',
  accepted: 'Assumida',
  in_progress: 'Em atendimento',
  waiting: 'Aguardando',
  resolved: 'Confirmar solução',
  closed: 'Concluída',
};
export const priorities: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};
export const kinds: Record<string, string> = {
  object: 'Objeto',
  document: 'Documento',
  system: 'Sistema',
  service: 'Serviço',
  process: 'Processo',
  team: 'Equipe',
  other: 'Outro',
};
export const roles: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Responsável',
  requester: 'Solicitante',
};
export const contextIcons = {
  object: Box,
  document: FileText,
  system: Laptop,
  service: Wrench,
  process: Workflow,
  team: Users,
  other: Layers,
};
export function categoryIcon(category: string) {
  return (
    (
      {
        Acessos: KeyRound,
        Compras: ShoppingBag,
        Documentos: FileText,
        Manutenção: Wrench,
        Pessoas: Users,
      } as Record<string, typeof Inbox>
    )[category] || Inbox
  );
}
export const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase();
export const date = (value: string) =>
  new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
