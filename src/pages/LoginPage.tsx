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
import { loginSchema, type LoginFormData } from '@/lib/validations'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signIn(data.email, data.password)
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Přihlášení se nezdařilo'
      if (message.includes('Invalid login credentials')) {
        toast.error('Nesprávný email nebo heslo')
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
          <CardTitle className="text-2xl">Vinný Sklep</CardTitle>
          <CardDescription>Přihlaste se ke svému sklepu</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Heslo</Label>
                <Link to="/reset-password" className="text-xs text-muted-foreground hover:text-primary">
                  Zapomenuté heslo?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Přihlašuji...' : 'Přihlásit se'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Nemáte účet?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Registrovat se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
