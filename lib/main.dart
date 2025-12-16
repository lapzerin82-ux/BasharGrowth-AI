import 'package:flutter/material.dart';
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
      newResults.add(GrowthResultData(
        measure: 'BMI',
        value: bmi,
        zScore: null,
        percentile: null,
        classification: 'Data Required',
        standard: 'CDC BMI',
      ));
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
                                  'Precision growth assessment using WHO (0-5y) & CDC (2-20y) standards',
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
