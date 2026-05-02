import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface MonsterCardProps {
  name: string
  hp: number
  ac: number
  initiativeBonus: number
  isCustom?: boolean
  addToFightLabel: string
  onAddToFight: () => void
  isAdding?: boolean
}

export function MonsterCard({ name, hp, ac, initiativeBonus, isCustom = false, addToFightLabel, onAddToFight, isAdding = false }: MonsterCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{name}</h3>
            {isCustom ? <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Custom</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border px-2 py-1 text-xs font-medium">AC {ac}</span>
            <span className="rounded-md border px-2 py-1 text-xs font-medium">HP {hp}</span>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">Initiative bonus: {initiativeBonus >= 0 ? `+${initiativeBonus}` : initiativeBonus}</p>

        <div className="mt-3">
          <Button type="button" size="sm" onClick={onAddToFight} disabled={isAdding}>
            {isAdding ? 'Adding...' : addToFightLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
