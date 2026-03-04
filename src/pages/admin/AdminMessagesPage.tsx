import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MESSAGE_TYPES } from '@/lib/constants'
import type { MessageType } from '@/types/database'
import { toast } from 'sonner'
import { Send, MessageSquare } from 'lucide-react'

export default function AdminMessagesPage() {
  const { profile } = useAuth()
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('news')
  const [recipientId, setRecipientId] = useState('all')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!profile || !subject || !content) {
      toast.error('Vyplňte předmět a obsah zprávy')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.from('admin_messages').insert({
        sender_id: profile.id,
        recipient_id: recipientId === 'all' ? null : recipientId,
        subject,
        content,
        message_type: messageType,
      })
      if (error) throw error
      toast.success('Zpráva odeslána!')
      setSubject('')
      setContent('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } catch (e: any) {
      toast.error(e.message ?? 'Chyba při odesílání')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Zprávy uživatelům</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />Nová zpráva
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Příjemce</Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všichni uživatelé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Typ zprávy</Label>
              <Select value={messageType} onValueChange={v => setMessageType(v as MessageType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MESSAGE_TYPES) as MessageType[]).map(t => (
                    <SelectItem key={t} value={t}>{MESSAGE_TYPES[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Předmět *</Label>
            <Input placeholder="Doporučení měsíce..." value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Obsah zprávy *</Label>
            <Textarea rows={6} placeholder="Text zprávy..." value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <Button onClick={handleSend} disabled={sending || sent} className="w-full">
            {sent ? '✓ Odesláno' : sending ? 'Odesílám...' : <><Send className="h-4 w-4 mr-2" />Odeslat zprávu</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
