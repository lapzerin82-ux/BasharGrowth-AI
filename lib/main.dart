import 'package:flutter/material.dart';
import 'app_theme.dart';
import 'input_form.dart';
import 'result_summary.dart';
import 'growth_calculations.dart';
import 'growth_standards.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PediaGrowth',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const GrowthMonitorHome(),
    );
  }
}

class GrowthMonitorHome extends StatefulWidget {
  const GrowthMonitorHome({Key? key}) : super(key: key);

  @override
  State<GrowthMonitorHome> createState() => _GrowthMonitorHomeState();
}

class _GrowthMonitorHomeState extends State<GrowthMonitorHome> {
  List<GrowthResultData> results = [];
  Map<String, double>? mph;
  Map<String, dynamic>? boneAgeResult;

  void _handleCalculate(PatientData data) {
    final ageMonths = calculateAgeMonths(data.dob!, data.measurementDate);
    final newResults = <GrowthResultData>[];

    // 1. Weight for Age
    final wfaData = getRelevantDataset(data.sex, 'weight', ageMonths);
    final wfaDataset = wfaData['dataset'] as List<LMSDataPoint>;
    
    if (wfaDataset.isNotEmpty) {
      final lms = getLMSForAge(wfaDataset, ageMonths);
      if (lms != null && data.weight != null) {
        final z = calculateZScore(data.weight!, lms);
        final p = calculatePercentile(z);
        newResults.add(GrowthResultData(
          measure: 'Weight-for-Age',
          value: data.weight!,
          zScore: z,
          percentile: p,
          classification: interpretWeightForAge(z),
          standard: wfaData['standardName'] as String,
        ));
      }
    }

    // 2. BMI (if >= 2y)
    if (ageMonths >= 24 && data.height != null && data.weight != null && data.height! > 0) {
      final bmi = calculateBMI(data.weight!, data.height!);
      final bmiData = getRelevantDataset(data.sex, 'bmi', ageMonths);
      final bmiDataset = bmiData['dataset'] as List<LMSDataPoint>;
      final bmiLms = bmiDataset.isNotEmpty ? getLMSForAge(bmiDataset, ageMonths) : null;

      double? bmiZ;
      double? bmiP;
      var bmiClassification = 'Data Required';
      if (bmiLms != null) {
        bmiZ = calculateZScore(bmi, bmiLms);
        bmiP = calculatePercentile(bmiZ);
        bmiClassification = interpretBMIForAgeCDC(bmiP);
      }

      newResults.add(GrowthResultData(
        measure: 'BMI',
        value: bmi,
        zScore: bmiZ,
        percentile: bmiP,
        classification: bmiClassification,
        standard: bmiData['standardName'] as String,
      ));
    }

    // 3. Head Circumference for Age (WHO standard, 0-60 months)
    final hcData = getRelevantDataset(data.sex, 'hc', ageMonths);
    final hcDataset = hcData['dataset'] as List<LMSDataPoint>;

    if (hcDataset.isNotEmpty && data.headCircumference != null) {
      final lms = getLMSForAge(hcDataset, ageMonths);
      if (lms != null) {
        final z = calculateZScore(data.headCircumference!, lms);
        final p = calculatePercentile(z);
        newResults.add(GrowthResultData(
          measure: 'Head Circumference-for-Age',
          value: data.headCircumference!,
          zScore: z,
          percentile: p,
          classification: interpretHeadCircumferenceForAge(z),
          standard: hcData['standardName'] as String,
        ));
      }
    }

    setState(() {
      results = newResults;
      
      // MPH
      if (data.motherHeight != null && data.fatherHeight != null) {
        mph = calculateMidParentalHeight(
          data.motherHeight!,
          data.fatherHeight!,
          data.sex,
        );
      } else {
        mph = null;
      }
      
      // Bone Age
      if (data.boneAgeMonths != null) {
        boneAgeResult = analyzeBoneAge(ageMonths, data.boneAgeMonths);
      } else {
        boneAgeResult = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFFF3E0),
                  Color(0xFFFDF6FF),
                  Color(0xFFE8FBF3),
                ],
              ),
            ),
          ),
          const BubbleBackground(),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.purple, AppColors.pink],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.purple.withOpacity(0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        const StickerBadge(emoji: '🧒', color: Colors.white, size: 56),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'PediaGrowth 🌱',
                                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                      color: Colors.white,
                                      fontSize: 26,
                                    ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Fun & precise growth tracking with WHO (0–5y) & CDC (2–20y) standards',
                                style: TextStyle(fontSize: 13, color: Colors.white.withOpacity(0.9)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Input Form
                  InputForm(onCalculate: _handleCalculate),

                  const SizedBox(height: 20),

                  // Results
                  if (results.isNotEmpty)
                    ResultSummary(
                      results: results,
                      mph: mph,
                      boneAgeAnalysis: boneAgeResult,
                    ),

                  const SizedBox(height: 24),

                  // Disclaimer
                  Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppColors.yellow.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        '💡 For clinical decision support only.\nAlways validate findings with clinical judgment.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: Colors.brown.shade700),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
