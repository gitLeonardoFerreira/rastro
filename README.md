<p align="center">
  <img src="docs/assets/rastro-cover.svg" alt="Rastro — Cada solicitação, um próximo passo." width="100%" />
</p>

<p align="center">
  <strong>Quem ficou responsável? O que falta fazer? O pedido foi mesmo resolvido?</strong><br />
  O Rastro organiza essas respostas e preserva o caminho de cada solicitação.
</p>

<p align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&amp;logoColor=white" />
  <img alt="FastAPI" src="https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&amp;logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/Interface-React-149ECA?logo=react&amp;logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&amp;logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/Banco-PostgreSQL-4169E1?logo=postgresql&amp;logoColor=white" />
</p>

<p align="center">
  <a href="#o-problema">O problema</a> ·
  <a href="#como-funciona">Como funciona</a> ·
  <a href="#o-que-já-funciona">Funcionalidades</a> ·
  <a href="#executar-o-projeto">Executar</a> ·
  <a href="#entender-o-código">Entender o código</a>
</p>

---

## O problema

“Já mandei a mensagem.” Nem sempre isso significa que alguém está cuidando do pedido.

Em uma equipe, solicitações podem se perder entre conversas, e-mails e transferências. Uma pessoa acha que outra assumiu; quem pediu não sabe a quem procurar; quem recebeu não tem todo o contexto. Mesmo quando alguém resolve, o resultado pode não chegar ao solicitante.

O **Rastro** transforma essa conversa em um pedido acompanhável: registra o que precisa acontecer, quem assumiu, qual é o próximo passo e se a solução foi confirmada.

### Mais que objetos

Um pedido pode tratar de acesso a um sistema, revisão de um documento, contratação de um serviço, etapa de um processo ou manutenção de um equipamento. Ele pode existir sozinho ou estar ligado a um **contexto**, uma referência que reúne assuntos relacionados.

| Contexto | Exemplo de solicitação |
| --- | --- |
| Sistema | Liberar acesso ao repositório de um projeto |
| Documento | Conferir a nova versão de um contrato |
| Processo | Preparar a entrada de um novo colaborador |
| Serviço | Revisar um orçamento antes da aprovação |
| Objeto | Substituir o toner de uma impressora |
| Equipe | Organizar uma revisão das instruções internas |

A categoria também é livre. A ideia é acompanhar a responsabilidade sobre um pedido, qualquer que seja seu assunto.

## Como funciona

Imagine que Bruno precisa de acesso a um projeto:

1. **Bruno registra o pedido.** Descreve o que precisa, define um prazo e escolhe a prioridade.
2. **O pedido é encaminhado para Marina.** A transferência fica registrada, com um motivo.
3. **Marina confirma o aceite.** A partir desse momento, fica explícito que ela assumiu.
4. **Marina registra o andamento.** Se precisar esperar, explica por quê e informa o próximo passo.
5. **Marina descreve a solução.** O pedido aguarda a confirmação de Bruno.
6. **Bruno confirma o resultado.** O pedido é concluído. Se o problema continuar, ele pode reabrir.

> **Encaminhar não é assumir. Resolver não é confirmar.** Esses momentos são separados para evitar que um pedido pareça atendido antes da hora.

A interface usa verde e cinza claro, com navegação horizontal, transições discretas e suporte a movimento reduzido. A tela principal mostra os pedidos em uma caixa de solicitações. Ao abrir um deles, aparecem o próximo passo, as pessoas envolvidas e a linha do tempo do que aconteceu. Os filtros **Sem aceite** e **Prazo vencido** ajudam a encontrar pedidos que precisam de atenção.

## O que já funciona

| Recurso | Para que serve |
| --- | --- |
| Cadastro e login | Entrar em um espaço de trabalho próprio |
| Convites por link | Trazer pessoas para a mesma equipe, com um papel definido |
| Pedidos com prazo e prioridade | Registrar o resultado esperado e a urgência |
| Contextos opcionais | Reunir solicitações sobre o mesmo assunto |
| Encaminhamento com motivo | Explicar a passagem de responsabilidade |
| Aceite explícito | Confirmar quem assumiu o atendimento |
| Andamento e espera | Deixar claro o que aconteceu e o que vem a seguir |
| Resolução, confirmação e reabertura | Acompanhar o resultado até o solicitante validar |
| Histórico e comentários | Consultar autoria, datas e informações do pedido |
| Busca, filtros e paginação | Encontrar pedidos sem carregar toda a base de uma vez |
| Interface responsiva | Usar as telas em computador ou celular |
| Transições e feedback | Perceber abertura de janelas, mudanças de tela e confirmação das ações |

