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
  hpFormula?: string | null
  creatureType?: string | null
  descriptionPreview?: string | null
  onView?: () => void
  onEdit?: () => void
  imageUrl?: string | null
}

export function MonsterCard({ name, hp, ac, initiativeBonus, isCustom = false, addToFightLabel, onAddToFight, isAdding = false, hpFormula = null, creatureType = null, descriptionPreview = null, onView, onEdit, imageUrl = null }: MonsterCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={imageUrl || '/logo.svg'} alt={name} className="size-10 rounded border object-cover" loading="lazy" />
            <h3 className="text-base font-semibold text-foreground">{name}</h3>
            {isCustom ? <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">Custom</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border px-2 py-1 text-xs font-medium">AC {ac}</span>
            <span className="rounded-md border px-2 py-1 text-xs font-medium">HP {hp}{hpFormula ? ` (${hpFormula})` : ''}</span>
          </div>
        </div>
        {creatureType ? <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{creatureType}</p> : null}
        <p className="mt-2 text-sm text-muted-foreground">Initiative bonus: {initiativeBonus >= 0 ? `+${initiativeBonus}` : initiativeBonus}</p>
        {descriptionPreview ? <p className="mt-2 line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">{descriptionPreview}</p> : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onView}>View</Button>
          {isCustom ? <Button type="button" size="sm" variant="outline" onClick={onEdit}>Edit</Button> : null}
          <Button type="button" size="sm" onClick={onAddToFight} disabled={isAdding}>
            {isAdding ? 'Adding...' : addToFightLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
