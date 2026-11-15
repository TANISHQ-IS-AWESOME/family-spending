# Tilly

Keep every receipt and see who spent what. Scan a receipt, pick a profile, and Tilly keeps totals by month, category, store and day, with tax kept separate.

- **Web app:** served by GitHub Pages straight from this folder (`index.html`, `app.css`, `app.js`, `scan.js`, `vendor/`).
- **Phone app:** the same files, packaged with [Capacitor](https://capacitorjs.com) in `android/` and `ios/`.
- **Data:** Supabase. Tables `sp_profiles`, `sp_purchases`, `sp_taxes` are protected by row-level security, so each account only reads and writes its own rows. The `account` edge function handles sign-up, recovery codes and account deletion.
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
