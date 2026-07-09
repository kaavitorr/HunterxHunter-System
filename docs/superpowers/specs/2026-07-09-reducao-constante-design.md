# Redução Constante — nova forma da atividade "Reduction"

> **Sistema-alvo:** `hunter-system` apenas (Foundry v14.360+, fork dnd5e v4). Se
> rodar sem bugs, portar depois para `oprpg-system` e `jujutsu-system` (mesma
> estrutura de atividade). **Data:** 2026-07-09.

## Contexto e objetivo

A atividade **Reduction** ("Redução de Dano") hoje funciona como um **escudo de uso
pontual**: ao usar, o jogador confirma/ajusta a fórmula, rola **uma vez**, e o
resultado vira um `valor` fixo guardado na flag `reducaoDano`, consumido pela
pipeline de dano. Há dois modos escolhidos no diálogo: **uso único** (reduz o
próximo ataque) e **persistente** (reduz cada ataque até o início do próximo
turno). Ambos expiram.

O objetivo é adicionar uma **terceira forma**, a **Redução Constante**: uma técnica
**sustentada** (não expira sozinha) que reduz **todo dano sofrido** por uma
**fórmula flat ou de dado**, **re-rolada a cada golpe**. Pode ou não ter Custo
Constante (a manutenção de PA por turno que já existe). É desligada pelo **widget
de sacrifícios/recursos** (o HUD de combate), some no fim do combate, e — se tiver
Custo Constante — drena PA/turno e desliga por falta de PA.

Princípio de design confirmado com o usuário: **reaproveitar a infraestrutura que
já existe** (checkbox de Custo Constante, campo de fórmula da Reduction, ciclo de
upkeep em `constant-cost.mjs`, e o widget `combat-sacrifice-hud.mjs`). O único
pedaço realmente novo é um pequeno toggle e o comportamento de aplicar a fórmula
por golpe.

## Decisões (fechadas com o usuário)

1. **Sistema:** só `hunter-system` por enquanto.
2. **Rolagem:** com fórmula de dado, **rola a cada golpe** (redução variável por
   golpe), não uma vez ao ativar.
3. **Rolagem é automática e silenciosa:** dispara sozinha dentro da aplicação de
   dano, **sem diálogo, sem popup e sem dado 3D por golpe**, para não atrasar o
   combate. O resultado entra **na mesma mensagem de dano** já postada.
4. **Desligar:** aparece no **widget** (HUD de combate) como técnica ativa e é
   desligada clicando ali. Também some no fim do combate (limpeza de upkeep já
   existente) e, se tiver Custo Constante, desliga por falta de PA.
5. **Fórmula:** reutiliza a **mesma** `reduction.formula` (já aceita `5` ou `1d6`).
   Sem campo de fórmula separado.
6. **Escopo do toggle:** quando **Redução Constante** está marcada, ela é a técnica
   **inteira** — ao usar, liga direto (sem o diálogo de único/até-próximo-turno).
   Uma atividade de Reduction é ou o escudo pontual atual **ou** a redução
   constante, decidido pelo checkbox de config.

## Abordagem escolhida — Redução Constante como upkeep sustentado

Reusa o mesmo sistema de upkeep (`flags.hunter-system.upkeep`) que já alimenta o
widget. A redução constante vira mais um **tipo** de upkeep (`type: "reduction"`),
com estas propriedades derivadas: fica ativa enquanto o upkeep existir; drena o
Custo Constante por turno **se** houver; some no fim do combate. Nenhum ciclo de
vida novo é criado.

Abordagens descartadas: (B) flag própria `reducaoConstante` paralela — duplicaria
limpeza/desativação/exibição; (C) estender a flag `reducaoDano` — mistura o escudo
de valor-fixo com a técnica de fórmula-por-golpe e não aparece no widget
naturalmente.

## Mudanças por arquivo

### 1. `module/data/activity/reduction-data.mjs` — schema
Adicionar **um** campo booleano dentro do `SchemaField` `reduction`:

