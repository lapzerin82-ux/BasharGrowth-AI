# Pediatric Growth Chart (Android)

A free, offline-first Android app for pediatricians to record children's height
and weight, plot every measurement as a **red ×** at the **exact chronological age**
on CDC 2000 or WHO growth charts, follow the trajectory over time, and export
a PDF report.

* Kotlin + Jetpack Compose, Room on SQLCipher (encrypted), custom vector chart renderer
* Growth curves are computed from the **official LMS tables**, not traced from images
  (see [docs/GROWTH_REFERENCES.md](docs/GROWTH_REFERENCES.md))
* Database structure: [docs/DATABASE.md](docs/DATABASE.md)

## Features

| Area | What the app does |
|---|---|
| Patients | Name, sex, file number, date of birth, father/mother height → MPH (or manual MPH), notes. Warns when a file number already exists and opens that patient instead. |
| Measurements | Any number per patient: date, height/length, weight, note. Exact age (y m d, days, decimal years) shown live while typing, with centile and z-score. |
| Charts | Height-for-age and weight-for-age, boys/girls, CDC 2000 birth–36 mo and 2–20 y (3rd–97th, Set 2 layout) or WHO 2006 (0–5 y) / WHO 2007 (5–19 y). All measurements shown as red ×, the latest circled, optional trajectory line, MPH and target range at 20 y. Pinch-zoom, pan, +/−, reset (or double-tap), tap a × for date/age/value/centile. |
| Search | By name or file number; opening a patient shows demographics, notes, all measurements and charts. |
| PDF | Patient information, notes, measurement table with centiles, and full-page charts for every chart that contains measurements. Save or share/print. |
| Backup / Restore | One password-encrypted file (AES-256-GCM) with all patients; save, share (email, Drive, WhatsApp, Nearby Share…), and restore on any device (merge or replace). |
| Accounts | Email + password sign-in. Each account has its own encrypted database; passwords are never stored (PBKDF2 verifier). |
| Multi-device | Optional Firebase sync (free plan): same account on several devices, works offline and syncs when online; records are end-to-end encrypted. |

## Install the APK on a phone

1. Get `PediatricGrowthChart.apk`:
   * From GitHub: **Releases → "Pediatric Growth Chart – latest APK"**, or
     **Actions → Build Android APK → latest run → Artifacts**; or
   * Build it yourself (see *Build from source*).
2. Copy/download the APK to the phone and tap it.
3. Android will ask to allow installing from this source (Chrome/Files) — allow it.
4. Open **Pediatric Growth Chart**, tap **Create account**, and start adding patients.

**Additional devices:** install the same APK the same way. Then either
* sign in with the same account (if cloud sync is set up), or
* move data with Backup → Share on the old device, and Restore on the new one.

**Updating:** install the newer APK over the old one. Your data is kept because
all builds are signed with the same key (`keystore/growthchart-release.jks`, or your own —
see below). Do **not** uninstall first: uninstalling deletes the local database.
Make a backup before updating, as a precaution.

## Backup and restore

* **Backup** (home screen): choose a backup password (≥ 8 characters), then
  *Save to device* (pick a folder, e.g. Downloads) or *Share…* (email, Drive, another phone).
  The file `GrowthChart_backup_YYYYMMDD_HHMM.bgcbackup` is unreadable without the password.
* **Restore** (home screen, on any device with the app): *Choose backup file* → enter the
  backup password → choose
  * **Merge** – adds the records; when the same record exists, the most recently edited copy wins;
  * **Replace** – makes this account identical to the backup.
* The password cannot be recovered. Android system backup is disabled on purpose
  (the encrypted database key never leaves the phone), so use this function.

## Cloud sync (optional, free)

Without it the app is fully functional in **local mode** (one device, move data with backups).
To sign in on several devices with the same data:

1. Create a free project at <https://console.firebase.google.com> (Spark plan).
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Firestore Database → Create database** (production mode), then **Rules**: paste
   [docs/firestore.rules](docs/firestore.rules) and publish.
4. **Project settings → Add app → Android**, package name `com.bashar.growthchart`;
   download `google-services.json`.
5. In the app: login screen or **Settings → Set up cloud sync**, paste the file content.
   Do this on every device. (Alternatively add repository secrets `FIREBASE_API_KEY`,
   `FIREBASE_APP_ID`, `FIREBASE_PROJECT_ID` so the APK has the configuration built in.)
6. Create the account (or sign in again with an existing local account to link and upload it).

The first sign-in on a new device needs internet; afterwards sign-in and all
clinical work are available offline, and changes upload automatically when online.

## Privacy and security

* Local database encrypted with SQLCipher (AES-256); key protected by the Android Keystore.
* Separate encrypted database per clinician account on a shared device.
* Passwords never stored: salted PBKDF2-HMAC-SHA256 verifier (210 000 iterations).
* Cloud records encrypted on the phone with a random key that is itself encrypted with
  the clinician's password; transport is TLS; Firestore rules isolate each clinician.
* Deleting a patient wipes all clinical fields locally and in the cloud.
* Optional screenshot blocking (Settings). Logout on the home screen.
* This repository is public: before real clinical use, replace the bundled signing key
  with a private one (secrets `SIGNING_KEYSTORE_BASE64`, `SIGNING_STORE_PASSWORD`,
  `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`) and install that build fresh.
  Also review local regulations (e.g. data-protection law) for storing patient data.

## Build from source

Requirements: JDK 17 and the Android SDK (Android Studio Ladybug or newer).

```bash
./gradlew :core:test            # growth maths, exact age, MPH, backup encryption tests
./gradlew :app:assembleRelease  # → app/build/outputs/apk/release/app-release.apk
```

GitHub Actions (`.github/workflows/android.yml`) runs the same commands on every push
and publishes the APK as the `latest-apk` release.

Regenerate the growth reference tables: see the header of `tools/convert_growth_data.py`.

## Project layout

```
core/   pure Kotlin: LMS references + JSON data, exact age, MPH, chart maths, backup format, crypto (unit tested)
app/    Android app: data (Room/SQLCipher), auth, sync (Firebase), chart renderer, PDF, Compose UI
tools/  script that converts the official LMS tables into core/src/main/resources/growthref
docs/   database structure, growth reference method, Firestore rules
```

---
Clinical decision-support tool. Measurement technique, reference choice and
interpretation remain the clinician's responsibility.
