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

// LMS reference data below reproduces the CDC 2000 Growth Charts exactly —
// the same "Set 2" clinical chart bundle (birth-36 months and 2-20 years,
// boys and girls) published by NCHS/CDC — replacing the app's earlier
// mixed WHO/CDC scheme entirely, per the user's request to use this
// specific document's charts without modification.
//
// Extracted programmatically (pandas + pyreadr reading the .rda file, not
// hand-transcribed) from CDC's own `CDCAnthro` R package
// (github.com/CDC-DNPAO/CDCAnthro) — the same reference software CDC
// itself uses to compute these percentiles, and the same underlying LMS
// parameters used to draw the printed charts:
//
// - Weight-for-Age: one continuous curve, birth-20y (no measurement-
//   method transition applies to weighing a child).
// - Length-for-Age (recumbent, birth-36mo) / Stature-for-Age (standing,
//   2-20y): two curves, matching the printed chart set's own transition
//   from recumbent length to standing height around 24 months.
// - Weight-for-Length (recumbent length, birth-36mo).
// - BMI-for-Age (2-20y).
//
// Percentile curves shown per chart type match the printed pages exactly:
// 3rd/10th/25th/50th/75th/90th/97th for weight, length/stature, and
// weight-for-length; 3rd/10th/25th/50th/75th/85th/90th/95th/97th for
// BMI-for-age (the CDC chart's own extra 85th/95th overweight/obesity
// cutoffs) — see cdcStandardPercentileZ / cdcBmiPercentileZ in
// growth_chart.dart.

final List<LMSDataPoint> cdcBoyWeight = [
  LMSDataPoint(ageMonths: 0.0, l: 1.81515, m: 3.5302, s: 0.15239),
  LMSDataPoint(ageMonths: 1.5, l: 1.0688, m: 4.87953, s: 0.13648),
  LMSDataPoint(ageMonths: 3.5, l: 0.41982, m: 6.39139, s: 0.12472),
  LMSDataPoint(ageMonths: 5.5, l: 0.07751, m: 7.63043, s: 0.11827),
  LMSDataPoint(ageMonths: 7.5, l: -0.08944, m: 8.64483, s: 0.11451),
  LMSDataPoint(ageMonths: 9.5, l: -0.1601, m: 9.4765, s: 0.11219),
  LMSDataPoint(ageMonths: 11.5, l: -0.17972, m: 10.16154, s: 0.11068),
  LMSDataPoint(ageMonths: 13.5, l: -0.17518, m: 10.73063, s: 0.10966),
  LMSDataPoint(ageMonths: 15.5, l: -0.16311, m: 11.20956, s: 0.10896),
  LMSDataPoint(ageMonths: 17.5, l: -0.15402, m: 11.61978, s: 0.10848),
  LMSDataPoint(ageMonths: 19.5, l: -0.15447, m: 11.97897, s: 0.10819),
  LMSDataPoint(ageMonths: 21.5, l: -0.16818, m: 12.30154, s: 0.10807),
  LMSDataPoint(ageMonths: 23.5, l: -0.1967, m: 12.59913, s: 0.1081),
  LMSDataPoint(ageMonths: 25.5, l: -0.23979, m: 12.88102, s: 0.10827),
  LMSDataPoint(ageMonths: 27.5, l: -0.29575, m: 13.1545, s: 0.1086),
  LMSDataPoint(ageMonths: 29.5, l: -0.36182, m: 13.42519, s: 0.10908),
  LMSDataPoint(ageMonths: 31.5, l: -0.43452, m: 13.69738, s: 0.10971),
  LMSDataPoint(ageMonths: 33.5, l: -0.51012, m: 13.97418, s: 0.11047),
  LMSDataPoint(ageMonths: 35.5, l: -0.58507, m: 14.2578, s: 0.11137),
  LMSDataPoint(ageMonths: 41.5, l: -0.7789, m: 15.16078, s: 0.11482),
  LMSDataPoint(ageMonths: 47.5, l: -0.90151, m: 16.14548, s: 0.11917),
  LMSDataPoint(ageMonths: 53.5, l: -0.9631, m: 17.19839, s: 0.12404),
  LMSDataPoint(ageMonths: 59.5, l: -0.99564, m: 18.29912, s: 0.12905),
  LMSDataPoint(ageMonths: 65.5, l: -1.02824, m: 19.43058, s: 0.1339),
  LMSDataPoint(ageMonths: 71.5, l: -1.07732, m: 20.58357, s: 0.13842),
  LMSDataPoint(ageMonths: 77.5, l: -1.14543, m: 21.75811, s: 0.14263),
  LMSDataPoint(ageMonths: 83.5, l: -1.22357, m: 22.96273, s: 0.14667),
  LMSDataPoint(ageMonths: 89.5, l: -1.29595, m: 24.21251, s: 0.15076),
  LMSDataPoint(ageMonths: 95.5, l: -1.34641, m: 25.52607, s: 0.15519),
  LMSDataPoint(ageMonths: 101.5, l: -1.36404, m: 26.92273, s: 0.16014),
  LMSDataPoint(ageMonths: 107.5, l: -1.34575, m: 28.42064, s: 0.16568),
  LMSDataPoint(ageMonths: 113.5, l: -1.29537, m: 30.03602, s: 0.1717),
  LMSDataPoint(ageMonths: 119.5, l: -1.22082, m: 31.78312, s: 0.1779),
  LMSDataPoint(ageMonths: 125.5, l: -1.1313, m: 33.67387, s: 0.1839),
  LMSDataPoint(ageMonths: 131.5, l: -1.03537, m: 35.71695, s: 0.18924),
  LMSDataPoint(ageMonths: 137.5, l: -0.94008, m: 37.91616, s: 0.19348),
  LMSDataPoint(ageMonths: 143.5, l: -0.85092, m: 40.26828, s: 0.19628),
  LMSDataPoint(ageMonths: 149.5, l: -0.77214, m: 42.76073, s: 0.19744),
  LMSDataPoint(ageMonths: 155.5, l: -0.70736, m: 45.3696, s: 0.19691),
  LMSDataPoint(ageMonths: 161.5, l: -0.66007, m: 48.05847, s: 0.19482),
  LMSDataPoint(ageMonths: 167.5, l: -0.63392, m: 50.77859, s: 0.19147),
  LMSDataPoint(ageMonths: 173.5, l: -0.63253, m: 53.47107, s: 0.18721),
  LMSDataPoint(ageMonths: 179.5, l: -0.65855, m: 56.07116, s: 0.18247),
  LMSDataPoint(ageMonths: 185.5, l: -0.71192, m: 58.51492, s: 0.17767),
  LMSDataPoint(ageMonths: 191.5, l: -0.78782, m: 60.74699, s: 0.17316),
  LMSDataPoint(ageMonths: 197.5, l: -0.87565, m: 62.72809, s: 0.16924),
  LMSDataPoint(ageMonths: 203.5, l: -0.96051, m: 64.44032, s: 0.16608),
  LMSDataPoint(ageMonths: 209.5, l: -1.027, m: 65.8897, s: 0.16375),
  LMSDataPoint(ageMonths: 215.5, l: -1.06353, m: 67.10642, s: 0.16214),
  LMSDataPoint(ageMonths: 221.5, l: -1.06462, m: 68.14111, s: 0.16102),
  LMSDataPoint(ageMonths: 227.5, l: -1.03158, m: 69.05176, s: 0.16023),
  LMSDataPoint(ageMonths: 233.5, l: -0.97466, m: 69.87224, s: 0.15995),
  LMSDataPoint(ageMonths: 239.5, l: -0.91972, m: 70.55252, s: 0.16123),
];

