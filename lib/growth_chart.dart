import 'dart:math';
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'growth_calculations.dart';
import 'growth_standards.dart';

/// Chart colors sourced from the dataviz skill's validated reference
/// palette: a single sequential "blue" hue for the WHO median/band series,
/// and the fixed status palette for the patient's point marker — so
/// severity is never carried by hue alone (the classification badge text
/// elsewhere on the screen backs it up).
class _ChartColors {
  static const median = Color(0xFF2A78D6);
  static const band = Color(0xFFB7D3F6);
  static const cutoff = Color(0xFF898781);
  static const gridline = Color(0xFFE1E0D9);
  static const axisLabel = Color(0xFF898781);
  static const legendLabel = Color(0xFF52514E);
  static const good = Color(0xFF0CA30C);
  static const warning = Color(0xFFFAB219);
  static const critical = Color(0xFFD03B3B);
}

Color _markerColorFor(String classification) {
  if (classification.contains('Severe') || classification == 'Obese') {
    return _ChartColors.critical;
  }
  if (classification == 'Normal' || classification == 'Healthy weight') {
    return _ChartColors.good;
  }
  return _ChartColors.warning;
}

/// A dataset needs enough anchor points, spaced closely enough, for a
/// linear-in-LMS-space interpolation to look like a faithful curve rather
/// than a straight-line guess between two distant points. Below this
/// resolution we show an explanatory note instead of a misleading chart —
/// see the TODO(clinical-data) datasets in growth_standards.dart, most of
/// which are still empty or too sparse to plot honestly.
bool hasEnoughResolutionForChart(List<LMSDataPoint> dataset) {
  if (dataset.length < 6) return false;
  for (var i = 0; i < dataset.length - 1; i++) {
    if (dataset[i + 1].ageMonths - dataset[i].ageMonths > 15) return false;
  }
  return true;
}

/// Plots a patient's measurement against the WHO/CDC median and normal
/// range (±2 SD) for the relevant growth standard, using only datasets
/// with [hasEnoughResolutionForChart].
class GrowthChart extends StatelessWidget {
  final String title;
  final List<LMSDataPoint> dataset;
  /// The patient's position on the X axis — age in months for every chart
  /// except Weight-for-Length, where WHO plots against recumbent length
  /// (cm) instead, per [xAxisUnit].
  final double patientX;
  final double patientValue;
  final String classification;
  final String yAxisLabel;
  final String xAxisUnit;

  const GrowthChart({
    super.key,
    required this.title,
    required this.dataset,
    required this.patientX,
    required this.patientValue,
    required this.classification,
    required this.yAxisLabel,
    this.xAxisUnit = 'm',
  });

  /// The LMS inverse transform (value = M·(1+LSZ)^(1/L)) is only
  /// well-behaved near the median: for a handful of ages in the CDC
  /// BMI-for-age tables, L swings negative enough that the ±3 SD tail
  /// pushes (1+LSZ) to near zero (or negative), and raising that to a
  /// negative fractional power explodes toward infinity or turns complex.
  /// This is a known LMS/Box-Cox edge case at extreme Z, not a data error
  /// (Z=±2 never triggers it in any of the embedded datasets — see
  /// test/growth_chart_test.dart). Skip the point rather than plot or
  /// let it distort the axis scale.
  double? _safeValueForZ(double z, LMSParameters lms) {
    final value = calculateValueForZ(z, lms);
    if (!value.isFinite) return null;
    if (value <= 0 || value > lms.m * 4 || value < lms.m * 0.25) return null;
    return value;
  }

  List<FlSpot> _curveAtZ(double z, double minAge, double maxAge) {
    final spots = <FlSpot>[];
    for (double age = minAge; age < maxAge; age += 1) {
      final lms = getLMSForAge(dataset, age);
      if (lms == null) continue;
      final value = _safeValueForZ(z, lms);
      if (value != null) spots.add(FlSpot(age, value));
    }
    final lmsEnd = getLMSForAge(dataset, maxAge);
    if (lmsEnd != null) {
      final value = _safeValueForZ(z, lmsEnd);
      if (value != null) spots.add(FlSpot(maxAge, value));
    }
    return spots;
  }

  LineChartBarData _curveLine(
    List<FlSpot> spots, {
    required Color color,
    double width = 2,
    List<int>? dashArray,
  }) {
    return LineChartBarData(
      spots: spots,
      isCurved: false,
      color: color,
      barWidth: width,
      dashArray: dashArray,
      dotData: const FlDotData(show: false),
    );
  }

