import 'package:flutter/material.dart';

import 'growth_assessment.dart';
import 'growth_chart.dart';

class ResultSummary extends StatelessWidget {
  final List<GrowthResultData> results;
  final Map<String, double>? mph;
  final Map<String, dynamic>? boneAgeAnalysis;
  final String? ageNote;
  final List<GrowthChartData> charts;

  const ResultSummary({
    Key? key,
    required this.results,
    this.charts = const [],
    this.ageNote,
    this.mph,
    this.boneAgeAnalysis,
  }) : super(key: key);

  /// Z-score with sign, showing a value that rounds to zero as "0.00" rather than "-0.00".
  static String _signedZ(double z) {
    final text = z.abs().toStringAsFixed(2);
    if (text == '0.00') return text;
    return '${z > 0 ? '+' : '-'}$text';
  }

  static String _unit(String measure) {
    if (measure.startsWith('BMI')) return 'kg/m²';
    if (measure.startsWith('Weight')) return 'kg';
    return 'cm';
  }

  /// One decimal place, or two above 99 so extended BMI percentiles stay distinct.
  static String _percentile(double p) => p > 99 && p < 100 ? p.toStringAsFixed(2) : p.toStringAsFixed(1);

  static String _signed(double v) => '${v > 0 ? '+' : ''}${v.toStringAsFixed(1)}';

  Color _getStatusColor(String classification) {
    if (classification == implausibleClassification) {
      return Colors.blueGrey;
    } else if (classification == 'Normal' || classification == 'Healthy weight') {
      return Colors.green;
    } else if (classification.contains('Severe') || classification.startsWith('Obese')) {
      return Colors.red;
    } else {
      return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (results.isEmpty) return const SizedBox.shrink();

    return Card(
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Growth Assessment', style: Theme.of(context).textTheme.headlineSmall),
            if (ageNote != null) ...[
              const SizedBox(height: 4),
              Text(ageNote!, style: TextStyle(color: Colors.grey.shade700)),
            ],
            const SizedBox(height: 16),
            
            // Results: one block per indicator so everything fits at phone width.
            for (final r in results)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey.shade300))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(r.measure, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: _getStatusColor(r.classification),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              r.classification,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      [
                        '${r.value.toStringAsFixed(1)} ${_unit(r.measure)}',
                        if (r.zScore != null) 'Z ${_signedZ(r.zScore!)}',
                        if (r.percentile != null) 'percentile ${_percentile(r.percentile!)}',
                      ].join('  ·  '),
                      style: TextStyle(fontSize: 14, color: Colors.grey.shade800),
                    ),
                    if (r.note != null) ...[
                      const SizedBox(height: 2),
                      Text(r.note!, style: TextStyle(fontSize: 13, color: Colors.grey.shade700)),
                    ],
                  ],
                ),
              ),
            const SizedBox(height: 8),

            // Growth charts
            for (final chart in charts)
              ExpansionTile(
                title: Text(chart.title),
                leading: const Icon(Icons.show_chart),
                tilePadding: EdgeInsets.zero,
                childrenPadding: const EdgeInsets.only(bottom: 8),
                children: [GrowthChart(data: chart)],
              ),

            // MPH Section
            if (mph != null) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.blue.shade100),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Mid-Parental Height (MPH) Target',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.blue.shade800),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Target Height: ${mph!['mph']!.toStringAsFixed(1)} cm | Range: ${mph!['rangeLow']!.toStringAsFixed(1)} cm – ${mph!['rangeHigh']!.toStringAsFixed(1)} cm',
                      style: const TextStyle(fontSize: 14),
                    ),
                  ],
                ),
              ),
            ],
            
            // Bone Age Section
            if (boneAgeAnalysis != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: boneAgeAnalysis!['status'] == 'Normal' ? Colors.green.shade50 : boneAgeAnalysis!['status'] == 'Not classified' ? Colors.grey.shade100 : Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: boneAgeAnalysis!['status'] == 'Normal' ? Colors.green.shade100 : boneAgeAnalysis!['status'] == 'Not classified' ? Colors.grey.shade300 : Colors.amber.shade100,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Bone Age Analysis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(
                      'Bone age − chronological age: ${_signed(boneAgeAnalysis!['diff'] as double)} months'
                      '${boneAgeAnalysis!['sds'] != null ? ' (${_signed(boneAgeAnalysis!['sds'] as double)} SD)' : ''}',
                      style: const TextStyle(fontSize: 14),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      boneAgeAnalysis!['sds'] == null
                          ? 'Enter the atlas SD for this age to classify (±2 SD).'
                          : 'Status: ${boneAgeAnalysis!['status']}',
                      style: const TextStyle(fontSize: 14),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
