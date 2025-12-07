# HackNation 2025 — Dashboard Odporności Sektorów

Interaktywny podgląd tego, które części polskiej gospodarki wyglądają na odporne i atrakcyjne inwestycyjnie. Połączyliśmy publiczne dane o upadłościach z sektorowymi wskaźnikami finansowymi, aby ocenić klasy PKD, wskazać stabilne obszary wzrostu i pokazać, co stoi za rankingiem.

## Co zbudowaliśmy
- Połączenie danych KRZ o upadłościach z wskaźnikami GUS, zmapowanymi na hierarchie PKD 2007.
- Inżynieria cech panelowych (wzrost, zmienność, udział w sektorze) oraz model XGBoost do wyłapywania „akceleratorów” sektorowych.
- SHAP zapewniający interpretowalność modelu i wgląd w czynniki stojące za wynikiem sektora.
- Lekki, interaktywny dashboard HTML, który każdy może uruchomić lokalnie. (W przypadku budowania produktu wdrozeniowego, dashboard jest gotowy do publikacji webowej, wraz z przygotowanymi ednpointami API, umozliwiającymi dostęp do danych live).

## Struktura projektu
- `dashboard.html` — interaktywny dashboard z wykresami i filtrami sektorów.
- `prepare_dashboard_data.py` — pomocnik do odświeżania danych dashboardu z surowych arkuszy.
- `charts/` — wygenerowane wizualizacje (udziały sektorów, korelacje).
- `data/` — pliki źródłowe: upadłości KRZ, mapowania PKD, wskaźniki finansowe, statystyki eksportu.
- `*.ipynb` — notebooki do inżynierii cech, trenowania modelu i analizy SHAP.
- `requirements.txt` — stos Pythona (pandas, numpy, scikit-learn, xgboost, shap, matplotlib).

## Przygotowanie środowiska
1) Zainstaluj Pythona 3.11+ i utwórz wirtualne środowisko:
```bash
python3 -m venv .venv
source .venv/bin/activate
```
2) Zainstaluj zależności:
```bash
pip install -r requirements.txt
```

## Uruchomienie dashboardu lokalnie
W katalogu projektu:
```bash
python3 -m http.server 8000
```
Następnie otwórz w przeglądarce: `http://localhost:8000/dashboard.html`.

## Aktualizacja danych (opcjonalnie)
Jeśli zmienisz dane w `data/`, uruchom:
```bash
python3 prepare_dashboard_data.py
```
To wygeneruje ponownie pliki CSV używane przez dashboard. Potem odśwież stronę w przeglądarce.
