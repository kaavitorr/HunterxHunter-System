# Separação do Celular em módulo próprio (`hunter-celular`) — Design

> Aprovado pelo usuário em 2026-07-09. Alvo: módulos Foundry do ecossistema hunter-system
> (`Data/modules/hunter-jornal`, novo `Data/modules/hunter-celular`, retoques em
> `Data/modules/hunter-economia`). Nenhuma mudança no `hunter-arquivos` nem no sistema.

## Contexto e objetivo

Hoje o celular inteiro (9 apps: Perfil, Notícias/HunterNet, HunterZap, Site Hunter, Diário,
Banco, Jogos, Fones + espelho de tela) vive dentro do **hunter-jornal**, junto com a Redação.
A camada social (fama/influência, posts, zap, site, porta única de Yen) também mora lá
(`social.mjs`), e a Economia lê de volta via `game.hunterJornal.famaDe`/`mudarYen`.

Pedido do usuário: separar o celular em um módulo próprio, onde:
- os apps de **Banco** e **Notícias** não aparecem sem Economia/Jornal respectivamente;
- a parte de **influência** (fama, seguidores, curtidas NPC, caridade) fica no celular,
  mas **depende do hunter-arquivos** — sem ele, ninguém recebe influência.

## Decisões fechadas (Q&A com o usuário)

1. **Nome**: id `hunter-celular`, título **"Celular do Caçador"** (padrão dos irmãos).
2. **Gates**: cada app com seu módulo — Banco ⇢ `hunter-economia` ativo; Notícias ⇢
   `hunter-jornal` ativo. Perfil, Zap, Diário, Jogos e Fones aparecem sempre.
3. **Site Hunter**: fica sempre, com conteúdo degradado — infos manuais do Narrador sempre
   funcionam; dossiês automáticos de famílias/nações/cidades só com Economia (guards já existem).
4. **Influência sem Arquivos**: **esconder tudo** (fama, seguidores, botão seguir, curtidas de
   NPC, aba Caridade do Banco, darFama) — nada é apagado; ativou os Arquivos, tudo volta.

## Estado atual (verificado no código)

- `hunter-jornal/scripts/`: `celular-app.mjs` (2940 l), `social.mjs` (1392 l, autocontido — só
  importa `MOD` do store), `fones-app.mjs` (243 l, importa `MOD` + `meuAtor`), `main.mjs` (393 l,
  bootstrap de TUDO), `redacao-app.mjs`, `pagina-app.mjs`, `motor.mjs` (601 l, sem imports),
  `store.mjs` (41 l, edições + `MOD`).
- Templates: `jornal-celular{,-topo,-nav}.hbs`, `jornal-fones.hbs`, `jornal-espelho.hbs`
  (celular) vs `jornal-redacao.hbs`, `jornal-pagina.hbs` (imprensa). CSS único de 1539 linhas.
- World settings (escopo `hunter-jornal`): `edicoes`, `plantao`, `nomeMundial`, `nomeLocal`,
  `procuradoUltimoMes` (imprensa) **+** `posts`, `zap`, `site`, `siteFamilias`, `fama`,
  `caridade` (social/celular). Flags de usuário: `wallpaper`, `zapVisto`, `perfilVisto`,
  `jornalVisto`, `plantaoVisto`, `diarioId`, `gmComo`.
- Socket único `module.hunter-jornal`: pedidos sociais (GM ativo grava), `fonesFalante`,
  `celularMostrar` (espelho).
- Economia → jornal: `main.mjs:249` e `vida.mjs:299` (`famaDe`), `vida.mjs:38` (`mudarYen`) —
  todos com `?.` e fallback.
- Jornal → celular interno: chat card "LER NO CELULAR" (`[data-jornal-abrir]`), Redação lê
  `Social.getPosts()` pra coluna social; `celular-app` chama `PaginaApp.abrir` (capa impressa).
- Banco já tem guard `bancoSemEco`; Site já usa `game.hunterEconomia?.…` e
  `game.hunterArquivos?.…` com fallbacks; licença Hunter tem fallback local (não é influência).

