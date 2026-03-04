import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { User, Lock, Bell } from 'lucide-react'

export default function SettingsPage() {
  const { profile, refreshProfile, resetPassword } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [currency, setCurrency] = useState(profile?.preferred_currency ?? 'CZK')
  const [savingProfile, setSavingProfile] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleSaveProfile = async () => {
    if (!profile) return
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName, preferred_currency: currency })
        .eq('id', profile.id)
      if (error) throw error
      await refreshProfile()
      toast.success('Profil uložen')
    } catch {
      toast.error('Chyba při ukládání')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleResetPassword = async () => {
    if (!profile?.email) return
    try {
      await resetPassword(profile.email)
      setResetSent(true)
      toast.success('Email pro reset hesla odeslán')
    } catch {
      toast.error('Chyba při odesílání emailu')
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Nastavení</h1>

      {/* Profil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input value={profile?.email ?? ''} disabled className="text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <Label>Celé jméno</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jan Novák" />
          </div>
          <div className="space-y-1">
            <Label>Preferovaná měna</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CZK">CZK – Česká koruna</SelectItem>
                <SelectItem value="EUR">EUR – Euro</SelectItem>
                <SelectItem value="USD">USD – Dolar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
            {savingProfile ? 'Ukládám...' : 'Uložit profil'}
          </Button>
        </CardContent>
      </Card>

      {/* Bezpečnost */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />Bezpečnost
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Reset hesla vám pošleme na váš email: <strong>{profile?.email}</strong>
          </p>
          <Button variant="outline" onClick={handleResetPassword} disabled={resetSent}>
            {resetSent ? 'Email odeslán ✓' : 'Odeslat reset hesla'}
          </Button>
        </CardContent>
      </Card>

      {/* Info o účtu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />Informace o účtu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{profile?.role === 'admin' ? '👑 Administrátor' : 'Uživatel'}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span className="text-muted-foreground">Registrace</span>
            <span className="font-medium">
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('cs-CZ')
                : '–'}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
