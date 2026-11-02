# Connecting the Social tab

Social is a real multi-person community once it has a server. Until then it runs in a labelled,
single-device preview. Supabase's free tier provides the database and sign-in.

## 1. Create the project (about 5 minutes)

1. Create an account and a new project at https://supabase.com. Save the database password somewhere safe.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and press **Run**. It should finish without errors.
3. Open **Project Settings > API** and copy the **Project URL** and the **publishable** (or **anon**) key.
4. Put both in `js/config.js`:

   ```js
   window.KERYKE_CONFIG = {
     supabaseUrl: 'https://your-project.supabase.co',
     supabaseAnonKey: 'your-publishable-key',
   };
   ```

   The publishable key is meant to be public, because the database rules protect the data.
   **Never use the `service_role` or secret key here.**

5. Reload Keryke, open **Social**, and create an account.

## 2. Check it

Create two accounts, in a normal and a private window, and try posting, replying, liking, reposting and
following. For the first test, you can turn off **Confirm email** under **Authentication > Sign In / Providers**,
so you don't need to click an email link. Turn it back on before real people join.

## 3. Let other people in

People can only reach it once the site is hosted, for example on GitHub Pages, Netlify or Cloudflare Pages.
Then set **Authentication > URL Configuration > Site URL** to the public address so email links work.
Supabase's built-in email service has a very low sending limit, so connect your own email provider
(**Authentication > Emails**) before opening sign-ups.

## Moderating

A public political forum needs someone responsible for moderating it.

- Reports appear in the `reports` table, in the Supabase **Table Editor**.
- To remove a post from view, set `hidden` to `true` on it in the `posts` table. Its author can still see it in the database, but it leaves every feed.
- To ban someone, use **Authentication > Users**.
- Publish community rules, and check privacy duties such as GDPR or Brazil's LGPD. You will be storing email addresses and people's political opinions, which privacy law often treats as sensitive. A lawyer can confirm what applies.

## Not built yet

- Password reset (for now, reset a password from **Authentication > Users**)
- Live updates (the feed updates when it is loaded or the refresh button is pressed)
- Quote posts, images and direct messages

## Testing the database yourself

`tests/run-remote.ps1 -Work <empty folder>` downloads Postgres and PostgREST (about 1 GB) and runs the schema
through normal use and attacks, such as deleting or forging someone else's posts. Sign-in responses are simulated.
