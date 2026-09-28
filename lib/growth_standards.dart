import 'package:flutter/services.dart' show AssetBundle, rootBundle;

import 'growth_calculations.dart';

/// LMS reference table for one sex, indexed by age (days or months) or by
/// length/height (cm). Values between rows are linearly interpolated.
class LmsTable {
  final List<double> _x;
  final List<double> _l;
  final List<double> _m;
  final List<double> _s;

  LmsTable._(this._x, this._l, this._m, this._s);

  double get minX => _x.first;
  double get maxX => _x.last;

  /// Parses a `sex,x,l,m,s` CSV (sex 1 = male, 2 = female) into one table
  /// per sex, keyed 'M' and 'F'.
  static Map<String, LmsTable> parseCsv(String csv) {
    final columns = {
      '1': [<double>[], <double>[], <double>[], <double>[]],
      '2': [<double>[], <double>[], <double>[], <double>[]],
    };
    final lines = csv.split('\n');
    for (final line in lines.skip(1)) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) continue;
      final fields = trimmed.split(',');
      final target = columns[fields[0]];
      if (target == null) {
        throw FormatException('Unknown sex code in LMS row: $trimmed');
      }
      for (var i = 0; i < 4; i++) {
        target[i].add(double.parse(fields[i + 1]));
      }
    }
    LmsTable build(List<List<double>> c) {
      if (c[0].isEmpty) throw const FormatException('Empty LMS table');
      return LmsTable._(c[0], c[1], c[2], c[3]);
    }

    return {'M': build(columns['1']!), 'F': build(columns['2']!)};
  }

  /// LMS parameters at [x], or null when [x] is outside the table's range.
  /// The reference is never extrapolated.
  LMSParameters? lookup(double x) {
    if (x.isNaN || x < _x.first || x > _x.last) return null;

    // Largest index i with _x[i] <= x.
    var lo = 0;
    var hi = _x.length - 1;
    while (lo < hi) {
      final mid = (lo + hi + 1) >> 1;
      if (_x[mid] <= x) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    if (_x[lo] == x || lo == _x.length - 1) {
      return LMSParameters(l: _l[lo], m: _m[lo], s: _s[lo]);
    }
    final f = (x - _x[lo]) / (_x[lo + 1] - _x[lo]);
    return LMSParameters(
      l: _l[lo] + (_l[lo + 1] - _l[lo]) * f,
      m: _m[lo] + (_m[lo + 1] - _m[lo]) * f,
      s: _s[lo] + (_s[lo + 1] - _s[lo]) * f,
    );
  }
}

/// Reference indicators available in the bundled data.
enum GrowthIndicator {
  whoWeightForAge('who_weight_for_age.csv'),
  whoLengthHeightForAge('who_length_height_for_age.csv'),
  whoBmiForAge('who_bmi_for_age.csv'),
  whoWeightForLength('who_weight_for_length.csv'),
  cdcWeightForAge('cdc_weight_for_age.csv'),
  cdcStatureForAge('cdc_stature_for_age.csv'),
  cdcBmiForAge('cdc_bmi_for_age.csv');

  const GrowthIndicator(this.fileName);

  final String fileName;
}

const String growthAssetDir = 'assets/growth';

/// All WHO 2006 and CDC 2000 LMS tables, loaded from `assets/growth/`.
///
/// WHO tables are indexed by age in days (0–1826) or by length/height in cm;
/// CDC tables by age in months (24–240.5). See `assets/growth/README.md` for
/// sources.
class GrowthReferences {
  final Map<GrowthIndicator, Map<String, LmsTable>> _tables;

  GrowthReferences._(this._tables);

  /// Builds references from CSV contents keyed by indicator.
  factory GrowthReferences.fromCsv(Map<GrowthIndicator, String> csvByIndicator) {
    return GrowthReferences._({
      for (final indicator in GrowthIndicator.values)
        indicator: LmsTable.parseCsv(csvByIndicator[indicator]!),
    });
  }

  static Future<GrowthReferences> load([AssetBundle? bundle]) async {
    final assets = bundle ?? rootBundle;
    final csv = <GrowthIndicator, String>{};
    for (final indicator in GrowthIndicator.values) {
      csv[indicator] = await assets.loadString('$growthAssetDir/${indicator.fileName}');
    }
    return GrowthReferences.fromCsv(csv);
  }

  /// [sex] is 'M' or 'F'.
  LmsTable table(GrowthIndicator indicator, String sex) => _tables[indicator]![sex]!;
}
