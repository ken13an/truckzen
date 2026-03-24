# Email Templates — Paste into Supabase Dashboard

## Welcome / Invite Email

Go to: Supabase Dashboard → Auth → Email Templates → Invite

### Subject
Welcome to TruckZen — Your account is ready

### Body (HTML)
```html
<div style="font-family:sans-serif;background:#060708;color:#DDE3EE;padding:40px;max-width:480px;margin:0 auto">
  <div style="font-size:22px;font-weight:700;margin-bottom:16px">Welcome, {{ .Data.full_name }}</div>
  <p style="color:#7C8BA0;line-height:1.7">You've been added to TruckZen. Click below to set your password and access the app.</p>
  <a href="{{ .ConfirmationURL }}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:linear-gradient(135deg,#1D6FE8,#1248B0);color:#fff;text-decoration:none;border-radius:9px;font-weight:700">Set Password & Log In</a>
  <p style="color:#7C8BA0;font-size:13px;line-height:1.6">TruckZen works on:</p>
  <ul style="color:#7C8BA0;font-size:13px;line-height:1.8">
    <li>Web: https://truckzen.pro</li>
    <li>iPhone: Search "TruckZen" in App Store</li>
    <li>Android: Search "TruckZen" in Google Play</li>
  </ul>
  <p style="color:#48536A;font-size:12px;margin-top:20px">If you didn't expect this email, you can ignore it.</p>
</div>
```

## Notes
- The actual welcome email is sent by our app via Resend (not Supabase email templates)
- The Resend welcome email is in `src/lib/integrations/resend.ts` → `sendWelcomeEmail()`
- It sends a password reset link so the user can set their own password
- For bulk import, each user gets an individual welcome email with a unique setup URL
