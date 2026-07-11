# Bancos de Notícias no hunter-jornal (+ impacto econômico + refino do motor) — Design

> Aprovado pelo usuário em 2026-07-09. Alvos: `Data/modules/hunter-jornal` (principal) e
> `Data/modules/hunter-economia` (API pequena de injeção de eventos). Fonte dos dados:
> `hunter-jornal/Assets/Banco_*_Foundry/` (9 bancos feitos pelo usuário via GitHub).

## O que o usuário pediu

1. Integrar os 9 bancos de modelos de notícia ao módulo do jornal.
2. Automático no rascunho + botão manual na Redação.
3. **Os eventos das matérias devem ACONTECER**: impacto econômico regional/global
   conforme o evento, vinculado ao hunter-economia.
4. Seções novas por tema; **a edição impressa pode ter mais de uma página**.
5. 4–6 matérias por edição com perfil por jornal (Mundial × Gazeta).
6. Copiar só os JSONs pra `data/` (lazy), gerador único genérico.
7. **Refinar o modelo antigo de notícias com o novo**: matérias geradas dos eventos
   da economia (e da sessão, e a coluna de esportes) usam os blocos dos bancos.

## Verificado no código/dados

- **Bancos**: estrutura idêntica entre os 9 — `meta` (placeholders), `temas` (15–16),
  coleções `manchetes/subtitulos/aberturas/desenvolvimentos/declaracoes/consequencias`
  (+`arquetipos`), itens `{id, tema, tom, escala, texto}`. Tons: `neutro, empolgante,
  critico, analitico`. Escalas: `local, regional, nacional, internacional`.
  51 placeholders no total (`[nome_da_cidade]`, `[nome_da_empresa]`, …). ~570KB por JSON.
  Geradores .js são idênticos entre si (classe com filter/random/replace) → vira UM
  genérico no módulo.
- **Economia**: `logEvento(state, ev)` (sim.mjs:72) registra evento + dispara
  `hunterEconomiaEvento`. `situacaoLocal` (eventos.mjs:666) computa a situação da cidade
  dos ÚLTIMOS 6 MESES de eventos por `ev.tipo` (mapas `SITUACAO_BOA/RUIM`), peso 1.5 na
  cidade, 1 no país, `escopo:"mundo"` pega todas — injetar eventos com tipos conhecidos
  muda preços organicamente, sem alterar a fórmula. Setores têm `state.setores[n].tend`
  (random-walk) — empurrável para impacto de bolsa.
- **Jornal**: `gerarRascunho` (motor.mjs:516) é JS puro; monta capa+secoes de
  `dados.eventos` com pools fixos (`DESENV/FECHO/DECKS`), + `gerarEsportes/Clima/
  Classificados` e coluna social. `ORDEM_SECOES` fixa. Redação (redacao-app) chama e
  salva; Página impressa (pagina-app) = 1 página, 3 layouts por nº de fotos, matérias
  capadas (5/8/9). O celular renderiza `ed.secoes` dinamicamente (seções novas = grátis).

## Implementação

### A. Dados — `hunter-jornal/data/bancos/`
Copiar (não mover) os 9 JSONs com slugs: `ciencia-tecnologia, economia,
entretenimento-cultura, esportes, internacional, meio-ambiente, opiniao,
seguranca-publica, sociedade`. `Assets/` fica como fonte (README/schema/exemplos/
geradores não entram no runtime).

### B. Gerador único — `scripts/bancos.mjs` (novo)
- `carregarBanco(slug)` → fetch lazy + cache em memória.
- `gerarMateria({slug, tema?, tom?, escala?, paragrafos?, placeholders})` → mesma lógica
  dos geradores do usuário (filtro tema/tom→fallback, anti-repetição por sessão,
  `[placeholder]`→valor) devolvendo `{titulo, subtitulo, paragrafos[], tema, tom, escala}`.
- `blocosPara({slug, tema?, tom?, escala?})` → só o RECHEIO (n desenvolvimentos +
  1 declaração + 1 consequência) — usado pelo refino (G).