  @override
  Widget build(BuildContext context) {
    final minAge = min(dataset.first.ageMonths, patientX);
    final maxAge = max(dataset.last.ageMonths, patientX);
    final clampedPatientAge = patientX.clamp(
      dataset.first.ageMonths,
      dataset.last.ageMonths,
    );

    final median = _curveAtZ(0, dataset.first.ageMonths, dataset.last.ageMonths);
    final upper2 = _curveAtZ(2, dataset.first.ageMonths, dataset.last.ageMonths);
    final lower2 = _curveAtZ(-2, dataset.first.ageMonths, dataset.last.ageMonths);
    final upper3 = _curveAtZ(3, dataset.first.ageMonths, dataset.last.ageMonths);
    final lower3 = _curveAtZ(-3, dataset.first.ageMonths, dataset.last.ageMonths);

    // Size the axis off the median and normal-range (±2 SD) band — the
    // chart's actual informative content — rather than the ±3 SD tails,
    // which can (rarely, and only well outside the normal range) hit the
    // LMS edge case described on _safeValueForZ. A ±3 SD point that
    // survives that filter but still lands outside this range simply
    // draws off the visible frame instead of distorting the whole scale.
    final allY = [
      ...median.map((s) => s.y),
      ...upper2.map((s) => s.y),
      ...lower2.map((s) => s.y),
      patientValue,
    ];
    final rawMinY = allY.reduce(min) * 0.9;
    final rawMaxY = allY.reduce(max) * 1.1;
    // Round the Y bounds to "nice" multiples of the tick step so fl_chart's
    // always-shown edge labels land exactly on a regular gridline instead
    // of producing a stray extra tick close to the last interval label.
    const yStepCandidates = [1.0, 2.0, 5.0, 10.0, 20.0, 25.0, 50.0, 100.0];
    var yStep = yStepCandidates.last;
    for (final candidate in yStepCandidates) {
      if ((rawMaxY - rawMinY) / candidate <= 5) {
        yStep = candidate;
        break;
      }
    }
    final minY = (rawMinY / yStep).floor() * yStep;
    final maxY = (rawMaxY / yStep).ceil() * yStep;
    final yInterval = yStep;

    double ageInterval = ((maxAge - minAge) / 5).ceilToDouble();
    if (ageInterval < 1) ageInterval = 1;

    final markerColor = _markerColorFor(classification);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 12),
        SizedBox(
          height: 240,
          child: LineChart(
            LineChartData(
              minX: minAge,
              maxX: maxAge,
              minY: minY,
              maxY: maxY,
              gridData: FlGridData(
                show: true,
                drawVerticalLine: false,
                horizontalInterval: yInterval,
                getDrawingHorizontalLine: (_) => const FlLine(
                  color: _ChartColors.gridline,
                  strokeWidth: 1,
                ),
              ),
              borderData: FlBorderData(show: false),
              titlesData: FlTitlesData(
                topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    interval: ageInterval,
                    reservedSize: 26,
                    getTitlesWidget: (value, meta) => SideTitleWidget(
                      axisSide: meta.axisSide,
                      child: Text(
                        '${value.toInt()}$xAxisUnit',
                        style: const TextStyle(fontSize: 10, color: _ChartColors.axisLabel),
                      ),
                    ),
                  ),
                ),
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    reservedSize: 34,
                    interval: yInterval,
                    getTitlesWidget: (value, meta) => Text(
                      value.toStringAsFixed(0),
                      style: const TextStyle(fontSize: 10, color: _ChartColors.axisLabel),
                    ),
                  ),
                ),
              ),
              lineTouchData: LineTouchData(
                touchTooltipData: LineTouchTooltipData(
                  getTooltipItems: (spots) => spots.map((s) {
                    return LineTooltipItem(
                      '${s.y.toStringAsFixed(1)} $yAxisLabel @ ${s.x.toStringAsFixed(0)}$xAxisUnit',
                      const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                    );
                  }).toList(),
                ),
              ),
              betweenBarsData: [
                BetweenBarsData(fromIndex: 2, toIndex: 3, color: _ChartColors.band.withOpacity(0.45)),
              ],
              lineBarsData: [
                _curveLine(lower3, color: _ChartColors.cutoff, width: 1, dashArray: const [4, 4]), // 0
                _curveLine(upper3, color: _ChartColors.cutoff, width: 1, dashArray: const [4, 4]), // 1
                _curveLine(lower2, color: Colors.transparent, width: 0), // 2
                _curveLine(upper2, color: Colors.transparent, width: 0), // 3
                _curveLine(median, color: _ChartColors.median, width: 2.5), // 4
                LineChartBarData(
                  spots: [FlSpot(clampedPatientAge.toDouble(), patientValue)],
                  barWidth: 0,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, percent, bar, index) => FlDotCirclePainter(
                      radius: 6,
                      color: markerColor,
                      strokeWidth: 2,
                      strokeColor: Colors.white,
                    ),
                  ),
                ), // 5
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 16,
          runSpacing: 4,
          children: [
            _legendItem(_ChartColors.median, 'WHO median'),
            _legendItem(_ChartColors.band.withOpacity(0.7), 'Normal range (±2 SD)'),
            _legendItem(markerColor, 'This measurement'),
          ],
        ),
      ],
    );
  }

  Widget _legendItem(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 11, color: _ChartColors.legendLabel)),
      ],
    );
  }
}
