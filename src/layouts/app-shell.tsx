import {
  AppWindow, Bell, BookOpen, ChevronLeft, ChevronRight, CircleDollarSign, CircleHelp,
  GraduationCap, LayoutDashboard, LogOut, Menu, Percent, Plus, Search, Settings,
  ShieldCheck, ShoppingBag, UserCircle, UserRoundSearch, X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/brand'
import { OfflineBanner } from '@/components/offline-banner'
import { Avatar, Button } from '@/components/ui/core'
import { Drawer, DropdownItem, DropdownMenu, Tooltip } from '@/components/ui/overlays'
import { cn } from '@/lib/utils'
import { isDevEnvironment } from '@/lib/env'
import { can, PERMISSIONS } from '@/lib/rbac'
import type { PermissionCode } from '@/types/database'
import { writeAuditLog } from '@/services/audit-service'
import { useAuth } from '@/features/auth/auth-context'
import { CommandPalette } from '@/features/search/command-palette'

type NavigationSection = { label?: string; items: NavigationItem[] }
type NavigationItem = { label: string; icon: React.ElementType; to: string; available?: boolean; permission?: PermissionCode }

const navigationSections: NavigationSection[] = [
  { items: [{ label: 'Visão Geral', icon: LayoutDashboard, to: '/', available: true }] },
  {
    label: 'Operação',
    items: [{ label: 'CRM', icon: UserRoundSearch, to: '/crm' }, { label: 'Vendas', icon: ShoppingBag, to: '/vendas' }]
  },
  {
    label: 'Acadêmico',
    items: [{ label: 'Alunos', icon: GraduationCap, to: '/alunos', available: true, permission: PERMISSIONS.STUDENTS_VIEW }, { label: 'Pedagógico', icon: BookOpen, to: '/pedagogico' }]
  },
  {
    label: 'Gestão',
    items: [{ label: 'Financeiro', icon: CircleDollarSign, to: '/financeiro' }, { label: 'Comissões', icon: Percent, to: '/comissoes' }, { label: 'Relatórios', icon: AppWindow, to: '/relatorios' }]
  },
  {
    label: 'Administração',
    items: [{ label: 'Configurações', icon: Settings, to: '/configuracoes' }, { label: 'Usuários', icon: ShieldCheck, to: '/administracao/usuarios', available: true, permission: PERMISSIONS.USERS_VIEW }]
  }
]

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(true) } }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler) }, [])
  const name = profile?.full_name || user?.email?.split('@')[0] || 'Usuário'
  const logout = async () => { await writeAuditLog('auth.logout', 'session'); await signOut(); navigate('/login', { replace: true }) }
  return <div className="min-h-screen bg-canvas">
    <a href="#main" className="skip-link">Pular para o conteúdo</a>
    <aside className={cn('fixed inset-y-0 left-0 z-50 hidden bg-navy transition-[width] duration-200 lg:block', collapsed ? 'w-[84px]' : 'w-[264px]')}><Sidebar collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} onLogout={logout} /></aside>
    <Drawer open={mobileOpen} onOpenChange={setMobileOpen} title="Menu principal"><Sidebar onLogout={logout} onClose={() => setMobileOpen(false)} /></Drawer>
    <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[84px]' : 'lg:pl-[264px]')}>
      <header className="safe-top fixed right-0 top-0 z-40 flex h-16 w-full items-center gap-2 border-b bg-white/95 px-4 backdrop-blur md:px-6 lg:left-[264px] lg:w-auto" style={collapsed ? { left: 84 } : undefined}>
        <button aria-label="Abrir menu" className="mr-1 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-navy-50 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
        <BrandLogo variant="mark" size="sm" className="mr-1 shrink-0 lg:hidden" />
        <button onClick={() => setCommandOpen(true)} className="relative hidden min-w-0 flex-1 max-w-[560px] text-left md:block"><span className="flex min-h-11 items-center gap-3 rounded-lg border bg-navy-50 py-3 pl-10 pr-14"><Search className="absolute left-3 top-3 size-5 text-muted" /><span className="truncate text-sm text-muted">Buscar aluno, venda, contrato, turma...</span></span><kbd className="absolute right-3 top-3 rounded border bg-white px-1.5 text-[10px] text-muted">Ctrl K</kbd></button>
        {isDevEnvironment && <span className="ml-auto hidden shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 md:inline-block" title="Ambiente de desenvolvimento/homologação">DEV</span>}
        <div className={cn('flex shrink-0 items-center gap-1 sm:gap-2', isDevEnvironment ? '' : 'ml-auto')}>
          <Button aria-label="Abrir busca" variant="ghost" className="shrink-0 px-3 md:hidden" onClick={() => setCommandOpen(true)}><Search className="size-5" /></Button>
          <Button aria-label="Aplica ações" variant="ghost" className="hidden shrink-0 px-3 xl:inline-flex"><AppWindow className="size-5" /></Button>
          <Button aria-label="Ajuda" variant="ghost" className="hidden shrink-0 px-3 lg:inline-flex"><CircleHelp className="size-5" /></Button>
          <Button aria-label="Notificações" variant="ghost" className="relative shrink-0 px-3"><Bell className="size-5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-white" /></Button>
          <span className="mx-1 hidden h-8 w-px shrink-0 bg-line sm:block" />
          <Button className="hidden shrink-0 whitespace-nowrap sm:inline-flex"><Plus className="size-4" />Criar</Button>
          <DropdownMenu trigger={<button aria-label="Menu do usuário" className="ml-1 flex shrink-0 items-center gap-2.5 rounded-lg p-1 pr-1 hover:bg-navy-50"><Avatar name={name} src={profile?.avatar_url} /><span className="hidden min-w-0 text-right xl:block"><span className="block max-w-[140px] truncate text-sm font-semibold leading-4 text-ink">{name}</span><span className="mt-0.5 block text-xs text-muted">Gestão</span></span></button>}><DropdownItem onSelect={() => navigate('/perfil')}><UserCircle className="size-4" />Meu perfil</DropdownItem><DropdownItem onSelect={logout} danger><LogOut className="size-4" />Sair</DropdownItem></DropdownMenu>
        </div>
      </header>
      <main id="main" className="min-h-screen pt-16"><div className="surface-max p-4 safe-bottom md:p-6 lg:p-8"><Outlet /></div></main>
    </div>
    <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    <OfflineBanner />
  </div>
}

