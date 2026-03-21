export function emailWrapper(shop: { name: string; phone: string; logoUrl?: string | null }, content: string): string {
  const header = shop.logoUrl
    ? `<img src="${shop.logoUrl}" alt="${shop.name}" style="max-height: 50px; max-width: 200px;" />`
    : `<span style="font-size: 20px; font-weight: bold; color: #F0F4FF; letter-spacing: 2px;">${shop.name.toUpperCase()}</span>`

  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0B0D11; color: #DDE3EE; padding: 32px; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 24px;">${header}</div>
    ${content}
    <hr style="border: 1px solid rgba(255,255,255,0.06); margin: 24px 0;">
    <p style="color: #48536A; font-size: 11px; text-align: center;">${shop.name}${shop.phone ? ' | ' + shop.phone : ''}</p>
  </div>`
}

export function blueButton(text: string, href: string): string {
  return `<div style="text-align: center; margin: 24px 0;"><a href="${href}" style="display: inline-block; padding: 14px 40px; background: #1B6EE6; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">${text}</a></div>`
}

export function infoCard(label: string, value: string): string {
  return `<div style="background: #161B24; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
    <p style="margin: 0; color: #7C8BA0; font-size: 12px; text-transform: uppercase;">${label}</p>
    <p style="margin: 4px 0 0; font-size: 20px; font-weight: bold; color: #F0F4FF;">${value}</p>
  </div>`
}
