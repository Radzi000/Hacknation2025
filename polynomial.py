from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from scipy import stats


pd.set_option("display.float_format", lambda v: f"{v:0.3f}")


def load_and_prepare(
    data_path: Path,
    sheet_name: str = "Arkusz1",
) -> pd.DataFrame:
    """
    Load Excel data and normalize the year column to be named 'year'.

    Handles 'year', 'rok', or a numeric first column as the year.
    """
    df_raw = pd.read_excel(data_path, sheet_name=sheet_name)

    possible_year_cols = ["year", "rok"]
    year_col = next((c for c in possible_year_cols if c in df_raw.columns), None)

    if year_col is None:
        first_col = df_raw.columns[0]
        if pd.api.types.is_numeric_dtype(df_raw[first_col]):
            year_col = first_col

    if year_col is None:
        raise ValueError(
            "Year column not found; expected a 'year'/'rok' column or an unnamed "
            "first column with numeric years."
        )

    df = (
        df_raw.rename(columns={year_col: "year"})
        .assign(year=lambda d: pd.to_numeric(d["year"], errors="coerce"))
        .sort_values("year")
        .reset_index(drop=True)
    )

    print(
        f"Loaded {df.shape[0]} rows and {df.shape[1] - 1} features from "
        f"'{data_path.name}'; year column = '{year_col}'."
    )
    return df


def _box_cox_transform(
    y: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[str, float | None], dict[str, float]]:
    """
    Apply Box–Cox column-wise. Constant columns are kept as zeros and flagged
    so we can invert them back to their constant value later.
    """
    transformed = {}
    lambdas: dict[str, float | None] = {}
    constants: dict[str, float] = {}

    for col in y.columns:
        series = y[col]
        if series.nunique() <= 1:
            lambdas[col] = None
            constants[col] = float(series.iloc[0])
            transformed[col] = np.zeros(len(series))
            continue

        bc_vals, lam = stats.boxcox(series.to_numpy())
        lambdas[col] = float(lam)
        transformed[col] = bc_vals

    return pd.DataFrame(transformed, index=y.index), lambdas, constants


def _box_cox_inverse(
    y_bc: pd.DataFrame,
    lambdas: dict[str, float | None],
    constants: dict[str, float],
) -> pd.DataFrame:
    """Invert a column-wise Box–Cox transform."""
    inverted = {}
    for col in y_bc.columns:
        lam = lambdas[col]
        if lam is None:
            inverted[col] = np.full(len(y_bc), constants[col])
        else:
            vals = y_bc[col].to_numpy()
            # Ensure we stay in the valid inverse domain: lambda * y + 1 > 0
            z = lam * vals + 1
            z = np.maximum(z, 1e-9)
            if np.isclose(lam, 0.0):
                inverted[col] = np.exp(vals)
            else:
                inverted[col] = np.power(z, 1.0 / lam)
    return pd.DataFrame(inverted, index=y_bc.index)


def fit_polynomial_model(
    df: pd.DataFrame,
    train_start_year: int = 2012,
    degree: int = 3,
) -> tuple[Pipeline, dict[str, float | None], dict[str, float], pd.Series]:
    """
    Fit a polynomial regression model with Box–Cox-transformed targets.
    Returns:
        poly_reg, lambdas, constants, target_offsets
    """
    train = df[df["year"] >= train_start_year].copy()

    X_train = train[["year"]]
    y_train = train.drop(columns=["year"]).apply(pd.to_numeric, errors="coerce")

    print(
        f"Training rows: {train.shape[0]} from {train_start_year}+, "
        f"Targets: {y_train.shape[1]} features."
    )

    # Box–Cox requires positive values; shift each target up if needed
    target_offsets = y_train.min().apply(lambda v: 1 - v if v <= 0 else 0.0)
    y_train_positive = y_train + target_offsets

    y_train_bc, lambdas, constants = _box_cox_transform(y_train_positive)

    poly_reg = make_pipeline(
        PolynomialFeatures(degree=degree, include_bias=False),
        LinearRegression(),
    )

    poly_reg.fit(X_train, y_train_bc)
    print(
        f"Model fitted with degree={degree} polynomial and "
        "Box–Cox-transformed targets."
    )

    return poly_reg, lambdas, constants, target_offsets


def forecast_future(
    df: pd.DataFrame,
    poly_reg,
    lambdas: dict[str, float | None],
    constants: dict[str, float],
    target_offsets: pd.Series,
    horizon: int = 3,
) -> pd.DataFrame:
    """
    Forecast the next `horizon` years beyond the latest available year.
    """
    last_year = int(df["year"].max())
    future_years = np.arange(last_year + 1, last_year + horizon + 1)
    future_X = pd.DataFrame({"year": future_years})

    future_pred_bc = pd.DataFrame(
        poly_reg.predict(future_X),
        columns=target_offsets.index,
        index=future_years,
    )

    future_pred = (
        _box_cox_inverse(future_pred_bc, lambdas, constants) - target_offsets
    )

    print("Forecast for next years (head):")
    print(future_pred.head())

    return future_pred


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Polynomial forecasting baseline for tabular time series."
    )
    parser.add_argument(
        "--data-path",
        type=Path,
        default=Path("data/DATA_PKD_SPECIFIC.xlsx"),
        help="Path to the Excel file with historical data.",
    )
    parser.add_argument(
        "--sheet-name",
        type=str,
        default="Arkusz1",
        help="Sheet name in the Excel file.",
    )
    parser.add_argument(
        "--train-start-year",
        type=int,
        default=2012,
        help="First year to use for model training.",
    )
    parser.add_argument(
        "--horizon",
        type=int,
        default=3,
        help="Number of years to forecast beyond the last observed year.",
    )
    parser.add_argument(
        "--output-path",
        type=Path,
        default=Path("data/polynomial_forecast_next3.csv"),
        help="Path where the forecast CSV will be saved.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    df = load_and_prepare(args.data_path, sheet_name=args.sheet_name)

    poly_reg, lambdas, constants, target_offsets = fit_polynomial_model(
        df,
        train_start_year=args.train_start_year,
        degree=2,
    )

    # Use the trained model to forecast future years
    future_pred = forecast_future(
        df,
        poly_reg=poly_reg,
        lambdas=lambdas,
        constants=constants,
        target_offsets=target_offsets,
        horizon=args.horizon,
    )

    # Persist forecasts
    output_path = args.output_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    future_pred.to_csv(output_path, index_label="year")
    print(f"Saved forecast to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