### Quem pode fazer o quê?

| Papel | Acesso |
| --- | --- |
| **Solicitante** | Abre e acompanha seus próprios pedidos; comenta, confirma a solução e reabre |
| **Responsável** | Consulta pedidos do espaço, assume, atende, encaminha e cadastra contextos |
| **Administrador** | Também gerencia convites, encaminhamentos e confirmações dentro do espaço |

O administrador precisa assumir um pedido para atualizar seu atendimento. Espaços diferentes ficam separados: uma equipe não consulta os pedidos de outra.

## Experimentar a demonstração

Com a aplicação em execução, abra **http://127.0.0.1:5173** e clique em **Explorar demonstração**.

O espaço de exemplo tem dados fictícios. O seletor no topo permite alternar entre os três papéis e acompanhar a passagem de um pedido de uma pessoa para outra. As alterações feitas na demonstração ficam salvas.

| Perfil | E-mail | Senha da demonstração |
| --- | --- | --- |
| Leo · administrador | `leo@rastro.demo` | `RastroDemo!2026` |
| Marina · responsável | `marina@rastro.demo` | `RastroDemo!2026` |
| Bruno · solicitante | `bruno@rastro.demo` | `RastroDemo!2026` |

**Um roteiro de dois minutos:** entre como Leo, registre um pedido e encaminhe para Marina. Troque para Marina, confirme o aceite e registre a solução. Volte a Leo para confirmar o resultado e consulte a linha do tempo.

Para testar com outra pessoa, use **Pessoas → Convidar pessoa**. O convite vale por 48 horas, é vinculado ao e-mail informado e só pode ser utilizado uma vez. O link é compartilhado manualmente; esta versão não envia e-mails.

## Executar o projeto

### O que precisa estar instalado

- **Python 3.12+** — executa o servidor da aplicação.
- **Node.js 22.12+ e npm** — executam e constroem a interface.
- **PostgreSQL 16+** — guarda os usuários, pedidos e histórico.

O projeto foi verificado com Python 3.12, Node.js 24 e PostgreSQL 18.6. Os comandos abaixo partem da pasta principal do projeto e usam um terminal macOS/Linux.

### 1. Preparar o banco

Crie um banco chamado `rastro` e um usuário com acesso a ele. Se já possui PostgreSQL, pode usar sua instalação.

Como alternativa, há um arquivo Compose para iniciar o banco com Docker. Defina uma senha no ambiente e execute:

```sh
export POSTGRES_PASSWORD='escolha-uma-senha-local'
docker compose up -d
```

Essa alternativa usa a porta `5432`, o usuário `rastro_app` e um volume persistente. Docker é opcional; o desenvolvimento local foi validado com PostgreSQL instalado diretamente.

### 2. Instalar as dependências

Crie um ambiente Python separado para o projeto e instale as bibliotecas:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.lock.txt
```

Instale as dependências da interface:

```sh
cd frontend
npm ci
cd ..
```

### 3. Configurar a conexão

```sh
cp backend/.env.example backend/.env
```

Abra `backend/.env` e ajuste `DATABASE_URL` com o usuário, senha, endereço e banco do seu PostgreSQL:

```dotenv
DATABASE_URL=postgresql+psycopg://rastro_app:SUA_SENHA@127.0.0.1:5432/rastro
ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000
COOKIE_SECURE=false
DEMO_ENABLED=true
```

`DEMO_ENABLED=true` habilita a demonstração. Use `false` para trabalhar apenas com contas próprias. Se a senha tiver caracteres especiais, codifique-os para uso em URL. O `.env` fica fora do Git.

### 4. Iniciar

```sh
./scripts/dev.sh
```

| Endereço | O que abre |
| --- | --- |
| http://127.0.0.1:5173 | Aplicação Rastro |
| http://127.0.0.1:8000/docs | Documentação interativa da API |

Mantenha o terminal aberto enquanto utiliza a aplicação. **Ctrl+C** encerra os dois serviços. As tabelas iniciais são criadas automaticamente quando a API inicia.

### 5. Carregar os exemplos — opcional

Com `DEMO_ENABLED=true`, em outro terminal:

```sh
cd backend
../.venv/bin/python -m app.seed
```

O comando insere o espaço fictício. Executá-lo novamente não sobrescreve os exemplos existentes.

<details>
<summary><strong>Prefere iniciar cada parte separadamente?</strong></summary>

No primeiro terminal:

```sh
cd backend
../.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

