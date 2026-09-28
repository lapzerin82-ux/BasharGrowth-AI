# Pediatric Growth Monitor - Flutter Version

## Complete Flutter Implementation

This is a **complete Flutter (Dart)** implementation of the Pediatric Growth Monitor app, featuring:

### ✅ Core Features
- **WHO Standards (0 to <2 years)** and **CDC 2000 References (2-20 years)**, as recommended by CDC/AAP
- **CDC clinical growth charts** (Set 2, 3rd–97th percentiles) from age 2: the child's stature, weight and BMI are plotted on the actual CDC chart pages
- **Z-score** and **Percentile** calculations using LMS method for weight-for-age, length/height-for-age, weight-for-length (WHO) and BMI-for-age
- **Corrected age for prematurity** (< 37 weeks' gestation, until 24 months chronological age)
- **Length/height adjustment** (±0.7 cm when the measuring position does not match the age)
- **Plausibility checks**: input ranges, and WHO flags for biologically implausible Z-scores
- **Mid-Parental Height (MPH)** calculation with target range
- **Bone Age Analysis**: bone age minus chronological age; classified as advanced/delayed beyond ±2 SD when the atlas SD for the child's age is entered
- **CDC 2022 extended BMI-for-age** at or above the 95th percentile: extended percentile/Z-score, % of the 95th percentile, obesity class 1-3
- **Growth charts** for each indicator (WHO Z-score or CDC percentile curves with the measurement plotted)
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
- WHO Child Growth Standards (2006): daily tables (used 0-730 days), weight-for-length 45-110 cm. Weight-based Z-scores beyond ±3 SD use the WHO restricted method.
- CDC 2000 Growth Charts: weight, stature and BMI-for-age, 24-240 months. At or above the 95th BMI percentile the CDC 2022 extended method is applied (Hales et al., Vital Health Stat 1(197), 2022; PMID 36598420).

WHO is used below 24 months and CDC from 24 months (MMWR 2010;59(RR-9)). From 2 years the charts are pages 5–8 of the CDC `set2color.pdf`, rendered in `assets/cdc_charts/`, with axes calibrated from the PDF grid so the LMS percentiles fall on the printed curves. Measurements outside a table's range are not scored (no extrapolation). Run `flutter test` to check the calculations against the reference values.

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