final List<LMSDataPoint> cdcBoyLength = [
  LMSDataPoint(ageMonths: 0.0, l: 1.267, m: 49.98888, s: 0.05311),
  LMSDataPoint(ageMonths: 0.5, l: 0.51124, m: 52.69598, s: 0.04869),
  LMSDataPoint(ageMonths: 1.5, l: -0.45224, m: 56.62843, s: 0.04412),
  LMSDataPoint(ageMonths: 2.5, l: -0.99059, m: 59.60895, s: 0.0418),
  LMSDataPoint(ageMonths: 3.5, l: -1.28584, m: 62.077, s: 0.04045),
  LMSDataPoint(ageMonths: 4.5, l: -1.43031, m: 64.21686, s: 0.03963),
  LMSDataPoint(ageMonths: 5.5, l: -1.47658, m: 66.12531, s: 0.03912),
  LMSDataPoint(ageMonths: 6.5, l: -1.45684, m: 67.86018, s: 0.03881),
  LMSDataPoint(ageMonths: 7.5, l: -1.3919, m: 69.45908, s: 0.03863),
  LMSDataPoint(ageMonths: 8.5, l: -1.29571, m: 70.94804, s: 0.03855),
  LMSDataPoint(ageMonths: 9.5, l: -1.17792, m: 72.34586, s: 0.03853),
  LMSDataPoint(ageMonths: 10.5, l: -1.04533, m: 73.66665, s: 0.03855),
  LMSDataPoint(ageMonths: 11.5, l: -0.9028, m: 74.9213, s: 0.03862),
  LMSDataPoint(ageMonths: 12.5, l: -0.75391, m: 76.11838, s: 0.0387),
  LMSDataPoint(ageMonths: 13.5, l: -0.60126, m: 77.2648, s: 0.03881),
  LMSDataPoint(ageMonths: 14.5, l: -0.44681, m: 78.36622, s: 0.03893),
  LMSDataPoint(ageMonths: 15.5, l: -0.29197, m: 79.42734, s: 0.03906),
  LMSDataPoint(ageMonths: 16.5, l: -0.13785, m: 80.45209, s: 0.0392),
  LMSDataPoint(ageMonths: 17.5, l: 0.01478, m: 81.44384, s: 0.03935),
  LMSDataPoint(ageMonths: 18.5, l: 0.1653, m: 82.40544, s: 0.03949),
  LMSDataPoint(ageMonths: 19.5, l: 0.3133, m: 83.33938, s: 0.03964),
  LMSDataPoint(ageMonths: 20.5, l: 0.45846, m: 84.24783, s: 0.0398),
  LMSDataPoint(ageMonths: 21.5, l: 0.60054, m: 85.1327, s: 0.03995),
  LMSDataPoint(ageMonths: 22.5, l: 0.73944, m: 85.99565, s: 0.0401),
  LMSDataPoint(ageMonths: 23.5, l: 0.875, m: 86.83818, s: 0.04025),
  LMSDataPoint(ageMonths: 24.5, l: 1.00721, m: 87.66161, s: 0.0404),
  LMSDataPoint(ageMonths: 25.5, l: 0.83725, m: 88.45247, s: 0.04058),
  LMSDataPoint(ageMonths: 26.5, l: 0.68149, m: 89.22326, s: 0.04072),
  LMSDataPoint(ageMonths: 27.5, l: 0.53878, m: 89.97549, s: 0.04083),
  LMSDataPoint(ageMonths: 28.5, l: 0.4077, m: 90.71041, s: 0.04091),
  LMSDataPoint(ageMonths: 29.5, l: 0.28676, m: 91.42908, s: 0.04095),
  LMSDataPoint(ageMonths: 30.5, l: 0.17449, m: 92.13242, s: 0.04097),
  LMSDataPoint(ageMonths: 31.5, l: 0.06944, m: 92.82127, s: 0.04095),
  LMSDataPoint(ageMonths: 32.5, l: -0.02972, m: 93.49638, s: 0.04091),
  LMSDataPoint(ageMonths: 33.5, l: -0.12425, m: 94.15847, s: 0.04084),
  LMSDataPoint(ageMonths: 34.5, l: -0.21529, m: 94.80823, s: 0.04076),
  LMSDataPoint(ageMonths: 35.5, l: -0.30385, m: 95.44637, s: 0.04065),
];

