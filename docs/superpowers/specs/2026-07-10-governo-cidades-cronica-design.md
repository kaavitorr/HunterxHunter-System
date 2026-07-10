# Governo definível + Criador de Cidades (hunter-cronica ↔ hunter-economia)

Data: 2026-07-10 · Status: aprovado (4× Recommended no AskUserQuestion)

## 1. Governo do país
- Select no Criador de Países: `— sorteado do arquétipo —` (padrão) + lista fixa
  (república democrática, democracia parlamentar, ditadura militar, ditadura civil,
  regime comunista, monarquia absolutista, monarquia constitucional, oligarquia,
  teocracia, tecnocracia, plutocracia corporativa, confederação de clãs).
- A escolha **tinge a história**: `comporPassado`/`gerarPassado` ganham opt `governo`
  que substitui o sorteio — o mecanismo `rxGoverno` já troca o valor assado nos marcos.
- Persistido em `pais.governoManual`; REGERAR repassa. Na ficha (edição), campo de
  texto em PERFIL atualiza `perfil.governo` + `governoManual`.

## 2. Cidades ricas (na ficha do país)
- Novo array `pais.cidadesFicha[]`: `{ id, nome, habitantes, indices{tecnologia,
  educacao, saude, seguranca, sociais}, problemas[keys], ganchos[], ecoIntegrada }`.
  `pais.cidades` (strings) continua fonte de nomes p/ economia — criar cidade rica
  faz push nos dois.
- Views novas no app: `cidadeNova` (criador) e `cidade` (ficha própria, editável).
  Chips de cidade na ficha do país; chip com ficha abre a view.
- Índices 0–100 com o mesmo padrão de slider+faixa+dica dos índices nacionais.
- **Problemas** multi-select (8): revoltas, pobreza, epidemias, crime organizado,
  corrupção, desemprego, favelização, escassez. Cada um liga a um índice e a um
  limiar — vêm pré-marcados quando o índice correspondente está baixo (sugestão
  ao vivo enquanto arrasta o slider). Cada problema carrega 2 templates de gancho
  de aventura (`{cidade}` substituído); os ganchos gerados ficam editáveis na ficha.
- Nó `tipo:"cidade"` entra na árvore na era atual.

## 3. Integração automática com a economia
- Nova API `game.hunterEconomia.fundarCidade(spec)` espelhando `fundarPais`:
  undo snapshot → registra região (state.regioesExtras + WD.REGIOES) →
  2–5 eventos retroativos (janela ~8 meses) sorteados de `eventosRuins` (tipos
  derivados dos problemas: revoltaPopular, epidemia, ondaRoubos, atentadoCidade,
  apagao — todos no SITUACAO_RUIM) e `eventosBons` (descoberta/universidade/
  obrasPublicas/festival/acordoComercial conforme índices ≥65) → `pRuim` cresce
  com nº de problemas → casas locais via `gerarEntidadesPais` com `nCasas` por
  habitantes (<50k:0–1 · <300k:1 · <1M:2 · ≥1M:3), `mafiaPct` da segurança,
  `fatorRiqueza = 0.5 + tecnologia/250`, viés pesquisa se tecnologia ≥65 →
  evento-anúncio `marcoInaugurado` de hoje.
- Cidade some da economia só via desfazer de eventos (comportamento igual ao país).

## Arquivos
- hunter-cronica: `scripts/gerador.mjs` (opt governo), `scripts/cronica-app.mjs`
  (GOVERNOS, INDICES_CIDADE, PROBLEMAS_CIDADE, views/actions/ctx), `templates/
  cronica-criador.hbs` (select governo), `templates/cronica-pais.hbs` (PERFIL edit
  + seção CIDADES), `templates/cronica-cidade.hbs` (novo), `templates/cronica-
  shell.hbs`, `scripts/main.mjs` (loadTemplates), `styles/hunter-cronica.css`.
- hunter-economia: `scripts/main.mjs` (`fundarCidade`).
