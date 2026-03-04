import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { Wine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { registerSchema, type RegisterFormData } from '@/lib/validations'

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      await signUp(data.email, data.password, data.full_name)
      toast.success('Registrace úspěšná! Zkontrolujte email pro potvrzení.')
      navigate('/login')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registrace se nezdařila'
      if (message.includes('already registered')) {
        toast.error('Tento email je již zaregistrován')
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-wine-950 via-wine-900 to-wine-800 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Wine className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Vytvořit účet</CardTitle>
          <CardDescription>Správa vašeho vinného sklepa</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Jméno</Label>
              <Input
                id="full_name"
                type="text"
                placeholder="Jan Novák"
                autoComplete="name"
                {...register('full_name')}
              />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vas@email.cz"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Heslo</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 znaků, 1 velké, 1 číslo"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirm">Potvrdit heslo</Label>
              <Input
                id="password_confirm"
                type="password"
                autoComplete="new-password"
                {...register('password_confirm')}
              />
              {errors.password_confirm && <p className="text-xs text-destructive">{errors.password_confirm.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Registruji...' : 'Zaregistrovat se'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Již máte účet?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Přihlásit se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