final List<LMSDataPoint> cdcBoyStature = [
  LMSDataPoint(ageMonths: 23.5, l: 0.87584, m: 86.04279, s: 0.04025),
  LMSDataPoint(ageMonths: 29.5, l: 0.28676, m: 90.62908, s: 0.04095),
  LMSDataPoint(ageMonths: 35.5, l: -0.30385, m: 94.64637, s: 0.04065),
  LMSDataPoint(ageMonths: 41.5, l: 0.22275, m: 98.39903, s: 0.04078),
  LMSDataPoint(ageMonths: 47.5, l: 0.75816, m: 101.93731, s: 0.04125),
  LMSDataPoint(ageMonths: 53.5, l: 1.09537, m: 105.32616, s: 0.04185),
  LMSDataPoint(ageMonths: 59.5, l: 1.25512, m: 108.62965, s: 0.04249),
  LMSDataPoint(ageMonths: 65.5, l: 1.26573, m: 111.88897, s: 0.04309),
  LMSDataPoint(ageMonths: 71.5, l: 1.1628, m: 115.12383, s: 0.0436),
  LMSDataPoint(ageMonths: 77.5, l: 0.98785, m: 118.33482, s: 0.04401),
  LMSDataPoint(ageMonths: 83.5, l: 0.78625, m: 121.50721, s: 0.04435),
  LMSDataPoint(ageMonths: 89.5, l: 0.6022, m: 124.61602, s: 0.04468),
  LMSDataPoint(ageMonths: 95.5, l: 0.47059, m: 127.63204, s: 0.04506),
  LMSDataPoint(ageMonths: 101.5, l: 0.40843, m: 130.52857, s: 0.04553),
  LMSDataPoint(ageMonths: 107.5, l: 0.41058, m: 133.28823, s: 0.04611),
  LMSDataPoint(ageMonths: 113.5, l: 0.45256, m: 135.90968, s: 0.04678),
  LMSDataPoint(ageMonths: 119.5, l: 0.49965, m: 138.41427, s: 0.04749),
  LMSDataPoint(ageMonths: 125.5, l: 0.51945, m: 140.8527, s: 0.04819),
  LMSDataPoint(ageMonths: 131.5, l: 0.4957, m: 143.31072, s: 0.04884),
  LMSDataPoint(ageMonths: 137.5, l: 0.44289, m: 145.90968, s: 0.0494),
  LMSDataPoint(ageMonths: 143.5, l: 0.41678, m: 148.7917, s: 0.04988),
  LMSDataPoint(ageMonths: 149.5, l: 0.50177, m: 152.07349, s: 0.05023),
  LMSDataPoint(ageMonths: 155.5, l: 0.75738, m: 155.76421, s: 0.05035),
  LMSDataPoint(ageMonths: 161.5, l: 1.15849, m: 159.69305, s: 0.05003),
  LMSDataPoint(ageMonths: 167.5, l: 1.60122, m: 163.53504, s: 0.04915),
  LMSDataPoint(ageMonths: 173.5, l: 1.96893, m: 166.95284, s: 0.04777),
  LMSDataPoint(ageMonths: 179.5, l: 2.18585, m: 169.74054, s: 0.04616),
  LMSDataPoint(ageMonths: 185.5, l: 2.23257, m: 171.86256, s: 0.0446),
  LMSDataPoint(ageMonths: 191.5, l: 2.13852, m: 173.40139, s: 0.04328),
  LMSDataPoint(ageMonths: 197.5, l: 1.96079, m: 174.48543, s: 0.04225),
  LMSDataPoint(ageMonths: 203.5, l: 1.75779, m: 175.23979, s: 0.04151),
  LMSDataPoint(ageMonths: 209.5, l: 1.57108, m: 175.76517, s: 0.041),
  LMSDataPoint(ageMonths: 215.5, l: 1.421, m: 176.13476, s: 0.04068),
  LMSDataPoint(ageMonths: 221.5, l: 1.31167, m: 176.39887, s: 0.0405),
  LMSDataPoint(ageMonths: 227.5, l: 1.23841, m: 176.59112, s: 0.0404),
  LMSDataPoint(ageMonths: 233.5, l: 1.19335, m: 176.73374, s: 0.04037),
  LMSDataPoint(ageMonths: 239.5, l: 1.16864, m: 176.84149, s: 0.04037),
];

final List<LMSDataPoint> cdcBoyBMI = [
  LMSDataPoint(ageMonths: 23.5, l: -2.03999, m: 16.60228, s: 0.08106),
  LMSDataPoint(ageMonths: 29.5, l: -1.69482, m: 16.29584, s: 0.07615),
  LMSDataPoint(ageMonths: 35.5, l: -1.44263, m: 16.03876, s: 0.07299),
  LMSDataPoint(ageMonths: 41.5, l: -1.4161, m: 15.82559, s: 0.07157),
  LMSDataPoint(ageMonths: 47.5, l: -1.65373, m: 15.65305, s: 0.07173),
  LMSDataPoint(ageMonths: 53.5, l: -2.07671, m: 15.52065, s: 0.07315),
  LMSDataPoint(ageMonths: 59.5, l: -2.54278, m: 15.43003, s: 0.07552),
  LMSDataPoint(ageMonths: 65.5, l: -2.92984, m: 15.38307, s: 0.07863),
  LMSDataPoint(ageMonths: 71.5, l: -3.18289, m: 15.37991, s: 0.08237),
  LMSDataPoint(ageMonths: 77.5, l: -3.30512, m: 15.41869, s: 0.08664),
  LMSDataPoint(ageMonths: 83.5, l: -3.32687, m: 15.49637, s: 0.09132),
  LMSDataPoint(ageMonths: 89.5, l: -3.28226, m: 15.60961, s: 0.09625),
  LMSDataPoint(ageMonths: 95.5, l: -3.19916, m: 15.75513, s: 0.10126),
  LMSDataPoint(ageMonths: 101.5, l: -3.09723, m: 15.92992, s: 0.1062),
  LMSDataPoint(ageMonths: 107.5, l: -2.98916, m: 16.13119, s: 0.11096),
  LMSDataPoint(ageMonths: 113.5, l: -2.88259, m: 16.35637, s: 0.11541),
  LMSDataPoint(ageMonths: 119.5, l: -2.78174, m: 16.60309, s: 0.11948),
  LMSDataPoint(ageMonths: 125.5, l: -2.68861, m: 16.86907, s: 0.1231),
  LMSDataPoint(ageMonths: 131.5, l: -2.60387, m: 17.15218, s: 0.12626),
  LMSDataPoint(ageMonths: 137.5, l: -2.52733, m: 17.45036, s: 0.12891),
  LMSDataPoint(ageMonths: 143.5, l: -2.45827, m: 17.76162, s: 0.13108),
  LMSDataPoint(ageMonths: 149.5, l: -2.39573, m: 18.08404, s: 0.13276),
  LMSDataPoint(ageMonths: 155.5, l: -2.33855, m: 18.41574, s: 0.13398),
  LMSDataPoint(ageMonths: 161.5, l: -2.28553, m: 18.75489, s: 0.13478),
  LMSDataPoint(ageMonths: 167.5, l: -2.23549, m: 19.0997, s: 0.13521),
  LMSDataPoint(ageMonths: 173.5, l: -2.18734, m: 19.44837, s: 0.13532),
  LMSDataPoint(ageMonths: 179.5, l: -2.14016, m: 19.79912, s: 0.13516),
  LMSDataPoint(ageMonths: 185.5, l: -2.09336, m: 20.15017, s: 0.13479),
  LMSDataPoint(ageMonths: 191.5, l: -2.04675, m: 20.49968, s: 0.13429),
  LMSDataPoint(ageMonths: 197.5, l: -2.00071, m: 20.84574, s: 0.13372),
  LMSDataPoint(ageMonths: 203.5, l: -1.95627, m: 21.18638, s: 0.13315),
  LMSDataPoint(ageMonths: 209.5, l: -1.91519, m: 21.51952, s: 0.13265),
  LMSDataPoint(ageMonths: 215.5, l: -1.87982, m: 21.84304, s: 0.13232),
  LMSDataPoint(ageMonths: 221.5, l: -1.85283, m: 22.15476, s: 0.13223),
  LMSDataPoint(ageMonths: 227.5, l: -1.83666, m: 22.45257, s: 0.13248),
  LMSDataPoint(ageMonths: 233.5, l: -1.83282, m: 22.73456, s: 0.13317),
  LMSDataPoint(ageMonths: 239.5, l: -1.84115, m: 22.99908, s: 0.13441),
];

