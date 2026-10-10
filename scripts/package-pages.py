"""Package an already-built static site for Cloudflare's ZIP upload."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
source = root / "dist"
destination = root / "output" / "bazaar-diy-cloudflare.zip"
if not (source / "index.html").is_file():
    raise SystemExit("Run npm run build first")
files = sorted(path for path in source.rglob("*") if path.is_file())
if len(files) > 1000 or any(path.stat().st_size > 25 * 1024**2 for path in files):
    raise SystemExit("Static assets exceed Cloudflare dashboard upload limits")
destination.parent.mkdir(exist_ok=True)
with ZipFile(destination, "w", compression=ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, path.relative_to(source).as_posix())
with ZipFile(destination) as archive:
    if archive.testzip() or "index.html" not in archive.namelist():
        raise SystemExit("Deployment archive verification failed")
print(f"{destination}: {len(files)} files, {destination.stat().st_size / 1024**2:.1f} MiB")
