# Pediatric Growth Monitor - Flutter App

[![Build Flutter APK](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions/workflows/build-apk.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/actions/workflows/build-apk.yml)

## 📱 Pediatric Growth Monitoring Application

A professional Flutter mobile application for precision growth assessment using **WHO (0-5 years)** and **CDC (2-20 years)** standards.

### ✨ Features
- ✅ **Z-score & Percentile Calculations** using LMS method
- ✅ **Mid-Parental Height (MPH)** calculation with target range
- ✅ **Bone Age Analysis** (flags >20% discrepancy)
- ✅ **Clinical Interpretations** (Underweight, Stunting, Wasting, Overweight, Obesity)
- ✅ **Material Design 3** UI with gradient backgrounds
- ✅ **Automatic APK builds** via GitHub Actions

### 📥 Download APK

**Option 1: From GitHub Actions**
1. Go to the [Actions tab](../../actions)
2. Click on the latest successful workflow run
3. Download the APK from "Artifacts" section

**Option 2: From Releases**
Check the [Releases page](../../releases) for stable versions

### 🛠️ Development Setup

#### Prerequisites
- Flutter SDK 3.x or higher
- Dart SDK
- (Optional) Android Studio for local builds

#### Install Dependencies
```bash
flutter pub get
```

#### Run on Device/Emulator
```bash
flutter run
```

#### Build APK Locally
```bash
flutter build apk --release
```

### 📊 Growth Data
The app includes embedded LMS data for demonstration. For full clinical accuracy, update `lib/growth_standards.dart` with complete datasets from:
- WHO: https://www.who.int/childgrowth/standards/
- CDC: https://www.cdc.gov/growthcharts/

### 📂 Project Structure
```
lib/
├── main.dart                 # Main app entry
├── input_form.dart           # Patient data input
├── result_summary.dart       # Results display
├── growth_calculations.dart  # Core math logic
└── growth_standards.dart     # WHO/CDC LMS data
```

### 🤝 Contributing
Contributions are welcome! This is a clinical decision support tool - always validate with clinical judgment.

### 📝 License
For clinical/educational use. Always validate findings with professional medical judgment.

---

**Built with Flutter 💙**