final List<LMSDataPoint> cdcBoyWeightForLength = [
  LMSDataPoint(ageMonths: 45.0, l: 1.44904, m: 2.28976, s: 0.14924),
  LMSDataPoint(ageMonths: 45.5, l: 1.31794, m: 2.38617, s: 0.14479),
  LMSDataPoint(ageMonths: 46.5, l: 1.04173, m: 2.5871, s: 0.13655),
  LMSDataPoint(ageMonths: 47.5, l: 0.75662, m: 2.79795, s: 0.12916),
  LMSDataPoint(ageMonths: 48.5, l: 0.47262, m: 3.01768, s: 0.12259),
  LMSDataPoint(ageMonths: 49.5, l: 0.19746, m: 3.24523, s: 0.1168),
  LMSDataPoint(ageMonths: 50.5, l: -0.06327, m: 3.47957, s: 0.11173),
  LMSDataPoint(ageMonths: 51.5, l: -0.30566, m: 3.71974, s: 0.10732),
  LMSDataPoint(ageMonths: 52.5, l: -0.52721, m: 3.96484, s: 0.10347),
  LMSDataPoint(ageMonths: 53.5, l: -0.72636, m: 4.21403, s: 0.10014),
  LMSDataPoint(ageMonths: 54.5, l: -0.90238, m: 4.46656, s: 0.09725),
  LMSDataPoint(ageMonths: 55.5, l: -1.05513, m: 4.72173, s: 0.09474),
  LMSDataPoint(ageMonths: 56.5, l: -1.18493, m: 4.9789, s: 0.09256),
  LMSDataPoint(ageMonths: 57.5, l: -1.29253, m: 5.2375, s: 0.09067),
  LMSDataPoint(ageMonths: 58.5, l: -1.37897, m: 5.49701, s: 0.08902),
  LMSDataPoint(ageMonths: 59.5, l: -1.44556, m: 5.75694, s: 0.08759),
  LMSDataPoint(ageMonths: 60.5, l: -1.4938, m: 6.01687, s: 0.08634),
  LMSDataPoint(ageMonths: 61.5, l: -1.52533, m: 6.2764, s: 0.08525),
  LMSDataPoint(ageMonths: 62.5, l: -1.54184, m: 6.5352, s: 0.08428),
  LMSDataPoint(ageMonths: 63.5, l: -1.5451, m: 6.79294, s: 0.08343),
  LMSDataPoint(ageMonths: 64.5, l: -1.53686, m: 7.04937, s: 0.08268),
  LMSDataPoint(ageMonths: 65.5, l: -1.51879, m: 7.30425, s: 0.08201),
  LMSDataPoint(ageMonths: 66.5, l: -1.49249, m: 7.55738, s: 0.0814),
  LMSDataPoint(ageMonths: 67.5, l: -1.45949, m: 7.80861, s: 0.08085),
  LMSDataPoint(ageMonths: 68.5, l: -1.42117, m: 8.05781, s: 0.08035),
  LMSDataPoint(ageMonths: 69.5, l: -1.37884, m: 8.30489, s: 0.07989),
  LMSDataPoint(ageMonths: 70.5, l: -1.33363, m: 8.5498, s: 0.07946),
  LMSDataPoint(ageMonths: 71.5, l: -1.28661, m: 8.79252, s: 0.07907),
  LMSDataPoint(ageMonths: 72.5, l: -1.23867, m: 9.03305, s: 0.0787),
  LMSDataPoint(ageMonths: 73.5, l: -1.19067, m: 9.27145, s: 0.07836),
  LMSDataPoint(ageMonths: 74.5, l: -1.14332, m: 9.50777, s: 0.07804),
  LMSDataPoint(ageMonths: 75.5, l: -1.09726, m: 9.74213, s: 0.07773),
  LMSDataPoint(ageMonths: 76.5, l: -1.05308, m: 9.97464, s: 0.07745),
  LMSDataPoint(ageMonths: 77.5, l: -1.01129, m: 10.20546, s: 0.07719),
  LMSDataPoint(ageMonths: 78.5, l: -0.97236, m: 10.43477, s: 0.07695),
  LMSDataPoint(ageMonths: 79.5, l: -0.93671, m: 10.66275, s: 0.07673),
  LMSDataPoint(ageMonths: 80.5, l: -0.90472, m: 10.88963, s: 0.07653),
  LMSDataPoint(ageMonths: 81.5, l: -0.87678, m: 11.11563, s: 0.07635),
  LMSDataPoint(ageMonths: 82.5, l: -0.85322, m: 11.34101, s: 0.07619),
  LMSDataPoint(ageMonths: 83.5, l: -0.83438, m: 11.56604, s: 0.07606),
  LMSDataPoint(ageMonths: 84.5, l: -0.82058, m: 11.79097, s: 0.07595),
  LMSDataPoint(ageMonths: 85.5, l: -0.81215, m: 12.01611, s: 0.07587),
  LMSDataPoint(ageMonths: 86.5, l: -0.80939, m: 12.24174, s: 0.07581),
  LMSDataPoint(ageMonths: 87.5, l: -0.81264, m: 12.46816, s: 0.07579),
  LMSDataPoint(ageMonths: 88.5, l: -0.82219, m: 12.69567, s: 0.07579),
  LMSDataPoint(ageMonths: 89.5, l: -0.83835, m: 12.92459, s: 0.07583),
  LMSDataPoint(ageMonths: 90.5, l: -0.86145, m: 13.1552, s: 0.07589),
  LMSDataPoint(ageMonths: 91.5, l: -0.89177, m: 13.38782, s: 0.07599),
  LMSDataPoint(ageMonths: 92.5, l: -0.92962, m: 13.62274, s: 0.07612),
  LMSDataPoint(ageMonths: 93.5, l: -0.97527, m: 13.86026, s: 0.07628),
  LMSDataPoint(ageMonths: 94.5, l: -1.02899, m: 14.10065, s: 0.07647),
  LMSDataPoint(ageMonths: 95.5, l: -1.09102, m: 14.3442, s: 0.07669),
  LMSDataPoint(ageMonths: 96.5, l: -1.16157, m: 14.59115, s: 0.07694),
  LMSDataPoint(ageMonths: 97.5, l: -1.24082, m: 14.84177, s: 0.07721),
  LMSDataPoint(ageMonths: 98.5, l: -1.32888, m: 15.09629, s: 0.07752),
  LMSDataPoint(ageMonths: 99.5, l: -1.42581, m: 15.35493, s: 0.07784),
  LMSDataPoint(ageMonths: 100.5, l: -1.53158, m: 15.6179, s: 0.07818),
  LMSDataPoint(ageMonths: 101.5, l: -1.64608, m: 15.88539, s: 0.07854),
  LMSDataPoint(ageMonths: 102.5, l: -1.76908, m: 16.1576, s: 0.07891),
];

