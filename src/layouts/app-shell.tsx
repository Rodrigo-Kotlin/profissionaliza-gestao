import {
  AppWindow, Bell, BookOpen, ChevronLeft, ChevronRight, CircleDollarSign, CircleHelp,
  GraduationCap, LayoutDashboard, LogOut, Menu, Percent, Plus, Search, Settings,
  ShieldCheck, ShoppingBag, UserCircle, UserRoundSearch, X
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '@/components/brand'
import { Avatar, Button } from '@/components/ui/core'
import { Drawer, DropdownItem, DropdownMenu, Tooltip } from '@/components/ui/overlays'
import { cn } from '@/lib/utils'
import { writeAuditLog } from '@/services/audit-service'
import { useAuth } from '@/features/auth/auth-context'
import { CommandPalette } from '@/features/search/command-palette'

const navigation = [
  { label: 'Visão Geral', icon: LayoutDashboard, to: '/', available: true },
  { label: 'CRM', icon: UserRoundSearch, to: '/crm' },
  { label: 'Vendas', icon: ShoppingBag, to: '/vendas' },
  { label: 'Alunos', icon: GraduationCap, to: '/alunos' },
  { label: 'Pedagógico', icon: BookOpen, to: '/pedagogico' },
  { label: 'Financeiro', icon: CircleDollarSign, to: '/financeiro' },
  { label: 'Comissões', icon: Percent, to: '/comissoes' },
  { label: 'Relatórios', icon: AppWindow, to: '/relatorios' },
  { label: 'Administração', icon: ShieldCheck, to: '/administracao/usuarios', available: true },
  { label: 'Configurações', icon: Settings, to: '/configuracoes' }
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
    <aside className={cn('fixed inset-y-0 left-0 z-50 hidden bg-navy transition-[width] duration-200 lg:block', collapsed ? 'w-[84px]' : 'w-[260px]')}><Sidebar collapsed={collapsed} onCollapse={() => setCollapsed((value) => !value)} onLogout={logout} /></aside>
    <Drawer open={mobileOpen} onOpenChange={setMobileOpen} title="Menu principal"><Sidebar onLogout={logout} onClose={() => setMobileOpen(false)} /></Drawer>
    <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[84px]' : 'lg:pl-[260px]')}>
      <header className="fixed right-0 top-0 z-40 flex h-16 w-full items-center border-b bg-white/95 px-4 backdrop-blur md:px-6 lg:w-auto lg:left-[260px]" style={collapsed ? { left: 84 } : undefined}>
        <button aria-label="Abrir menu" className="mr-2 grid size-10 place-items-center rounded-lg hover:bg-navy-50 lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button>
        <button onClick={() => setCommandOpen(true)} className="relative hidden w-full max-w-[480px] text-left md:block"><Search className="absolute left-3 top-2.5 size-5 text-muted" /><span className="block min-h-11 rounded-lg border bg-navy-50 py-3 pl-10 pr-14 text-sm text-muted">Buscar aluno, venda, contrato, turma...</span><kbd className="absolute right-3 top-3 rounded border bg-white px-1.5 text-[10px] text-muted">Ctrl K</kbd></button>
        <div className="ml-auto flex items-center gap-1 sm:gap-2"><Button aria-label="Abrir busca" variant="ghost" className="md:hidden" onClick={() => setCommandOpen(true)}><Search className="size-5" /></Button><Button aria-label="Notificações" variant="ghost" className="relative px-3"><Bell className="size-5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-red-600 ring-2 ring-white" /></Button><Button aria-label="Ajuda" variant="ghost" className="hidden px-3 sm:inline-flex"><CircleHelp className="size-5" /></Button><Button aria-label="Aplicações" variant="ghost" className="hidden px-3 sm:inline-flex"><AppWindow className="size-5" /></Button><span className="mx-2 hidden h-8 w-px bg-line sm:block" /><Button className="hidden sm:inline-flex"><Plus className="size-4" />Criar</Button><DropdownMenu trigger={<button aria-label="Menu do usuário" className="ml-1 flex items-center gap-2 rounded-lg p-1 hover:bg-navy-50"><div className="hidden text-right xl:block"><p className="text-sm font-semibold leading-4">{name}</p><p className="mt-1 text-xs text-muted">Gestão</p></div><Avatar name={name} src={profile?.avatar_url} /></button>}><DropdownItem onSelect={() => navigate('/perfil')}><UserCircle className="size-4" />Meu perfil</DropdownItem><DropdownItem onSelect={logout} danger><LogOut className="size-4" />Sair</DropdownItem></DropdownMenu></div>
      </header>
      <main className="min-h-screen pt-16"><div className="mx-auto max-w-[1504px] p-4 md:p-6 lg:p-8"><Outlet /></div></main>
    </div>
    <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
  </div>
}

function Sidebar({ collapsed = false, onCollapse, onLogout, onClose }: { collapsed?: boolean; onCollapse?: () => void; onLogout: () => void; onClose?: () => void }) {
  const navigate = useNavigate()
  return <div className="flex h-full flex-col overflow-y-auto scrollbar-thin">
    <div className={cn('flex items-center justify-between border-b border-white/10 p-5', collapsed && 'justify-center px-3')}><Brand compact={collapsed} light />{onClose && <button aria-label="Fechar menu" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-white/70 hover:bg-white/10"><X className="size-5" /></button>}</div>
    <div className={cn('p-4', collapsed && 'px-3')}><Tooltip content="Novo Registro"><Button variant="gold" className={cn('w-full', collapsed && 'px-0')}><Plus className="size-5" />{!collapsed && 'Novo Registro'}</Button></Tooltip></div>
    <nav aria-label="Menu principal" className="flex-1 space-y-1 px-3 py-2">{navigation.map((item, index) => <div key={item.label}>{index === 8 && <div className="my-3 border-t border-white/10" />}{item.available ? <Tooltip content={item.label}><NavLink end={item.to === '/'} to={item.to} className={({ isActive }) => cn('flex min-h-11 items-center gap-3 rounded-lg border-l-4 border-transparent px-3 text-sm font-medium text-white/65 transition hover:bg-white/[.07] hover:text-white', isActive && 'border-gold bg-gold/10 text-gold-light', collapsed && 'justify-center px-2')}><item.icon className="size-5 shrink-0" />{!collapsed && item.label}</NavLink></Tooltip> : <Tooltip content={`${item.label} · disponível em breve`}><button onClick={() => navigate(`/em-breve?modulo=${encodeURIComponent(item.label)}`)} className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg border-l-4 border-transparent px-3 text-sm font-medium text-white/65 transition hover:bg-white/[.07] hover:text-white', collapsed && 'justify-center px-2')}><item.icon className="size-5 shrink-0" />{!collapsed && item.label}</button></Tooltip>}</div>)}</nav>
    <div className="border-t border-white/10 p-3"><Tooltip content="Perfil"><button onClick={() => navigate('/perfil')} className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/65 hover:bg-white/[.07] hover:text-white', collapsed && 'justify-center')}><UserCircle className="size-5" />{!collapsed && 'Perfil'}</button></Tooltip><Tooltip content="Sair"><button onClick={onLogout} className={cn('flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/65 hover:bg-white/[.07] hover:text-white', collapsed && 'justify-center')}><LogOut className="size-5" />{!collapsed && 'Sair'}</button></Tooltip>{onCollapse && <button aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} onClick={onCollapse} className="mt-2 flex min-h-10 w-full items-center justify-center rounded-lg text-white/55 hover:bg-white/[.07]">{collapsed ? <ChevronRight className="size-5" /> : <><ChevronLeft className="mr-2 size-5" /><span className="text-xs">Recolher menu</span></>}</button>}</div>
  </div>
}