## Arquitetura alvo

### Módulo novo `hunter-celular`

```
modules/hunter-celular/
├── module.json            id hunter-celular, socket: true, relationships.systems: hunter-system
│                          (nenhum "requires" de módulo — integrações todas soft)
├── styles/hunter-celular.css     fatia do CSS (blocos do celular/fones/espelho; classes hj-* mantidas)
├── scripts/
│   ├── main.mjs           bootstrap: settings, socket module.hunter-celular, game.hunterCelular,
│   │                      hooks, migração, botão de cena "Celular do Caçador"
│   ├── store.mjs          MOD = "hunter-celular" + helpers copiados do motor: MESES, dataLabel,
│   │                      indiceBolsa, limpa (duplicação pequena e aceita p/ independência)
│   ├── social.mjs         movido na íntegra (import de MOD passa a vir do novo store)
│   ├── celular-app.mjs    movido; PaginaApp/publicadas/plantao viram chamadas à API do jornal;
│   │                      gates de apps e de influência
│   └── fones-app.mjs      movido
└── templates/
    ├── celular.hbs, celular-topo.hbs, celular-nav.hbs, fones.hbs, espelho.hbs
```

### O que fica no `hunter-jornal`

Redação, Página (capa impressa), motor de geração, edições/plantão/nomes, PROCURADOS
automáticos, botão de cena "Redação do Jornal". `main.mjs` enxuto (sem hooks do celular).
Mantém `requires: hunter-economia`. Mantém os **registros legados** dos settings sociais
(`posts`…`caridade`, `config: false`) só para a migração conseguir ler — comentados como legado.

### Gates (checagem `game.modules.get(id)?.active`, resolvida a cada render)

- `temJornal` ⇒ ícone/rota do app **Notícias** (home, gaveta, nav), badge de notícias e plim de
  edição; ação `abrirImpressa` delega a `game.hunterJornal.abrirPagina`.
- `temEconomia` ⇒ ícone/rota do app **Banco** (o guard `bancoSemEco` continua como cinto de
  segurança); no Site, as seções automáticas de mundo (já guardadas).
- `temArquivos` ⇒ **influência** (seção abaixo).
- Ações gated também bloqueiam por baixo (`#onAbrirApp` recusa app escondido) — defesa além do template.

### Influência dormente (sem `hunter-arquivos`)

- **Perfil**: esconde contadores de fama/seguidores/seguindo, botão seguir, botão do GM
  darFama; `likesNpcDoPost`/`likesNpcDe`/`seguidoresNpc` retornam 0 (curtidas reais de
  jogadores continuam); aba Caçadores esconde a contagem de seguidores.
- **Banco**: aba Caridade some (abre direto em Meus Negócios); ações `bancoDoar`,
  `bancoMensal`, `bancoOng`, `caridadeEditar` recusam.
- **Lado do GM ativo** (`social.mjs processar`): pedidos `famaDar`, doações, mensais e ONGs
  recusam sem Arquivos; `processarMesFama` vira no-op (não cobra mensais nem dá fama gradual).
- **API**: `game.hunterCelular.famaDe` devolve **1 (neutro)** — a Economia não dá boost de
  clientela/desconto por um sistema desligado; `darFama` avisa e não grava.
- **Nada é apagado**: o store `fama` fica intacto; reativar os Arquivos religa tudo.

### Dados & migração (não destrutiva)

- Movem de escopo `hunter-jornal` → `hunter-celular`: world settings `posts`, `zap`, `site`,
  `siteFamilias`, `fama`, `caridade`; flags de usuário `wallpaper`, `zapVisto`, `perfilVisto`,
  `jornalVisto`, `plantaoVisto`, `diarioId`, `gmComo`, `fones`, `fonesVol`, `jogos` (recordes);
  e o **extrato de Yen** (flag de ATOR `flags.hunter-jornal.extrato` → copiado por ator, na
  mesma passada do GM ativo). Journals de dossiê antigos guardam `siteInfoId` no escopo do
  jornal — a leitura aceita os dois escopos.
