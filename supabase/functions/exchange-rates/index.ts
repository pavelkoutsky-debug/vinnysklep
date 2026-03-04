// Supabase Edge Function: exchange-rates
// Nasazení: supabase functions deploy exchange-rates
// Cron: každý den v 6:00 UTC
//
// Stahuje aktuální kurzy z ECB (Evropská centrální banka)
// a ukládá je do tabulky exchange_rates.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ECB XML API – vrací kurzy vůči EUR
const ECB_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'

async function fetchEcbRates(): Promise<Record<string, number>> {
  const res = await fetch(ECB_URL)
  const xml = await res.text()
  const rates: Record<string, number> = { EUR: 1 }

  const matches = xml.matchAll(/currency='([A-Z]+)'\s+rate='([\d.]+)'/g)
  for (const m of matches) {
    rates[m[1]] = parseFloat(m[2])
  }
  return rates
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const rates = await fetchEcbRates()

    // Uložit klíčové kurzy (EUR jako základ)
    const currencies = ['CZK', 'USD', 'GBP', 'CHF']
    const upsertData = []

    for (const from of currencies) {
      for (const to of currencies) {
        if (from === to) continue
        const fromRate = rates[from] ?? 1
        const toRate = rates[to] ?? 1
        upsertData.push({
          base_currency: from,
          target_currency: to,
          rate: toRate / fromRate,
          fetched_at: new Date().toISOString(),
        })
      }
      // EUR -> měna
      upsertData.push({ base_currency: 'EUR', target_currency: from, rate: rates[from] ?? 1, fetched_at: new Date().toISOString() })
      // měna -> EUR
      upsertData.push({ base_currency: from, target_currency: 'EUR', rate: 1 / (rates[from] ?? 1), fetched_at: new Date().toISOString() })
    }

    const { error } = await supabase
      .from('exchange_rates')
      .upsert(upsertData, { onConflict: 'base_currency,target_currency' })

    if (error) throw error

    return new Response(JSON.stringify({
      success: true,
      updated: upsertData.length,
      rates: { CZK: rates.CZK, USD: rates.USD },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