- **Resolvedor de placeholders com o mundo**: tabela chave→fonte com fallback genérico:
  cidade/país da edição ou sorteados de `dados.cidades`/nações; pessoas de
  PRENOMES+SOBRENOMES (import dinâmico de world-data como o main já faz);
  empresa/banco/marca/instituição das entidades vivas (`paraSiteFamilias`/state) por
  setor; `nome_da_moeda`="Jenny"; `nome_do_jornal`=nome da edição; time/estádio/
  competição derivados da cidade ("Falcões de X", "Arena X", "Copa do Mundo Conhecido");
  rio/bairro/escola/hospital etc. compostos com a cidade. Chave sem fonte → fallback.

### C. Seções novas — motor.mjs
`ORDEM_SECOES` = [Frente de Guerra, Política, Polícia, Economia, Internacional,
Ciência & Tecnologia, Meio Ambiente, Tragédias, Sociedade, Esportes, Entretenimento,
Opinião, Cotidiano, Geral]. Mapa banco→seção: economia→Economia,
seguranca-publica→Polícia, sociedade→Sociedade, demais→seção própria.

### D. Automático no rascunho — redacao-app.mjs
Depois de `gerarRascunho`, injetar N matérias de banco (setting
`bancoMateriasPorEdicao`, default 5, 0 desliga; sorteio 4–6 quando 5):
- Mundial → bancos internacional/economia/ciencia-tecnologia/opiniao(/meio-ambiente),
  escalas nacional/internacional;
- Gazeta → esportes/sociedade/seguranca-publica/entretenimento-cultura/meio-ambiente,
  escalas local/regional, cidade da edição nos placeholders.
Matéria de banco = `{id, titulo, corpo (parágrafos \n\n), tag:"banco", banco, tema,
tom, escala, impacto}` na seção do mapa (C). Tom sorteado com peso (neutro/analítico
55%, empolgante 25%, crítico 20%) pra não virar montanha-russa econômica.

### E. Botão 🎲 MATÉRIA DE BANCO — Redação
Na seção "NOVA MATÉRIA": diálogo banco → tema (do banco) → tom → escala → seção
(sugerida pelo mapa) → gera com placeholders do mundo e insere com impacto proposto.

### F. Impacto econômico (as matérias ACONTECEM)
- Só matérias de banco com tom **empolgante** (bom) ou **crítico** (ruim); neutro/
  analítico = sem impacto. Bancos sem consequência sensata (ex.: opiniao) → sem impacto.
- **Tabela banco→tipo de evento** (vocabulário existente da situação):
  · seguranca-publica: ruim `ondaRoubos` (grave: `atentadoCidade`) · bom `transicaoExemplar`
  · meio-ambiente: ruim `desastreNatural` · bom `safraNacional`
  · economia: ruim `sancoes` (internacional: `criseGlobal`) · bom `acordoComercial`
    (internacional: `capitalEstrangeiro`)
  · ciencia-tecnologia: ruim `apagao` · bom `descoberta` (saúde: `avancoMedicinal`)
  · internacional: ruim `sancoes`/`criseGlobal` · bom `tratadoGlobal`/`pazFronteira`
  · esportes: bom `jogosContinentais` (local: `festival`) · ruim — sem impacto
  · entretenimento-cultura: bom `festival`/`expoMundial` · ruim — sem impacto
  · sociedade: bom `obrasPublicas`/`turismoRecorde` · ruim `revoltaPopular`
  · opiniao: sem impacto (sempre)
- **Escopo pela escala**: local → `{cidade, pais}`; regional/nacional → `{pais}`;
  internacional → `{escopo:"mundo"}`. Severidade 2 (grave: 3). `tags` coerentes
  (crime/desastre/mercado/social/politica) — de brinde, um crime grave noticiado pode
  virar PROCURADO (hook existente do jornal).
- **Bolsa**: impacto de banco `economia`/`ciencia-tecnologia` com escala internacional
  também empurra o setor citado (`state.setores[nome].tend ± 0.05`, clamp).
- **API nova no hunter-economia** (main.mjs):
  `game.hunterEconomia.registrarEventoExterno({tipo, texto, cidade, pais, escopo,
  severidade, tags, origem}, {setor, delta}?)` → valida GM, lê o state, `logEvento`,
  nudge opcional do setor, salva o state pelo caminho normal (mesmo save do tick).
