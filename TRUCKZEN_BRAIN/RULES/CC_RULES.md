# CC RULES — TruckZen

## DEPLOY (MANDATORY EVERY TIME)
1. npm run build
2. git add . && git commit && git push
3. npx vercel --prod
4. Wait 3 min
5. Test on truckzen.pro

## API PATTERN (all routes must use this)
- Session client (anon key) → auth.getUser()
- Service client (SERVICE_ROLE_KEY) → all data queries
- Get shop_id from users table using service client

## PROMPT FORMAT
- .md files only, never paste in chat
- Two files: main prompt + checklist
- Verification steps V1..VX
- End with: DO NOT mark complete without V1 through VX
- End with: npx vercel --prod

## GLOBAL RULES
- Every fix = global, never local
- No hardcoding
- No manual Supabase steps
- Claude suggests, Ken approves
- No emojis in code/docs
- Always give time estimate before starting
