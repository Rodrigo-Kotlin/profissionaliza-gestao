import { cn } from '@/lib/utils'

type BrandVariant = 'mark' | 'horizontal'
type BrandSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type BrandTheme = 'dark' | 'light'

const markSizes: Record<BrandSize, string> = {
  xs: 'size-8',
  sm: 'size-10',
  md: 'size-12',
  lg: 'size-16',
  xl: 'size-20'
}

const horizontalSizes: Record<BrandSize, string> = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
  xl: 'h-16'
}

export function BrandLogo({
  variant = 'mark',
  size = 'md',
  theme = 'dark',
  className
}: {
  variant?: BrandVariant
  size?: BrandSize
  theme?: BrandTheme
  className?: string
}) {
  if (variant === 'mark') {
    return (
      <img
        src="/logo/mark.png"
        alt="Profissionaliza"
        className={cn('object-contain', markSizes[size], className)}
        draggable={false}
      />
    )
  }

  // A versão horizontal oficial é branca e deve ser usada apenas sobre fundo escuro (navy).
  if (theme === 'light') {
    return (
      <img
        src="/logo/mark.png"
        alt="Profissionaliza"
        className={cn('object-contain', markSizes[size === 'xl' ? 'lg' : size === 'xs' ? 'xs' : 'md'], className)}
        draggable={false}
      />
    )
  }

  return (
    <img
      src="/logo/horizontal.png"
      alt="Profissionaliza"
      className={cn('object-contain', horizontalSizes[size], className)}
      draggable={false}
    />
  )
}
