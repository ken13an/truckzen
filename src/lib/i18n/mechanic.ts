/**
 * TruckZen — Mechanic-only i18n (static dictionaries).
 *
 * Scope: ONLY the mechanic-facing surface (currently src/app/mechanic/dashboard/page.tsx).
 * Not a global app i18n. Dictionaries live in code; persistence uses the
 * existing users.language column (read/written via the existing mechanic
 * dashboard API path through Supabase).
 *
 * Adding a new key:
 *   1. Add the key to every locale below.
 *   2. Use `t('mechanic.your_key')` in the mechanic surface.
 */

export type MechanicLang = 'en' | 'es' | 'ru' | 'uz'

export interface MechanicLanguageOption {
  code: MechanicLang
  label: string
}

export const MECHANIC_LANGUAGES: MechanicLanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Espa\u00f1ol' },
  { code: 'ru', label: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
  { code: 'uz', label: "O'zbek" },
]

export const MECHANIC_DEFAULT_LANG: MechanicLang = 'en'

export function isSupportedMechanicLang(code: unknown): code is MechanicLang {
  return code === 'en' || code === 'es' || code === 'ru' || code === 'uz'
}

type MechanicDict = Record<string, string>

const en: MechanicDict = {
  // nav / tabs
  'mechanic.tab.my_jobs':        'My Jobs',
  'mechanic.tab.parts_requests': 'Parts Requests',
  'mechanic.tab.profile':        'Profile',
  // loading / empty
  'mechanic.loading_dashboard':  'Loading dashboard...',
  'mechanic.no_jobs_assigned':   'No jobs assigned to you yet',
  'mechanic.no_parts_requests':  'No parts requests yet',
  // punch in card
  'mechanic.not_punched_in':     'Not Punched In',
  'mechanic.punch_message':      'Punch in to start your shift before working on jobs',
  'mechanic.punch_in':           'Punch In',
  'mechanic.locating':           'Locating...',
  'mechanic.punching':           'Punching...',
  // override modal
  'mechanic.outside_shop_area':       'Outside Shop Area',
  'mechanic.override_reason_placeholder': 'Reason (e.g., road call, parking lot)',
  'mechanic.override_punch_in':       'Override & Punch In',
  // job statuses
  'mechanic.status.working_now':      'Working Now',
  'mechanic.status.paused':           'Paused',
  'mechanic.status.done':             'Done',
  'mechanic.status.pending':          'Pending',
  'mechanic.status.assigned':         'Assigned',
  // job actions
  'mechanic.action.decline_job':      'Decline Job',
  'mechanic.action.request_more_time':'Request More Time',
  'mechanic.action.complete_job':     'Complete Job?',
  'mechanic.action.request_parts':    'Request Parts',
  'mechanic.action.decline_reason_placeholder': 'Reason for declining...',
  'mechanic.action.parts_details_placeholder':  'Any additional details...',
  'mechanic.action.submit_request':   'Submit Request',
  'mechanic.action.submitting':       'Submitting...',
  // parts requests block
  'mechanic.parts.heading':           'Parts Requests',
  // profile labels
  'mechanic.profile.heading':         'Profile',
  'mechanic.profile.name':            'Name',
  'mechanic.profile.email':           'Email',
  'mechanic.profile.role':            'Role',
  'mechanic.profile.team':            'Team',
  'mechanic.profile.skills':          'Skills',
  'mechanic.profile.language':        'Language',
  'mechanic.profile.save_language':   'Save Language',
  'mechanic.profile.saving':          'Saving...',
  'mechanic.profile.sign_out':        'Sign Out',
  // common
  'mechanic.common.cancel':           'Cancel',
}