final List<LMSDataPoint> cdcGirlWeight = [
  LMSDataPoint(ageMonths: 0.0, l: 1.50919, m: 3.39919, s: 0.14211),
  LMSDataPoint(ageMonths: 1.5, l: 1.10554, m: 4.54478, s: 0.13173),
  LMSDataPoint(ageMonths: 3.5, l: 0.73412, m: 5.85996, s: 0.12303),
  LMSDataPoint(ageMonths: 5.5, l: 0.46439, m: 6.96785, s: 0.11717),
  LMSDataPoint(ageMonths: 7.5, l: 0.2505, m: 7.90244, s: 0.11295),
  LMSDataPoint(ageMonths: 9.5, l: 0.07089, m: 8.69342, s: 0.10986),
  LMSDataPoint(ageMonths: 11.5, l: -0.08526, m: 9.36659, s: 0.10766),
  LMSDataPoint(ageMonths: 13.5, l: -0.22356, m: 9.94423, s: 0.10618),
  LMSDataPoint(ageMonths: 15.5, l: -0.347, m: 10.44541, s: 0.10535),
  LMSDataPoint(ageMonths: 17.5, l: -0.45722, m: 10.88639, s: 0.10508),
  LMSDataPoint(ageMonths: 19.5, l: -0.55524, m: 11.2809, s: 0.10532),
  LMSDataPoint(ageMonths: 21.5, l: -0.64185, m: 11.64043, s: 0.10601),
  LMSDataPoint(ageMonths: 23.5, l: -0.71788, m: 11.97454, s: 0.10708),
  LMSDataPoint(ageMonths: 25.5, l: -0.78423, m: 12.29102, s: 0.10848),
  LMSDataPoint(ageMonths: 27.5, l: -0.84194, m: 12.59622, s: 0.11014),
  LMSDataPoint(ageMonths: 29.5, l: -0.8921, m: 12.89517, s: 0.11202),
  LMSDataPoint(ageMonths: 31.5, l: -0.93588, m: 13.19181, s: 0.11406),
  LMSDataPoint(ageMonths: 33.5, l: -0.97438, m: 13.48913, s: 0.11619),
  LMSDataPoint(ageMonths: 35.5, l: -1.00864, m: 13.78937, s: 0.11839),
  LMSDataPoint(ageMonths: 41.5, l: -1.09438, m: 14.72064, s: 0.12493),
  LMSDataPoint(ageMonths: 47.5, l: -1.16596, m: 15.70817, s: 0.13089),
  LMSDataPoint(ageMonths: 53.5, l: -1.2288, m: 16.74994, s: 0.13603),
  LMSDataPoint(ageMonths: 59.5, l: -1.28055, m: 17.83782, s: 0.14049),
  LMSDataPoint(ageMonths: 65.5, l: -1.31529, m: 18.96631, s: 0.14463),
  LMSDataPoint(ageMonths: 71.5, l: -1.32726, m: 20.1367, s: 0.14885),
  LMSDataPoint(ageMonths: 77.5, l: -1.31333, m: 21.35797, s: 0.1535),
  LMSDataPoint(ageMonths: 83.5, l: -1.27424, m: 22.64564, s: 0.15875),
  LMSDataPoint(ageMonths: 89.5, l: -1.21441, m: 24.01918, s: 0.16465),
  LMSDataPoint(ageMonths: 95.5, l: -1.14075, m: 25.4988, s: 0.17105),
  LMSDataPoint(ageMonths: 101.5, l: -1.06115, m: 27.10193, s: 0.17767),
  LMSDataPoint(ageMonths: 107.5, l: -0.98309, m: 28.83984, s: 0.18416),
  LMSDataPoint(ageMonths: 113.5, l: -0.9128, m: 30.7149, s: 0.19012),
  LMSDataPoint(ageMonths: 119.5, l: -0.85503, m: 32.71868, s: 0.19521),
  LMSDataPoint(ageMonths: 125.5, l: -0.81314, m: 34.83116, s: 0.19912),
  LMSDataPoint(ageMonths: 131.5, l: -0.78944, m: 37.02111, s: 0.20168),
  LMSDataPoint(ageMonths: 137.5, l: -0.78554, m: 39.24775, s: 0.2028),
  LMSDataPoint(ageMonths: 143.5, l: -0.80264, m: 41.46336, s: 0.20249),
  LMSDataPoint(ageMonths: 149.5, l: -0.84163, m: 43.61683, s: 0.20082),
  LMSDataPoint(ageMonths: 155.5, l: -0.90308, m: 45.65777, s: 0.19795),
  LMSDataPoint(ageMonths: 161.5, l: -0.98695, m: 47.54083, s: 0.19406),
  LMSDataPoint(ageMonths: 167.5, l: -1.09216, m: 49.22993, s: 0.18939),
  LMSDataPoint(ageMonths: 173.5, l: -1.21591, m: 50.70196, s: 0.18422),
  LMSDataPoint(ageMonths: 179.5, l: -1.3529, m: 51.94926, s: 0.17884),
  LMSDataPoint(ageMonths: 185.5, l: -1.49479, m: 52.98079, s: 0.1736),
  LMSDataPoint(ageMonths: 191.5, l: -1.63023, m: 53.82138, s: 0.16884),
  LMSDataPoint(ageMonths: 197.5, l: -1.74586, m: 54.50921, s: 0.16492),
  LMSDataPoint(ageMonths: 203.5, l: -1.82837, m: 55.09172, s: 0.1621),
  LMSDataPoint(ageMonths: 209.5, l: -1.86721, m: 55.62001, s: 0.16055),
  LMSDataPoint(ageMonths: 215.5, l: -1.85729, m: 56.141, s: 0.1603),
  LMSDataPoint(ageMonths: 221.5, l: -1.80115, m: 56.68633, s: 0.16117),
  LMSDataPoint(ageMonths: 227.5, l: -1.71041, m: 57.2568, s: 0.16282),
  LMSDataPoint(ageMonths: 233.5, l: -1.60621, m: 57.80227, s: 0.16477),
  LMSDataPoint(ageMonths: 239.5, l: -1.51875, m: 58.19877, s: 0.16652),
];

