## Overview
- Created the initial data drop under `data/`, including KRZ bankruptcy counts (`krz_pkd.csv`/`krz_pkd_short.csv`), PKD 2007↔2025 mappings (`mapowanie_pkd.xlsx`, `KluczePKD_2007_2025_pop.csv`/`.xls`, `StrukturaPKD2025.xls`), and financial/export tables (`wsk_fin.xlsx`, `dane_export.xlsx`, `wskazniki_full.csv`).
- Curated cleaned indicator panels by PKD class (`GS_filtered.xlsx`, `GS_filtered_xx.x.xlsx`) and net working capital panels (`NWC_filtered.xlsx`, `NWC_filtered_xx.x.xlsx`) covering 2005–2024.
- Added a wide financial-indicator pivot for PKD classes (`data/df_pivot.csv`) alongside sector-share helpers (`sector_top_values.xlsx`).
- Built the sector share visualization pipeline: `sector_pie_chart.py` reads `GS_filtered_xx.x.xlsx`, exports the top segments table, and saves the pie chart to `charts/sector_percentage_pie.png`.
- Extracted indicator families from `df_pivot.csv` whose headers match numeric prefixes `35.1, 46.7, 47.1, 45.1, 46.3, 46.9, 46.4, 29.3, 47.4, 10.1, 49.4, 22.2, 62.0, 41.2, 52.2` into `data/df_pivot_filtered_numbers.csv` for focused analysis.
- Cleaned the filtered pivot by removing `Zi.e_EN` and `Zi.e_EN_dyn` columns, leaving 20 rows × 1111 columns in `data/df_pivot_filtered_numbers.csv`.
