import 'package:flutter/material.dart';
import 'app_theme.dart';

class GrowthResultData {
  final String measure;
  final double value;
  final double? zScore;
  final double? percentile;
  final String classification;
  final String standard;

  GrowthResultData({
    required this.measure,
    required this.value,
    this.zScore,
    this.percentile,
    required this.classification,
    required this.standard,
  });
}

class ResultSummary extends StatelessWidget {
  final List<GrowthResultData> results;
  final Map<String, double>? mph;
  final Map<String, dynamic>? boneAgeAnalysis;

  const ResultSummary({
    Key? key,
    required this.results,
    this.mph,
    this.boneAgeAnalysis,
  }) : super(key: key);

  Color _getStatusColor(String classification) {
    if (classification == 'Normal' || classification == 'Healthy weight') {
      return AppColors.leaf;
    } else if (classification.contains('Severe') || classification == 'Obese') {
      return Colors.redAccent;
    } else {
      return AppColors.coral;
    }
  }

  String _getStatusEmoji(String classification) {
    if (classification == 'Normal' || classification == 'Healthy weight') {
      return '✅';
    } else if (classification.contains('Severe') || classification == 'Obese') {
      return '🚨';
    } else {
      return '⚠️';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (results.isEmpty) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SectionTitle(emoji: '📊', title: 'Growth Assessment', color: AppColors.purpleDark),
            const SizedBox(height: 16),

            // Results Table
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: DataTable(
                  headingRowColor: MaterialStateProperty.all(AppColors.purple.withOpacity(0.10)),
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
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: _getStatusColor(r.classification),
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: [
                              BoxShadow(
                                color: _getStatusColor(r.classification).withOpacity(0.35),
                                blurRadius: 6,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Text(
                            '${_getStatusEmoji(r.classification)} ${r.classification}',
                            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                    ]);
                  }).toList(),
                ),
              ),
            ),

            // MPH Section
            if (mph != null) ...[
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.sky.withOpacity(0.18), AppColors.sky.withOpacity(0.06)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.sky.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const StickerBadge(emoji: '📐', color: AppColors.sky, size: 30),
                        const SizedBox(width: 8),
                        Text(
                          'Mid-Parental Height (MPH) Target',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.blue.shade800),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
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
                  gradient: LinearGradient(
                    colors: boneAgeAnalysis!['status'] == 'Normal'
                        ? [AppColors.leaf.withOpacity(0.18), AppColors.leaf.withOpacity(0.06)]
                        : [AppColors.yellow.withOpacity(0.25), AppColors.yellow.withOpacity(0.08)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: boneAgeAnalysis!['status'] == 'Normal'
                        ? AppColors.leaf.withOpacity(0.3)
                        : AppColors.yellow.withOpacity(0.5),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        StickerBadge(
                          emoji: boneAgeAnalysis!['status'] == 'Normal' ? '🦴' : '🔍',
                          color: boneAgeAnalysis!['status'] == 'Normal' ? AppColors.leaf : AppColors.yellow,
                          size: 30,
                        ),
                        const SizedBox(width: 8),
                        const Text('Bone Age Analysis', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 10),
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
