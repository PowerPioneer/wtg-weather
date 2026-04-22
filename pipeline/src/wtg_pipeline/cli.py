from __future__ import annotations

import typer

app = typer.Typer(help="Where to Go for Great Weather — data pipeline CLI.")

download = typer.Typer(help="Download raw data from external sources.")
process = typer.Typer(help="Process raw data into intermediate artifacts.")
build = typer.Typer(help="Build final outputs (GeoJSON, PMTiles).")

app.add_typer(download, name="download")
app.add_typer(process, name="process")
app.add_typer(build, name="build")


@app.command()
def version() -> None:
    """Print the pipeline version."""
    from wtg_pipeline import __version__

    typer.echo(__version__)


if __name__ == "__main__":
    app()