```js
reduction: new SchemaField({
  formula: new FormulaField({ label: "Fórmula de Redução" }),
  constant: new BooleanField({ label: "Redução Constante" })   // NOVO
})
```

`BooleanField` vem de `foundry.data.fields` (já desestruturado no topo, ou
adicionar). Sem migração de dados — campo novo, `initial` falso implícito.

### 2. `templates/activity/reduction-effect.hbs` — checkbox de config
Adicionar o checkbox logo abaixo do campo de fórmula, **reusando o pattern** do
`constant-cost.hbs` (input de checkbox via `@root.inputs.createCheckboxInput`):

```hbs
<label class="checkbox" style="margin-top:6px;">
  {{ formInput fields.reduction.fields.constant value=source.reduction.constant
               input=@root.inputs.createCheckboxInput }}
  Redução Constante <i class="fas fa-shield-halved" inert></i>
</label>
<p class="hint">
  Quando marcada, a técnica fica <strong>ativa</strong> ao usar (aparece no HUD de
  combate) e reduz <strong>todo dano sofrido</strong> pela fórmula acima, rolada a
  cada golpe. Desative pelo HUD. Combine com o <strong>Custo Constante</strong>
  abaixo se ela deve custar PA por turno.
</p>
```

O bloco de Custo Constante (`{{> constant-cost.hbs }}`, já incluído na linha 12 do
template) continua como está — é o "custo constante ou não".

### 3. `module/applications/actor/jj/constant-cost.mjs` — reconhecer o tipo "reduction"

**3a. `resolveSustained(activity)`** — detectar a redução constante como sustentada
(independe de ter Custo Constante) e carregar a fórmula:

```js
export function resolveSustained(activity) {
  // Redução Constante: sustentada por si só; drena o Custo Constante se houver.
  if ( activity?.type === "reduction" && activity.reduction?.constant ) {
    const up = activity.getConstantUpkeep?.() ?? {};
    return {
      active: true,
      value: up.active ? up.value : 0,
      pool:  up.pool ?? "generated",
      type:  "reduction",
      formula: (activity.reduction?.formula ?? "").trim() || "0"
    };
  }
  const up = activity?.getConstantUpkeep?.();
  if ( up?.active ) return up;
  const units = [activity?.duration?.units, activity?.item?.system?.duration?.units];
  if ( units.some(u => u && u !== "inst") ) return { active: true, value: 0, pool: "generated", type: "duration" };
  return { active: false, value: 0, pool: "generated", type: null };
}
```

**3b. `getActorUpkeeps(actor)`** — repassar `formula` para quem consome (o widget e a
pipeline). Incluir `formula: up.formula` no objeto empurrado para `out`.

**3c. `activateUpkeep(activity)`** — já registra o upkeep genericamente (usa
`resolveSustained`). Adicionar um ramo de mensagem para `type === "reduction"`
(ex.: `🛡️ <b>Nome</b> ativou <b>Redução Constante</b> — <b>{formula}</b> por golpe.
Desative no HUD de combate.`). Nenhuma outra mudança: o "já ativo" (linha 83) evita
duplicar ao reusar a atividade.

**3d. Loop de dreno em `combatTurnChange`** — **correção necessária:** hoje o loop
lê `act.getConstantUpkeep()` (linha 119) e **remove** qualquer entrada cujo upkeep
seja inativo (linha 121). Uma redução constante **sem** Custo Constante tem
`getConstantUpkeep()` inativo → seria **purgada** no início do turno do dono. Trocar
a resolução do loop para `resolveSustained(act)`:

```js
const up = resolveSustained(act);
```

Assim o dreno respeita todos os tipos sustentados e drena `value` (0 para redução
sem custo / duração), mantendo a entrada viva. Efeito colateral (desejável): upkeeps
de **duração** também deixam de ser purgados no turno do dono, passando a persistir
até o fim do combate / remoção manual — coerente com o widget que os lista como
"clique para desativar". **Sinalizar isso ao usuário na revisão da spec.**

