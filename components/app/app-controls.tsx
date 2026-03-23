'use client'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export function AppControls({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size={compact ? 'sm' : 'icon'}
        className={compact ? 'h-8 px-2 text-xs uppercase' : 'size-8'}
        onClick={() => setLanguage(language === 'en' ? 'cs' : 'en')}
        aria-label={t('lang.switch')}
        title={t('lang.switch')}
      >
        {language.toUpperCase()}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        aria-label={t('theme.toggle')}
        title={t('theme.toggle')}
      >
        {resolvedTheme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  )
}
