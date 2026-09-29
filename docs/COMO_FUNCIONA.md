# Entenda o código do Rastro

## 1. A ideia virou um modelo de dados

O centro do sistema é a **solicitação**, não o objeto. Um pedido descreve um resultado esperado e carrega categoria, prioridade, prazo, solicitante, responsável, estado e próximo passo. Seu vínculo com um contexto é opcional.

Um **contexto** é uma referência compartilhada: “Contrato do fornecedor”, “Repositório Atlas”, “Entrada de colaboradores” ou “Impressora da sala”. Diferentes pedidos podem se referir ao mesmo contexto. Isso combina informações e coisas sem obrigar tudo a ser um bem físico.

Em `backend/app/models.py`, cada classe corresponde a uma tabela:

| Tabela | Responsabilidade |
| --- | --- |
| workspaces | Espaços de trabalho separados |
| users | Pessoas, vínculo ao espaço e papel |
| contexts | Referências que agrupam pedidos |
| tickets | Situação atual de cada solicitação |
| events | Acontecimentos do pedido, com autoria |
| auth_sessions | Sessões de login com expiração |
| invites | Convites de cadastro com papel, validade e uso |

As chaves estrangeiras ligam essas tabelas. Restrições no banco impedem estados e prioridades inválidos e exigem um responsável quando o pedido deixa de estar aberto. IDs são UUIDs; o código curto `RST-...` é apenas uma apresentação, e os links usam o UUID completo.

## 2. Encaminhar e assumir são ações distintas

Ao encaminhar para Marina, o pedido passa a **assigned**: Marina ainda não confirmou. Ela precisa executar o aceite para chegar a **accepted**. Isso evita tratar a entrega de uma informação como compromisso assumido.

| Estado técnico | Texto na interface | Próxima ação habitual |
| --- | --- | --- |
| open | Sem responsável | Assumir ou encaminhar |
| assigned | Aceite pendente | Destinatário confirma o aceite |
| accepted | Assumida | Iniciar, esperar ou resolver |
| in_progress | Em atendimento | Esperar ou resolver |
| waiting | Aguardando | Retomar ou resolver |
| resolved | Confirmar solução | Solicitante confirma ou reabre |
| closed | Concluída | Reabrir se o problema voltar |

O solicitante ou administrador confirma e reabre. Somente o responsável atual altera o atendimento. O administrador pode encaminhar um pedido, mas precisa assumir antes de executar o atendimento. A transferência durante o atendimento exige um novo aceite.

A API exige uma justificativa para mudanças de estado. Atendimento e espera também exigem um **próximo passo** concreto. Um comentário acrescenta informações sem mudar o estado.

## 3. A API é quem decide se uma ação pode acontecer

`backend/app/main.py` contém os endpoints. O React chama esses endpoints com JSON; esconder um botão não é suficiente para proteger uma operação.

Cada ação verifica sessão, papel e espaço de trabalho. O solicitante só consulta seus próprios pedidos; administradores e responsáveis consultam os pedidos de seu espaço. Buscar um pedido de outro espaço retorna 404. Um contexto ou responsável de outro espaço não pode ser vinculado ao pedido.

`backend/app/schemas.py` usa Pydantic para validar as entradas: campos obrigatórios, tamanho, prioridades, estados e prazo futuro com fuso horário. Texto comum é aparado, mas espaços de uma senha são preservados.

Exemplo do caminho de uma criação:

1. O formulário envia título, descrição, categoria, prioridade, prazo e contexto opcional.
2. Pydantic valida o formato.
3. A API identifica a pessoa pela sessão e verifica o contexto.
4. Cria a solicitação e um evento “Registrou a solicitação”.
5. Confirma a transação no PostgreSQL.
6. O React abre o pedido e mostra seu histórico.

## 4. Atualização e histórico ficam na mesma transação

O estado atual está em `tickets`. A função `record` adiciona um acontecimento em `events` e atualiza a data de movimentação. A mudança e o evento só ficam persistidos após o mesmo `commit`. Se a operação falhar, não deve sobrar um estado novo sem seu acontecimento.

Para aceite, encaminhamento, comentários e transições, `find_ticket(..., lock=True)` usa **SELECT FOR UPDATE**. O PostgreSQL bloqueia a linha enquanto uma transação a modifica. Se duas pessoas tentarem assumir o mesmo pedido, a segunda espera e então lê o estado já assumido; recebe 409, em vez de também assumir. O teste de concorrência verifica esse comportamento com duas chamadas simultâneas.

Não existem endpoints que editem ou apaguem acontecimentos. Isso preserva o histórico dentro da aplicação, mas um administrador do banco ainda consegue alterar as tabelas. Não apresentamos esse registro como prova inviolável.

## 5. Como o login funciona

`backend/app/security.py` usa **Argon2** para gerar e verificar o hash da senha. A API não devolve esse hash ao navegador.

