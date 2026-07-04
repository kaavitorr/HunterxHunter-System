/**
 * Fixed set of moon phases the GM can assign to a calendar day. Rendered with plain unicode glyphs
 * so the month view never depends on a specific icon font shipping the right symbols.
 * @type {{ key: string, label: string, glyph: string }[]}
 */
export const MOON_PHASES = [
  { key: "new", label: "Lua Nova", glyph: "🌑" },
  { key: "waxing-crescent", label: "Crescente", glyph: "🌒" },
  { key: "first-quarter", label: "Quarto Crescente", glyph: "🌓" },
  { key: "waxing-gibbous", label: "Gibosa Crescente", glyph: "🌔" },
  { key: "full", label: "Lua Cheia", glyph: "🌕" },
  { key: "waning-gibbous", label: "Gibosa Minguante", glyph: "🌖" },
  { key: "last-quarter", label: "Quarto Minguante", glyph: "🌗" },
  { key: "waning-crescent", label: "Minguante", glyph: "🌘" }
];
