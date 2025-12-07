# Hacknation2025

Project's task is, using the available sources of economic, financial and administrative data, to provide insights into which sectors of Polish economy are the "accelerators" - which of them are worth of investing in, as they tend to be stable 


#TO RUN:
in bash run 'python3 -m http.server 8000'


in the browser open: 'http://localhost:8000/dashboard.html'

Repository layout and current data drops:

- `data/krz_pkd.csv` — bankruptcies from the National Debt Register by PKD 2007 class, from 2018 onward (`rok`, `pkd`, `liczba_upadlosci`).
- `data/krz_pkd_short.csv` — same KRZ extract but shipped as a single semicolon-delimited column.
- `data/mapowanie_pkd.xlsx` — four sheets:
  - `MAP_PKD_2007_2025`: mapping PKD 2007 → PKD 2025 (to class level).
  - `MAP_PKD_2025_2007`: mapping PKD 2025 → PKD 2007 (to class level).
  - `PKD_2025`: full PKD 2025 list.
  - `PKD_2007`: full PKD 2007 list.
- `data/KluczePKD_2007_2025_pop.csv` and `.xls` — bilingual lookup table aligning PKD 2007 groupings to PKD 2025 groupings across hierarchy levels.
- `data/StrukturaPKD2025.xls` — hierarchical structure for PKD 2025.
- `data/wsk_fin.xlsx` — financial indicators for PKD 2007 (2005 onward); values are for firms with >9 employees and reported in millions of PLN. Some classes may be missing when only group-level data exists.
- `data/GS_filtered.xlsx` — cleaned indicator panel keyed by PKD code and indicator name (`wskaźnik`) with yearly values 2005–2024.
- `data/GS_filtered_xx.x.xlsx` — same as above plus `percentage in total`, used for sector-share visualisations.
- `data/NWC_filtered.xlsx` and `data/NWC_filtered_xx.x.xlsx` — indicator panels by PKD with yearly values 2005–2024 (the `xx.x` file is an intermediate variant).
- `data/dane_export.xlsx` — export totals by PKD section with breakdowns for EU vs non-EU markets (`2022`, `2022.1`, `2022.2`, …).
- `data/wskazniki_full.csv` — wide financial-indicator panel by PKD class; columns are semicolon-separated and cover multiple metrics per code.
- `requirements.txt` — Python stack (pandas, numpy, scikit-learn, matplotlib, xgboost, shap).
- `charts/sector_percentage_pie.png` — generated figure with sector shares.
- `sector_pie_chart.py` — script that builds the sector pie chart from `data/GS_filtered_xx.x.xlsx` (requires columns `numer i nazwa PKD` and `percentage in total`).

Usage quickstart:

- Create a virtual env and install deps: `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`.
- Generate the sector share plot: `python3 sector_pie_chart.py` (outputs to `charts/sector_percentage_pie.png`; adjusts `TOP_N` in the script to change the number of labelled sectors).
- Notebooks: `SHAP.ipynb` (model explainability), `size_sorting.ipynb` (sorting firms by size buckets), `wskazniki.ipynb` (financial indicator exploration).
