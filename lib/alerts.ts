const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_CHAT_ID = '5370205957'
const EDGE_ALERT_THRESHOLD = 0.15  // alert on 15%+ edge

export async function sendPickAlert(pick: {
  match: string
  market: string
  pick: string
  odds: number
  edge: number
  tier: string
  sport?: string
}) {
  if (!TELEGRAM_BOT_TOKEN) return
  if (pick.edge < EDGE_ALERT_THRESHOLD) return

  const msg = [
    `🔥 HIGH EDGE PICK`,
    ``,
    `Match: ${pick.match}`,
    `Market: ${pick.market}`,
    `Pick: ${pick.pick}`,
    `Odds: ${pick.odds.toFixed(2)}`,
    `Edge: +${(pick.edge * 100).toFixed(1)}%`,
    `Tier: ${pick.tier}`,
    pick.sport ? `Sport: ${pick.sport}` : '',
  ].filter(Boolean).join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML' }),
    })
  } catch (e) {
    console.error('Alert failed:', e)
  }
}
