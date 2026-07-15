# Description formatting

## There are two valid styles — mirror the PDF, don't normalize to one

The two example hatsus in this world look inconsistent in Foundry (one has tidy stat-block
footers, one doesn't), and it's tempting to read that as sloppiness worth fixing. It isn't —
each source PDF has its own house style per técnica, and the "inconsistency" is just faithful
transcription. Detect which style a given técnica uses *in the PDF* and reproduce that same
structure, técnica by técnica — don't pick one style for the whole hatsu.

**Style A — full stat-block section.** The técnica gets its own caps header (e.g. "SOCO DE
GRATIDÃO"), body paragraph(s), then a 2-column table: Duração / Alcance / Requisito(optional) /
Dano(optional), with the PA cost shown as a merged cell on the left (e.g. "5 / Ponto de Aura").
Reproduce as: body paragraphs, then `<hr>`, then one `<p><strong>Label:</strong> value</p>` per
row, in this fixed order — Duração, Alcance, Requisito, Dano, Custo. Always add Custo as its
own line even though the PDF shows it as a side-cell rather than a table row; that's the
established Foundry convention (see Hyakushiki Kannon, Soco de Gratidão, Mão Zero, Limitless
Fist, 100 Braços — all in this style, all from the same PDF).

**Style B — inline lead-in.** The técnica is just a bold run inside its *parent*
manifestação's paragraph: `**Nome (N PA):** texto...`, no separate header, no table. Reproduce
as plain paragraph(s), no `<hr>` footer. (See Murder of Crows, Black Cloud, Black Assault,
Playground, A New Place, White Crows, Kill Yourself — all in this style, all from the same
other PDF.)

A manifestação's own cost line is different from either técnica style: `Custo: N Pontos de
Aura[; Requisito: X]`, as a plain sentence at the top of its paragraph, not a parenthetical.
The `; Requisito: X` clause is *optional* — it only shows up when the action economy is
unusual enough to call out explicitly (e.g. "Todas as ações", "Inação", "Ação de Poder" when
it's not just the default implied by the ability's own text). When it's present, put it in
both `activation.type`/`activation.condition` on the manifestação's activity and in a
`<hr>` footer `<strong>Requisito:</strong>` line. When it's absent, don't invent one — most
manifestações are a plain power action and just say so in prose instead of the header line.

## Secondary effects: the `condicao` field first, then inline enrichers

A técnica that *also* imposes a **condition** on the target — "a criatura deve realizar uma
Salvaguarda de Agilidade para não receber a condição Cego" — is still **not** a separate
`save`-type Activity. Since 2026-07 the primary home for this is the structured **`condicao`**
field on the same attack/save/damage activity (`condicao:{id:"jj-cego", ability:"dex", ...}` —
full docs and the PT→`jj-` id table in data-schema.md). It renders a save/apply button on the
chat card and applies the real status effect, which the old enricher couldn't do.

Fall back to a dnd5e inline roll enricher in the description HTML —

```
[[/save dex dc=@attributes.spell.dc]]
```

— only when the condition has **no matching `jj-*` status id**, or when a *second* condition
needs to ride on the same activity (the `condicao` field holds only one). The enricher is still
the convention already visible in Black Cloud's and Kill Yourself's descriptions; it just stops
being the *default* for anything that maps to a known condition. Either way, this is a secondary
effect riding on the activity, never its own dedicated mechanical Activity.

Only build a real `save`-type Activity when the save check *is* the técnica's whole mechanical
point, not a side effect of something else — e.g. Playground, whose entire function is
save-or-be-illusioned. If you're unsure whether an effect is "primary" or "secondary", ask:
does the técnica do anything mechanically interesting when the save succeeds and something
else entirely when it fails (primary), or is the save gating one bullet point among several
listed effects (secondary)?

## Quoted terms are bold, quotes included

Rule from the user (2026-07-02): any word or phrase in quotes — condition names ("Atordoado",
"Sangramento", "Cego"), cross-references to other técnica/manifestação names ("Lord's Cross",
"God's Punishment") — gets wrapped in `<strong>` **together with the quote marks themselves**,
not just the word: `<strong>“Atordoado”</strong>`, not `“<strong>Atordoado</strong>”` or plain
`“Atordoado”`. This isn't specific to condition names — apply it to any quoted term you're
transcribing from the PDF, whatever it's referring to. The PDF's own raw text extraction
doesn't preserve bold formatting, so you won't see this coming from the source — it's a
Foundry-side styling convention to apply regardless of how the PDF itself renders it.

## PDF extraction can scramble numbers near tables — cross-check before trusting

Raw text extraction from a PDF page can interleave text oddly around 2-column tables and page
breaks. One observed example: Soco de Gratidão's "...até um máximo de 20d10..." came out of a
raw extraction as "...até um máximo d13e 20d10...", with a table-adjacent digit leaking into
the middle of the sentence. The "20d10" was still recoverable, but don't assume every garbled
number is this forgiving.

Both example PDFs restate every important number twice — once in flowing prose, once in the
stat table (when style A applies). Cross-check any number pulled from near a table against its
prose restatement elsewhere in the same técnica's paragraph before treating it as reliable. If
a number can't be cross-validated this way (no prose restatement, or the two disagree), say so
explicitly in the pre-apply summary shown to the user instead of silently picking one.
