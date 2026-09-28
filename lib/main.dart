import 'package:flutter/material.dart';
import 'input_form.dart';
import 'result_summary.dart';
import 'growth_assessment.dart';
import 'growth_calculations.dart';
import 'growth_standards.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final refs = await GrowthReferences.load();
  runApp(MyApp(refs: refs));
}

class MyApp extends StatelessWidget {
  final GrowthReferences refs;

  const MyApp({Key? key, required this.refs}) : super(key: key);

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
      home: GrowthMonitorHome(refs: refs),
    );
  }
}

class GrowthMonitorHome extends StatefulWidget {
  final GrowthReferences refs;

  const GrowthMonitorHome({Key? key, required this.refs}) : super(key: key);

  @override
  State<GrowthMonitorHome> createState() => _GrowthMonitorHomeState();
}

class _GrowthMonitorHomeState extends State<GrowthMonitorHome> {
  List<GrowthResultData> results = [];
  Map<String, double>? mph;
  Map<String, dynamic>? boneAgeResult;

  void _handleCalculate(PatientData data) {
    final ageDays = calculateAgeDays(data.dob!, data.measurementDate);
    final ageMonths = ageDays / 30.4375;
    final newResults = assessGrowth(
      refs: widget.refs,
      sex: data.sex,
      ageDays: ageDays,
      weightKg: data.weight,
      heightCm: data.height,
    );

    if (newResults.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No reference available: age must be 0-20 years and measurements within the WHO/CDC table ranges'),
        ),
      );
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
                                  'Precision growth assessment using WHO (0-5y) & CDC (5-20y) standards',
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
