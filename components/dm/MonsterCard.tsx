import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface MonsterCardProps {
  name: string
  hp: number
  ac: number
  initiativeBonus: number
  addToFightLabel: string
}

export function MonsterCard({ name, hp, ac, initiativeBonus, addToFightLabel }: MonsterCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">{name}</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-md border px-2 py-1 text-xs font-medium">AC {ac}</span>
            <span className="rounded-md border px-2 py-1 text-xs font-medium">HP {hp}</span>
          </div>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">Initiative bonus: {initiativeBonus >= 0 ? `+${initiativeBonus}` : initiativeBonus}</p>

        <div className="mt-3">
          <Button type="button" size="sm">{addToFightLabel}</Button>
        </div>
      </CardContent>
    </Card>
  )
}
