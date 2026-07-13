import io
import json
import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from zipfile import ZipFile, BadZipFile

from app.config import WORKSPACE_DIR, REPOSITORY_IGNORE_DIRS

logger = logging.getLogger("server")

REPOSITORY_STATUS = "READY_FOR_ANALYSIS"
REPO_PREFIX = "repo_"


def _generate_repo_id() -> str:
    return str(uuid.uuid4())


def _repo_dir(repo_id: str) -> Path:
    return WORKSPACE_DIR / f"{REPO_PREFIX}{repo_id}"


def _source_dir(repo_id: str) -> Path:
    return _repo_dir(repo_id) / "source"


def _metadata_path(repo_id: str) -> Path:
    return _repo_dir(repo_id) / "metadata.json"


def _load_metadata(repo_id: str) -> Optional[dict]:
    path = _metadata_path(repo_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _save_metadata(repo_id: str, metadata: dict) -> None:
    _repo_dir(repo_id).mkdir(parents=True, exist_ok=True)
    _metadata_path(repo_id).write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )


def _should_ignore(path: str) -> bool:
    parts = Path(path).parts
    return any(part in REPOSITORY_IGNORE_DIRS for part in parts)


def upload_repository(file_bytes: bytes, filename: str) -> dict:
    repo_id = _generate_repo_id()
    repo_dir = _repo_dir(repo_id)
    source_dir = _source_dir(repo_id)

    try:
        with ZipFile(io.BytesIO(file_bytes)) as zf:
            bad_file = zf.testzip()
            if bad_file is not None:
                raise ValueError(f"Corrupted ZIP file: {bad_file}")

            all_files = [f for f in zf.namelist() if not f.endswith("/")]
            if not all_files:
                raise ValueError("Empty repository: ZIP file contains no files")

            source_dir.mkdir(parents=True, exist_ok=True)
            file_count = 0
            for member in zf.infolist():
                filename_clean = member.filename
                if _should_ignore(filename_clean):
                    continue
                if filename_clean.endswith("/"):
                    continue
                zf.extract(member, source_dir)
                file_count += 1

            if file_count == 0:
                shutil.rmtree(repo_dir)
                raise ValueError(
                    "Empty repository: no files found after filtering ignored directories"
                )
    except BadZipFile:
        if repo_dir.exists():
            shutil.rmtree(repo_dir)
        raise ValueError("Invalid or corrupted ZIP file")

    total_size = sum(
        f.stat().st_size for f in source_dir.rglob("*") if f.is_file()
    )

    now = datetime.now().isoformat()
    metadata = {
        "repository_id": repo_id,
        "repository_name": Path(filename).stem,
        "status": REPOSITORY_STATUS,
        "upload_time": now,
        "repository_path": f"workspace/{REPO_PREFIX}{repo_id}/source",
        "repository_size": total_size,
        "total_files": file_count,
    }
    _save_metadata(repo_id, metadata)

    logger.info(
        "Uploaded repository '%s' (id=%s, %d files, %d bytes)",
        metadata["repository_name"], repo_id, file_count, total_size,
    )
    return metadata


def list_repositories() -> list[dict]:
    repos = []
    if not WORKSPACE_DIR.exists():
        return repos
    for child in sorted(WORKSPACE_DIR.iterdir()):
        if child.is_dir() and child.name.startswith(REPO_PREFIX):
            repo_id = child.name[len(REPO_PREFIX):]
            metadata = _load_metadata(repo_id)
            if metadata:
                repos.append(metadata)
    return repos


def get_repository(repo_id: str) -> Optional[dict]:
    repo_dir = _repo_dir(repo_id)
    if not repo_dir.exists():
        return None
    return _load_metadata(repo_id)


def delete_repository(repo_id: str) -> bool:
    repo_dir = _repo_dir(repo_id)
    if not repo_dir.exists():
        return False
    shutil.rmtree(repo_dir)
    logger.info("Deleted repository '%s'", repo_id)
    return True
