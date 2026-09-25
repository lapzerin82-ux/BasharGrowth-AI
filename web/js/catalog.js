// General-paediatrics catalogue: investigation sections with common tests (and the unit most labs
// report them in, used only to pre-fill an empty unit box), clinical features grouped by system,
// and common presenting complaints. Everything stays free text: any test/unit/feature can be typed.

export const INV_CATS = {
  "Hematology": [["Hemoglobin (Hb)", "g/dL"], ["Hematocrit", "%"], ["RBC", "×10¹²/L"], ["MCV", "fL"], ["MCH", "pg"], ["RDW", "%"], ["WBC", "×10⁹/L"], ["Neutrophils", "×10⁹/L"], ["Lymphocytes", "×10⁹/L"], ["Eosinophils", "×10⁹/L"], ["Platelets", "×10⁹/L"], ["Reticulocytes", "%"], ["Blood film", ""], ["Hb electrophoresis", ""], ["G6PD", ""], ["Direct Coombs test", ""], ["Blood group", ""]],
  "Coagulation": [["PT", "s"], ["INR", ""], ["aPTT", "s"], ["Fibrinogen", "g/L"], ["D-dimer", "mg/L FEU"], ["Factor VIII", "%"], ["Factor IX", "%"], ["von Willebrand antigen", "%"], ["Bleeding time", "min"]],
  "Biochemistry": [["Sodium", "mmol/L"], ["Potassium", "mmol/L"], ["Chloride", "mmol/L"], ["Bicarbonate", "mmol/L"], ["Urea", "mmol/L"], ["Creatinine", "µmol/L"], ["eGFR", "mL/min/1.73m²"], ["Glucose", "mmol/L"], ["Calcium", "mmol/L"], ["Ionized calcium", "mmol/L"], ["Phosphate", "mmol/L"], ["Magnesium", "mmol/L"], ["Alkaline phosphatase", "U/L"], ["Uric acid", "µmol/L"], ["Ammonia", "µmol/L"], ["Lactate", "mmol/L"], ["CK", "U/L"], ["LDH", "U/L"], ["Osmolality (serum)", "mOsm/kg"]],
  "Liver": [["ALT", "U/L"], ["AST", "U/L"], ["GGT", "U/L"], ["Total bilirubin", "µmol/L"], ["Direct bilirubin", "µmol/L"], ["Albumin", "g/L"], ["Total protein", "g/L"], ["Bile acids", "µmol/L"]],
  "Blood gas": [["pH", ""], ["pCO₂", "kPa"], ["pO₂", "kPa"], ["HCO₃", "mmol/L"], ["Base excess", "mmol/L"], ["Lactate", "mmol/L"], ["Anion gap", "mmol/L"]],
  "Infection / inflammation": [["CRP", "mg/L"], ["ESR", "mm/h"], ["Procalcitonin", "ng/mL"], ["Blood culture", ""], ["Urine culture", ""], ["CSF analysis & culture", ""], ["Throat swab", ""], ["Respiratory viral PCR panel", ""], ["Stool culture", ""], ["Malaria film / RDT", ""], ["Wound / pus culture", ""]],
  "Serology / virology": [["HBsAg", ""], ["Anti-HBs", "mIU/mL"], ["Anti-HCV", ""], ["HIV Ag/Ab", ""], ["CMV IgM / IgG", ""], ["EBV serology", ""], ["Toxoplasma IgM / IgG", ""], ["Rubella IgG", ""], ["Measles IgG", ""], ["Brucella serology", ""], ["Typhoid (Widal / culture)", ""], ["Mantoux / IGRA (TB)", ""], ["ASO titre", "IU/mL"], ["Mycoplasma serology", ""]],
  "Immunology / allergy": [["IgG", "g/L"], ["IgA", "g/L"], ["IgM", "g/L"], ["Total IgE", "kU/L"], ["Specific IgE", "kUA/L"], ["Skin prick test", ""], ["ANA", ""], ["Anti-dsDNA", "IU/mL"], ["C3", "g/L"], ["C4", "g/L"], ["Lymphocyte subsets (CD3/4/8/19/56)", ""], ["Vaccine antibody responses", ""]],
  "Nutrition / vitamins": [["Ferritin", "µg/L"], ["Serum iron", "µmol/L"], ["TIBC", "µmol/L"], ["Transferrin saturation", "%"], ["25-OH vitamin D", "nmol/L"], ["Vitamin B12", "pmol/L"], ["Folate", "nmol/L"], ["Zinc", "µmol/L"], ["Vitamin A", "µmol/L"], ["Prealbumin", "g/L"]],
  "Lipids": [["Total cholesterol", "mmol/L"], ["LDL cholesterol", "mmol/L"], ["HDL cholesterol", "mmol/L"], ["Triglycerides", "mmol/L"], ["Non-HDL cholesterol", "mmol/L"]],
  "Endocrine": [["TSH", "mIU/L"], ["Free T4", "pmol/L"], ["Free T3", "pmol/L"], ["IGF-1", "ng/mL"], ["IGFBP-3", "mg/L"], ["GH peak (stimulation test)", "ng/mL"], ["Cortisol (8 am)", "nmol/L"], ["ACTH", "pmol/L"], ["17-OH progesterone", "nmol/L"], ["LH", "IU/L"], ["FSH", "IU/L"], ["Testosterone", "nmol/L"], ["Estradiol", "pmol/L"], ["DHEAS", "µmol/L"], ["Prolactin", "mIU/L"], ["PTH", "pmol/L"], ["HbA1c", "%"], ["Insulin", "mIU/L"], ["C-peptide", "nmol/L"], ["Karyotype (DSD)", ""]],
  "Celiac / GI": [["tTG-IgA", "U/mL"], ["Total IgA", "g/L"], ["EMA", ""], ["Fecal calprotectin", "µg/g"], ["Fecal elastase", "µg/g"], ["Stool occult blood", ""], ["Stool ova & parasites", ""], ["H. pylori stool antigen", ""], ["Lipase", "U/L"], ["Amylase", "U/L"], ["Endoscopy / biopsy", ""]],
  "Urine": [["Urinalysis (dipstick)", ""], ["Urine microscopy", ""], ["Urine protein/creatinine ratio", "mg/mmol"], ["Urine albumin/creatinine ratio", "mg/mmol"], ["Urine calcium/creatinine ratio", "mmol/mmol"], ["Urine osmolality", "mOsm/kg"], ["Urine sodium", "mmol/L"], ["24-h urine protein", "mg/day"], ["Urine specific gravity", ""]],
  "Cardiology": [["ECG", ""], ["Echocardiography", ""], ["Troponin", "ng/L"], ["NT-proBNP", "pg/mL"], ["Holter monitoring", ""], ["Blood pressure (ABPM)", "mmHg"]],
  "Neurology / development": [["EEG", ""], ["CSF analysis", ""], ["Nerve conduction / EMG", ""], ["Hearing test (OAE / ABR / audiometry)", ""], ["Vision assessment", ""], ["Developmental assessment", ""], ["Cognitive / IQ assessment", ""]],
  "Pulmonary": [["Sweat chloride", "mmol/L"], ["Spirometry – FEV₁", "% predicted"], ["Spirometry – FVC", "% predicted"], ["Peak flow", "L/min"], ["Oxygen saturation", "%"], ["Sleep study (polysomnography)", ""]],
  "Metabolic / newborn screening": [["Newborn screening panel", ""], ["Plasma amino acids", ""], ["Urine organic acids", ""], ["Acylcarnitine profile", ""], ["Very long-chain fatty acids", ""], ["Urine reducing substances", ""], ["Galactosaemia screen (GALT)", ""]],
  "Bone age / X-ray": [["Bone age (Greulich–Pyle)", "years"], ["Bone age (TW3)", "years"], ["Chest X-ray", ""], ["Abdominal X-ray", ""], ["Skeletal survey", ""], ["Limb / joint X-ray", ""], ["Spine X-ray", ""]],
  "Imaging": [["Abdominal ultrasound", ""], ["Renal ultrasound", ""], ["Pelvic ultrasound", ""], ["Cranial ultrasound", ""], ["Hip ultrasound", ""], ["CT head", ""], ["CT chest / abdomen", ""], ["MRI brain / pituitary", ""], ["MRI spine", ""], ["VCUG / MCUG", ""], ["DMSA scan", ""], ["DEXA (bone density)", "Z-score"]],
  "Genetics": [["Karyotype", ""], ["Chromosomal microarray", ""], ["FISH", ""], ["Fragile X testing", ""], ["SHOX analysis", ""], ["Gene panel", ""], ["Whole exome / genome", ""]],
  "Toxicology / drug levels": [["Lead level", "µmol/L"], ["Paracetamol level", "mg/L"], ["Salicylate level", "mg/L"], ["Anti-epileptic drug level", ""], ["Gentamicin level", "mg/L"], ["Vancomycin level", "mg/L"], ["Urine drug screen", ""]],
  "Other": [],
};