### 4. `module/applications/actor/jj/combat-sacrifice-hud.mjs` — linha no widget

Em `upkeepHtml(actor)` (linha 225), adicionar um ramo para `u.type === "reduction"`
(antes do fallback de Custo Constante), no mesmo estilo de `is-conc`/`is-dur`,
mostrando ícone de escudo + a fórmula, e o custo em PA se houver (`u.value > 0`):

```js
if ( u.type === "reduction" ) {
  const custo = u.value > 0 ? `<span class="jj-sac-cost">−${u.value} ${u.pool === "total" ? "Total" : "Gerada"}</span>` : "";
  return `
    <button type="button" class="jj-sac-upkeep is-red" data-upkeep="${u.activityId}"
            data-tooltip="Redução Constante (${u.formula} por golpe) — clique para desativar">
      <i class="fas fa-shield-halved" inert></i>
      <span class="jj-sac-lbl">${u.label}</span>
      <span class="jj-sac-red">${u.formula}</span>
      ${custo}
      <i class="fas fa-xmark jj-sac-x" inert></i>
    </button>`;
}
```

Adicionar o CSS de `.jj-sac-upkeep.is-red` (paleta própria, ex.: âmbar/escudo) junto
aos blocos `is-conc`/`is-dur` já existentes (linhas ~95-102). O clique-para-desativar
(linha 387-392, chama `deactivateUpkeep`) já cobre a nova linha sem mudança.

### 5. `module/applications/actor/jj/reducao-dano.mjs` — desviar o fluxo de ativação

No handler `dnd5e.preUseActivity` (linha 18), quando `activity.reduction?.constant`,
**não** abrir o diálogo do escudo. `activateUpkeep(activity)` (já chamado na linha
20) faz a ativação (registra o upkeep + mensagem). Então retornar cedo:

```js
Hooks.on("dnd5e.preUseActivity", (activity) => {
  if ( activity?.type !== "reduction" ) return;
  activateUpkeep(activity);                 // registra upkeep (constante ou não)
  if ( activity.reduction?.constant ) return false;  // Redução Constante: ativação = upkeep, sem diálogo
  _ativarReducao(activity);                 // escudo pontual (fluxo atual)
  return false;
});
```

Sem outras mudanças em `reducao-dano.mjs`. A limpeza por fim de turno (linha 152) e
por fim de combate (linha 167) atua na flag `reducaoDano` (escudo pontual) e não
toca no upkeep da redução constante — correto.

### 6. `module/applications/actor/character-sheet.mjs` — aplicar na pipeline de dano

**6a.** Trocar o import lateral por nomeado (linha 18):
`import { getActorUpkeeps } from "./jj/constant-cost.mjs";` (o efeito colateral do
módulo continua rodando).

**6b.** Em `_applyLayeredDamageToActor(actor, amount, ...)` (linha 4632), adicionar
uma camada **logo após** a "Redução de Dano" de uso único (bloco 0.5, linha 4654) e
**antes** dos Pontos de Armadura (bloco 0.75), tornando a subtração assíncrona:

```js
// 0.6. Redução Constante (upkeeps type "reduction") — rola a fórmula A CADA golpe.
for ( const up of getActorUpkeeps(actor) ) {
  if ( up.type !== "reduction" || restante <= 0 ) continue;
  let rolled = 0;
  try {
    const r = await new Roll(up.formula || "0", actor.getRollData()).evaluate();
    rolled = r.total;                       // silencioso: sem game.dice3d
  } catch { rolled = 0; }
  if ( rolled > 0 ) {
    const reducao = Math.min(rolled, restante);
    restante = Math.max(0, restante - reducao);
    partes.push(`Redução Constante reduziu <strong>${reducao}</strong> (${up.formula})`);
  }
}
```

