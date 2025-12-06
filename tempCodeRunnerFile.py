from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd

matplotlib.use("Agg")


DATA_PATH = Path("data/GS_filtered_xx.x.xlsx")
OUTPUT_DIR = Path("charts")
OUTPUT_PATH = OUTPUT_DIR / "sector_percentage_pie.png"
TOP_EXCEL_PATH = OUTPUT_DIR / "sector_top_values.xlsx"
TOP_N = 15


def load_data(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    required_cols = {"numer i nazwa PKD", "percentage in total"}
    missing = required_cols.difference(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    return df


def prepare_segments(df: pd.DataFrame, top_n: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    top = df.nlargest(top_n, "percentage in total")[["numer i nazwa PKD", "percentage in total"]]
    other_sum = df.drop(top.index)["percentage in total"].sum()
    segments = top.copy()
    if other_sum > 0:
        segments = pd.concat(
            [segments, pd.DataFrame({"numer i nazwa PKD": ["Other sectors"], "percentage in total": [other_sum]})],
            ignore_index=True,
        )
    return top, segments


def plot_pie(segments: pd.DataFrame, output_path: Path) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    labels = segments["numer i nazwa PKD"]
    sizes = segments["percentage in total"]

    plt.figure(figsize=(10, 10))
    plt.pie(
        sizes,
        labels=labels,
        autopct="%1.1f%%",
        startangle=90,
        pctdistance=0.8,
    )
    plt.title("Sector share by percentage in total", pad=20)
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    plt.close()


def export_top_segments(top_segments: pd.DataFrame, output_path: Path) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    top_segments.to_excel(output_path, index=False)


def main() -> None:
    df = load_data(DATA_PATH)
    top_segments, pie_segments = prepare_segments(df, TOP_N)
    plot_pie(pie_segments, OUTPUT_PATH)
    export_top_segments(top_segments, TOP_EXCEL_PATH)
    print(f"Pie chart saved to {OUTPUT_PATH}")
    print(f"Top segments exported to {TOP_EXCEL_PATH}")


if __name__ == "__main__":
    main()
