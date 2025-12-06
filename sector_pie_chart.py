from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd

matplotlib.use("Agg")


DATA_PATH = Path("data/GS_filtered_xx.x.xlsx")
OUTPUT_DIR = Path("charts")
OUTPUT_PATH = OUTPUT_DIR / "sector_percentage_pie.png"
TOP_N = 15


def load_data(path: Path) -> pd.DataFrame:
    df = pd.read_excel(path)
    required_cols = {"numer i nazwa PKD", "percentage in total"}
    missing = required_cols.difference(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    return df


def prepare_segments(df: pd.DataFrame, top_n: int) -> pd.DataFrame:
    top = df.nlargest(top_n, "percentage in total")[["numer i nazwa PKD", "percentage in total"]]
    other_sum = df.drop(top.index)["percentage in total"].sum()
    if other_sum > 0:
        top = pd.concat(
            [top, pd.DataFrame({"numer i nazwa PKD": ["Other sectors"], "percentage in total": [other_sum]})],
            ignore_index=True,
        )
    return top


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


def main() -> None:
    df = load_data(DATA_PATH)
    segments = prepare_segments(df, TOP_N)
    plot_pie(segments, OUTPUT_PATH)
    print(f"Pie chart saved to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
