// ============================================================
// TRUCKZEN — VALIDATION UTILITIES
// ============================================================

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateVIN(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin)
}

export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 11
}

export function validateRequired(value: string | null | undefined): boolean {
  return value != null && value.trim().length > 0
}
