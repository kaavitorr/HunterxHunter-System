# Choosing and configuring the Activity type

This is the decision tree the user walked through directly (2026-07-02) for picking which
dnd5e Activity type a técnica's mechanical effect should become, and how to configure it. It's
more specific than "pick attack/save/damage/utility by vibes" — the system has real
conventions (e.g. attack-roll damage always being d10/d12) that make this mostly mechanical
once you know them. Read the técnica's full text before applying any of this — these triggers
are about what the ability *actually does*, not keyword matching on isolated sentences.

## The decision tree

**1. Does it summon or create a controllable creature?** → dnd5e's native `summon` activity
type. Neither example hatsu has a mechanically-summoned creature (Black Raven's "corvos" are
narrative set-dressing with stats mentioned only in prose, not implemented as summons) — if a
new PDF has one, this is genuinely new territory for this skill; build carefully and flag it
in the summary for the user to check.

**2. Does it deal damage?** If yes, which of these three shapes applies:

  - **No saving throw gates the damage, and the damage die is d10 or d12** → `type: "attack"`
    (attack roll + damage). This system's convention is that attack-roll damage uses d10/d12 —
    it's a real signal, not a coincidence of the two examples read so far (Soco de Gratidão
    12d10, Black Cloud 2d10, Mão Zero 34d10 — all attack type, all d10).
    - **Crit range vs. crit bonus damage — two different fields, do not mix them up.** A PDF's
      "margem de acerto crítico 18-20" is the crit *range*: it goes in `critThreshold` as the
      **lower-bound number** (18-20 → `18`, 19-20 → `19`; omit for a normal 20-only crit). A
      PDF's "causa N dados de dano adicionais em um crítico" is *bonus crit damage*: it goes in
      `criticalBonus` as a **dice formula** matching the base die (e.g. "6 dados adicionais" on a
      d10 base → `"6d10"`). A técnica can have one, both, or neither. **Never** put the range text
      ("18-20", "margem de acerto crítico 18-20") into `criticalBonus` — that was a real import
      bug (12 técnicas): the letters crash Foundry's roll parser ("d" of "de"), and even a bare
      "18-20"/"19" silently corrupts the crit-damage math while leaving the crit range wrong. If
      the crit range is *conditional* (e.g. "18-20 apenas com a arma Tac-50"), leave
      `critThreshold` unset and keep the condition in the description — a static threshold can't
      express a weapon-dependent range.
  - **A saving throw gates the damage itself** (e.g. "a criatura recebe Xd_ de dano, ou metade
    em caso de sucesso em uma Salvaguarda de \_") → `type: "save"`, with `damage.parts` set and
    `save.ability`/`save.dc` configured.
  - **Neither of the above** — damage happens automatically/unconditionally, not gated by a
    roll or a save (e.g. triggered by the *target's* own action, like Kill Yourself's "caso a
    criatura o ataque, ela sofre 4d8...") → `type: "damage"`.

  In all three shapes: if the técnica *also* imposes a **condition** on the target (separate from
  whether the damage itself lands), use the structured **`condicao`** field on that same activity
  (attack/save/damage all render it) — set `condicao.id` to the matching `jj-*` status,
  `condicao.ability` to the resisting save, and `semSalvaguarda`/`gatilho` as the text dictates
  (full field docs + PT→`jj-` id table in data-schema.md). This is the current convention (the
  field was added 2026-07). Fall back to an inline enricher `[[/save <code>
  dc=@attributes.spell.dc]]` ONLY when the condition has no matching `jj-*` status id, or when a
  *second* condition needs to ride on the same activity (the `condicao` field holds just one).
  The condition-save is still never its own separate Activity — it rides on the damage/attack via
  `condicao`, whether the damage came from an attack roll, a save, or was unconditional.

  If the text never states an explicit damage type (Cortante/Contundente/Perfurante/
  Psíquico/Verdadeiro/etc.) for a damage part, don't guess one — leave it and call it out
  explicitly in the pre-apply summary so the user can supply it.

**3. No damage, but a saving throw gates some other effect** (illusion, condition, forced
movement, whatever) → `type: "save"` with empty `damage.parts` (`onSave: "none"`). Same idea
as case 2's save-gated damage, just without the damage half. (This is exactly "Playground":
save-or-be-illusioned, no damage at all.)

**4. Does it restore HP (or grant temporary HP)?** → `type: "heal"`, confirmed by the user
2026-07-02, first seen on "Healing Injection" from the Adrenalin hatsu. Two earlier drafts of
this section guessed wrong before this was pinned down by actually filling in the field in
Foundry's UI and reading back what got saved — **the correct shape is a singular `healing`
object, not `damage.parts[]`**:

```
system.activities.<id>.healing = { number: 5, denomination: 10, bonus: "", types: ["healing"] }
```

`number`/`denomination`/`bonus` work exactly like a single damage part (not an array — a heal
activity has exactly one healing block, no "add another part" control in the UI). `types` is
an array — confirmed against the UI's own Portuguese labels — from `DND5E.healingTypes`:

  - `types: ["healing"]` — "Pontos de Vida" — restores real HP.
  - `types: ["temphp"]` — "Pontos de Vida Temporários" — grants temp HP (doesn't stack, takes
    the higher value, no custom code needed).
  - `types: ["maximum"]` — "Pontos de Vida Máximos" — raises max HP (rare, only if the text
    says so explicitly).

Leave `system.activities.<id>.damage` alone/empty for a heal activity — it's a separate field
that a heal-type activity doesn't use, don't populate it as a substitute for `healing`.
`jjScale` still applies on top the same way it would for damage.

**5. An attack roll gates a non-damage, non-heal effect** — **retracted 2026-07-02.** An
earlier draft of this doc said to use `type: "attack"` with empty damage for this shape (first
guessed on "Quick Removal" from Adrenalin, an attack roll that removes a condition instead of
dealing damage). The user corrected this directly: use `type: "utility"` instead, even when
the PDF describes a to-hit roll — the roll itself stays as description text, it doesn't get a
mechanical Activity of its own unless it's also dealing damage or healing. Fold this case into
bucket 6 below; there's no real case 5 anymore, numbering kept for history.

**6. None of the above — no damage, no heal, no condition-via-save, no summon** →
`type: "utility"`, just configure the activation cost and nothing else. Note this type is
labeled **"Usar"** ("Use") in the Portuguese UI, not "Utility" — if the user refers to
"atividade Usar" they mean this. This is also the bucket for "there's a roll or check
described in the text, but it isn't damage or healing" — describe the roll in text, don't try
to force it into `attack`/`save`.

## Scaling patterns (apply on top of whichever type you picked above)

- **"Você pode gastar N PA para aumentar XdY de dano até um máximo de ZdY"** → `jjScale`, see
  data-schema.md for the exact formula. This adds damage by spending extra PA at activation.

- **"Você pode reduzir NdY...MdY de dano [para algum outro benefício, ex. aplicar uma condição
  de até K PA]"** — a técnica giving up its OWN outgoing damage dice in exchange for a secondary
  effect (e.g. Soco de Gratidão). **There's still no schema for this specific trade-off
  mechanic** (confirmed by the user 2026-07-02: "realmente não tem nada configurado para isso").
  Configure the damage normally (attack/save/damage per the rules above, jjScale if it also
  scales) and leave this part as plain description text only.

