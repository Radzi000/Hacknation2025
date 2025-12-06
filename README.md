# Hacknation2025

Project's task is, using the available sources of economic, financial and administrative data, to provide insights into which sectors of Polish economy are the "accelerators" - which of them are worth of investing in, as they tend to be stable 


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

Model Description

Model analizuje i prognozuje kondycję branż polskiej gospodarki na podstawie danych finansowych (balance sheet) oraz czynników makroekonomicznych.

1. Dane wejściowe – bilanse branżowe PKD/NACE
Pobierane są dane finansowe dla branż z podziałem na szczegółowe grupy PKD/NACE (np. 46.1 – sprzedaż hurtowa na zlecenie). Obejmują m.in. przychody, koszty, zyski, inwestycje, zadłużenie, płynność i aktywa.

2. Predykcja istotnych zmiennych makro
Model przewiduje kluczowe dane makroekonomiczne oraz ceny: produktów i usług, energii, surowców, kosztów finansowania, inflacji, popytu krajowego i globalnego.

3. Modelowanie wpływu czynników makro na dane finansowe branż
Uczenie nieliniowych zależności między zmiennymi makro a danymi bilansowymi sektorów. Ocena wrażliwości branż na zmiany cen, popytu, kosztów, stóp procentowych i koniunktury.

4. Prognozy bilansów (Balance Sheet Forecasting)
Model generuje przyszłe wartości kluczowych pozycji (przychody, koszty, cash flow, zysk netto, zadłużenie, kapitał obrotowy), uzyskując projekcję kondycji finansowej branż.

5. Wskaźniki i klasyfikacja przyszłej kondycji branż
Na podstawie prognozowanej sytuacji finansowej określane są wskaźniki:

wzrostowe / ekspansywne,

spowalniające lub wykazujące symptomy pogorszenia,

wysokiego ryzyka / wysokich potrzeb pożyczkowych,

zmieniające trend (wzrost → stagnacja, stagnacja → ekspansja).

6. Analiza strategiczna branż (Growth-Share Matrix / BCG)
Model umieszcza branże w macierzy wzrost–udział, określając:

czy polska gospodarka jest w fazie wzrostu czy dojrzałości,

które sektory są „gwiazdami” (wysoki wzrost, wysoka siła rynkowa),

które są „dojnymi krowami” (stabilne i przewidywalne),

które branże są „znakami zapytania” lub „psami” – wykazują ryzyko lub słabe perspektywy,

które sektory oferują najlepsze warunki do finansowania oraz największy potencjał długoterminowy.
