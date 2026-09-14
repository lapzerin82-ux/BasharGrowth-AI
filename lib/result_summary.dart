import 'package:flutter/material.dart';
import 'growth_calculations.dart' show isRedFlag;
import 'growth_standards.dart' show LMSDataPoint;
import 'growth_chart.dart';

class GrowthResultData {
  final String measure;
  final double value;
  final double? zScore;
  final double? percentile;
  final String classification;
  final String standard;
  final List<LMSDataPoint>? chartDataset;
  /// The patient's X-axis position for [chartDataset] — age in months for
  /// every chart except Weight-for-Length, where it's recumbent length
  /// (cm); see [chartXUnit].
  final double? chartX;
  final String chartXUnit;

  GrowthResultData({
    required this.measure,
    required this.value,
    this.zScore,
    this.percentile,
    required this.classification,
    required this.standard,
    this.chartDataset,
    this.chartX,
    this.chartXUnit = 'm',
  });
}

class ResultSummary extends StatelessWidget {
  final List<GrowthResultData> results;
  final Map<String, double>? mph;
  final Map<String, dynamic>? boneAgeAnalysis;

  const ResultSummary({
    super.key,
    required this.results,
    this.mph,
    this.boneAgeAnalysis,
  });

  Color _getStatusColor(String classification) {
    if (classification == 'Reference data unavailable') {
      return Colors.grey;
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

    final flaggedMeasures = results
        .where((r) => isRedFlag(r.classification))
        .map((r) => '${r.measure}: ${r.classification}')
        .toList();

    return Card(
      elevation: 8,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Growth Assessment', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 16),

            if (flaggedMeasures.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.red.shade700),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Red Flag: Findings requiring urgent clinical attention',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: Colors.red.shade800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            flaggedMeasures.join(' · '),
                            style: TextStyle(color: Colors.red.shade900, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

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

            // Growth Charts (only for measures with a dataset dense enough
            // to plot a faithful curve — see hasEnoughResolutionForChart)
            for (final r in results)
              if (r.chartDataset != null && r.chartX != null) ...[
                const SizedBox(height: 24),
                GrowthChart(
                  title: '${r.measure} vs. ${r.standard}',
                  dataset: r.chartDataset!,
                  patientX: r.chartX!,
                  patientValue: r.value,
                  classification: r.classification,
                  yAxisLabel: r.measure.contains('BMI')
                      ? 'kg/m²'
                      : (r.measure.contains('Height') ? 'cm' : 'kg'),
                  xAxisUnit: r.chartXUnit,
                  percentileZ: r.measure.contains('BMI') ? cdcBmiPercentileZ : cdcStandardPercentileZ,
                ),
              ],

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
