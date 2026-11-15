# Tilly

Keep every receipt and see who spent what. Scan a receipt, pick a profile, and Tilly keeps totals by month, category, store and day, with tax kept separate.

- Static site on GitHub Pages: `index.html`, `app.css`, `app.js`, `scan.js` (free on-device receipt scanner).
- Accounts and data live in Supabase. Tables `sp_profiles`, `sp_purchases`, `sp_taxes` are protected by row-level security, so each account only reads and writes its own rows.
- The `account` edge function creates accounts and copies data over from the original Family Spending app (needs the family passcode).
- Add `#demo` to the address to open the sample-data demo.
