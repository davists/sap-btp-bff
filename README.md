# sap-btp-bff

BFF (Backend-for-Frontend) mínimo no **SAP BTP trial**. Grava qualquer dado no
**HANA Cloud** e exibe num frontend que acessa o BFF de forma **segura** usando
serviços nativos do BTP (App Router + XSUAA + Cloud Identity Services).

## Arquitetura

Dois microserviços que se comunicam no Cloud Foundry:

```
Browser
   │  (login OIDC via Cloud Identity Services, sessão em cookie)
   ▼
bff-web  ── App Router + Frontend estático + BFF (Express)   [público]
   │  (JWT injetado pelo App Router; o browser nunca vê o token)
   ▼
bff-api  ── API + acesso a dados (Express)                   [interno]
   │
   ▼
HANA Cloud (tabela ITEMS)
```

- **`bff-web`** é o único app público. O App Router faz o login OAuth2/OIDC
  contra o XSUAA (que confia no Cloud Identity Services), guarda a sessão num
  cookie HTTP-only e injeta o JWT nas chamadas `/api/**`. O BFF (mesmo processo)
  valida esse JWT com `@sap/xssec` antes de repassar para a API.
- **`bff-api`** só tem rota **interna** (`bff-api.apps.internal`). Só o `bff-web`
  a alcança, via network policy. Ela conecta no HANA e faz as queries
  parametrizadas.
- **Logging**: nativo do SAP. Os apps escrevem em stdout/stderr; o serviço
  `application-logs` bindado captura tudo. Sem biblioteca de log no código.

## Estrutura

```
.
├── api/                  # Microserviço interno (API + HANA)
│   └── src/
│       ├── server.js         # bootstrap
│       ├── app.js            # rotas: GET /health, GET/POST /items
│       ├── config.js         # credenciais HANA (env ou VCAP_SERVICES)
│       └── repository/       # camada de dados
│           ├── index.js          # factory (HANA ou in-memory)
│           ├── hanaRepository.js  # @sap/hana-client, SQL parametrizado
│           └── memoryRepository.js# fallback em memória (dev/testes)
├── web/                  # Monólito público (App Router + Front + BFF)
│   ├── src/
│   │   ├── server.js         # entry: BFF + App Router num só processo
│   │   ├── bffServer.js      # sobe o BFF (com/sem auth)
│   │   ├── bff.js            # rotas /api/items -> API interna
│   │   ├── auth.js           # middleware XSUAA (xssec + passport)
│   │   └── config.js
│   ├── public/           # frontend estático (index.html, app.js, styles.css)
│   └── xs-app.json       # rotas do App Router
├── xs-security.json      # descritor XSUAA (scopes/roles)
├── manifest.yml          # deploy CF (caminho principal)
├── deploy.sh             # script de deploy (serviços + push + rede)
└── mta.yaml              # deploy via MTA (alternativa)
```

## Rodar localmente

Sem HANA e sem XSUAA (a API cai no repositório em memória e o BFF roda sem auth):

```bash
# terminal 1 - API
cd api && npm install && npm start          # porta 4001

# terminal 2 - BFF (auth desligada só para dev local)
cd web && npm install && AUTH_ENABLED=false npm run start:bff   # porta 5001
```

> `start:bff` roda apenas o BFF (sem App Router). Veja o script abaixo.

Testar:

```bash
curl -X POST http://127.0.0.1:5001/api/items \
  -H 'content-type: application/json' -d '{"nome":"Ana","idade":30}'
curl http://127.0.0.1:5001/api/items
```

Aceita também texto puro: `-d '"um texto qualquer"'`.

### Rodar contra o HANA real (local)

Baixe uma *service key* da instância HANA e exporte:

```bash
export HANA_HOST=<host>.hanacloud.ondemand.com
export HANA_PORT=443
export HANA_USER=<user>
export HANA_PASSWORD=<password>
cd api && npm start
```

## Testes

```bash
cd api && npm test    # repositório + rotas (6 testes)
cd web && npm test    # BFF (relay/erros) + auth (401/403) (8 testes)
```

## Deploy no Cloud Foundry (trial)

Pré-requisitos:

1. **cf CLI v8+** instalado.
2. Login na trial:
   ```bash
   cf login -a https://api.cf.us10-001.hana.ondemand.com
   # org: efbc829etrial   space: dev
   ```
3. **HANA Cloud** provisionado e **rodando** no space (a instância trial
   hiberna; inicie-a no BTP Cockpit ou no HANA Cloud Central antes do deploy).

Deploy (caminho principal):

```bash
./deploy.sh
```

O script:
1. cria `bff-xsuaa` (a partir de `xs-security.json`), `bff-logs`
   (application-logs) e `bff-hana` (hana / hdi-shared);
2. espera os serviços ficarem prontos;
3. `cf push --no-start`;
4. mapeia a rota **interna** `bff-api.apps.internal` e abre a network policy
   `bff-web -> bff-api` (tcp 8080);
5. inicia os apps e imprime a URL pública.

Passo manual único depois do deploy: no **BTP Cockpit → Security → Role
Collections → `BFFViewer`**, adicione seu usuário. Sem isso o login funciona
mas o token não terá o scope `Read` (o BFF responde 403).

### Alternativa via MTA

```bash
npm i -g mbt        # Cloud MTA Build Tool
mbt build
cf deploy mta_archives/sap-btp-bff_1.0.0.mtar
# depois: cf add-network-policy bff-web bff-api --protocol tcp --port 8080
```

## Logging (nativo SAP)

Sem SDK de log. Os apps usam `console.log`/`console.error` (stdout/stderr) e o
serviço `application-logs` bindado captura tudo:

```bash
cf logs bff-web --recent
cf logs bff-api --recent
cf logs bff-web            # streaming
```

## Segurança — checklist

- O frontend nunca manipula o token; o App Router mantém a sessão em cookie e
  injeta o JWT internamente.
- O BFF valida o JWT (`@sap/xssec`) e exige o scope `Read` em `/api/**`.
- A API é **interna** (`apps.internal`), sem rota pública; só o `bff-web` a
  alcança via network policy.
- Queries HANA são **parametrizadas** (sem concatenar SQL); o nome da tabela é
  validado como identificador.
- Credenciais nunca são commitadas (`.gitignore` cobre `.env` e
  `default-env.json`).

## Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Login OK mas `/api/items` responde **403** | usuário sem a role collection | adicionar `BFFViewer` ao usuário no Cockpit |
| BFF responde **502/504** | API interna fora do ar ou network policy ausente | `cf app bff-api`; recriar policy tcp 8080 |
| `bff-api` não sobe | HANA hibernando ou binding falhou | iniciar a instância HANA; `cf restage bff-api` |
| `create-service hana` falha | plano/entitlement | confira o entitlement de HANA no Cockpit (hana / hdi-shared) |
| Erro de OIDC trust no login | trust XSUAA ↔ Cloud Identity Services | Security → Trust Configuration (estabelecer confiança OIDC) |

## Dados da conta (trial)

- Endpoint CF: `https://api.cf.us10-001.hana.ondemand.com`
- Org: `efbc829etrial` · Space: `dev` · Região: AWS us10
- Limite de memória: 4.096 MB (esta app usa ~640 MB: web 384M + api 256M)
