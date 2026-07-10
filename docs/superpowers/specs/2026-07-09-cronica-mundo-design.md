# hunter-cronica — Crônica do Mundo (Skill Tree + Criador de Países) — Design

> Aprovado pelo usuário em 2026-07-09. Módulo Foundry NOVO `Data/modules/hunter-cronica`
> + API pequena no `hunter-economia`. Fonte dos dados:
> `Downloads/Criador_Paises_Universo_Athem_Foundry/` (pacote do usuário via GitHub).

## O que o usuário pediu (3 funções)

1. **Skill Tree vertical** da história do mundo: cresce indefinidamente, aceita imagens,
   e o Narrador adiciona **Eras** (com início e fim).
2. **Gerador de países/cidades** pendurado num ponto específico da árvore. Com o
   hunter-economia ativo, o país é ADICIONADO à economia com a simulação "refeita" do
   ano em que entrou — **sem simular mês a mês** (travaria o Foundry): **redistribuição
   baseada em probabilidade**.
3. **Criação completa** de países/cidades com população média, segurança, cultura,
   educação etc. + um **passado gerado** que o Narrador edita ou usa como veio.

## Decisões (Q&A)

- Id `hunter-cronica`, título "Crônica do Mundo — Hunter".
- Árvore **visível aos jogadores** com verso **secreto** por nó (padrão do pacote:
  marcos têm texto_publico/texto_secreto); nós nascem **ocultos** e o GM revela.
- Integração com **porte escolhido** (pequeno 4–6 / médio 8–12 / grande 14–20 casas,
  1–4 cidades) + **histórico em lote**.
- Índices (0–100) na ficha do país, com **influência leve só na criação**: segurança→
  máfia/situação; educação/cultura→viés de setores; população→nº de casas no porte.
- Confirmados: eventos retroativos SÓ na janela de 24 meses (ECO.MESES_MEMORIA — o
  resto do passado vive na Crônica); anos no calendário **Gênesis**, cronologia de
  Athem convertida como texto do nó.

## Verificado no código/dados

- **Pacote**: `criador-paises-athem.json` (681KB) — `lore_base.cronologia` (9 marcos
  fixos do mundo), `varja_akai` (ficha), 14 eras, 18 arquétipos (perfil: governo,
  economia, segredo, relacao_g5, traços), 756 marcos (arquetipo×era×variante, público+
  secreto, pessoa_principal 1–14), 30 legados, 30 ganchos, 20 mitos. Gerador com **RNG
  determinístico por seed** (`generate({archetypeId, seed, placeholders, includeSecrets,
  includeNen, includeDarkContinent, legacyCount, hookCount})`).
- **Economia**: entidades carregam `entradaAbs` retroativo (gen.mjs baseEntidade — idade
  1–40 anos); `gerarNPC(state, tier)` = receituário completo (setor sorteado com peso,
  legalidade/máfia, nomes por PRENOMES/SOBRENOMES, líquido log-uniform por tier,
  volatilidade); `logEvento(state, ev)` aceita `ev.mesAbs` retroativo (spread override)
  e poda além de 24 meses; `situacaoLocal` deriva dos últimos 6 meses; nações/cidades
  DERIVAM de `pais_sede`/`cidade` das entidades (paraSiteNacoes/Cidades pegam país novo
  de graça); `REGIOES` é `export const` array (mutável em runtime, não persistido);
  `Store.saveState`, `Store.salvarUndoEvento` (snapshot p/ desfazer) existem.

## Implementação

### Estrutura do módulo
```
modules/hunter-cronica/
├── module.json          id hunter-cronica, requer hunter-system; economia é soft
├── styles/hunter-cronica.css
├── data/
│   ├── criador-paises-athem.json   (copiado do pacote)
│   └── lore-athem.json             (LORE_ATHEM_E_VARJA.json copiado)
├── scripts/
│   ├── main.mjs         settings (arvore, paises), seed inicial da árvore, botões
│   │                    de cena (Crônica p/ todos; criador é interno GM), API
│   │                    game.hunterCronica { abrir }
│   ├── store.mjs        MOD, get/set arvore e paises, helpers (temEconomia, anoGenesis)
│   ├── gerador.mjs      port do AthemCountryHistoryGenerator (lazy fetch + cache) +
│   │                    resolvedor das pessoas 1–14 (PRENOMES/SOBRENOMES da economia
│   │                    via import dinâmico, fallback embutido)
│   ├── cronica-app.mjs  a árvore + ficha do país + criador (uma ApplicationV2 com
│   │                    views: arvore | pais | criador — padrão do archive-app)
│   └── (sem app extra: o criador é view interna)
└── templates/
    ├── cronica-shell.hbs, cronica-arvore.hbs, cronica-pais.hbs, cronica-criador.hbs
```

### Dados (world settings, escopo hunter-cronica)
- `arvore`: `{ eras: [{id, nome, inicio, fim|null, img, publico, secreto, oculta}],
  nos: [{id, eraId, ano, titulo, publico, secreto, img, oculto, tipo:"manual"|"pais"|
  "cidade", paisId, ordem}] }`. Ordenação: era por `inicio`, nó por `ano` (empate:
  `ordem`). Só o GM escreve (UI GM-gated; jogador só lê).
- `paises`: `[{id, nome, arquetipoId, seed, porte, indices{populacao,seguranca,cultura,
  educacao}, cidades:[string], anoEntrada, noId, ecoIntegrado, mito, legados[],
  ganchos[], perfil{...}, pessoas{p1..p14}, historia:[{eraId, eraNome, publico,
  secreto}] (EDITÁVEL — o gerado é só o ponto de partida)}]`.
