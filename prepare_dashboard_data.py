import json
from pathlib import Path

import pandas as pd


YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]
BASE_DIR = Path(__file__).parent
GS_PATH = BASE_DIR / "data" / "GS_filtered.xlsx"
NWC_PATH = BASE_DIR / "data" / "NWC_filtered.xlsx"
DEFAULTS_PATH = BASE_DIR / "data" / "krz_pkd.csv"
EXPORT_PATH = BASE_DIR / "data" / "dane_export.xlsx"
OUTPUT_PATH = BASE_DIR / "data" / "dashboard_data.json"
PKD_VARS = BASE_DIR / "pkd_to_variables.json"


def load_series_for_codes(df: pd.DataFrame, codes, label_col: str):
    """Return {pkd_code: {year: value}} using the most specific available row."""
    data = {}
    for code in codes:
        matches = df[df[label_col].astype(str) == code]
        if matches.empty:
            # try startswith fallback (aggregate)
            matches = df[df[label_col].astype(str).str.startswith(f"{code}.")]
        if matches.empty:
            continue
        row = matches.iloc[0]
        data[code] = {}
        for year in YEARS:
            value = row.get(year, 0)
            value = pd.to_numeric(value, errors="coerce")
            data[code][year] = float(value) if pd.notnull(value) else 0.0
    return data


def load_names(df: pd.DataFrame, codes):
    names = {}
    for code in codes:
        matches = df[df["numer PKD"].astype(str) == code]
        if matches.empty:
            matches = df[df["numer PKD"].astype(str).str.startswith(f"{code}.")]
        if not matches.empty:
            names[code] = matches.iloc[0]["nazwa PKD"]
    return names


def load_exports():
    df = pd.read_excel(EXPORT_PATH)
    total = float(df.loc[df["Unnamed: 0"] == "OGÓŁEM", 2024].squeeze())
    exports = {}
    for _, row in df.iterrows():
        code = str(row["Unnamed: 0"]).strip()
        if len(code) != 1 or not code.isalpha():
            continue
        value = float(row[2024] or 0)
        exports[code] = {
            "value": value,
            "share": value / total * 100 if total else 0,
        }
    return exports


def load_defaults(codes):
    df = pd.read_csv(DEFAULTS_PATH, sep=";")
    df = df[df["pkd"].astype(str).str.len() > 0]
    df["section"] = df["pkd"].astype(str).str[0]
    df = df[df["rok"].isin(YEARS)]
    defaults = {}
    for code in codes:
        # match full pkd prefix
        mask = df["pkd"].astype(str).str.startswith(code)
        slice_df = df[mask]
        series = {year: 0 for year in YEARS}
        for _, row in slice_df.iterrows():
            series[row["rok"]] += int(row["liczba_upadlosci"])
        defaults[code] = series
    return defaults


def normalize_series(series_dict):
    """Normalize values per year across sectors to 0-1."""
    result = {}
    for year in YEARS:
        values = [vals[year] for vals in series_dict.values()]
        min_v, max_v = min(values), max(values)
        span = max(max_v - min_v, 1e-9)
        for key, vals in series_dict.items():
            result.setdefault(key, {})[year] = (vals[year] - min_v) / span
    return result


def project_revenue(rev_series):
    # Extend revenue to 2027 using recent CAGR or last growth
    available_years = [y for y in YEARS if y in rev_series and rev_series[y] != 0 and y <= 2024]
    if not available_years:
        return rev_series
    last_year = max(available_years)
    last_value = rev_series[last_year]
    cagr = 0.02
    if last_year >= 2022 and rev_series.get(last_year - 2, 0):
        cagr = (rev_series[last_year] / rev_series[last_year - 2]) ** (1 / 2) - 1
    elif last_year >= 2021 and rev_series.get(last_year - 1, 0):
        cagr = (rev_series[last_year] / rev_series[last_year - 1]) - 1
    cagr = max(min(cagr, 0.3), -0.1)  # cap extremes
    for year in [2025, 2026, 2027]:
        last_value = last_value * (1 + cagr)
        rev_series[year] = last_value
    return rev_series


