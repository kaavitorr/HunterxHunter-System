# Aba "Dossiês" no Arquivos Hunter — Design

> Aprovado pelo usuário em 2026-07-09 (com o ajuste de censura). Alvo:
> `Data/modules/hunter-arquivos` (não é repo git). Nenhuma mudança em outros módulos.

## Contexto e objetivo

O fichário "Arquivos da Associação" tem hoje Bestiário (criatura), Pessoas (pessoa),
Outros (outro) e Missões. O usuário quer um novo tipo, **Dossiê**: arquivos que carregam
**várias páginas** — fotos, informações por escrito etc.

## Decisões fechadas (Q&A)

1. **Escrita das páginas: só o Narrador.** Em documentos tipo `dossie`, jogador não cria,
   edita nem anexa páginas (nos demais tipos continua como hoje: registros de campo de
   qualquer jogador, moderados pelo Narrador).
2. **Capa = ficha completa**, como os outros tipos: campos estruturados próprios + tarjas.
3. **Páginas**: as duas existentes (Anotações texto+fotos; Anexos com links) **+ página
   FOTO nova** — imagem grande emoldurada + legenda (disponível em todos os tipos de doc).
4. **Visibilidade: pelo selo do documento** (OCULTO/publicado) — publicou, ficha e todas
   as páginas aparecem. **PORÉM: a censura inline `[trecho]` se mantém nas páginas** —
   o que o Narrador deixou entre colchetes continua tarjado pros jogadores (ajuste do usuário).

## Estado atual (verificado no código)

- Cada arquivo = `JournalEntry` sem páginas, dados em `flags["hunter-arquivos"]`
  (`tipo, numero, actorUuid, img, published, fields, redacted`). Publicação =
  `ownership.default NONE↔OBSERVER` (store.mjs `setPublished`).
- Tipos/pastas/campos em `store.mjs`: `TIPOS`, `FIELD_DEFS` (gera formulário e render),
  `docCode` (letra por tipo), `createDoc` (semeia por Actor), `ensureFolders`.
- **Páginas** já existem por documento: vivem no journal "Notas de Campo"
  (`flag paginas`, cada página com `target` = uuid do doc, `kind` = `anotacoes`/`anexos`,
  `addedBy`). `#buildPages(target)` monta; `pageNav.canAdd = !!notesJournal()`; remoção
  só do autor ou GM; edição pelo fluxo `editingPage`.
- **Redação**: `redact.mjs` — `redactInline(text, reveal)` e `redactHTML(html, reveal)`
  (tarja o que está entre `[colchetes]`; `reveal=true` mostra com contorno). Nos campos
  da ficha, `reveal = this.gmView` (archive-app.mjs:398). As páginas hoje são
  enriquecidas SEM redação (`#enrichPageContent`, archive-app.mjs:203/792).
- Abas do fichário são **hardcoded** em `files.hbs` (criatura/pessoa/outro nas linhas
  60-68; Missões em botão à parte). Contagens da mesa em `desk.hbs` (cards por pasta).
- Selects de campo usam nome de dicionário (`options: "perigo"|"rank"|"especime"|"status"`),
  resolvidos no archive-app.

## Mudanças

### store.mjs
- `TIPOS.dossie = { label: "Dossiês", singular: "Dossiê", pasta: "Dossiês", icone: "fa-solid fa-folder-open" }`.
- `SIGILO_OPTS = { publico: "Público", restrito: "Restrito", confidencial: "Confidencial", ultra: "Ultrassecreto" }`.
- `FIELD_DEFS.dossie`:
  `assunto` (text, "Tema do dossiê — caso, organização, evento…") ·
  `origem` (text, "Origem da Informação") ·
  `sigilo` (select `sigilo`) ·
  `envolvidos` (textarea, "Envolvidos Conhecidos") ·
  `descricao` (textarea rich, "Resumo do Caso") ·
  `notas` (textarea, "Notas da Associação").
- `docCode`: letra `D` (→ `ARQ-D-001`).

### archive-app.mjs
- Resolver de options: registrar `sigilo` → `SIGILO_OPTS`.
- Mesa (desk): contagem de dossiês + card próprio.
- **Gate GM-only nas páginas de dossiê**: `pageNav.canAdd` vira
  `notesJournal() && (doc não é dossie || isGM)`; guards espelhados em `#onAddPage`
  e nos handlers de drop de anexo quando o doc aberto é dossie.
- **Página FOTO**: opção nova no diálogo de tipo de página (`kind: "foto"`, campos
  `img`, `caption`); `#buildPages` expõe `isFoto`, `img`, `caption`; edição com
  FilePicker (imagem) + inputs de título/legenda; salvar grava no flag `paginas`.
- **Censura nas páginas de dossiê**: quando o doc aberto é `dossie`,
  `contentHtml = redactHTML(await enrich(...), this.gmView)` e, na FOTO,
  título/legenda passam por `redactInline(..., this.gmView)`. Páginas de docs
  não-dossiê seguem SEM redação (comportamento atual preservado — são notas de
  jogador, e `[colchetes]` neles não deve virar tarja de surpresa).

### Templates
- `files.hbs`: aba **DOSSIÊS** na fileira (mesmo padrão das outras três).
- `desk.hbs`: card/pasta com contagem de dossiês.
- `doc-pagenav.hbs`: ícone `fa-image` para páginas FOTO.
- `doc-page.hbs`: branch `isFoto` — visualização (moldura estilo polaroid presa no
  fichário + legenda) e edição (picker de imagem, título, legenda).

### CSS (styles/hunter-arquivos.css)
- Estilo da página FOTO (moldura clara, sombra, leve rotação, legenda datilografada) e
  ajustes mínimos da aba nova.

## Casos de borda
- Dossiê sem páginas: só a ficha (pageNav mostra "Principal" e, pro GM, "+ Página").
- FOTO sem imagem definida: placeholder com ícone (GM vê o botão de escolher).
- Arquivos antigos: nada muda (páginas de jogador continuam graváveis e sem redação).
- Journal "Notas de Campo" inexistente: `canAdd` já bloqueia (comportamento atual).
- Jogador com dossiê aberto não vê "+ Página" nem consegue dropar anexos nele.

## Verificação
1. `node --check` nos `.mjs` tocados.
2. Restart completo do app (F5 não recarrega `.mjs`).
3. GM: criar Dossiê (aba nova + card na mesa), preencher ficha (tarjas por campo ok),
   criar uma página de cada tipo (FOTO com imagem + legenda com `[trecho censurado]`),
   publicar.
4. Jogador: vê o dossiê publicado, ficha com tarjas, páginas visíveis, `[trechos]`
   TARJADOS no texto e na legenda da foto, sem botão "+ Página", drop recusado.
5. Arquivo antigo (criatura): jogador ainda adiciona registro de campo normalmente.