Isso já cai na mensagem consolidada de dano existente (`partes.join("; ")`, linha
4695) — um só chat por aplicação, sem popup. Se houver mais de uma redução constante
ativa, cada uma rola e reduz em sequência (empilham).

## Fluxo resultante

1. GM/designer marca **Redução Constante** na config da Reduction e define a fórmula
   (e, opcional, o Custo Constante).
2. Jogador **usa** a técnica → vira upkeep ativo → aparece no widget (🛡️ + fórmula).
3. Todo dano aplicado no ator (`_applyLayeredDamageToActor`) **rola a fórmula na
   hora** e reduz, registrando na mensagem de dano. Re-rola a cada golpe.
4. Jogador **desliga** clicando no widget; ou some no fim do combate; ou desliga por
   falta de PA se tiver Custo Constante.

## Casos de borda e limitações (v1)

- **Sem escala (`jj-scale`) na redução constante:** o modo constante usa a fórmula
  base como está; o diálogo de escala é do escudo pontual e não roda aqui. (Extensão
  futura possível: somar incrementos à fórmula guardada.)
- **Fora de combate:** o widget só existe em combate. Se a técnica for ligada fora de
  combate, a flag persiste silenciosa até um combate começar (aí aparece no widget) —
  e é limpa no fim desse combate. Aplicar dano fora de combate ainda respeita a
  redução. Sem UI de desligar fora de combate no v1 (coerente com "reusar o que já
  existe"); reavaliar se incomodar.
- **Empilhamento:** múltiplas reduções constantes ativas somam (cada uma rola e
  reduz). A ordem geral de mitigação permanece: Explosão Defensiva → Redução de Dano
  (pontual) → **Redução Constante** → Pontos de Armadura → PV temp → PV.
- **Dano Verdadeiro (force):** hoje só a armadura é ignorada por dano verdadeiro. A
  Redução Constante, como a Redução de Dano pontual, **não** é ignorada por dano
  verdadeiro no v1 (mesmo comportamento do escudo atual). Sinalizar caso se queira o
  contrário.

## Arquivos tocados (resumo)

| Arquivo | Mudança |
|---|---|
| `data/activity/reduction-data.mjs` | +campo `reduction.constant` (BooleanField) |
| `templates/activity/reduction-effect.hbs` | +checkbox "Redução Constante" + hint |
| `applications/actor/jj/constant-cost.mjs` | `resolveSustained` tipo "reduction"; `getActorUpkeeps` repassa `formula`; ramo de msg em `activateUpkeep`; dreno usa `resolveSustained` |
| `applications/actor/jj/combat-sacrifice-hud.mjs` | +linha e CSS `is-red` no `upkeepHtml` |
| `applications/actor/jj/reducao-dano.mjs` | desvio: constante = ativação por upkeep, sem diálogo |
| `applications/actor/character-sheet.mjs` | import nomeado `getActorUpkeeps`; camada 0.6 na pipeline de dano |

## Plano de verificação

1. `node --check` em cada `.mjs` alterado; precompilar o `.hbs`; conferir chaves do
   CSS do widget.
2. **Restart completo do app** (não F5 — cache de `.mjs` no Electron).
3. Config: numa atividade Reduction, marcar Redução Constante, fórmula `1d6`, sem
   Custo Constante. Usar → conferir mensagem de ativação e linha no widget (🛡️ 1d6).
4. Aplicar dano no ator 3× → cada aplicação mostra "Redução Constante reduziu N
   (1d6)" com N variando; nenhum popup/dado 3D; um chat por aplicação.
5. Desligar pelo widget → linha some; dano seguinte não reduz. Repetir com Custo
   Constante ligado: conferir dreno de PA/turno e desligamento por falta de PA e no
   fim do combate.
6. Regressão: o escudo pontual (Redução Constante **desmarcada**) continua abrindo o
   diálogo único/até-próximo-turno e funcionando como antes.
