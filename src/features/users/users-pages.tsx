import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Save, ShieldCheck, UserRoundX, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui/core'
import { DataTable } from '@/components/ui/data'
import { can, PERMISSIONS } from '@/lib/rbac'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { useAuth } from '@/features/auth/auth-context'

const profileSchema = z.object({ full_name: z.string().min(3, 'Informe o nome completo.').max(160), phone: z.string().max(32).optional() })
type ProfileForm = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema), values: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '' } })
  const submit = async (values: ProfileForm) => {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ full_name: values.full_name, phone: values.phone || null }).eq('id', user.id)
    if (error) { toast.error('Não foi possível atualizar o perfil.'); return }
    await refreshProfile()
    toast.success('Perfil atualizado.')
  }
  return <div className="space-y-8"><PageHeader title="Meu perfil" description="Mantenha seus dados de identificação atualizados." /><Card className="max-w-2xl p-6"><div className="mb-8 flex items-center gap-4"><Avatar name={profile?.full_name || 'Usuário'} src={profile?.avatar_url} className="size-16 text-lg" /><div><h2 className="text-lg font-semibold">{profile?.full_name || 'Usuário'}</h2><p className="text-sm text-muted">{profile?.email || user?.email}</p></div></div><form className="space-y-5" onSubmit={handleSubmit(submit)}><Input label="Nome completo" error={errors.full_name?.message} {...register('full_name')} /><Input label="E-mail" value={profile?.email || user?.email || ''} readOnly disabled /><Input label="Telefone" placeholder="(93) 99999-9999" error={errors.phone?.message} {...register('phone')} /><div className="flex justify-end"><Button disabled={isSubmitting}><Save className="size-4" />{isSubmitting ? 'Salvando...' : 'Salvar alterações'}</Button></div></form></Card></div>
}

export function UsersPage() {
  const { permissions } = useAuth()
  const allowed = can(permissions, PERMISSIONS.USERS_VIEW) || can(permissions, PERMISSIONS.USERS_MANAGE)
  const query = useQuery({ queryKey: ['profiles'], enabled: allowed, queryFn: async () => { const { data, error } = await supabase.from('profiles').select('*').order('full_name'); if (error) throw error; return data as Profile[] } })
  if (!allowed) return <Card><EmptyState icon={ShieldCheck} title="Acesso restrito" description="Seu perfil não possui a permissão users.view." /></Card>
  return <div className="space-y-8"><PageHeader title="Usuários" description="Consulte os usuários e seus estados de acesso."><Button disabled={!can(permissions, PERMISSIONS.USERS_MANAGE)}>Gerenciar papéis</Button></PageHeader><Card className="overflow-hidden">{query.isLoading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div> : query.isError ? <EmptyState icon={UserRoundX} title="Não foi possível carregar usuários" description="Tente novamente em alguns instantes." /> : !query.data?.length ? <EmptyState icon={Users} title="Nenhum usuário encontrado" description="Os usuários criados no Supabase Auth aparecerão aqui." /> : <DataTable data={query.data} getKey={(row) => row.id} columns={[{ key: 'user', header: 'Usuário', cell: (row) => <div className="flex items-center gap-3"><Avatar name={row.full_name} src={row.avatar_url} /><div><p className="font-semibold">{row.full_name}</p><p className="text-xs text-muted">{row.email}</p></div></div> }, { key: 'status', header: 'Status', cell: (row) => <Badge variant={row.is_active ? 'success' : 'danger'}>{row.is_active ? 'Ativo' : 'Inativo'}</Badge> }, { key: 'created', header: 'Criado em', cell: (row) => new Date(row.created_at).toLocaleDateString('pt-BR') }]} />}</Card></div>
}
