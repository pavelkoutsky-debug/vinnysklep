import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Wine, CheckCircle, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { resetPasswordSchema, newPasswordSchema } from '@/lib/validations'

type EmailFormData = z.infer<typeof resetPasswordSchema>
type NewPasswordFormData = z.infer<typeof newPasswordSchema>

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [sent, setSent] = useState(false)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)

  // Detect PASSWORD_RECOVERY event (Supabase exchanges the code from URL automatically)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveryMode(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const passwordForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
  })

  const onSendEmail = async (data: EmailFormData) => {
    try {
      await resetPassword(data.email)
      setSent(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nepodařilo se odeslat reset link')
    }
  }

  const onSetNewPassword = async (data: NewPasswordFormData) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      setPasswordChanged(true)
      toast.success('Heslo bylo úspěšně změněno')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Nepodařilo se změnit heslo')
    }
  }

  // State: new password successfully set
  if (passwordChanged) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <CheckCircle className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle>Heslo změněno</CardTitle>
            <CardDescription>Vaše heslo bylo úspěšně změněno. Přesměrovávám...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // State: recovery mode – show new password form
  if (isRecoveryMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <KeyRound className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle>Nové heslo</CardTitle>
            <CardDescription>Zadejte nové heslo pro váš účet.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={passwordForm.handleSubmit(onSetNewPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nové heslo</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimálně 8 znaků, 1 velké, 1 číslo"
                  {...passwordForm.register('password')}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password_confirm">Potvrdit heslo</Label>
                <Input
                  id="password_confirm"
                  type="password"
                  placeholder="Zopakujte nové heslo"
                  {...passwordForm.register('password_confirm')}
                />
                {passwordForm.formState.errors.password_confirm && (
                  <p className="text-xs text-destructive">{passwordForm.formState.errors.password_confirm.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting ? 'Ukládám...' : 'Nastavit nové heslo'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Default state: email form to request reset link
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            {sent ? <CheckCircle className="h-7 w-7 text-primary-foreground" /> : <Wine className="h-7 w-7 text-primary-foreground" />}
          </div>
          <CardTitle>{sent ? 'Email odeslán' : 'Zapomenuté heslo'}</CardTitle>
          <CardDescription>
            {sent
              ? 'Zkontrolujte svůj email a klikněte na odkaz pro reset hesla.'
              : 'Zadejte váš email a pošleme vám odkaz pro reset hesla.'}
          </CardDescription>
        </CardHeader>
        {!sent && (
          <CardContent>
            <form onSubmit={emailForm.handleSubmit(onSendEmail)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vas@email.cz"
                  {...emailForm.register('email')}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={emailForm.formState.isSubmitting}>
                {emailForm.formState.isSubmitting ? 'Odesílám...' : 'Odeslat reset link'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary hover:underline">← Zpět na přihlášení</Link>
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
