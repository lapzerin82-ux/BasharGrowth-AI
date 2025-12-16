# Pediatric Growth Monitor - Flutter Version

## Complete Flutter Implementation

This is a **complete Flutter (Dart)** implementation of the Pediatric Growth Monitor app, featuring:

### ✅ Core Features
- **WHO Standards (0-5 years)** and **CDC References (2-20 years)**
- **Z-score** and **Percentile** calculations using LMS method
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
│   └── growth_standards.dart     # WHO/CDC LMS data
├── android/                      # Android configuration
├── pubspec.yaml                  # Dependencies
└── README.md                     # This file
```

## 📊 Data Accuracy
The app includes **embedded LMS data** for key age points (0-60 months WHO, 2-20 years CDC stub). For full clinical precision, update `growth_standards.dart` with complete datasets from:
- WHO: https://www.who.int/childgrowth/standards/
- CDC: https://www.cdc.gov/growthcharts/

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
