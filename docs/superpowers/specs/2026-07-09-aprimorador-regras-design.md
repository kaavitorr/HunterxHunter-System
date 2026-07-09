# Regras automáticas do Aprimorador (nível 3) + Caminho Aprimorador Físico (nível 6) — Design

> Aprovado pelo usuário em 2026-07-09 ("faça modulado" = arquivo modular DENTRO do sistema).
> Alvo: `systems/hunter-system`. Módulo novo `module/applications/actor/jj/categoria-aprimorador.mjs`
> no padrão dos outros jj/* (hooks próprios, acoplamento mínimo no character-sheet).

## Regras (texto do usuário)

**Classe Aprimorador, nível de personagem ≥ 3:**
- **Sem Recuar** — a cada 20 PV perdidos, +1 Classe de Resistência (máx +5). A CR não pode
  ultrapassar 20 com essa característica; teto vira 24 no 6º nível e 27 no 12º. O efeito
  encerra se o personagem se afastar de um inimigo sem ir na direção de outro.
- **Vigor Ilimitado** — ao SOFRER ou CAUSAR dano máximo (no dado principal) ou um acerto
  crítico, recupera 3 PA, até um máximo de 4× o nível de personagem; reseta no descanso longo.

**Caminho (subclasse) `aprimorador-fisico`, nível de personagem ≥ 6:**
- **Resistência do Gigante** — 1 Ponto de Redução para TODO dano sofrido; no início de cada
  turno seu, +1 adicional, até um máximo igual ao nível de personagem.

## Decisões (Q&A)

1. **Onde**: arquivo modular dentro do sistema (`jj/categoria-aprimorador.mjs`), não módulo Foundry.
2. **Sem Recuar**: efeito ativo automático recalculado pela Vida; a condição de "afastou-se"
   é humana → desativar/reativar o efeito com um clique (reativou, recalcula).
3. **Vigor Ilimitado**: automático no detectável (crítico/dano máximo CAUSADO no card custom;
   crítico SOFRIDO via cardMeta) + botão manual pro dano máximo sofrido. 3 PA = `energy.total`.
4. **Concessão**: automática por classe/subclasse + nível — sem depender de itens no compêndio.

## Fundamentos verificados no código

- CA: `ac.value = max(ac.min, ac.base + ac.shield + ac.bonus + ac.cover)`
  (attributes.mjs:234) — ActiveEffect em `system.attributes.ac.bonus` (ADD) funciona.
- Dano sofrido: `_applyLayeredDamageToActor(actor, amount, { soVerdadeiro, cardMeta })`
  (character-sheet.mjs:4632); `cardMeta.crit` vem do checkbox do card do atacante
  (5710/6275). Vitalidade: `_applyPVEDamage` com `meta.crit` do diálogo.
- Cards custom de dano têm o atacante e o estado de crit; nat20 detectado nos painéis.
- Descanso: `dnd5e.restCompleted` com `longRest` (padrão do heal-limit.mjs).
- Nível de personagem: `system.details.level`. Subclasse: item `type "subclass"`,
  `system.identifier === "aprimorador-fisico"`. Classe: item `type "class"` com nome
  normalizado começando com "aprimorador".

## Implementação

### Módulo novo: `module/applications/actor/jj/categoria-aprimorador.mjs`

**Elegibilidade** (helpers): `ehAprimorador3(actor)` = classe Aprimorador + nível ≥ 3;
`ehFisico6(actor)` = subclasse `aprimorador-fisico` + nível ≥ 6. Só `type === "character"`.
Escritas pelo cliente responsável (`game.users.activeGM === game.user`, senão o dono) —
padrão `_canAct` dos jj.

**Sem Recuar (efeito ativo):**
- Efeito "Sem Recuar" no ator, flag `hunter-system.semRecuar = true`, change
  `system.attributes.ac.bonus` (ADD, valor inteiro), ícone próprio, descrição da regra.
- Recalculado em `updateActor` (quando `hp.value/max` muda), `ready` (varredura) e quando
  nível/classe muda: `perdido = hp.max − hp.value`; `bonus = min(5, floor(perdido/20))`;
  `teto = nível ≥ 12 ? 27 : nível ≥ 6 ? 24 : 20`;
  `base = CA_atual − valor_atual_do_efeito`; `efetivo = clamp(bonus, 0, max(0, teto − base))`.
  Atualiza o change só quando o valor muda (sem loop: o update do efeito re-dispara cálculo
  que converge — guard de igualdade).
- Efeito `disabled` → não é atualizado (bônus fora da CA pelo core); ao reativar
  (`updateActiveEffect`), recalcula. Ator inelegível com efeito → efeito removido.

**Vigor Ilimitado:**
- Flag `hunter-system.vigorIlimitado.usado` (número). Teto = `4 × nível`.
- `ganharVigor(actor, motivo)`: `ganho = min(3, teto − usado)`; se ≤ 0, nada (aviso curto
  1×). `energy.total = min(total + ganho, energy.max)`; flag `usado += ganho`; msg no chat
  "⚡ Vigor Ilimitado (+ganho PA — motivo) · usado/teto", `isEnergySystem: true` no update
  (não dispara o aviso de Aura manual).
- Gatilhos automáticos (via hooks novos do sheet, abaixo):
  · `hunterDamageRolled(actor, roll, {crit})` — atacante Aprimorador 3+: crit marcado OU
    dado principal máximo (primeiro termo `Die` do roll com TODOS os resultados ativos na
    face máxima) → ganharVigor("dano máximo/crítico causado").
  · `hunterDamageApplied(actor, {crit})` — alvo Aprimorador 3+ com crit → ganharVigor
    ("crítico sofrido"). Vale nos dois caminhos (PV e Vitalidade).
- Botão manual (dano máximo SOFRIDO, indetectável): ícone no bloco de Aura da ficha,
  visível só para Aprimorador 3+, tooltip "Vigor Ilimitado — usado X/teto", clique →
  ganharVigor("dano máximo sofrido"). Injetado pelo módulo no render da ficha
  (hook `renderCharacterActorSheet`), sem mexer no template.
- Reset: `dnd5e.restCompleted` longo → `usado = 0` + msg curta.

**Resistência do Gigante (Caminho físico 6+):**
- DR total = `1 + (flag hunter-system.resistenciaGigante.extra ?? 0)`, cap = nível.
- `combatTurnChange` no turno do ator (elegível): `extra = min(extra + 1, nível − 1)`;
  msg curta "🗿 Resistência do Gigante: redução X/nível" só quando o valor sobe.
- `deleteCombat` → limpa a flag `extra` (volta à redução 1).
- Export `reducaoDoGigante(actor)` → número (0 se inelegível) — consumido pela pipeline.

### Acoplamento no character-sheet.mjs (mínimo)

1. `import "./jj/categoria-aprimorador.mjs"` + `import { reducaoDoGigante } ...`.
2. `Hooks.callAll("hunterDamageRolled", actor, roll, {crit})` no ponto em que o card
   custom de dano finaliza a rolagem (com o crit do card).
3. `Hooks.callAll("hunterDamageApplied", actor, {crit: !!cardMeta?.crit})` dentro de
   `_applyLayeredDamageToActor` e `_applyPVEDamage` (após aplicar).
4. Camada nova na pipeline de PV, entre 0.5 (escudo) e 0.6 (Redução Constante):
   `const gigante = reducaoDoGigante(actor);` reduz `restante` e soma
   "Resistência do Gigante reduziu X" nas partes. **Aplica inclusive a dano Verdadeiro**
   (o texto diz "todo dano sofrido"; Verdadeiro hoje só ignora a Armadura).

### Fora do escopo
- Vitalidade (aura off) NÃO recebe a Resistência do Gigante: a perda de PVE tem régua
  própria (base 1 / arma 2 / grau, ×2 crit) e não é "dano" em pontos.
- "Afastou-se do inimigo" (Sem Recuar) e "dano máximo sofrido" (Vigor) ficam manuais
  por natureza (toggle do efeito / botão).
- Interpretação registrada: "dano máximo no dado principal" = TODAS as faces do primeiro
  termo de dados no máximo (ex.: 2d6 = 6 e 6).

## Verificação
1. `node --check`; restart completo do app.
2. Aprimorador nível 3: perde 40 PV → efeito Sem Recuar +2; com CA base 19, bônus capado
   (teto 20 → +1); desativa o efeito → CA volta; reativa → recalcula. Nível 6/12 → tetos 24/27.
3. Card de dano com Crit → "+3 PA" no chat; repetir até o teto 4×nível → para de ganhar;
   descanso longo → contador zera. Botão do punho na ficha soma e respeita o teto.
4. Crítico sofrido (checkbox do atacante) → alvo Aprimorador ganha +3 PA.
5. Físico nível 6: dano sofrido cai 1; passa 3 turnos em combate → redução 4; mensagem do
   acúmulo; fim do combate → volta a 1. Personagem de outra categoria/caminho: nada muda.
