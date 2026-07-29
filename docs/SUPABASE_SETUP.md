# GainsLab mobile sync

LiftLog remains fully usable with its on-device SQLite database. Supabase is
only the authenticated copy used to move routines between devices.

## One-time project setup

1. In the existing GainsLab Supabase project, run
   `supabase/migrations/0001_liftlog_sync.sql` in the SQL editor.
2. Enable Email/Password authentication in Supabase Auth.
3. Create `app/.env` from `app/.env.example` and add the project URL plus
   anon key. These are client configuration values; never put a service-role
   key in the mobile app.
4. To migrate an existing IronLog routine, also add the six Firebase public
   configuration values already used by the PWA.

## First-device migration

1. Open **Ajustes > Importar rutina de IronLog**.
2. Sign in once with the existing Firebase account. The password is not saved;
   only the `users/{uid}` snapshot is read.
3. Open **Ajustes > Cuenta y sincronizacion**, create/sign in to Supabase and
   choose **Subir mis rutinas**.

Supersets are converted to LiftLog's `supersetWithNext` model. Any members of
the same IronLog group are placed consecutively before the routine is saved.