function Sidebar({ collapsed = false, onCollapse, onLogout, onClose }: { collapsed?: boolean; onCollapse?: () => void; onLogout: () => void; onClose?: () => void }) {
  const navigate = useNavigate()
  const { permissions } = useAuth()
  const visibleSections = navigationSections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.permission || can(permissions, item.permission)) }))
    .filter((section) => section.items.length > 0)
  return <div className="flex h-full flex-col">
    <div className={cn('flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-5', collapsed && 'justify-center px-3')}><div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>{collapsed ? <BrandLogo variant="mark" size="lg" className="mx-auto" /> : <BrandLogo variant="horizontal" size="md" />}{onClose && <button aria-label="Fechar menu" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-white/70 hover:bg-white/10"><X className="size-5" /></button>}</div></div>
    <div className={cn('shrink-0 p-4 pb-2', collapsed && 'px-3')}>
      {collapsed ? (
        <Tooltip content="Novo Registro">
          <Button variant="gold" className="h-12 w-full px-0"><Plus className="size-5 shrink-0" /></Button>
        </Tooltip>
      ) : (
        <Button variant="gold" className="h-12 w-full"><Plus className="size-5 shrink-0" />Novo Registro</Button>
      )}
    </div>
    <nav aria-label="Menu principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-3 scrollbar-navy">
      {visibleSections.map((section) => (
        <div key={section.label ?? section.items[0]!.label} className="space-y-1">
          {section.label && !collapsed && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">{section.label}</p>}
          {section.label && collapsed && <div className="mx-3 mb-1 border-t border-white/10" />}
          {section.items.map((item) => <SidebarItem key={item.label} item={item} collapsed={collapsed} navigate={navigate} />)}
        </div>
      ))}
    </nav>
    <div className="shrink-0 border-t border-white/10 p-3">
      {collapsed ? (
        <>
          <Tooltip content="Perfil">
            <button onClick={() => navigate('/perfil')} className="flex h-11 w-full items-center justify-center gap-3 rounded-lg px-2 text-sm text-white/65 hover:bg-white/[.07] hover:text-white"><UserCircle className="size-5 shrink-0" /></button>
          </Tooltip>
          <Tooltip content="Sair">
            <button onClick={onLogout} className="flex h-11 w-full items-center justify-center gap-3 rounded-lg px-2 text-sm text-white/65 hover:bg-white/[.07] hover:text-white"><LogOut className="size-5 shrink-0" /></button>
          </Tooltip>
        </>
      ) : (
        <>
          <button onClick={() => navigate('/perfil')} className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/65 hover:bg-white/[.07] hover:text-white"><UserCircle className="size-5 shrink-0" />Perfil</button>
          <button onClick={onLogout} className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/65 hover:bg-white/[.07] hover:text-white"><LogOut className="size-5 shrink-0" />Sair</button>
        </>
      )}
      {onCollapse && <button aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={onCollapse} className="mt-1 flex h-10 w-full items-center justify-center rounded-lg text-white/55 hover:bg-white/[.07]">{collapsed ? <ChevronRight className="size-5" /> : <><ChevronLeft className="mr-2 size-5" /><span className="text-xs">Recolher menu</span></>}</button>}
    </div>
  </div>
}

function SidebarItem({ item, collapsed, navigate }: { item: NavigationItem; collapsed: boolean; navigate: (to: string) => void }) {
  const base = cn('flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition', collapsed && 'justify-center px-2')
  const icon = (active = false) => <IconBox icon={item.icon} active={active} />

  if (item.available) {
    return (
      <NavLink end={item.to === '/'} to={item.to} className={({ isActive }) => cn(base, isActive ? 'bg-navy-100/25 text-white' : 'text-white/65 hover:bg-white/[.07] hover:text-white')}>
        {({ isActive }) => (
          collapsed ? (
            <Tooltip content={item.label}>
              {icon(isActive)}
            </Tooltip>
          ) : (
            <>
              {icon(isActive)}
              <span className="min-w-0 truncate text-current">{item.label}</span>
            </>
          )
        )}
      </NavLink>
    )
  }
  return collapsed ? (
    <Tooltip content={`${item.label} · disponível em breve`}>
      <button onClick={() => navigate(`/em-breve?modulo=${encodeURIComponent(item.label)}`)} className={cn(base, 'text-white/65 hover:bg-white/[.07] hover:text-white')}>{icon()}</button>
    </Tooltip>
  ) : (
    <button onClick={() => navigate(`/em-breve?modulo=${encodeURIComponent(item.label)}`)} className={cn(base, 'text-white/65 hover:bg-white/[.07] hover:text-white')}>{icon()}<span className="min-w-0 truncate text-current">{item.label}</span></button>
  )
}

function IconBox({ icon: Icon, active = false }: { icon: React.ElementType; active?: boolean }) {
  return <span className="grid size-6 shrink-0 place-items-center"><Icon className={cn('size-5', active ? 'text-gold-light' : 'text-white/60')} /></span>
}