final List<LMSDataPoint> cdcGirlLength = [
  LMSDataPoint(ageMonths: 0.0, l: -1.29596, m: 49.2864, s: 0.05009),
  LMSDataPoint(ageMonths: 0.5, l: -0.80925, m: 51.68358, s: 0.04682),
  LMSDataPoint(ageMonths: 1.5, l: -0.05078, m: 55.28613, s: 0.04344),
  LMSDataPoint(ageMonths: 2.5, l: 0.47685, m: 58.09382, s: 0.04172),
  LMSDataPoint(ageMonths: 3.5, l: 0.8433, m: 60.45981, s: 0.04071),
  LMSDataPoint(ageMonths: 4.5, l: 1.09756, m: 62.5367, s: 0.04008),
  LMSDataPoint(ageMonths: 5.5, l: 1.27251, m: 64.40633, s: 0.03969),
  LMSDataPoint(ageMonths: 6.5, l: 1.39043, m: 66.11842, s: 0.03944),
  LMSDataPoint(ageMonths: 7.5, l: 1.46673, m: 67.70574, s: 0.0393),
  LMSDataPoint(ageMonths: 8.5, l: 1.5123, m: 69.19124, s: 0.03924),
  LMSDataPoint(ageMonths: 9.5, l: 1.53495, m: 70.59164, s: 0.03922),
  LMSDataPoint(ageMonths: 10.5, l: 1.54039, m: 71.91962, s: 0.03924),
  LMSDataPoint(ageMonths: 11.5, l: 1.53285, m: 73.18501, s: 0.0393),
  LMSDataPoint(ageMonths: 12.5, l: 1.51551, m: 74.39564, s: 0.03937),
  LMSDataPoint(ageMonths: 13.5, l: 1.49077, m: 75.55785, s: 0.03946),
  LMSDataPoint(ageMonths: 14.5, l: 1.46046, m: 76.67686, s: 0.03956),
  LMSDataPoint(ageMonths: 15.5, l: 1.42601, m: 77.75701, s: 0.03967),
  LMSDataPoint(ageMonths: 16.5, l: 1.38851, m: 78.80198, s: 0.03979),
  LMSDataPoint(ageMonths: 17.5, l: 1.34882, m: 79.81492, s: 0.03992),
  LMSDataPoint(ageMonths: 18.5, l: 1.30761, m: 80.79852, s: 0.04005),
  LMSDataPoint(ageMonths: 19.5, l: 1.26541, m: 81.75512, s: 0.04018),
  LMSDataPoint(ageMonths: 20.5, l: 1.22263, m: 82.68679, s: 0.04031),
  LMSDataPoint(ageMonths: 21.5, l: 1.17959, m: 83.59532, s: 0.04045),
  LMSDataPoint(ageMonths: 22.5, l: 1.13656, m: 84.48233, s: 0.04059),
  LMSDataPoint(ageMonths: 23.5, l: 1.09373, m: 85.34924, s: 0.04072),
  LMSDataPoint(ageMonths: 24.5, l: 1.05127, m: 86.19732, s: 0.04086),
  LMSDataPoint(ageMonths: 25.5, l: 1.04195, m: 87.09026, s: 0.04114),
  LMSDataPoint(ageMonths: 26.5, l: 1.01259, m: 87.95714, s: 0.04135),
  LMSDataPoint(ageMonths: 27.5, l: 0.97054, m: 88.79602, s: 0.0415),
  LMSDataPoint(ageMonths: 28.5, l: 0.92113, m: 89.60551, s: 0.04161),
  LMSDataPoint(ageMonths: 29.5, l: 0.86822, m: 90.38477, s: 0.04169),
  LMSDataPoint(ageMonths: 30.5, l: 0.81454, m: 91.13342, s: 0.04175),
  LMSDataPoint(ageMonths: 31.5, l: 0.76196, m: 91.85154, s: 0.0418),
  LMSDataPoint(ageMonths: 32.5, l: 0.71166, m: 92.53964, s: 0.04185),
  LMSDataPoint(ageMonths: 33.5, l: 0.66432, m: 93.19854, s: 0.04189),
  LMSDataPoint(ageMonths: 34.5, l: 0.62029, m: 93.82945, s: 0.04193),
  LMSDataPoint(ageMonths: 35.5, l: 0.57956, m: 94.43382, s: 0.04197),
];

final List<LMSDataPoint> cdcGirlStature = [
  LMSDataPoint(ageMonths: 23.5, l: 1.09363, m: 84.55379, s: 0.04072),
  LMSDataPoint(ageMonths: 29.5, l: 0.86822, m: 89.58477, s: 0.04169),
  LMSDataPoint(ageMonths: 35.5, l: 0.57956, m: 93.63382, s: 0.04197),
  LMSDataPoint(ageMonths: 41.5, l: 0.40335, m: 97.08337, s: 0.04251),
  LMSDataPoint(ageMonths: 47.5, l: 0.25116, m: 100.46805, s: 0.04316),
  LMSDataPoint(ageMonths: 53.5, l: 0.10001, m: 103.88728, s: 0.04373),
  LMSDataPoint(ageMonths: 59.5, l: -0.03735, m: 107.37068, s: 0.04421),
  LMSDataPoint(ageMonths: 65.5, l: -0.145, m: 110.89842, s: 0.0446),
  LMSDataPoint(ageMonths: 71.5, l: -0.21217, m: 114.42263, s: 0.04492),
  LMSDataPoint(ageMonths: 77.5, l: -0.23513, m: 117.88333, s: 0.04519),
  LMSDataPoint(ageMonths: 83.5, l: -0.21677, m: 121.22102, s: 0.04542),
  LMSDataPoint(ageMonths: 89.5, l: -0.16535, m: 124.38704, s: 0.04565),
  LMSDataPoint(ageMonths: 95.5, l: -0.09258, m: 127.35221, s: 0.04592),
  LMSDataPoint(ageMonths: 101.5, l: -0.01098, m: 130.11484, s: 0.04627),
  LMSDataPoint(ageMonths: 107.5, l: 0.07064, m: 132.70938, s: 0.04678),
  LMSDataPoint(ageMonths: 113.5, l: 0.15445, m: 135.21628, s: 0.04752),
  LMSDataPoint(ageMonths: 119.5, l: 0.26189, m: 137.76913, s: 0.04852),
  LMSDataPoint(ageMonths: 125.5, l: 0.4321, m: 140.54348, s: 0.04964),
  LMSDataPoint(ageMonths: 131.5, l: 0.69306, m: 143.695, s: 0.05046),
  LMSDataPoint(ageMonths: 137.5, l: 1.01105, m: 147.23002, s: 0.05035),
  LMSDataPoint(ageMonths: 143.5, l: 1.27401, m: 150.89365, s: 0.04894),
  LMSDataPoint(ageMonths: 149.5, l: 1.36309, m: 154.25293, s: 0.04662),
  LMSDataPoint(ageMonths: 155.5, l: 1.2693, m: 156.96443, s: 0.04422),
  LMSDataPoint(ageMonths: 161.5, l: 1.10308, m: 158.9427, s: 0.04236),
  LMSDataPoint(ageMonths: 167.5, l: 0.97184, m: 160.29973, s: 0.04117),
  LMSDataPoint(ageMonths: 173.5, l: 0.90752, m: 161.20788, s: 0.04049),
  LMSDataPoint(ageMonths: 179.5, l: 0.89448, m: 161.81735, s: 0.04012),
  LMSDataPoint(ageMonths: 185.5, l: 0.90944, m: 162.2347, s: 0.03993),
  LMSDataPoint(ageMonths: 191.5, l: 0.93623, m: 162.5287, s: 0.03983),
  LMSDataPoint(ageMonths: 197.5, l: 0.96609, m: 162.74212, s: 0.03977),
  LMSDataPoint(ageMonths: 203.5, l: 0.99494, m: 162.90132, s: 0.03974),
  LMSDataPoint(ageMonths: 209.5, l: 1.02109, m: 163.02281, s: 0.03971),
  LMSDataPoint(ageMonths: 215.5, l: 1.04406, m: 163.11717, s: 0.03969),
  LMSDataPoint(ageMonths: 221.5, l: 1.06386, m: 163.19142, s: 0.03967),
  LMSDataPoint(ageMonths: 227.5, l: 1.08076, m: 163.2504, s: 0.03966),
  LMSDataPoint(ageMonths: 233.5, l: 1.09507, m: 163.29756, s: 0.03965),
  LMSDataPoint(ageMonths: 239.5, l: 1.10713, m: 163.33545, s: 0.03964),
];

