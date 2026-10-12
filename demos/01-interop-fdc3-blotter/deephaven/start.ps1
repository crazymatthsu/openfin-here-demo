# Start Deephaven without Docker (Windows PowerShell). Needs Python 3.10+ and Java 17+.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path ".venv")) {
  python -m venv .venv
}
& .\.venv\Scripts\Activate.ps1
python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
python run_server.py @args
