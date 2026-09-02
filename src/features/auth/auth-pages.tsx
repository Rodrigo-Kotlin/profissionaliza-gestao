import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { BrandLogo } from '@/components/brand'
import { Button, Checkbox, Input } from '@/components/ui/core'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { writeAuditLog } from '@/services/audit-service'
import { useAuth } from './auth-context'

const loginSchema = z.object({ email: z.email('Informe um e-mail válido.'), password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'), remember: z.boolean() })
type LoginData = z.infer<typeof loginSchema>

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginData>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', remember: true } })
  if (session) return <Navigate to="/" replace />

  const onSubmit = async (values: LoginData) => {
    if (!isSupabaseConfigured) { toast.error('Configure as variáveis do Supabase para entrar.'); return }
    const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
    if (error) { toast.error(error.message.includes('Invalid') ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Tente novamente.'); return }
    await writeAuditLog('auth.login', 'session')
    navigate('/', { replace: true })
  }

  return <main className="grid min-h-screen lg:grid-cols-[45%_55%]">
    <section className="relative hidden overflow-hidden bg-navy p-12 lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_2px_2px,rgba(255,255,255,.1)_1px,transparent_0)] [background-size:24px_24px]" />
      <div className="relative"><BrandLogo variant="horizontal" size="md" /></div>
      <div className="relative max-w-lg"><h1 className="text-5xl font-bold leading-[1.18] text-white">Educação profissional<br />com gestão inteligente.</h1><p className="mt-7 text-lg leading-7 text-white/55">A plataforma completa para instituições de ensino alcançarem a excelência administrativa e pedagógica.</p></div>
    </section>
    <section className="relative flex items-center justify-center bg-white px-4 py-24 sm:px-12">
      <div className="absolute left-5 top-5 lg:hidden"><BrandLogo variant="mark" size="md" /></div>
      <div className="w-full max-w-[420px]">
        <h1 className="text-[28px] font-bold md:text-[32px]">Bem-vindo de volta</h1>
        <p className="mt-1 text-base text-muted">Insira suas credenciais para acessar a plataforma.</p>
        {!isSupabaseConfigured && <div role="alert" className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Ambiente não configurado. Defina as variáveis descritas em <code>.env.example</code>.</div>}
        <form className="mt-10 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="relative"><Mail className="absolute left-3 top-[37px] z-10 size-5 text-muted" /><Input label="E-mail corporativo" placeholder="nome@instituicao.com.br" className="pl-10" autoComplete="email" error={errors.email?.message} {...register('email')} /></div>
          <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">Senha</label><Link to="/recuperar-senha" className="text-xs font-semibold text-navy hover:underline">Esqueci minha senha</Link></div><div className="relative"><LockKeyhole className="absolute left-3 top-3 size-5 text-muted" /><Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="pl-10 pr-11" autoComplete="current-password" error={errors.password?.message} {...register('password')} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1.5 grid size-9 place-items-center rounded-md text-muted hover:bg-navy-50">{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></div></div>
          <label className="flex items-center gap-2 text-sm text-muted"><Checkbox {...register('remember')} />Lembrar acesso</label>
          <Button variant="gold" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? 'Entrando...' : 'Entrar'}</Button>
        </form>
        <p className="mt-12 text-center text-sm text-muted">Precisa de ajuda? <a href="mailto:suporte@profissionaliza.com.br" className="font-semibold text-navy hover:underline">Fale com o suporte</a></p>
      </div>
    </section>
  </main>
}

const recoverySchema = z.object({ email: z.email('Informe um e-mail válido.') })
export function RecoveryPage() {
  const { register, handleSubmit, formState: { errors, isSubmitting, isSubmitSuccessful } } = useForm<{ email: string }>({ resolver: zodResolver(recoverySchema) })
  const submit = async ({ email }: { email: string }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/redefinir-senha` })
    if (error) toast.error('Não foi possível enviar o link.'); else toast.success('Se o e-mail existir, você receberá as instruções.')
  }
  return <AuthCard title="Recuperar senha" description="Enviaremos um link seguro para redefinir sua senha.">{isSubmitSuccessful ? <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Solicitação processada. Verifique sua caixa de entrada e spam.</div> : <form className="space-y-5" onSubmit={handleSubmit(submit)}><Input label="E-mail corporativo" error={errors.email?.message} {...register('email')} /><Button className="w-full" disabled={isSubmitting}>Enviar link</Button></form>}<Link to="/login" className="mt-6 block text-center text-sm font-semibold text-navy">Voltar ao login</Link></AuthCard>
}

const passwordSchema = z.object({ password: z.string().min(8, 'Use ao menos 8 caracteres.') })
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ password: string }>({ resolver: zodResolver(passwordSchema) })
  const submit = async ({ password }: { password: string }) => { const { error } = await supabase.auth.updateUser({ password }); if (error) toast.error('Não foi possível redefinir a senha.'); else { toast.success('Senha atualizada.'); navigate('/') } }
  return <AuthCard title="Definir nova senha" description="Escolha uma senha forte e exclusiva."><form className="space-y-5" onSubmit={handleSubmit(submit)}><Input label="Nova senha" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} /><Button className="w-full" disabled={isSubmitting}>Atualizar senha</Button></form></AuthCard>
}

function AuthCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <main className="grid min-h-screen place-items-center bg-canvas p-4"><section className="w-full max-w-md rounded-card border bg-white p-6 shadow-card sm:p-8"><BrandLogo variant="mark" size="md" /><h1 className="mt-8 text-2xl font-bold">{title}</h1><p className="mb-8 mt-1 text-sm text-muted">{description}</p>{children}</section></main> }