final List<LMSDataPoint> cdcGirlBMI = [
  LMSDataPoint(ageMonths: 23.5, l: -0.94872, m: 16.45875, s: 0.08588),
  LMSDataPoint(ageMonths: 29.5, l: -1.44369, m: 16.06429, s: 0.08149),
  LMSDataPoint(ageMonths: 35.5, l: -2.0033, m: 15.74526, s: 0.07888),
  LMSDataPoint(ageMonths: 41.5, l: -2.53847, m: 15.49893, s: 0.07791),
  LMSDataPoint(ageMonths: 47.5, l: -2.96258, m: 15.32168, s: 0.07848),
  LMSDataPoint(ageMonths: 53.5, l: -3.23028, m: 15.20894, s: 0.08045),
  LMSDataPoint(ageMonths: 59.5, l: -3.34405, m: 15.15543, s: 0.08366),
  LMSDataPoint(ageMonths: 65.5, l: -3.33589, m: 15.15567, s: 0.08789),
  LMSDataPoint(ageMonths: 71.5, l: -3.24594, m: 15.20441, s: 0.09291),
  LMSDataPoint(ageMonths: 77.5, l: -3.10956, m: 15.29676, s: 0.09846),
  LMSDataPoint(ageMonths: 83.5, l: -2.95293, m: 15.42817, s: 0.10433),
  LMSDataPoint(ageMonths: 89.5, l: -2.79337, m: 15.59439, s: 0.1103),
  LMSDataPoint(ageMonths: 95.5, l: -2.64134, m: 15.79143, s: 0.1162),
  LMSDataPoint(ageMonths: 101.5, l: -2.50257, m: 16.01546, s: 0.12186),
  LMSDataPoint(ageMonths: 107.5, l: -2.37976, m: 16.26284, s: 0.12717),
  LMSDataPoint(ageMonths: 113.5, l: -2.2738, m: 16.53005, s: 0.13203),
  LMSDataPoint(ageMonths: 119.5, l: -2.18458, m: 16.81368, s: 0.13639),
  LMSDataPoint(ageMonths: 125.5, l: -2.11144, m: 17.11045, s: 0.14018),
  LMSDataPoint(ageMonths: 131.5, l: -2.05348, m: 17.41719, s: 0.14339),
  LMSDataPoint(ageMonths: 137.5, l: -2.00977, m: 17.73082, s: 0.14602),
  LMSDataPoint(ageMonths: 143.5, l: -1.97936, m: 18.04838, s: 0.14807),
  LMSDataPoint(ageMonths: 149.5, l: -1.96137, m: 18.36701, s: 0.14958),
  LMSDataPoint(ageMonths: 155.5, l: -1.95497, m: 18.68396, s: 0.15058),
  LMSDataPoint(ageMonths: 161.5, l: -1.95937, m: 18.9966, s: 0.15113),
  LMSDataPoint(ageMonths: 167.5, l: -1.97376, m: 19.30243, s: 0.15127),
  LMSDataPoint(ageMonths: 173.5, l: -1.99728, m: 19.59907, s: 0.15107),
  LMSDataPoint(ageMonths: 179.5, l: -2.02891, m: 19.88429, s: 0.15061),
  LMSDataPoint(ageMonths: 185.5, l: -2.06746, m: 20.15598, s: 0.14996),
  LMSDataPoint(ageMonths: 191.5, l: -2.11143, m: 20.41219, s: 0.14922),
  LMSDataPoint(ageMonths: 197.5, l: -2.15894, m: 20.65111, s: 0.14847),
  LMSDataPoint(ageMonths: 203.5, l: -2.20768, m: 20.87105, s: 0.14782),
  LMSDataPoint(ageMonths: 209.5, l: -2.25489, m: 21.07049, s: 0.14737),
  LMSDataPoint(ageMonths: 215.5, l: -2.29732, m: 21.24797, s: 0.14725),
  LMSDataPoint(ageMonths: 221.5, l: -2.33143, m: 21.40215, s: 0.14758),
  LMSDataPoint(ageMonths: 227.5, l: -2.35344, m: 21.53171, s: 0.1485),
  LMSDataPoint(ageMonths: 233.5, l: -2.35971, m: 21.63539, s: 0.15016),
  LMSDataPoint(ageMonths: 239.5, l: -2.34696, m: 21.71189, s: 0.15272),
];

