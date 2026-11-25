# Tilly

Keep every receipt, see who spent what, and find ways to save. Scan a receipt, pick a profile, and Tilly keeps totals by month, category, store and day, with tax kept separate. Budgets, savings goals and subscriptions live in the Plan tab, and Insights shows ways to save worked out from your own receipts.

- **Web app:** served by GitHub Pages straight from this folder (`index.html`, `app.css`, `app.js`, `scan.js`, `vendor/`).
- **Phone app:** the same files, packaged with [Capacitor](https://capacitorjs.com) in `android/` and `ios/`.
- **Data:** Supabase. Tables `sp_profiles`, `sp_purchases`, `sp_taxes`, `sp_subscriptions`, `sp_budgets` and `sp_goals` are protected by row-level security, so each account only reads and writes its own rows. The `account` edge function handles sign-up, recovery codes and account deletion. Edge function sources are in `supabase/functions/`.
- **Legal:** `terms.html` and `privacy.html`, linked from sign-up, the Pro screen, Help and Settings. Have them reviewed before charging money.
- **Offline:** each device keeps a copy of the account's data, and changes made offline sync when the connection is back.
- **Demo:** add `#demo` to the address.

## Build the phone app

You need Node.js 20 or newer. For Android, install [Android Studio](https://developer.android.com/studio). For iPhone, you need a Mac with Xcode.

```bash
npm install
npm run android   # builds www/, syncs, opens Android Studio
npm run ios       # builds www/, syncs, opens Xcode (Mac only)
```

Then press Run in Android Studio or Xcode to put it on a phone or emulator.

After changing `index.html`, `app.css`, `app.js` or `scan.js`, run `npm run sync` to copy the changes into both phone projects.
If you update a library in `package.json`, run `npm run vendor` to refresh `vendor/`.

## Phone-only features

- **Camera:** native camera. On Android, Google's document scanner finds the receipt's edges and flattens it first.
- **Monthly reminder:** a local notification on the 1st at 9 AM with last month's total (Settings → Notifications).
- **Back button:** Android's back button closes sheets and returns to Home.

## Tilly Pro

| | Free | Pro |
|---|---|---|
| Profiles | 3 | Unlimited |
| Savings goals | 1 | Unlimited |
| Budgets | One for everything | Also each category and person |
| Ways to save | Fees, subscriptions, categories running high, eating out, budget pace | Also cheaper stores, price rises, unplanned buys |
| Price tracker, PDF reports, accent colors | | ✓ |

- Pro status lives in `sp_entitlements`. People can read their own row but can't change it.
- The free limits are enforced by database triggers, so they can't be skipped by editing the app.
- Ways to get Pro: the 14-day trial (`sp_start_trial`, once per account, no card), a code (`sp_redeem_code`), or a Stripe subscription (`billing` and `stripe-webhook` edge functions).

### Turn on card payments (Stripe)

Until these steps are done, the app offers the free trial and codes, and says paid plans are coming soon.

1. Make a Stripe account. Start in **test mode**.
2. Create a product called Tilly Pro with two recurring prices: $2.99 a month and $24.99 a year. Copy both price IDs (`price_...`).
3. In Stripe, go to Developers, then Webhooks, and add an endpoint for `https://uvbadnjcisuzgypzqyub.supabase.co/functions/v1/stripe-webhook` with the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. Copy its signing secret (`whsec_...`).
4. In Stripe's billing settings, turn on the customer portal so people can cancel and switch plans.
5. In Supabase, go to Edge Functions, then Secrets, and add `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` and `STRIPE_WEBHOOK_SECRET`.

The Subscribe button appears in the app by itself once the secrets are set. Test with Stripe's test card `4242 4242 4242 4242`, then switch the keys to live mode.

If Tilly goes on Google Play or the App Store, those stores require their own billing for subscriptions bought inside the app.

### Pro codes

In the Supabase SQL editor:

```sql
select public.sp_make_promo_code('Family', null, 1);   -- Pro for life, one use
select public.sp_make_promo_code('Launch', 30, 100);   -- 30 days of Pro, up to 100 people
```

Each call prints a new code like `TILLY-ABCD-EFGH-JKMN`. Only a hash of it is stored.

### Support messages

Messages sent from Help, then Contact support, are in Supabase's Table editor under `sp_feedback`.
