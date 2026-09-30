import { defaultScope, getAlertBoard } from '@/lib/data/alerts'
import { LEVELS, type Level } from '@/lib/alerts/rules'
import { NavBell } from './NavBell'

/** メニューのベル（件数はあとから届く。画面の表示を待たせない） */
export async function NavBellCount({ userId, role, variant }: { userId: string; role: string; variant?: 'top' | 'side' }) {
  const board = await getAlertBoard(userId, defaultScope({ role }))
  const level = board.open.reduce<Level | null>((top, a) => (!top || LEVELS[a.level].rank > LEVELS[top].rank ? a.level : top), null)
  return <NavBell count={board.open.length} level={level} variant={variant} />
}
