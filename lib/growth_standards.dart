import 'growth_calculations.dart';

class LMSDataPoint {
  final double ageMonths;
  final double l;
  final double m;
  final double s;

  LMSDataPoint({
    required this.ageMonths,
    required this.l,
    required this.m,
    required this.s,
  });
}

// WHO Boys Weight (0-60m) - Source: WHO/CDC
// Note: Simplified dataset for demonstration
final List<LMSDataPoint> whoBoyWeight = [
  LMSDataPoint(ageMonths: 0, l: 0.3487, m: 3.3464, s: 0.14602),
  LMSDataPoint(ageMonths: 1, l: 0.2928, m: 4.4709, s: 0.13429),
  LMSDataPoint(ageMonths: 2, l: 0.2458, m: 5.6, s: 0.125),
  LMSDataPoint(ageMonths: 3, l: 0.2058, m: 6.4, s: 0.12),
  LMSDataPoint(ageMonths: 6, l: 0.1257, m: 7.9340, s: 0.10958),
  LMSDataPoint(ageMonths: 9, l: 0.090, m: 8.9, s: 0.109),
  LMSDataPoint(ageMonths: 12, l: 0.0644, m: 9.6479, s: 0.10925),
  LMSDataPoint(ageMonths: 18, l: 0.020, m: 10.9, s: 0.111),
  LMSDataPoint(ageMonths: 24, l: -0.0137, m: 12.1515, s: 0.11426),
  LMSDataPoint(ageMonths: 36, l: -0.0664, m: 13.9161, s: 0.11894),
  LMSDataPoint(ageMonths: 48, l: -0.1009, m: 15.3414, s: 0.12285),
  LMSDataPoint(ageMonths: 60, l: -0.1237, m: 16.5186, s: 0.12595),
];

final List<LMSDataPoint> whoGirlWeight = [
  LMSDataPoint(ageMonths: 0, l: 0.3809, m: 3.2322, s: 0.14171),
  LMSDataPoint(ageMonths: 60, l: -0.1, m: 16.0, s: 0.12),
];

final List<LMSDataPoint> cdcBoyWeight = [
  LMSDataPoint(ageMonths: 24, l: -0.206, m: 12.67, s: 0.108),
  LMSDataPoint(ageMonths: 240, l: 0, m: 70, s: 0.15),
];

// TODO(clinical-data): Populate from the official CDC 2000 Growth Reference
// (https://www.cdc.gov/growthcharts/). Left empty rather than guessed so the
// app honestly reports "Reference data unavailable" instead of silently
// using inaccurate figures for a clinical decision-support tool.
final List<LMSDataPoint> cdcGirlWeight = [];

// TODO(clinical-data): Populate from WHO Length/Height-for-Age standards
// (https://www.who.int/childgrowth/standards/) — 0-60 months.
final List<LMSDataPoint> whoBoyHeight = [];
final List<LMSDataPoint> whoGirlHeight = [];

// TODO(clinical-data): Populate from the CDC Stature-for-Age Reference
// (https://www.cdc.gov/growthcharts/) — 2-20 years.
final List<LMSDataPoint> cdcBoyHeight = [];
final List<LMSDataPoint> cdcGirlHeight = [];

// TODO(clinical-data): Populate from WHO Weight-for-Length standards
// (https://www.who.int/childgrowth/standards/). Note the independent
// variable for this chart is recumbent length in cm, not age — the
// `ageMonths` field on LMSDataPoint is reused to hold that x-axis value
// when interpolating with `getLMSForAge`.
final List<LMSDataPoint> whoBoyWeightForLength = [];
final List<LMSDataPoint> whoGirlWeightForLength = [];

// TODO(clinical-data): Populate from the CDC BMI-for-Age Reference
// (https://www.cdc.gov/growthcharts/) — 2-20 years.
final List<LMSDataPoint> cdcBoyBMI = [];
final List<LMSDataPoint> cdcGirlBMI = [];

/// Get LMS for a specific age using linear interpolation
LMSParameters? getLMSForAge(List<LMSDataPoint> dataset, double ageMonths) {
  if (dataset.isEmpty) return null;
  
  if (ageMonths < dataset.first.ageMonths) {
    return LMSParameters(
      l: dataset.first.l,
      m: dataset.first.m,
      s: dataset.first.s,
    );
  }

  if (ageMonths > dataset.last.ageMonths) {
    return LMSParameters(
      l: dataset.last.l,
      m: dataset.last.m,
      s: dataset.last.s,
    );
  }

  for (int i = 0; i < dataset.length - 1; i++) {
    final p1 = dataset[i];
    final p2 = dataset[i + 1];
    
    if (ageMonths >= p1.ageMonths && ageMonths <= p2.ageMonths) {
      final fraction = (ageMonths - p1.ageMonths) / (p2.ageMonths - p1.ageMonths);
      return LMSParameters(
        l: p1.l + (p2.l - p1.l) * fraction,
        m: p1.m + (p2.m - p1.m) * fraction,
        s: p1.s + (p2.s - p1.s) * fraction,
      );
    }
  }
  
  return null;
}

const String _whoStandard = 'WHO Child Growth Standards';
const String _cdcStandard = 'CDC Growth Reference (2000)';

/// Get relevant dataset based on sex, measure type, and age.
///
/// Selection logic: WHO standards apply to weight/height under 5y (60m);
/// CDC references apply from 5y onward. Weight-for-length is a WHO chart
/// used under 2y and is superseded by CDC BMI-for-age from 2y onward.
Map<String, dynamic> getRelevantDataset(
  String sex,
  String measureType,
  double ageMonths,
) {
  final bool isMale = sex == 'M';

  switch (measureType) {
    case 'weight':
      final isWHO = ageMonths < 60;
      return {
        'dataset': isWHO
            ? (isMale ? whoBoyWeight : whoGirlWeight)
            : (isMale ? cdcBoyWeight : cdcGirlWeight),
        'standardName': isWHO ? _whoStandard : _cdcStandard,
      };

    case 'height':
      final isWHO = ageMonths < 60;
      return {
        'dataset': isWHO
            ? (isMale ? whoBoyHeight : whoGirlHeight)
            : (isMale ? cdcBoyHeight : cdcGirlHeight),
        'standardName': isWHO ? _whoStandard : _cdcStandard,
      };

    case 'weightForLength':
      return {
        'dataset': isMale ? whoBoyWeightForLength : whoGirlWeightForLength,
        'standardName': _whoStandard,
      };

    case 'bmi':
      return {
        'dataset': isMale ? cdcBoyBMI : cdcGirlBMI,
        'standardName': _cdcStandard,
      };

    default:
      return {
        'dataset': <LMSDataPoint>[],
        'standardName': 'Unknown',
      };
  }
}