export const unitFor = (test) => {
  const t = String(test || "").trim().toLowerCase();
  for (const list of Object.values(INV_CATS)) for (const [name, unit] of list) if (name.toLowerCase() === t) return unit;
  return "";
};

export const FEATURE_GROUPS = {
  "General": ["Fever", "Lethargy", "Irritability", "Weight loss", "Night sweats", "Lymphadenopathy", "Pallor", "Jaundice", "Dehydration", "Edema"],
  "Growth & nutrition": ["Short stature", "Tall stature", "Poor weight gain / failure to thrive", "Obesity", "Growth deceleration", "Feeding difficulties", "Picky eating"],
  "Respiratory / ENT": ["Cough", "Wheeze", "Shortness of breath", "Stridor", "Nasal congestion", "Sore throat", "Ear pain / discharge", "Snoring"],
  "Cardiovascular": ["Heart murmur", "Cyanosis", "Chest pain", "Palpitations", "Syncope", "Hypertension"],
  "Gastrointestinal": ["Vomiting", "Diarrhea", "Constipation", "Abdominal pain", "Abdominal distension", "Blood in stool", "Reflux", "Hepatosplenomegaly"],
  "Renal / urinary": ["Dysuria", "Frequency", "Enuresis", "Hematuria", "Proteinuria", "Oliguria"],
  "Neurology / development": ["Seizures", "Headache", "Developmental delay", "Regression", "Hypotonia", "Abnormal gait", "Macrocephaly", "Microcephaly", "Visual problems", "Hearing concern"],
  "Behaviour / mental health": ["ADHD features", "Autism features", "Sleep problems", "Anxiety", "Low mood", "School difficulties"],
  "Skin": ["Rash", "Eczema", "Urticaria", "Petechiae / purpura", "Café-au-lait spots", "Acanthosis nigricans"],
  "Musculoskeletal": ["Joint pain / swelling", "Limp", "Bone pain", "Scoliosis", "Disproportionate body segments"],
  "Endocrine / puberty": ["Early puberty", "Delayed puberty", "Goitre", "Polyuria / polydipsia", "Hirsutism", "Gynecomastia", "Ambiguous genitalia", "Undescended testes"],
  "Hematology / immunology": ["Bruising / bleeding", "Recurrent infections", "Anemia symptoms", "Allergy / anaphylaxis"],
  "Syndromic": ["Dysmorphic features", "Midline defects", "Congenital anomalies", "Family history of similar condition"],
};

export const COMPLAINTS = ["Fever", "Cough", "Difficulty breathing", "Wheeze", "Vomiting", "Diarrhea", "Constipation", "Abdominal pain", "Poor feeding", "Poor weight gain", "Short stature", "Tall stature", "Obesity", "Rash", "Seizure", "Headache", "Developmental delay", "Behavioural concern", "Jaundice", "Pallor / anemia", "Bruising / bleeding", "Joint pain / limp", "Urinary symptoms", "Bedwetting", "Ear pain", "Sore throat", "Early puberty", "Delayed puberty", "Recurrent infections", "Routine check-up / follow-up", "Vaccination visit"];
