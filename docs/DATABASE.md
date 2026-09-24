# Database structure

Each clinician account on a device has its **own SQLite database file**, encrypted
with SQLCipher (AES-256) using a random 256-bit key. That key is wrapped by a
non-exportable key in the Android Keystore. Accounts on the same phone therefore
never see each other's patients.

## Table `patients`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `name` | TEXT | as entered |
| `nameNormalized` | TEXT (indexed) | lower-case, for search |
| `sex` | TEXT | `M` / `F` |
| `fileNumber` | TEXT (indexed) | medical record number; duplicate warning on entry |
| `dobEpochDay` | INTEGER | date of birth (days since 1970-01-01) |
| `fatherHeightCm`, `motherHeightCm` | REAL NULL | |
| `mphCm` | REAL NULL | calculated or manually entered |
| `mphManual` | INTEGER | 1 = MPH entered manually |
| `notes` | TEXT | clinical notes |
| `preferredReference` | TEXT NULL | chart last chosen for this patient (`cdc2000_infant`, `cdc2000_child`, `who2006`, `who2007`) |
| `createdAt`, `updatedAt` | INTEGER | epoch ms |
| `deleted` | INTEGER | tombstone: clinical fields wiped, kept only so deletion can sync |
| `dirty` | INTEGER (indexed) | changed locally, not yet uploaded |

## Table `measurements`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `patientId` | TEXT (indexed) | → `patients.id` |
| `dateEpochDay` | INTEGER | measurement date |
| `heightCm` | REAL NULL | length (< 2 y) or standing height, exactly as entered |
| `weightKg` | REAL NULL | exactly as entered |
| `notes` | TEXT | |
| `createdAt`, `updatedAt`, `deleted`, `dirty` | | as above |

Age is **not stored**; it is always recomputed from `dobEpochDay` and
`dateEpochDay`, so correcting a date of birth automatically moves every point.

## Backup file (`.bgcbackup`)

```
"BGCB" | version (1 byte) | PBKDF2 iterations (4 bytes) | salt (16 bytes) |
AES-256-GCM( iv | gzip(JSON) | tag )      key = PBKDF2-HMAC-SHA256(backup password, salt)
```
The JSON contains `patients[]` and `measurements[]` with the fields above.

## Cloud (optional, Firebase Firestore)

```
users/{uid}/meta/keys        { salt, iterations, wrapped }   data key wrapped with PBKDF2(account password)
users/{uid}/records/{id}     { kind, updatedAt, deleted, serverTs, payload }
```
`payload` = AES-256-GCM(data key, JSON record): the cloud never holds readable patient data.
Conflicts are resolved by last edit (`updatedAt`).