- **UI/fluxo**: chip de impacto na matéria da Redação
  ("📉 Yorknew — Onda de roubos · ~6 meses" / "🌍 mundo — Acordo comercial") com
  toggle ✔/✖ (default ✔). Ao **PUBLICAR**: aplica os aceitos via API, marca
  `impactosAplicados: true` na edição (REPUBLICAR não re-aplica), e o texto do evento
  na timeline = manchete da matéria.
- Matérias REFINADAS de eventos da economia (G) **não** têm impacto — elas JÁ SÃO
  eventos; re-injetar duplicaria.

### G. Refino do modelo antigo com os bancos (pedido extra do usuário)
Camada `refinarMateria` (bancos.mjs) aplicada na Redação após `gerarRascunho` — o
motor continua puro, com os pools antigos como fallback:
- **Matérias de eventos da economia**: mantêm o 1º parágrafo factual (texto do evento);
  o RESTO do corpo é reescrito com `blocosPara` do banco mapeado pelas tags do evento
  (crime/terrorismo→seguranca-publica; mercado→economia; social/lideranca→sociedade;
  desastre→meio-ambiente; politica/guerra→internacional; cotidiano→sociedade;
  sem mapa→pool antigo). Tom pelo sinal do evento (SITUACAO_BOA→empolgante,
  RUIM→critico, senão neutro); escala pelo escopo (mundo→internacional, pais→nacional,
  cidade→local). Placeholders com cidade/país DO EVENTO.
- **Notícias da sessão** (ORGANIZAR EM NOTÍCIAS): mesmo refino, banco pela seção alvo.
- **Coluna ESPORTES**: linhas geradas do banco esportes (manchetes curtas, tema
  sorteado, cidade nos placeholders) no lugar de `gerarEsportes` — fallback antigo.
- Falha de fetch/JSON → mantém o texto antigo (nunca quebra a geração).

### H. Edição impressa multi-página — pagina-app.mjs + jornal-pagina.hbs + CSS
- Página 1 = layouts atuais (0/1/2 fotos), intocada.
- Excedente (matérias além do cap + caixas que sobrarem) pagina em **CADERNOS**:
  páginas internas em 3 colunas, cabeçalho "CADERNO — <seções da página>", ~8 matérias
  por página, quantas páginas precisar.
- Navegação ◀ Página N/M ▶ (topo do wrap), estado `_pg` no app; jogador e GM.
- Rodapé de cada interna: nome do jornal + nº da página.

### I. Settings e versões
- Setting world `bancoMateriasPorEdicao` (config: true, 0–9, default 5).
- hunter-jornal 1.1.0 → 1.2.0; hunter-economia 1.1.0 → 1.2.0.

## Fora do escopo / decisões registradas
- Impacto NUNCA sai de matéria neutra/analítica nem dos bancos esportes/entretenimento
  em tom crítico e opinião (sem tipo econômico sensato).
- Anti-repetição de blocos é por sessão de jogo (memória), além do dedup interno da edição.
- `exemplos-preenchidos/relatorio-validacao/schema/README` não entram no runtime.
- Encoding: os JSONs são UTF-8; carregamento via fetch/JSON.parse (o mojibake visto no
  terminal era do console Windows, não dos arquivos — conferir 1 acento no app).

## Verificação
1. `node --check` em tudo; restart completo do app.
2. GERAR GAZETA: rascunho vem com 4–6 matérias temáticas com nomes/cidades reais do
   mundo, seções novas na ordem, chips de impacto ✔; matérias de eventos da economia
   agora com corpo rico (1º parágrafo factual + blocos do banco).
3. Desligar um chip, PUBLICAR: eventos aceitos aparecem na timeline da Economia e a
   situação da cidade muda no vira-mês; REPUBLICAR não duplica.
4. Botão 🎲: gerar matéria de Opinião (sem impacto) e uma de Segurança crítica local
   (com impacto na cidade).
5. VER PÁGINA: edição com 12+ matérias pagina em cadernos; navegação funciona pro
   jogador; celular mostra as seções novas.
6. Setting 0 → rascunho volta a nascer só com o conteúdo antigo (refinado).