- **Separately — "cria um escudo/barreira que reduz NdM de dano [até o fim da duração / até o
  início do próximo turno]"** — a técnica creating its OWN defensive damage-reduction shield.
  **This DOES have a real schema**: `type: "reduction"` Activity
  (`module/documents/activity/reduction.mjs`, `module/data/activity/reduction-data.mjs`,
  `module/applications/actor/jj/reducao-dano.mjs`), with `system.reduction.formula` (a
  FormulaField, e.g. `"6d8"`) and `system.reduction.constant` (a boolean, see next bullet). An
  earlier version of this doc wrongly said no schema existed for *any* "reduction" wording,
  conflating this case with the dice-trade case above — that was a real bug (2026-07-02): a
  batch-import run created ~7 técnicas whose entire effect IS this shield (Diamond Defense,
  Defesa de Aura, Shield Orbit, Rule: Shield, Signature Card, Escudo del Brazo, Complete Defense)
  with `type: "utility"` and no formula recorded, silently losing the mechanic. Use
  `type: "reduction"` whenever the técnica's own effect literally creates this shield; keep using
  `utility`/text for a técnica that only *references* reduction without creating its own (ignores
  an enemy's, doubles damage against one, boosts a *different* named técnica's reduction, etc. —
  read carefully, most PDF mentions of "redução de dano" are this kind, not a shield of their
  own). The same `jjScale` scaling field used for damage/healing also applies here for "pode
  gastar N PA para reduzir mais XdY, até um máximo de ZdY" wording.

  - **One-shot shield vs. Redução Constante** (`reduction.constant`, added by the user 2026-07):
    default `constant:false` is a **one-shot** shield — rolled once when used, absorbs like a pool
    of armor points and depletes as hits land (the reaction case: "reduz Xd8 de dano até o início
    do próximo turno"). Set `constant:true` when the técnica instead **stays active over a
    duration and reduces every hit** — a sustained toggle that re-rolls the formula fresh on each
    incoming hit and never depletes ("enquanto ativa/até o fim da duração, reduz Xd8 de cada dano
    sofrido"). The `constant:true` técnica appears in the combat HUD and is turned off there; pair
    it with `constantCost` if the PDF says it drains PA per turn while active. Signal to
    distinguish: a *reaction that absorbs one instance* → one-shot; a *sustained buff that applies
    to all damage for as long as it's up* → constant. (This is the mechanism the deferred **Star
    Shield** was waiting on — "a cada dano recebido rola xd8 e reduz automaticamente" is exactly
    `constant:true`; it can be configured now.)

  **When one técnica describes several named modes/effects (only some of which may be this
  shield)** — e.g. Aura Flow: "Portal" / "Escudo" / "Construtos" (only "Escudo" reduces damage),
  or Secret Art: "King's Bind" / "Dark Rush" / "Black Shield" / "Dark Magic" (only "Black Shield"
  is a reduction) — build **N+1 activities**, refined by the user 2026-07-02 after an initial
  attempt (Aura Flow) missed the +1:
  - One **"Ativação"** activity representing turning the whole ability on, carrying whatever
    single cost/activation the ability's intro sentence states (e.g. "Ao utilizar uma ação de
    poder, você recebe as seguintes habilidades: ..." → `power`, the técnica's stated PA cost).
    `type: "utility"`.
  - One `namedSubActivities` entry per named mode, each getting its own mechanical `type` (the
    shield mode → `reduction`, a mode that only gates a condition via a save → `save` with empty
    `damage.parts`, everything else → `utility`). **No cost** on any of these unless that specific
    mode's own text states one — the PA was already spent on "Ativação"; don't repeat or split it
    across modes. Each mode's `activation.type` is whatever that mode's own text states (e.g. "ao
    utilizar uma ação bônus" → `bonus`, "ao utilizar uma reação" → `reaction`); if a mode doesn't
    state its own action at all (rare — most do), fall back to the ability's general activation.
  This generalizes past "reduction, one shield among several modes" to any multi-named-mode
  técnica, whether or not a shield is involved.

## Granting a defensive buffer: Pontos de Armadura vs. temporary HP

Rule from the user (2026-07-02), for a técnica that grants some kind of "shrug off damage"
buffer (first seen on the "Adrenalin" técnica reviving a creature with a buffer equal to half
its HP):

- **If the ability's own text ties the buffer to resistência** (e.g. it explicitly grants
  resistance to damage alongside the buffer, not just a flat number) → it's the system's real
  `system.armorPoints` resource (`module/data/actor/character.mjs`/`npc.mjs` — this is where
  the built-in 2:1 damage-resistance-while-absorbing property actually lives, so "resistência"
  in the text is the signal that the author means *this specific resource*, not a generic
  buffer). Grant it via an ActiveEffect in the activity's `effects` array that **adds** to
  `system.armorPoints.value` (mode `CONST.ACTIVE_EFFECT_MODES.ADD`) — adding to `.value` rather
  than `.max` is what makes it "poder esgotar" (able to deplete): the existing damage-application
  pipeline already drains `.value` as hits land (confirmed — every other place in the codebase
  that touches `armorPoints.value` does it via a plain `actor.update()`, there's no existing
  ActiveEffect example of this to copy from, so treat the exact change-key/mode construction as
  unverified until you've confirmed one actually applies correctly in Foundry).
- **If it doesn't mention resistência** — just a flat temporary buffer — use dnd5e's native
  temp HP instead: `type: "heal"` activity, `damage.parts: [{..., types:["temphp"]}]` (see
  case 4 above). No custom effect needed, this one's fully native.

Adrenalin's actual text ("Pontos de Armadura igual metade da vida dela") names the specific
resource by its exact system name but never says "resistência" — genuinely ambiguous from the
text alone, and never fully resolved: the concrete case stacked this ambiguity on top of a
*second* open question (see next paragraph) and the user ended up pulling both back to manual
rather than resolving either in isolation. Don't treat this pairing as a settled precedent for
the resistência/temp-HP split specifically — it's still an open question, flag it again next
time rather than assuming the earlier guess (temp HP) was confirmed correct.

**Target-relative amounts** (e.g. "metade da vida **dela**" — half of the *target's* HP, not
the caster's) were attempted via `@target.system.attributes.hp.max` in a
`damage.parts[].custom.formula` — the only precedent for a `@target.*` path anywhere in this
codebase is inside a description enricher, not an Activity's own formula field, so this was
always going to need live verification. **The user decided against automating it** (2026-07-02,
on Adrenalin's revive técnica): rather than ship an experimental formula stacked on top of an
already-ambiguous resource choice, fall back to `type: "utility"` with just the cost/activation
configured, and put the whole "grants 1 HP + a defensive buffer equal to half the target's
HP, dies if it depletes" effect in the description for players to apply by hand.

The generalizable lesson isn't "never try target-relative formulas" — it's that when a
técnica's automation would require stacking more than one unverified guess (here: which
resource *and* an unproven formula path *and* a bespoke death-on-depletion rule with no home
anywhere), that compounding uncertainty is itself a signal to fall back to `utility` + manual
text rather than ship something fragile. A técnica needing only *one* uncertain piece (e.g.
just the temp-HP type, with a flat or dice-based amount) is a much safer bet to actually try.

This generalizes past armor points specifically: any técnica referencing a real actor-level
mechanic that has no plain Activity field for it (the same situation "reduction" is in) should
get whatever plain fields DO apply (cost, activation, an activity type for the parts that fit)
configured normally, with the custom-resource part either mechanized if there's a clear native
path (like temphp turned out to have) or left as text and flagged if there isn't — don't invent
an ActiveEffect for something with zero precedent in the codebase without flagging it as
unverified.

## Duration default for manifestações

Rule from the user (2026-07-02): if a manifestação's PDF text states a duration explicitly,
use that. If it doesn't, check what kind of effect it is:

- **Grants ongoing buffs, or creates/conjures something, and never says how it ends** → default
  to `duration: {units: "minute", value: "10"}`. First applied on "Injection" (Adrenalin) —
  conjures a pistol, the PDF never says how long it lasts or what makes it go away.
- **Anything else** (instant effects, things with their own stated end-condition even if it's
  not time-based — e.g. "até os Pontos de Armadura chegarem a 0" counts as *stating* how it
  ends, just not with a duration) → leave as `inst`, don't apply the 10-minute default. Don't
  conflate "no duration stated" with "no end condition stated" — the rule is about the former.

Set this on the top-level `system.duration` field — same field the Detalhes tab reads for
`activation.type` (see the callout in console-script-pattern.md), the same duplication risk
applies here. The one real example read this session (Black Crows, an *existing* técnica, not
one this skill created) has top-level `duration: {units:"minute", value:"1"}` while its own
activity's `duration.units` stayed `"inst"` — so the two fields not matching doesn't seem to
break anything for duration specifically, unlike activation. Match the top-level field to
whatever you determine; don't stress about also changing the activity's own `duration.units`
to match unless you see evidence it matters.

## Cost pool (applies to every activity type)

The cost written in the técnica's name/header in the PDF (e.g. "Black Cloud (1 PA)") maps
directly to the activity's `consumption.targets[0].value`. Pool defaults to `energy.generated`;
switch to `energy.total` only when the PDF text explicitly says "Aura Total", or the técnica
is in the `inata` slot (see data-schema.md).

## `activation.type` (applies to every activity type)

Map the PDF's stated action requirement to dnd5e's activation types (`action`, `bonus`,
`reaction`, `power` — this system's own addition for "Ação de Poder" — etc.) the obvious way.
Two specific triggers map to `"special"` instead of any of those:

- The requisito is **"Inação"** (this is a meaningful game term here — it means the ability
  doesn't cost a normal action at all, not that no requirement is stated).
- The PDF **doesn't specify any particular action type** for activating it (e.g. a técnica
  that just describes when it triggers, like Murder of Crows' "toda vez que você usar uma ação
  bônus, reação, ataque ou técnica" — no single action type governs it).

Don't default everything ambiguous to `"special"` — if the text clearly does name one specific
action word (Ação, Ação Bônus, Reação, Ação de Poder), use that, even if the surrounding
requirement is otherwise unusual. "Todas as ações" (consumes the whole turn) is a case that
doesn't cleanly fit `"special"` under the rule above (it does specify something — all of them)
but doesn't map obviously to a normal single-action type either; the one existing example of
this (Hyakushiki Kannon) is currently `"action"` — treat that as the working convention until
told otherwise, and flag it in the summary if you're unsure.

**When the PDF names two specific action options** for the same técnica ("ação bônus ou
reação") rather than one — confirmed by the user 2026-07-02 on "Quick Removal" (Adrenalin):
use the **first one named**, not `"special"`. So "ação bônus ou reação" → `"bonus"`. This is
different from the two `"special"` triggers above (Inação, or no action type named at all) —
here an action type *is* named, just with an alternative offered, and the PDF's own ordering
is treated as the primary path.
