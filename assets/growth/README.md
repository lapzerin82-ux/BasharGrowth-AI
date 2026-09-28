# Growth reference LMS tables

Each CSV has the columns `sex,x,l,m,s`: sex `1` = male, `2` = female. The
Z-score for a measurement `y` is `((y/M)^L - 1) / (L*S)`, or `ln(y/M)/S` when
`L = 0`.

| File | Reference | Index (`x`) | Range |
|---|---|---|---|
| `who_weight_for_age.csv` | WHO Child Growth Standards (2006) | age in days | 0–1826 |
| `who_length_height_for_age.csv` | WHO 2006 (length < 731 d, height from 731 d) | age in days | 0–1826 |
| `who_bmi_for_age.csv` | WHO 2006 (length-based < 731 d, height-based from 731 d) | age in days | 0–1826 |
| `who_weight_for_length.csv` | WHO 2006 | recumbent length, cm | 45.0–110.0 |
| `cdc_weight_for_age.csv` | CDC 2000 Growth Charts | age in months | 24–240 |
| `cdc_stature_for_age.csv` | CDC 2000 Growth Charts | age in months | 24–240 |
| `cdc_bmi_for_age.csv` | CDC 2000 Growth Charts | age in months | 24–240.5 |

## Sources

- **WHO**: the `growthstandards_*anthro` tables in `R/sysdata.rda` of the WHO
  `anthro` R package (<https://github.com/WorldHealthOrganization/anthro>),
  exported unchanged.
- **CDC**: the CDC 2000 LMS values (`wtage.csv`, `statage.csv`,
  `bmiagerev.csv` from <https://www.cdc.gov/growthcharts/percentile_data_files.htm>),
  taken unchanged from the `cdc2-20.json` data table in the RCPCH
  `rcpchgrowth` Python package v4.6.5, with decimal ages converted back to
  months.

CDC 2022 extended BMI-for-age needs no table: its scale parameter is the
published quadratic in age (`cdcExtendedBmiSigma` in
`lib/growth_calculations.dart`; Hales et al., Vital Health Stat 1(197), 2022,
PMID 36598420). It matches the `sigma` column of rcpchgrowth's CDC BMI table
to within 5e-7 at every age.
