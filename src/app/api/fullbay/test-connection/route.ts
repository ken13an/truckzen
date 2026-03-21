import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const key = process.env.FULLBAY_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'FULLBAY_API_KEY not configured' })

  try {
    // Step 1: Get our public IP
    const ipRes = await fetch('https://api.ipify.org')
    const ip = (await ipRes.text()).trim()

    // Step 2: Generate token
    const today = new Date().toISOString().split('T')[0]
    const token = crypto.createHash('sha1').update(key + today + ip).digest('hex')

    // Step 3: Call Fullbay
    const url = `https://app.fullbay.com/services/getInvoices.php?key=${key}&token=${token}&startDate=${today}&endDate=${today}`
    const fbRes = await fetch(url)
    const text = await fbRes.text()

    // Parse response
    let data: any
    try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 200) } }

    if (data.status === 'SUCCESS') {
      return NextResponse.json({ ok: true, name: 'Fullbay Connected', count: data.resultCount || 0, ip })
    } else {
      return NextResponse.json({ ok: false, error: data.status || 'Unknown', ip, response: text.slice(0, 200) })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }
}
