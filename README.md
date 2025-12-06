# Hacknation2025

Repository layout and current data drops:

- `data/krz_pkd.csv` — bankruptcies from the National Debt Register by PKD 2007 class, from 2018 onward (`rok`, `pkd`, `liczba_upadlosci`).
- `data/mapowanie_pkd.xlsx` — four sheets:
  - `MAP_PKD_2007_2025`: mapping PKD 2007 → PKD 2025 (to class level).
  - `MAP_PKD_2025_2007`: mapping PKD 2025 → PKD 2007 (to class level).
  - `PKD_2025`: full PKD 2025 list.
  - `PKD_2007`: full PKD 2007 list.
- `data/KluczePKD_2007_2025_pop.csv` and `.xls` — bilingual lookup table aligning PKD 2007 groupings to PKD 2025 groupings across hierarchy levels.
- `data/StrukturaPKD2025.xls` — hierarchical structure for PKD 2025.
- `data/wsk_fin.xlsx` — financial indicators for PKD 2007 (2005 onward); values are for firms with >9 employees and reported in millions of PLN. Some classes may be missing when only group-level data exists.
- `requirements.txt` — Python stack (pandas, numpy, scikit-learn, matplotlib, xgboost, shap).

