# Pediatric Growth Monitor - Flutter Version

## Complete Flutter Implementation

This is a **complete Flutter (Dart)** implementation of the Pediatric Growth Monitor app, featuring:

### ✅ Core Features
- **CDC 2000 Growth Charts** (birth–20 years) — the same "Set 2" chart bundle NCHS/CDC publishes: recumbent Length-for-Age (birth–36mo) transitioning to standing Stature-for-Age (2–20y), Weight-for-Age (one continuous birth–20y curve), Weight-for-Length (birth–36mo), and BMI-for-Age (2–20y)
- **Z-score** and **Percentile** calculations using LMS method
- **Growth-curve charts** matching the official printed charts' own percentile sets exactly: 3rd/10th/25th/50th/75th/90th/97th for weight, length/stature, and weight-for-length; 3rd/10th/25th/50th/75th/**85th**/90th/**95th**/97th for BMI-for-age (the chart's own overweight/obesity cutoffs)
- **Mid-Parental Height (MPH)** calculation with target range
- **Bone Age Analysis** (flags >20% discrepancy)
- **Clinical Interpretations** (Underweight, Stunting, Wasting, Overweight, Obesity)
- **Calendar-accurate age calculation** (years/months/days), not a naive day-count estimate
- **Plausibility validation** on entered measurements to catch data-entry mistakes
- **Red-flag banner** surfacing severe findings that warrant urgent clinical attention

### 📱 Mobile-First Design
- Material Design 3 with gradient backgrounds
- Responsive forms with date pickers
- Color-coded status badges (Green/Amber/Red/Grey for unavailable reference data)
- Professional data tables

## 🚀 How to Build APK

### Prerequisites
1. **Install Flutter SDK**: https://docs.flutter.dev/get-started/install
2. **Install Android Studio**: https://developer.android.com/studio
3. **Set up Flutter path** in your system environment variables

### Build Steps

1. **Navigate to the Flutter app folder**:
   ```bash
   cd "c:\Users\Dell\OneDrive\Desktop\Bashar calc\flutter_app"
   ```

2. **Get dependencies**:
   ```bash
   flutter pub get
   ```

3. **Build the APK** (Release mode):
   ```bash
   flutter build apk --release
   ```

4. **Find your APK**:
   The APK will be located at:
   ```
   flutter_app\build\app\outputs\flutter-apk\app-release.apk
   ```

### Development Mode
To test on an emulator or connected device:
```bash
flutter run
```

## 📂 Project Structure
```
flutter_app/
├── lib/
│   ├── main.dart                 # Main app entry
│   ├── input_form.dart           # Patient data input
│   ├── result_summary.dart       # Results display
│   ├── growth_calculations.dart  # Core math logic
│   ├── growth_chart.dart         # Percentile-curve chart widget
│   └── growth_standards.dart     # CDC 2000 LMS data
├── android/                      # Android configuration
├── pubspec.yaml                  # Dependencies
└── README.md                     # This file
```

## 📊 Data Accuracy
All LMS reference data in `growth_standards.dart` reproduces the **CDC 2000 Growth Charts** exactly — the same charts published at https://www.cdc.gov/growthcharts/, covering birth–36 months and 2–20 years for both sexes. It was extracted programmatically (not hand-typed) from CDC's own [`CDCAnthro`](https://github.com/CDC-DNPAO/CDCAnthro) R package — the reference software CDC itself uses to compute these percentiles — so the embedded values match the printed charts precisely rather than being approximated.

If a chart ever can't be shown for a given measure/age/sex combination, the app surfaces a grey **"Reference data unavailable"** badge instead of a fabricated number — for a clinical decision-support tool, a wrong number is worse than an honest gap.

## 🧪 Testing
Unit tests for the calculation engine (Z-score/percentile math, age breakdown, MPH, bone age, interpretation thresholds, validation) live in `test/growth_calculations_test.dart`. Run them with:
```bash
flutter test
```

## 🔧 Troubleshooting

### "Flutter not found"
Add Flutter to your PATH:
1. Download Flutter SDK
2. Extract to `C:\flutter`
3. Add `C:\flutter\bin` to system PATH
4. Restart terminal

### "Android SDK not found"
1. Open Android Studio
2. Go to Settings → Android SDK
3. Note the SDK location
4. Create `flutter_app/android/local.properties`:
   ```
   sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
   flutter.sdk=C:\\flutter
   ```

## 📝 License
This is a clinical decision support tool. Always validate with clinical judgment.