- `arvoreSemeada` (bool): primeira carga cria a Era "Antes do Gênesis" (fim = ano 0) e
  a Era "Calendário Gênesis" (início 0, fim aberto), com os 9 marcos da
  `lore_base.cronologia` como nós OCULTOS da primeira era (público+secreto do pacote;
  anos de Athem viram texto no título/ano do nó).

### CronicaApp (janela grande, padrão retrô da casa)
- **View árvore**: coluna central vertical; ERAS como bandas (cabeçalho com nome +
  `inicio–fim` ou `inicio–hoje`; GM: editar/fechar era, "+ Era"); NÓS como cartões
  alternando lado (ano Gênesis, título, imagem opcional via FilePicker, texto público
  enriquecido). GM extra: verso secreto (dobra no cartão), olhinho oculto/revelado,
  editar, apagar, "+ nó" na era. Jogador: só eras/nós revelados, sem controles.
- **View país** (ficha): cabeçalho (nome, arquétipo, ano de entrada, cidades, selo
  "integrado à economia" quando for), índices 0–100 (input GM), perfil do arquétipo,
  mito, história por era (público sempre; secreto só GM; textarea no modo edição),
  legados/ganchos (listas editáveis), pessoas 1–14. Botões GM: EDITAR/SALVAR,
  REGERAR (mesmo seed = mesma história; seed novo sorteia), INTEGRAR NA ECONOMIA
  (se ainda não), ABRIR NÓ NA ÁRVORE.
- **View criador**: nome, arquétipo (select 18 + aleatório), seed (texto; vazio =
  aleatório), porte, cidades (textarea 1–4 nomes; vazio = gera "Cidade de X"),
  índices (4 sliders 0–100), ano de entrada + era alvo, toggles (segredos/Nen/
  Continente Negro), checkbox "Integrar na Economia Mundial" (visível se ativa).
  GERAR PASSADO → preview editável → CRIAR (salva ficha + nó + integra se marcado).
- Cidade avulsa: o criador também aceita "só uma cidade" (tipo cidade: nó + entrada
  no pool de regiões de um país EXISTENTE da economia, sem ficha de arquétipo).

### gerador.mjs
- Port fiel do generator do pacote (seeded RNG, choose/sample/replace) + placeholders:
  `[nome do país]` e `[nome da pessoa 1..14]` resolvidos com PRENOMES/SOBRENOMES da
  economia (import dinâmico, fallback embutido de ~20 nomes). Pessoas ficam salvas na
  ficha (`pessoas`) pra edição.

### Integração econômica — `game.hunterEconomia.fundarPais(spec)` (main da economia)
`spec = { nome, cidades:[{cidade, tipo}], nCasas, mafiaPct, entradaAbs, viesSetores:
{pesquisa: 1.x, arte: 1.x}, texto }`. GM-only. Passos:
1. `Store.salvarUndoEvento(snapshot, "Fundação de <nome>")` — reversível.
2. `state.regioesExtras = [...existentes, ...cidades novas]` + `REGIOES.push(...)`
   das que ainda não existem (dedup por cidade+pais).
3. Cria `nCasas` entidades com o receituário do gerarNPC, MAS: região travada nas
   cidades novas (round-robin), tiers sorteados por porte (sem magnata; 1 "âncora"
   rica em porte grande), `entradaAbs` = spec.entradaAbs (idade real na árvore),
   riqueza log-uniform escalada por `clamp(idadeAnos/40, 0.35, 1.15)` — país novo
   em folha nasce mais pobre que um centenário. `mafiaPct` alvo respeitando o teto
   de 55% (reaproveita a régua do espalharMafia localmente). SEM recalibrar o mundo
   (os outros países não mudam).
4. Viés de setores: multiplicador de peso no sorteio (educação→Pesquisa/Tecnologia…,
   cultura→Arte/Entretenimento… — casa com os nomes reais de SETORES_LEGAIS).
5. **Histórico em lote**: 2–5 eventos retroativos (quantidade e sinal enviesados
   pelos índices: segurança baixa puxa ondaRoubos/atentado; educação alta puxa
   descoberta…) com `mesAbs` sorteado nos últimos 24 meses (≥ entradaAbs) — os dos
   últimos 6 meses moldam a situação atual. + 1 evento ATUAL "🌍 NOVO NO MAPA:
   <nome> — <texto>" (tipo "entrada", escopo "pais", origem "cronica").
6. `Store.saveState(state)`.
- Economia `ready`: re-injeta `state.regioesExtras` em REGIOES (persistência entre
  sessões). paraJornal NÃO filtra origem "cronica" (a chegada do país É notícia).

### Fora do escopo (registrado)
- Editar a economia de um país já integrado pela ficha (os índices pós-criação são
  narrativos; a simulação normal manda).
- Mapa visual/posicionamento geográfico; exportar pro Site Hunter (já acontece de
  graça via dossiês de nações).
- Migração de países pré-existentes da economia pra fichas da Crônica (dá pra criar
  nó manual apontando, sem ficha).

## Verificação
1. `node --check` em tudo; restart completo.
2. Primeira carga: árvore semeada com a cronologia de Athem (nós ocultos, verso
   secreto ok); revelar um nó → jogador passa a ver.
3. Criar era nova (início/fim), nós manuais com imagem, crescer a árvore.
4. Criador: mesmo seed → mesma história; preview editável; CRIAR pendura o nó.
5. Integração: casas nascem nas cidades novas com idade certa (entrada retroativa),
   máfia ~alvo, situação da cidade coerente com os eventos em lote; timeline mostra
   o lote; undo da economia reverte a fundação; jornal noticia a chegada; Site
   Hunter lista a nação nova; entrada futura de mercado pode nascer lá
   (regioesExtras persistido).
6. Sem economia: tudo funciona menos a integração (checkbox some).