const es: MechanicDict = {
  'mechanic.tab.my_jobs':        'Mis Trabajos',
  'mechanic.tab.parts_requests': 'Solicitudes de Piezas',
  'mechanic.tab.profile':        'Perfil',
  'mechanic.loading_dashboard':  'Cargando panel...',
  'mechanic.no_jobs_assigned':   'No tienes trabajos asignados todav\u00eda',
  'mechanic.no_parts_requests':  'A\u00fan no hay solicitudes de piezas',
  'mechanic.not_punched_in':     'No has fichado',
  'mechanic.punch_message':      'Ficha para iniciar tu turno antes de trabajar',
  'mechanic.punch_in':           'Fichar entrada',
  'mechanic.locating':           'Localizando...',
  'mechanic.punching':           'Fichando...',
  'mechanic.outside_shop_area':       'Fuera del \u00e1rea del taller',
  'mechanic.override_reason_placeholder': 'Motivo (p. ej., llamada en carretera, estacionamiento)',
  'mechanic.override_punch_in':       'Anular y fichar entrada',
  'mechanic.status.working_now':      'Trabajando ahora',
  'mechanic.status.paused':           'Pausado',
  'mechanic.status.done':             'Hecho',
  'mechanic.status.pending':          'Pendiente',
  'mechanic.status.assigned':         'Asignado',
  'mechanic.action.decline_job':      'Rechazar trabajo',
  'mechanic.action.request_more_time':'Solicitar m\u00e1s tiempo',
  'mechanic.action.complete_job':     '\u00bfCompletar trabajo?',
  'mechanic.action.request_parts':    'Solicitar piezas',
  'mechanic.action.decline_reason_placeholder': 'Motivo del rechazo...',
  'mechanic.action.parts_details_placeholder':  'Detalles adicionales...',
  'mechanic.action.submit_request':   'Enviar solicitud',
  'mechanic.action.submitting':       'Enviando...',
  'mechanic.parts.heading':           'Solicitudes de Piezas',
  'mechanic.profile.heading':         'Perfil',
  'mechanic.profile.name':            'Nombre',
  'mechanic.profile.email':           'Correo',
  'mechanic.profile.role':            'Rol',
  'mechanic.profile.team':            'Equipo',
  'mechanic.profile.skills':          'Habilidades',
  'mechanic.profile.language':        'Idioma',
  'mechanic.profile.save_language':   'Guardar idioma',
  'mechanic.profile.saving':          'Guardando...',
  'mechanic.profile.sign_out':        'Cerrar sesi\u00f3n',
  'mechanic.common.cancel':           'Cancelar',
}

const ru: MechanicDict = {
  'mechanic.tab.my_jobs':        '\u041c\u043e\u0438 \u0440\u0430\u0431\u043e\u0442\u044b',
  'mechanic.tab.parts_requests': '\u0417\u0430\u044f\u0432\u043a\u0438 \u043d\u0430 \u0437\u0430\u043f\u0447\u0430\u0441\u0442\u0438',
  'mechanic.tab.profile':        '\u041f\u0440\u043e\u0444\u0438\u043b\u044c',
  'mechanic.loading_dashboard':  '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043f\u0430\u043d\u0435\u043b\u0438...',
  'mechanic.no_jobs_assigned':   '\u041d\u0435\u0442 \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043d\u044b\u0445 \u0440\u0430\u0431\u043e\u0442',
  'mechanic.no_parts_requests':  '\u0417\u0430\u044f\u0432\u043e\u043a \u043d\u0430 \u0437\u0430\u043f\u0447\u0430\u0441\u0442\u0438 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442',
  'mechanic.not_punched_in':     '\u0421\u043c\u0435\u043d\u0430 \u043d\u0435 \u043d\u0430\u0447\u0430\u0442\u0430',
  'mechanic.punch_message':      '\u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u0441\u043c\u0435\u043d\u0443 \u043f\u0435\u0440\u0435\u0434 \u0440\u0430\u0431\u043e\u0442\u043e\u0439',
  'mechanic.punch_in':           '\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u043c\u0435\u043d\u0443',
  'mechanic.locating':           '\u041e\u043f\u0440\u0435\u0434\u0435\u043b\u0435\u043d\u0438\u0435 \u043f\u043e\u0437\u0438\u0446\u0438\u0438...',
  'mechanic.punching':           '\u041d\u0430\u0447\u0438\u043d\u0430\u044e \u0441\u043c\u0435\u043d\u0443...',
  'mechanic.outside_shop_area':       '\u0412\u043d\u0435 \u0437\u043e\u043d\u044b \u0441\u0435\u0440\u0432\u0438\u0441\u0430',
  'mechanic.override_reason_placeholder': '\u041f\u0440\u0438\u0447\u0438\u043d\u0430 (\u043d\u0430\u043f\u0440. \u0432\u044b\u0435\u0437\u0434, \u0441\u0442\u043e\u044f\u043d\u043a\u0430)',
  'mechanic.override_punch_in':       '\u041d\u0430\u0447\u0430\u0442\u044c \u0441\u043c\u0435\u043d\u0443 \u0432 \u043e\u0431\u0445\u043e\u0434',
  'mechanic.status.working_now':      '\u0420\u0430\u0431\u043e\u0442\u0430\u044e \u0441\u0435\u0439\u0447\u0430\u0441',
  'mechanic.status.paused':           '\u041f\u0430\u0443\u0437\u0430',
  'mechanic.status.done':             '\u0413\u043e\u0442\u043e\u0432\u043e',
  'mechanic.status.pending':          '\u041e\u0436\u0438\u0434\u0430\u0435\u0442',
  'mechanic.status.assigned':         '\u041d\u0430\u0437\u043d\u0430\u0447\u0435\u043d\u043e',
  'mechanic.action.decline_job':      '\u041e\u0442\u043a\u0430\u0437\u0430\u0442\u044c\u0441\u044f \u043e\u0442 \u0440\u0430\u0431\u043e\u0442\u044b',
  'mechanic.action.request_more_time':'\u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 \u0432\u0440\u0435\u043c\u0435\u043d\u0438',
  'mechanic.action.complete_job':     '\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u0443?',
  'mechanic.action.request_parts':    '\u0417\u0430\u043f\u0440\u043e\u0441\u0438\u0442\u044c \u0437\u0430\u043f\u0447\u0430\u0441\u0442\u0438',
  'mechanic.action.decline_reason_placeholder': '\u041f\u0440\u0438\u0447\u0438\u043d\u0430 \u043e\u0442\u043a\u0430\u0437\u0430...',
  'mechanic.action.parts_details_placeholder':  '\u0414\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0434\u0435\u0442\u0430\u043b\u0438...',
  'mechanic.action.submit_request':   '\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u044f\u0432\u043a\u0443',
  'mechanic.action.submitting':       '\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430...',
  'mechanic.parts.heading':           '\u0417\u0430\u044f\u0432\u043a\u0438 \u043d\u0430 \u0437\u0430\u043f\u0447\u0430\u0441\u0442\u0438',
  'mechanic.profile.heading':         '\u041f\u0440\u043e\u0444\u0438\u043b\u044c',
  'mechanic.profile.name':            '\u0418\u043c\u044f',
  'mechanic.profile.email':           'Email',
  'mechanic.profile.role':            '\u0420\u043e\u043b\u044c',
  'mechanic.profile.team':            '\u041a\u043e\u043c\u0430\u043d\u0434\u0430',
  'mechanic.profile.skills':          '\u041d\u0430\u0432\u044b\u043a\u0438',
  'mechanic.profile.language':        '\u042f\u0437\u044b\u043a',
  'mechanic.profile.save_language':   '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u044f\u0437\u044b\u043a',
  'mechanic.profile.saving':          '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...',
  'mechanic.profile.sign_out':        '\u0412\u044b\u0439\u0442\u0438',
  'mechanic.common.cancel':           '\u041e\u0442\u043c\u0435\u043d\u0430',
}

