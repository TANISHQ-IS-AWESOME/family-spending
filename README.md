# Family Spending

Mom's and Dad's grocery and household spending: totals by month, store and day, tax kept separate, and receipts added from a photo.

- The page is a static site (GitHub Pages).
- Data and receipt reading live in Supabase (project `family-spending`), behind the `api` edge function.
- The app asks for the family passcode (the `FAMILY_PASSCODE` secret in Supabase).
- Photo reading uses the `ANTHROPIC_API_KEY` secret in Supabase.
