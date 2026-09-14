import 'package:flutter/material.dart';
import 'input_form.dart';
import 'result_summary.dart';
import 'growth_calculations.dart';
import 'growth_standards.dart';
import 'growth_chart.dart' show hasEnoughResolutionForChart;

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pediatric Growth Monitor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        brightness: Brightness.light,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.indigo,
          brightness: Brightness.light,
        ),
      ),
      home: const GrowthMonitorHome(),
    );
  }
}

class GrowthMonitorHome extends StatefulWidget {
  const GrowthMonitorHome({super.key});

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

    // 1. Weight-for-Age
    if (data.weight != null) {
      final wfaData = getRelevantDataset(data.sex, 'weight', ageMonths);
      final wfaDataset = wfaData['dataset'] as List<LMSDataPoint>;
      final lms = wfaDataset.isNotEmpty ? getLMSForAge(wfaDataset, ageMonths) : null;
      if (lms != null) {
        final z = calculateZScore(data.weight!, lms);
        final p = calculatePercentile(z);
        newResults.add(GrowthResultData(
          measure: 'Weight-for-Age',
          value: data.weight!,
          zScore: z,
          percentile: p,
          classification: interpretWeightForAge(z),
          standard: wfaData['standardName'] as String,
          chartDataset: hasEnoughResolutionForChart(wfaDataset) ? wfaDataset : null,
          chartX: ageMonths,
        ));
      } else {
        newResults.add(GrowthResultData(
          measure: 'Weight-for-Age',
          value: data.weight!,
          classification: 'Reference data unavailable',
          standard: wfaData['standardName'] as String,
        ));
      }
    }

    // 2. Length/Height-for-Age
    if (data.height != null) {
      final hfaData = getRelevantDataset(data.sex, 'height', ageMonths);
      final hfaDataset = hfaData['dataset'] as List<LMSDataPoint>;
      final lms = hfaDataset.isNotEmpty ? getLMSForAge(hfaDataset, ageMonths) : null;
      if (lms != null) {
        final z = calculateZScore(data.height!, lms);
        final p = calculatePercentile(z);
        newResults.add(GrowthResultData(
          measure: 'Length/Height-for-Age',
          value: data.height!,
          zScore: z,
          percentile: p,
          classification: interpretLengthHeightForAge(z),
          standard: hfaData['standardName'] as String,
          chartDataset: hasEnoughResolutionForChart(hfaDataset) ? hfaDataset : null,
          chartX: ageMonths,
        ));
      } else {
        newResults.add(GrowthResultData(
          measure: 'Length/Height-for-Age',
          value: data.height!,
          classification: 'Reference data unavailable',
          standard: hfaData['standardName'] as String,
        ));
      }
    }

    // 3. Weight-for-Length (<2y) or BMI-for-Age (>=2y)
    if (data.weight != null && data.height != null && data.height! > 0) {
      if (ageMonths < 24) {
        final wflData = getRelevantDataset(data.sex, 'weightForLength', ageMonths);
        final wflDataset = wflData['dataset'] as List<LMSDataPoint>;
        final lms = wflDataset.isNotEmpty ? getLMSForAge(wflDataset, data.height!) : null;
        if (lms != null) {
          final z = calculateZScore(data.weight!, lms);
          final p = calculatePercentile(z);
          newResults.add(GrowthResultData(
            measure: 'Weight-for-Length',
            value: data.weight!,
            zScore: z,
            percentile: p,
            classification: interpretWeightForLength(z),
            standard: wflData['standardName'] as String,
            chartDataset: hasEnoughResolutionForChart(wflDataset) ? wflDataset : null,
            chartX: data.height!,
            chartXUnit: 'cm',
          ));
        } else {
          newResults.add(GrowthResultData(
            measure: 'Weight-for-Length',
            value: data.weight!,
            classification: 'Reference data unavailable',
            standard: wflData['standardName'] as String,
          ));
        }
      } else {
        final bmi = calculateBMI(data.weight!, data.height!);
        final bmiData = getRelevantDataset(data.sex, 'bmi', ageMonths);
        final bmiDataset = bmiData['dataset'] as List<LMSDataPoint>;
        final lms = bmiDataset.isNotEmpty ? getLMSForAge(bmiDataset, ageMonths) : null;
        if (lms != null) {
          final z = calculateZScore(bmi, lms);
          final p = calculatePercentile(z);
          newResults.add(GrowthResultData(
            measure: 'BMI-for-Age',
            value: bmi,
            zScore: z,
            percentile: p,
            classification: interpretBMIForAgeCDC(p),
            standard: bmiData['standardName'] as String,
            chartDataset: hasEnoughResolutionForChart(bmiDataset) ? bmiDataset : null,
            chartX: ageMonths,
          ));
        } else {
          newResults.add(GrowthResultData(
            measure: 'BMI-for-Age',
            value: bmi,
            classification: 'Reference data unavailable',
            standard: bmiData['standardName'] as String,
          ));
        }
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
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Colors.blue.shade50,
              Colors.indigo.shade50,
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Container(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.health_and_safety, size: 40, color: Theme.of(context).primaryColor),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                ShaderMask(
                                  shaderCallback: (bounds) => LinearGradient(
                                    colors: [Colors.indigo.shade600, Colors.green.shade500],
                                  ).createShader(bounds),
                                  child: const Text(
                                    'Pediatric Growth Monitor',
                                    style: TextStyle(
                                      fontSize: 28,
                                      fontWeight: FontWeight.bold,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Precision growth assessment using the CDC 2000 Growth Charts (birth-20y)',
                                  style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Input Form
                InputForm(onCalculate: _handleCalculate),
                
                const SizedBox(height: 16),
                
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
                  child: Text(
                    'Disclaimer: This tool is for clinical decision support only.\nValidate all findings with clinical judgment.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
