/**
 * TruckZen — Shop Payment Instructions
 * Single source of truth for payment info displayed on invoices, emails, and PDFs.
 */

export const SHOP_PAYMENT_INFO = {
  companyName: 'UGL Truck Center Inc',
  bank: 'Chase Bank',
  ach: {
    account: '583509081',
    routing: '071000013',
  },
  wire: {
    account: '583509081',
    routing: '021000021',
  },
  zelle: [
    'accounting.truckcenter@yahoo.com',
    'sanjarbek@ugltruckcenterinc.com',
  ],
  mailTo: {
    name: 'UGL Truck Center Inc',
    address: '325 State Rte 31',
    city: 'Montgomery',
    state: 'IL',
    zip: '60538',
  },
} as const

export const SHOP_MAIL_ADDRESS = `${SHOP_PAYMENT_INFO.mailTo.name}, ${SHOP_PAYMENT_INFO.mailTo.address}, ${SHOP_PAYMENT_INFO.mailTo.city}, ${SHOP_PAYMENT_INFO.mailTo.state} ${SHOP_PAYMENT_INFO.mailTo.zip}`
