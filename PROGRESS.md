# TruckZen Build Progress

## Completed:
1. [x] Service order creation fix + can_create_so — API fixed, page sends shop_id/user_id/role, can_create_so enforced
7. [x] Database tables and RLS policies — notifications table, can_create_so, supervisor_teams, parts_requests columns
8. [x] Password reset — confirmed working, 24h expiry, SMTP/DKIM verified
9. [x] Compliance moves inside Fleet — /fleet/compliance created, /compliance redirects
10. [x] Roles and teams cleanup — service_advisor removed everywhere (0 refs), role guide updated

## In Progress:
2. [ ] AI Service Writer panel — need to build voice input + Claude integration
3. [ ] Shop floor notification workflow — notify lib exists, need to wire into SO lifecycle
4. [ ] Shop Floor board (Table/Kanban/Monitor) — /shop-floor page not yet created
5. [ ] Telegram bot — existing route needs Claude integration upgrade
6. [ ] Kiosk — existing page needs voice input, VIN scanning, AI complaint processing
