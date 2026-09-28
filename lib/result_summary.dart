import 'package:flutter/material.dart';

import 'growth_assessment.dart' show implausibleClassification;
import 'growth_calculations.dart';

class ResultSummary extends StatelessWidget {
  final List<GrowthResultData> results;
  final Map<String, double>? mph;
  final Map<String, dynamic>? boneAgeAnalysis;
  final String? ageNote;

  const ResultSummary({
    Key? key,
    required this.results,
    this.ageNote,
    this.mph,
    this.boneAgeAnalysis,
  }) : super(key: key);

  Color _getStatusColor(String classification) {
    if (classification == implausibleClassification) {
      return Colors.blueGrey;
    } else if (classification == 'Normal' || classification == 'Healthy weight') {
      return Colors.green;
    } else if (classification.contains('Severe') || classification == 'Obese') {
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
            
            // Results Table
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                columns: const [
                  DataColumn(label: Text('Measure', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Value', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Z-Score', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Percentile', style: TextStyle(fontWeight: FontWeight.bold))),
                  DataColumn(label: Text('Status', style: TextStyle(fontWeight: FontWeight.bold))),
                ],
                rows: results.map((r) {
                  return DataRow(cells: [
                    DataCell(Text(r.measure)),
                    DataCell(Text(r.value.toStringAsFixed(1))),
                    DataCell(Text(r.zScore != null ? r.zScore!.toStringAsFixed(2) : '-')),
                    DataCell(Text(r.percentile != null ? '${r.percentile!.toStringAsFixed(1)}th' : '-')),
                    DataCell(
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getStatusColor(r.classification),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          r.classification,
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ),
                  ]);
                }).toList(),
              ),
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
                  color: boneAgeAnalysis!['status'] == 'Normal' ? Colors.green.shade50 : Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: boneAgeAnalysis!['status'] == 'Normal' ? Colors.green.shade100 : Colors.amber.shade100,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Bone Age Analysis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(
                      'Status: ${boneAgeAnalysis!['status']}${boneAgeAnalysis!['status'] != 'Normal' ? ' (${boneAgeAnalysis!['diff'] > 0 ? '+' : ''}${boneAgeAnalysis!['diff'].toStringAsFixed(1)} months difference)' : ''}',
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