def main():
    pkd_json = json.loads(PKD_VARS.read_text())
    pkd_codes = list(pkd_json.keys())
    driver_set = set()
    for arr in pkd_json.values():
        driver_set.update(arr)
    gs = pd.read_excel(GS_PATH)
    nwc = pd.read_excel(NWC_PATH)

    revenue = load_series_for_codes(gs, pkd_codes, "numer PKD")
    working_capital = load_series_for_codes(nwc, pkd_codes, "numer PKD")
    names = load_names(gs, pkd_codes)
    exports = load_exports()
    defaults = load_defaults(pkd_codes)

    growth_raw = {}
    debt_raw = {}
    risk_raw = {}
    export_raw = {}

    seen_codes = set()
    for section, rev_series in revenue.items():
        # Year-over-year growth (%)
        growth_series = {}
        rev_series = project_revenue(rev_series)
        prev = None
        for year in YEARS:
            current = rev_series[year]
            if prev and prev != 0:
                growth_series[year] = (current - prev) / prev * 100
            else:
                growth_series[year] = 0
            prev = current
        growth_raw[section] = growth_series

        # Debt proxy: 1 - working_capital / revenue (bounded to [0,1])
        debt_series = {}
        wc_series = working_capital.get(section, {})
        for year in YEARS:
            rev = rev_series[year]
            wc = wc_series.get(year, 0)
            if year >= 2025 and wc == 0 and rev != 0:
                # project WC using last known ratio
                last_known_years = [y for y, v in wc_series.items() if v]
                ratio = 0.3
                if last_known_years:
                    ly = max(last_known_years)
                    last_rev = rev_series.get(ly, 0)
                    ratio = (wc_series[ly] / last_rev) if last_rev else 0.3
                wc = rev * ratio
            debt = 1 - (wc / rev if rev else 0)
            debt_series[year] = max(0, min(1, debt))
        debt_raw[section] = debt_series

        # Risk proxy from defaults, normalized later (flat forward)
        def_series = defaults.get(section, {y: 0 for y in YEARS})
        last_def = def_series.get(2024, 0)
        for y in [2025, 2026, 2027]:
            def_series[y] = last_def
        risk_raw[section] = def_series

        # Export share stays flat (use section letter if available)
        exp = exports.get(section[0], exports.get(section, {"share": 0}))["share"] if section else 0
        export_raw[section] = {year: exp for year in YEARS}

    growth_norm = normalize_series(growth_raw)
    risk_norm = {}
    # Normalize risk by max defaults per year (higher defaults => higher risk)
    for year in YEARS:
        vals = [risk_raw[s][year] for s in risk_raw]
        max_v = max(vals) if vals else 1
        for s in risk_raw:
            risk_norm.setdefault(s, {})[year] = (risk_raw[s][year] / max_v) if max_v else 0

    debt_norm = normalize_series(debt_raw)
    export_norm = normalize_series(export_raw)

    sectors = []
    weights = {"growth": 0.35, "risk": 0.25, "debt": 0.25, "export": 0.15}

    for section in revenue.keys():
        seen_codes.add(section)
        scores = []
        growth = []
        debt = []
        risk = []
        export = []
        defaults_series = []
        for year in YEARS:
            g = growth_raw[section][year]
            d = debt_raw[section][year]
            r = risk_norm.get(section, {}).get(year, 0)
            ex = export_raw[section][year]
            g_norm = growth_norm.get(section, {}).get(year, 0)
            d_norm = debt_norm.get(section, {}).get(year, 0)
            ex_norm = export_norm.get(section, {}).get(year, 0)
            score = 100 * (
                weights["growth"] * g_norm
                + weights["risk"] * (1 - r)
                + weights["debt"] * (1 - d_norm)
                + weights["export"] * ex_norm
            )
            scores.append(round(score, 1))
            growth.append(round(g, 2))
            debt.append(round(d, 3))
            risk.append(round(r, 3))
            export.append(round(ex, 2))
            defaults_series.append(int(risk_raw[section][year]))

        latest_score = scores[-1]
        tier = "developing" if latest_score >= 70 else "core" if latest_score >= 55 else "watchlist"
        sectors.append(
            {
                "id": section.lower(),
                "name": names.get(section, f"Sekcja {section}"),
                "tier": tier,
                "score": scores,
                "growth": growth,
                "risk": risk,
                "debt": debt,
                "export": export,
                "defaults": defaults_series,
                "note": f"{names.get(section, 'Sektor')} • revenue CAGR {growth[-1]:.1f}% | defaults {defaults_series[-1]} (2024) | export share {export[-1]:.1f}%",
            }
        )

    # Add placeholders for codes without financial coverage so the UI shows all analyzed PKD
    for code in pkd_codes:
        if code in seen_codes:
            continue
        sectors.append(
            {
                "id": code.lower(),
                "name": names.get(code, f"PKD {code}"),
                "tier": "watchlist",
                "score": [50 for _ in YEARS],
                "growth": [0 for _ in YEARS],
                "risk": [0 for _ in YEARS],
                "debt": [0.5 for _ in YEARS],
                "export": [0 for _ in YEARS],
                "defaults": [0 for _ in YEARS],
                "note": "Placeholder — no aggregated financial series available, only forecast drivers present.",
            }
        )

    model = {"years": YEARS, "sectors": sectors, "drivers": sorted(driver_set)}
    OUTPUT_PATH.write_text(json.dumps(model, ensure_ascii=False, indent=2))
    print(f"Wrote {OUTPUT_PATH.relative_to(BASE_DIR)} with {len(sectors)} sectors.")


if __name__ == "__main__":
    main()