- **World**: no `ready`, o **GM ativo** copia os 6 settings se `hunter-celular.migradoDoJornal`
  for false e o jornal estiver ativo; marca o guard ao final. Originais permanecem no jornal.
- **Flags**: cada cliente copia as próprias flags (por flag: copia se a nova está `undefined`
  e a legada existe — idempotente, sem guard extra).
- Migração exige jornal + celular ativos na primeira carga pós-update (registros legados
  garantem a leitura). Sem jornal instalado: mundo começa limpo — aceito.

### APIs

- **`game.hunterCelular`** = `{ abrirCelular(app), darFama(atorId, n), famaDe(atorId),
  mudarYen(ator, delta, motivo), anotarMotivo(atorId, cat), getPosts() }`.
- **`game.hunterJornal`** = `{ abrirRedacao, abrirPagina(id), publicadas(tipo), plantao() }` +
  aliases de compatibilidade `abrirCelular/darFama/famaDe/mudarYen/anotarMotivo` delegando a
  `game.hunterCelular?.…` (macros antigas não quebram).
- **Economia** (3 pontos): `main.mjs:249` e `vida.mjs:299` → `game.hunterCelular?.famaDe`;
  `vida.mjs:38` → `game.hunterCelular?.mudarYen` (fallbacks existentes continuam).
- **Redação**: coluna social lê `game.hunterCelular?.getPosts?.() ?? []`.
- **Chat card do jornal**: "LER NO CELULAR" → `game.hunterCelular?.abrirCelular?.("noticias")`,
  senão cai na capa impressa (`PaginaApp`).
- **Celular ← jornal sem acoplamento**: o celular escuta `Hooks.on("updateSetting")` das keys
  `hunter-jornal.edicoes` e `hunter-jornal.plantao` para re-render, badge e plim — o jornal não
  referencia o celular em nada obrigatório.

### Hooks que migram para o celular

`getSceneControlButtons` (botão Celular), `updateUser` (diário criado), `updateJournalEntry*`
(render do Diário + `sincronizarJournalDossie` do Site), `updateWorldTime` (relógio),
`updateSetting hunter-economia.worldState` (render Banco/Site + `processarMesFama`),
`updateActor` yen (render Banco), avisos/plims de Zap e Perfil. O jornal mantém só os seus
(procurados, chat card, redação).

## Casos de borda

- **Jornal ativo, celular ausente**: Redação funciona, coluna social vazia, chat card cai na
  capa impressa. Aviso de "Economia ausente" do jornal continua como está.
- **Celular sozinho**: home só com Perfil (sem influência), Zap, Site (só infos manuais),
  Diário, Jogos, Fones.
- **Celular + Economia, sem Arquivos**: Banco aparece direto em Meus Negócios; sem Caridade;
  fama neutra (1) na clientela.
- **Socket muda de canal** (`module.hunter-celular`): sem impacto — todos os clientes rodam a
  mesma versão dos módulos.
- **CSS**: nomes de classe `hj-*`/`hunter-jornal-celular` **mantidos** (zero churn em template);
  só o arquivo é fatiado. Ids de janela (`hj-celular` etc.) mantidos.

## Verificação

1. `node --check` em todos os `.mjs` dos três módulos tocados.
2. Restart completo do app Foundry (F5 não recarrega `.mjs`).
3. Mundo real do usuário (dados vivos): conferir migração (posts, zap, fama, wallpaper) e
   celular funcionando igual a antes com tudo ativo.
4. Matriz de gates (desativando módulos): sem Jornal → Notícias some, resto vive; sem Economia
   → Banco some, Site degrada; sem Arquivos → influência dormente (Perfil só feed, Banco sem
   Caridade, darFama recusa); sem os três → celular básico.
5. Economia: clientela/fama e `mudarYen` (compra no Site, transferência) funcionando via nova API.
