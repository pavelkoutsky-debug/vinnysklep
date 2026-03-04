import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MESSAGE_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { AdminMessage, MessageType } from '@/types/database'
import { Mail, MailOpen, Bell } from 'lucide-react'

export default function MessagesPage() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<AdminMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    loadMessages()
  }, [profile])

  const loadMessages = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('admin_messages')
        .select(`
          *,
          reads:admin_message_reads(id)
        `)
        .or(`recipient_id.eq.${profile!.id},recipient_id.is.null`)
        .order('created_at', { ascending: false })

      if (data) {
        const enriched = data.map((m: any) => ({
          ...m,
          is_read: m.reads && m.reads.length > 0,
        }))
        setMessages(enriched)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = async (msg: AdminMessage) => {
    const isExpanding = expandedId !== msg.id
    setExpandedId(isExpanding ? msg.id : null)

    if (isExpanding && !msg.is_read && profile) {
      await supabase.from('admin_message_reads').upsert({
        message_id: msg.id,
        user_id: profile.id,
      })
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m))
    }
  }

  const unreadCount = messages.filter(m => !m.is_read).length

  const messageTypeColors: Record<string, string> = {
    news: 'bg-blue-50 text-blue-700 border-blue-200',
    event: 'bg-purple-50 text-purple-700 border-purple-200',
    recommendation: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    system: 'bg-gray-50 text-gray-700 border-gray-200',
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-3">
        <h1 className="text-2xl font-bold">Zprávy</h1>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Zprávy</h1>
        {unreadCount > 0 && (
          <Badge className="bg-red-500 text-white">{unreadCount} nepřečtených</Badge>
        )}
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Žádné zprávy od administrátora.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map(msg => (
            <Card
              key={msg.id}
              className={`cursor-pointer transition-colors hover:bg-muted/30 ${!msg.is_read ? 'border-blue-200 bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
              onClick={() => handleOpen(msg)}
            >
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    {msg.is_read
                      ? <MailOpen className="h-4 w-4 text-muted-foreground" />
                      : <Mail className="h-4 w-4 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${!msg.is_read ? 'font-semibold' : 'font-medium'}`}>
                        {msg.subject}
                      </p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className={`text-xs ${messageTypeColors[msg.message_type] ?? ''}`}>
                          {MESSAGE_TYPES[msg.message_type as MessageType] ?? msg.message_type}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatDate(msg.created_at)}</p>
                    {expandedId === msg.id && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
