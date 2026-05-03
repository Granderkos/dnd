export function parseHpFormulaAverage(formula: string): number | null {
  const normalized = formula.trim().toLowerCase()
  const match = normalized.match(/^(\d+)\s*d\s*(\d+)\s*([+-]\s*\d+)?$/i)
  if (!match) return null
  const diceCount = Number.parseInt(match[1], 10)
  const diceSides = Number.parseInt(match[2], 10)
  const modifier = match[3] ? Number.parseInt(match[3].replace(/\s+/g, ''), 10) : 0
  if (!Number.isFinite(diceCount) || !Number.isFinite(diceSides) || diceCount <= 0 || diceSides <= 0) return null
  return Math.max(1, Math.round(diceCount * ((diceSides + 1) / 2) + modifier))
}

export function resolveHpFromFormula(inputHp: number, formula: string): { hp: number; warning: string | null } {
  const trimmed = formula.trim()
  if (!trimmed) return { hp: Math.max(1, inputHp), warning: null }
  const fromFormula = parseHpFormulaAverage(trimmed)
  if (fromFormula == null) return { hp: Math.max(1, inputHp), warning: 'HP formula is invalid. Kept manual HP value.' }
  return { hp: fromFormula, warning: null }
}