No segundo terminal:

```sh
cd frontend
npm run dev
```

</details>

## Entender o código

O projeto tem três partes principais:

```text
Interface React → API Python → Banco PostgreSQL
```

- **React** mostra a tela, recebe os dados dos formulários e faz as solicitações ao servidor.
- **FastAPI** verifica quem está conectado, valida as informações e decide se a ação é permitida.
- **PostgreSQL** mantém os registros salvos, inclusive depois de fechar ou recarregar a página.

**API** é a ponte pela qual a interface conversa com o servidor. Por exemplo: ao clicar em “Assumir pedido”, o React envia uma requisição; o Python verifica as regras; o banco registra o responsável e o acontecimento; a interface mostra o novo estado.

```text
rastro/
├── backend/
│   ├── app/
│   │   ├── main.py            # Endpoints e regras das solicitações
│   │   ├── models.py          # Tabelas e relacionamentos do banco
│   │   ├── schemas.py         # Validação dos dados recebidos
│   │   ├── security.py        # Senhas, sessões e permissões
│   │   ├── db.py              # Conexão com o PostgreSQL
│   │   └── seed.py            # Dados fictícios da demonstração
│   └── tests/                # Testes de integração
├── frontend/
│   └── src/
│       ├── App.tsx            # Navegação, busca e lista de pedidos
│       ├── Auth.tsx           # Login e cadastro
│       ├── TicketDetail.tsx   # Histórico e atendimento do pedido
│       ├── Forms.tsx          # Formulários e janelas
│       ├── Team.tsx           # Pessoas e convites
│       ├── api.ts             # Comunicação com a API
│       └── styles.css         # Aparência e adaptação das telas
├── docs/                     # Guia de funcionamento
├── scripts/                  # Inicialização e verificação
└── compose.yml               # PostgreSQL com Docker, opcional
```

Para começar, leia [o guia de funcionamento](docs/COMO_FUNCIONA.md). Ele explica o modelo de dados, os estados, o login e o caminho de uma requisição com mais detalhes.

### Algumas decisões importantes

- As senhas são armazenadas como **hash Argon2**, não como texto legível.
- O login usa um cookie **HttpOnly**, com expiração e proteção CSRF nas alterações.
- As permissões são verificadas na API, além dos controles da interface.
- Mudança de estado e evento do histórico são gravados na mesma transação.
- Um bloqueio de linha no PostgreSQL impede que duas pessoas assumam o mesmo pedido ao mesmo tempo.

## Testes e qualidade

Os testes de integração usam PostgreSQL real em um banco separado chamado **`rastro_test`**. Eles verificam:

- Login, sessão, logout, origem e proteção CSRF.
- Permissões e isolamento entre espaços.
- Fluxo do pedido, transferência, confirmação, reabertura e histórico.
- Convites, validade e vínculo ao e-mail.
- Duas tentativas simultâneas de assumir o mesmo pedido.
- Busca, filtros, paginação e validação das entradas.
- Limite de tentativas de login.

Crie `rastro_test` com um usuário autorizado e execute:

```sh
export TEST_DATABASE_URL='postgresql+psycopg://usuario:senha@127.0.0.1:5432/rastro_test'
./scripts/check.sh
```

> Os testes recriam as tabelas de `rastro_test`. Use um banco dedicado e descartável. O comando recusa uma URL cujo banco tenha outro nome; não utiliza o banco normal do aplicativo.

A verificação executa os testes da API e o build do React. O build confere os tipos TypeScript e gera os arquivos da interface para distribuição. A primeira versão também foi percorrida pelo navegador, do registro à confirmação do pedido.

Para conferir a formatação da interface:

```sh
cd frontend
npm run format:check
```

## Estado do projeto

**Versão 0.1: aplicação local funcional.** Ainda não há uma implantação pública.

Os próximos recursos previstos são recuperação de senha por e-mail, anexos, notificações, edição de prazos e atualização em tempo real. A indicação de prazo vencido aparece ao consultar os pedidos; esta versão não envia cobranças automáticas.

Para publicação, ainda precisam ser configurados HTTPS, cookies seguros, migrações e backups. A demonstração com credenciais conhecidas deve ser desabilitada, e o limite de login em memória deve evoluir para uma solução compartilhada entre processos. O histórico preserva acontecimentos pela aplicação, mas não é uma trilha criptograficamente inviolável.

---

<p align="center">
  <strong>Um pedido só deixa de ser esquecido quando seu próximo passo fica claro.</strong>
</p>
