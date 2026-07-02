# SHY Security Notes

## Configuration

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Do not put it in `VITE_*`, Capacitor config, Android resources, or public files.
- `VITE_SUPABASE_PUBLISHABLE_KEY` is browser/mobile visible by design. Protect data with Supabase RLS policies.
- Configure Supabase Auth email OTP expiry to 5-10 minutes in the Supabase dashboard.
- Configure Supabase Auth rate limits for OTP/email sending in the Supabase dashboard.

## Authentication

- Email OTP login uses Supabase Auth (`signInWithOtp` and `verifyOtp`).
- The UI adds a resend cooldown and failed-attempt guard, but production abuse protection must also be enforced by Supabase Auth rate limits.
- Password sign-in and sign-up are still available for existing users.

## Marketplace and Payments

- The Buy Song UI does not fake successful payments.
- Airtel Money, MTN Mobile Money, Visa, and Payoneer are placeholders until real provider APIs are integrated.
- Song purchase requests and sale terms require the `20260702150000_song_marketplace.sql` migration.

## Android

- The Capacitor Android app loads the deployed web app URL so it shares the same Supabase backend and user accounts.
- Do not place private API keys in Android resources.
- Rebuild/sync Android after changing icons, app name, or Capacitor config.