const uz: MechanicDict = {
  'mechanic.tab.my_jobs':        'Mening ishlarim',
  'mechanic.tab.parts_requests': 'Ehtiyot qism so\u02bbrovlari',
  'mechanic.tab.profile':        'Profil',
  'mechanic.loading_dashboard':  'Yuklanmoqda...',
  'mechanic.no_jobs_assigned':   'Sizga hali ish biriktirilmagan',
  'mechanic.no_parts_requests':  'Hali ehtiyot qism so\u02bbrovi yo\u02bbq',
  'mechanic.not_punched_in':     'Smena boshlanmagan',
  'mechanic.punch_message':      'Ish boshlashdan oldin smenani boshlang',
  'mechanic.punch_in':           'Smenaga kirish',
  'mechanic.locating':           'Joylashuv aniqlanmoqda...',
  'mechanic.punching':           'Boshlanmoqda...',
  'mechanic.outside_shop_area':       'Servis hududi tashqarisida',
  'mechanic.override_reason_placeholder': 'Sabab (masalan, yo\u02bblda, avtoturargoh)',
  'mechanic.override_punch_in':       'Ruxsat olib boshlash',
  'mechanic.status.working_now':      'Hozir ishlamoqda',
  'mechanic.status.paused':           'To\u02bbxtatildi',
  'mechanic.status.done':             'Bajarildi',
  'mechanic.status.pending':          'Kutilmoqda',
  'mechanic.status.assigned':         'Biriktirildi',
  'mechanic.action.decline_job':      'Ishni rad etish',
  'mechanic.action.request_more_time':'Ko\u02bbproq vaqt so\u02bbrash',
  'mechanic.action.complete_job':     'Ishni yakunlash?',
  'mechanic.action.request_parts':    'Ehtiyot qism so\u02bbrash',
  'mechanic.action.decline_reason_placeholder': 'Rad etish sababi...',
  'mechanic.action.parts_details_placeholder':  'Qo\u02bbshimcha tafsilotlar...',
  'mechanic.action.submit_request':   'So\u02bbrov yuborish',
  'mechanic.action.submitting':       'Yuborilmoqda...',
  'mechanic.parts.heading':           'Ehtiyot qism so\u02bbrovlari',
  'mechanic.profile.heading':         'Profil',
  'mechanic.profile.name':            'Ism',
  'mechanic.profile.email':           'Email',
  'mechanic.profile.role':            'Rol',
  'mechanic.profile.team':            'Jamoa',
  'mechanic.profile.skills':          'Mahoratlar',
  'mechanic.profile.language':        'Til',
  'mechanic.profile.save_language':   'Tilni saqlash',
  'mechanic.profile.saving':          'Saqlanmoqda...',
  'mechanic.profile.sign_out':        'Chiqish',
  'mechanic.common.cancel':           'Bekor qilish',
}

export const MECHANIC_DICTIONARIES: Record<MechanicLang, MechanicDict> = { en, es, ru, uz }