final List<LMSDataPoint> cdcGirlWeightForLength = [
  LMSDataPoint(ageMonths: 45.0, l: 0.66684, m: 2.3054, s: 0.16897),
  LMSDataPoint(ageMonths: 45.5, l: 0.69962, m: 2.40326, s: 0.15765),
  LMSDataPoint(ageMonths: 46.5, l: 0.74792, m: 2.60602, s: 0.13939),
  LMSDataPoint(ageMonths: 47.5, l: 0.75175, m: 2.81711, s: 0.12584),
  LMSDataPoint(ageMonths: 48.5, l: 0.69133, m: 3.03536, s: 0.11589),
  LMSDataPoint(ageMonths: 49.5, l: 0.55911, m: 3.25969, s: 0.10865),
  LMSDataPoint(ageMonths: 50.5, l: 0.36155, m: 3.48922, s: 0.1034),
  LMSDataPoint(ageMonths: 51.5, l: 0.11644, m: 3.7232, s: 0.0996),
  LMSDataPoint(ageMonths: 52.5, l: -0.15251, m: 3.96103, s: 0.09683),
  LMSDataPoint(ageMonths: 53.5, l: -0.42148, m: 4.20227, s: 0.0948),
  LMSDataPoint(ageMonths: 54.5, l: -0.67139, m: 4.44648, s: 0.09332),
  LMSDataPoint(ageMonths: 55.5, l: -0.88997, m: 4.69322, s: 0.09225),
  LMSDataPoint(ageMonths: 56.5, l: -1.07184, m: 4.94203, s: 0.09147),
  LMSDataPoint(ageMonths: 57.5, l: -1.21667, m: 5.1924, s: 0.09092),
  LMSDataPoint(ageMonths: 58.5, l: -1.32736, m: 5.44383, s: 0.09053),
  LMSDataPoint(ageMonths: 59.5, l: -1.40826, m: 5.69581, s: 0.09025),
  LMSDataPoint(ageMonths: 60.5, l: -1.46405, m: 5.94789, s: 0.09002),
  LMSDataPoint(ageMonths: 61.5, l: -1.49911, m: 6.19964, s: 0.08982),
  LMSDataPoint(ageMonths: 62.5, l: -1.5172, m: 6.4507, s: 0.08962),
  LMSDataPoint(ageMonths: 63.5, l: -1.52148, m: 6.70074, s: 0.08939),
  LMSDataPoint(ageMonths: 64.5, l: -1.51448, m: 6.94949, s: 0.08913),
  LMSDataPoint(ageMonths: 65.5, l: -1.4982, m: 7.19674, s: 0.08882),
  LMSDataPoint(ageMonths: 66.5, l: -1.47423, m: 7.44231, s: 0.08846),
  LMSDataPoint(ageMonths: 67.5, l: -1.44381, m: 7.68607, s: 0.08805),
  LMSDataPoint(ageMonths: 68.5, l: -1.40796, m: 7.92791, s: 0.08758),
  LMSDataPoint(ageMonths: 69.5, l: -1.36752, m: 8.16778, s: 0.08706),
  LMSDataPoint(ageMonths: 70.5, l: -1.32324, m: 8.40567, s: 0.0865),
  LMSDataPoint(ageMonths: 71.5, l: -1.27583, m: 8.64157, s: 0.0859),
  LMSDataPoint(ageMonths: 72.5, l: -1.22601, m: 8.87552, s: 0.08526),
  LMSDataPoint(ageMonths: 73.5, l: -1.17456, m: 9.10759, s: 0.08461),
  LMSDataPoint(ageMonths: 74.5, l: -1.12232, m: 9.33787, s: 0.08393),
  LMSDataPoint(ageMonths: 75.5, l: -1.0703, m: 9.56645, s: 0.08325),
  LMSDataPoint(ageMonths: 76.5, l: -1.01962, m: 9.79348, s: 0.08257),
  LMSDataPoint(ageMonths: 77.5, l: -0.97154, m: 10.0191, s: 0.08191),
  LMSDataPoint(ageMonths: 78.5, l: -0.9275, m: 10.24346, s: 0.08127),
  LMSDataPoint(ageMonths: 79.5, l: -0.88905, m: 10.46675, s: 0.08066),
  LMSDataPoint(ageMonths: 80.5, l: -0.85784, m: 10.68916, s: 0.0801),
  LMSDataPoint(ageMonths: 81.5, l: -0.8356, m: 10.91087, s: 0.07959),
  LMSDataPoint(ageMonths: 82.5, l: -0.82401, m: 11.13211, s: 0.07914),
  LMSDataPoint(ageMonths: 83.5, l: -0.82467, m: 11.35309, s: 0.07876),
  LMSDataPoint(ageMonths: 84.5, l: -0.83902, m: 11.57406, s: 0.07846),
  LMSDataPoint(ageMonths: 85.5, l: -0.86819, m: 11.79525, s: 0.07824),
  LMSDataPoint(ageMonths: 86.5, l: -0.91299, m: 12.01692, s: 0.07811),
  LMSDataPoint(ageMonths: 87.5, l: -0.97373, m: 12.23935, s: 0.07806),
  LMSDataPoint(ageMonths: 88.5, l: -1.05024, m: 12.46282, s: 0.0781),
  LMSDataPoint(ageMonths: 89.5, l: -1.14175, m: 12.68764, s: 0.07823),
  LMSDataPoint(ageMonths: 90.5, l: -1.24694, m: 12.91413, s: 0.07845),
  LMSDataPoint(ageMonths: 91.5, l: -1.36388, m: 13.14264, s: 0.07876),
  LMSDataPoint(ageMonths: 92.5, l: -1.49024, m: 13.37354, s: 0.07914),
  LMSDataPoint(ageMonths: 93.5, l: -1.6232, m: 13.60723, s: 0.07959),
  LMSDataPoint(ageMonths: 94.5, l: -1.75975, m: 13.84412, s: 0.08012),
  LMSDataPoint(ageMonths: 95.5, l: -1.89672, m: 14.08465, s: 0.08072),
  LMSDataPoint(ageMonths: 96.5, l: -2.03108, m: 14.32925, s: 0.08137),
  LMSDataPoint(ageMonths: 97.5, l: -2.15999, m: 14.57837, s: 0.08209),
  LMSDataPoint(ageMonths: 98.5, l: -2.28099, m: 14.83246, s: 0.08287),
  LMSDataPoint(ageMonths: 99.5, l: -2.39213, m: 15.09192, s: 0.0837),
  LMSDataPoint(ageMonths: 100.5, l: -2.49199, m: 15.35716, s: 0.08458),
  LMSDataPoint(ageMonths: 101.5, l: -2.57969, m: 15.62855, s: 0.08551),
  LMSDataPoint(ageMonths: 102.5, l: -2.65492, m: 15.90641, s: 0.08649),
];
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

const String cdcStandard = 'CDC Growth Charts (2000)';

/// Get relevant dataset based on sex, measure type, and age — entirely
/// from the CDC 2000 charts (see file header). Length-for-age (recumbent)
/// applies under 24 months, matching the printed chart's own convention;
/// Stature-for-age (standing) applies from 24 months, same as
/// Weight-for-Length (<24m) versus BMI-for-Age (>=24m).
Map<String, dynamic> getRelevantDataset(
  String sex,
  String measureType,
  double ageMonths,
) {
  final bool isMale = sex == 'M';

  switch (measureType) {
    case 'weight':
      return {
        'dataset': isMale ? cdcBoyWeight : cdcGirlWeight,
        'standardName': cdcStandard,
      };

    case 'height':
      final useRecumbent = ageMonths < 24;
      return {
        'dataset': useRecumbent
            ? (isMale ? cdcBoyLength : cdcGirlLength)
            : (isMale ? cdcBoyStature : cdcGirlStature),
        'standardName': cdcStandard,
      };

    case 'weightForLength':
      return {
        'dataset': isMale ? cdcBoyWeightForLength : cdcGirlWeightForLength,
        'standardName': cdcStandard,
      };

    case 'bmi':
      return {
        'dataset': isMale ? cdcBoyBMI : cdcGirlBMI,
        'standardName': cdcStandard,
      };

    default:
      return {
        'dataset': <LMSDataPoint>[],
        'standardName': 'Unknown',
      };
  }
}
