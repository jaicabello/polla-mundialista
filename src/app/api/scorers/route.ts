import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API key no configurada' }, { status: 500 })
  }

  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/scorers?limit=10',
    { headers: { 'X-Auth-Token': apiKey } },
  )

  if (!res.ok) {
    return NextResponse.json({ error: `Football API: ${res.status}` }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
