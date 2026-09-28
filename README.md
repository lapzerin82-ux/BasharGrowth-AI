# Pediatric Growth Monitor - Flutter Version

## Complete Flutter Implementation

This is a **complete Flutter (Dart)** implementation of the Pediatric Growth Monitor app, featuring:

### ✅ Core Features
- **WHO Standards (0 to <5 years)** and **CDC 2000 References (5-20 years)**
- **Z-score** and **Percentile** calculations using LMS method for weight-for-age, length/height-for-age, weight-for-length/height (WHO) and BMI-for-age
- **Corrected age for prematurity** (< 37 weeks' gestation, until 24 months chronological age)
- **Length/height adjustment** (WHO ±0.7 cm when the measuring position does not match the age)
- **Plausibility checks**: input ranges, and WHO flags for biologically implausible Z-scores
- **Mid-Parental Height (MPH)** calculation with target range
- **Bone Age Analysis** (flags >20% discrepancy)
- **Clinical Interpretations** (Underweight, Stunting, Wasting, Overweight, Obesity)

### 📱 Mobile-First Design
- Material Design 3 with gradient backgrounds
- Responsive forms with date pickers
- Color-coded status badges (Green/Amber/Red)
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
│   ├── growth_assessment.dart    # Indicator and standard selection
│   └── growth_standards.dart     # LMS table loading and lookup
├── assets/growth/                # Complete WHO 2006 / CDC 2000 LMS tables (CSV)
├── test/                         # Unit tests against the reference tables
├── android/                      # Android configuration
├── pubspec.yaml                  # Dependencies
└── README.md                     # This file
```

## 📊 Data Accuracy
The app bundles the **complete LMS tables** in `assets/growth/` (sources in `assets/growth/README.md`):
- WHO Child Growth Standards (2006): daily tables 0-1826 days, weight-for-length 45-110 cm, weight-for-height 65-120 cm. Weight-based Z-scores beyond ±3 SD use the WHO restricted method.
- CDC 2000 Growth Charts: weight, stature and BMI-for-age, 24-240 months.

WHO is used below 60 months and CDC from 60 months. Measurements outside a table's range are not scored (no extrapolation). Run `flutter test` to check the calculations against the reference values.

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