Após login, gera um token aleatório e o envia em um cookie **HttpOnly**, com **SameSite=Lax** e validade de sete dias. O banco guarda somente SHA-256 do token. HttpOnly impede a leitura do cookie por JavaScript; não elimina todos os riscos de scripts maliciosos.

O endpoint `/auth/me` devolve os dados do usuário e um token CSRF da sessão. O React mantém esse token em memória e o envia no cabeçalho `X-CSRF-Token` das alterações. A API verifica esse cabeçalho e rejeita origens diferentes das configuradas. O logout remove a sessão do banco e o cookie. A opção `COOKIE_SECURE=true` deve acompanhar HTTPS na publicação.

Cadastro sem convite cria um novo espaço com administrador. Com convite válido, cria uma conta no espaço existente, com o papel definido pelo administrador. O convite é ligado ao e-mail, expira em 48 horas e é consumido com bloqueio de linha.

O limite de login protege contra tentativas repetidas no processo atual. Ele é uma proteção inicial, em memória, que precisa evoluir antes da publicação com vários processos.

## 6. Como o React foi dividido

| Arquivo | Função |
| --- | --- |
| src/main.tsx | Monta a aplicação na página |
| src/App.tsx | Sessão, navegação, listagem, busca, filtros e abertura do pedido |
| src/Auth.tsx | Login, cadastro e entrada na demonstração |
| src/Forms.tsx | Janela acessível, novo pedido e novo contexto |
| src/TicketDetail.tsx | Histórico, responsáveis, próximo passo e ações do pedido |
| src/Team.tsx | Pessoas e geração de convites |
| src/api.ts | Chamadas HTTP, tipos compartilhados e tratamento de respostas |
| src/constants.ts | Nomes em português, ícones e formatação de datas |
| src/styles.css | Aparência, foco por teclado e adaptação de tela |

`useState` guarda o estado da tela. `useEffect` carrega dados e acompanha filtros. A busca aguarda 250 ms depois da digitação, para evitar uma consulta por tecla. A lista carrega páginas de 50 pedidos, e o botão “Carregar mais” consulta a próxima página. Todas as consultas são limitadas ao espaço e à permissão de quem entrou.

O endereço `?pedido=UUID` permite retomar um pedido ao recarregar a página; a API verifica novamente o acesso. O token de convite usa `?convite=TOKEN` e abre o cadastro na tela de entrada.

O formulário usa um `dialog` nativo, que prende o foco enquanto está aberto. Escape fecha a janela. A interface usa verde e cinza claro, com navegação horizontal. Ela adapta a navegação e as colunas para telas menores. As transições de entrada, a resposta ao passar o cursor, as janelas e as confirmações usam CSS e o estado do React, sem uma biblioteca de animação. A preferência de movimento reduzido desativa as animações.

## 7. Python, React e SQL trabalham juntos

No desenvolvimento, o servidor Vite encaminha `/api` para o FastAPI. Assim o navegador usa uma única origem e o cookie acompanha as chamadas. A configuração fica em `frontend/vite.config.ts`.

SQLAlchemy monta consultas parametrizadas e persiste os modelos. Busca usa `ILIKE` para encontrar título, descrição e categoria; `%` e `_` digitados pelo usuário são tratados como texto literal. Isso não permite executar SQL escrito no campo de busca.

Datas ficam no PostgreSQL com fuso horário. O navegador envia o prazo em UTC e mostra a data no fuso local. Um prazo vencido é calculado ao consultar pedidos em andamento. Resolvidos e concluídos não aparecem como atrasados, mesmo com prazo passado.

## 8. O que os testes comprovam

Os sete testes de integração percorrem a API contra um PostgreSQL real. Eles verificam autorização, sessão, origem, CSRF, convites, persistência, filtros e o fluxo completo. Um deles verifica especificamente o conflito de dois aceites concorrentes. Usam um banco independente: `rastro_test`.

O build do React verifica os tipos TypeScript e gera arquivos para distribuição. A verificação no navegador testa os formulários e a passagem entre perfis fictícios. Esses controles têm propósitos diferentes: uma tela bonita não garante permissão correta, e um teste da API não garante um formulário utilizável.

## 9. Como explicar no currículo

Uma descrição fiel ao que existe:

> Desenvolvi o Rastro, aplicação web de acompanhamento de solicitações com React/TypeScript, FastAPI e PostgreSQL. Implementei autenticação por sessão, controle de acesso por papel e espaço, contexto opcional, transferência com aceite, histórico de eventos e confirmação da solução. Validei regras de negócio e concorrência com testes de integração em PostgreSQL.

Use “publicada” ou acrescente um link público apenas após uma implantação. Hoje existe uma versão local funcional. Para a próxima evolução, vale escolher uma necessidade concreta após testar o fluxo com outras pessoas: notificações, anexos ou compartilhamento de pedidos, por exemplo.
