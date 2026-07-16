import io
import json
import logging
import shutil
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
from zipfile import ZipFile, BadZipFile

from app.config import WORKSPACE_DIR, REPOSITORY_IGNORE_DIRS
from app.indexing_service import index_repository as _index_repo

logger = logging.getLogger("server")

REPOSITORY_STATUS = "READY_FOR_ANALYSIS"
REPO_PREFIX = "repo_"

SUPPORTED_EXTENSIONS: dict[str, str] = {
    ".c": "C",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "React",
    ".tsx": "React",
    ".java": "Java",
}

CONTEXT_EXTENSIONS: dict[str, str] = {
    ".html": "HTML",
    ".css": "CSS",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
}


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
            if metadata and "repository_id" in metadata:
                repos.append(metadata)
    return repos


def get_repository(repo_id: str) -> Optional[dict]:
    repo_dir = _repo_dir(repo_id)
    if not repo_dir.exists():
        return None
    return _load_metadata(repo_id)


def _update_metadata(repo_id: str, updates: dict) -> Optional[dict]:
    metadata = _load_metadata(repo_id)
    if metadata is None:
        return None
    metadata.update(updates)
    _save_metadata(repo_id, metadata)
    return metadata


def _classify_file(rel_path: str) -> str:
    if _should_ignore(rel_path):
        return "ignored"
    ext = Path(rel_path).suffix.lower()
    if ext in SUPPORTED_EXTENSIONS:
        return "supported"
    if ext in CONTEXT_EXTENSIONS:
        return "context"
    return "unsupported"


def _detect_languages(source_dir: Path) -> dict[str, int]:
    languages: dict[str, int] = {}
    for f in source_dir.rglob("*"):
        if not f.is_file():
            continue
        rel = f.relative_to(source_dir)
        if _should_ignore(str(rel)):
            continue
        ext = f.suffix.lower()
        lang = SUPPORTED_EXTENSIONS.get(ext) or CONTEXT_EXTENSIONS.get(ext)
        if lang:
            languages[lang] = languages.get(lang, 0) + 1
    return languages


def analyze_repository(repo_id: str) -> Optional[dict]:
    metadata = _load_metadata(repo_id)
    if metadata is None:
        return None

    source_dir = _source_dir(repo_id)
    if not source_dir.exists():
        return None

    _update_metadata(repo_id, {"status": "ANALYZING"})

    supported = 0
    context = 0
    unsupported = 0
    ignored = 0
    total_size = 0
    total_count = 0

    for f in source_dir.rglob("*"):
        if not f.is_file():
            continue
        rel = str(f.relative_to(source_dir))
        total_count += 1
        total_size += f.stat().st_size
        category = _classify_file(rel)
        if category == "supported":
            supported += 1
        elif category == "context":
            context += 1
        elif category == "ignored":
            ignored += 1
        else:
            unsupported += 1

    languages = _detect_languages(source_dir)
    lang_list = sorted(languages.keys()) if languages else []

    _update_metadata(repo_id, {
        "status": "READY_FOR_INDEXING",
        "total_files": total_count,
        "supported_files": supported,
        "context_files": context,
        "unsupported_files": unsupported,
        "ignored_files": ignored,
        "repository_size": total_size,
        "languages": lang_list,
        "analysis_completed_at": datetime.now().isoformat(),
    })

    logger.info(
        "Analyzed repository '%s': %d total, %d supported, %d context, %d unsupported, %d ignored, langs=%s",
        repo_id, total_count, supported, context, unsupported, ignored, lang_list,
    )

    return _load_metadata(repo_id)


def index_repository(repo_id: str) -> Optional[dict]:
    metadata = _load_metadata(repo_id)
    if metadata is None:
        return None

    source_path = _source_dir(repo_id)
    if not source_path.exists():
        return None

    _update_metadata(repo_id, {"status": "INDEXING"})

    result = _index_repo(str(source_path))

    if result["success"]:
        _update_metadata(repo_id, {
            "status": "READY",
            "index_created": True,
            "indexed_at": datetime.now().isoformat(),
        })
    else:
        _update_metadata(repo_id, {"status": "READY_FOR_INDEXING"})

    return _load_metadata(repo_id)


def get_repository_tree(repo_id: str) -> Optional[dict]:
    source_dir = _source_dir(repo_id)
    if not source_dir.exists():
        return None

    def _build_tree(dir_path: Path) -> list[dict]:
        entries: list[dict] = []
        for child in sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
            rel = child.relative_to(source_dir)
            if _should_ignore(str(rel)):
                continue
            if child.is_dir():
                children = _build_tree(child)
                entries.append({
                    "name": child.name,
                    "type": "directory",
                    "path": str(rel),
                    "children": children,
                })
            elif child.is_file():
                entries.append({
                    "name": child.name,
                    "type": "file",
                    "path": str(rel),
                })
        return entries

    return {"tree": _build_tree(source_dir)}


def get_source_file_content(repo_id: str, file_path: str) -> Optional[str]:
    source_dir = _source_dir(repo_id)
    if not source_dir.exists():
        return None

    full_path = (source_dir / file_path).resolve()
    if not str(full_path).startswith(str(source_dir.resolve())):
        return None
    if not full_path.is_file():
        return None

    try:
        return full_path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


def _cbm_project_name(source_dir: Path) -> str:
    return str(source_dir.resolve()).lstrip("/").replace("/", "-")


def retrieve_file_context(repo_id: str, file_path: str) -> dict:
    metadata = _load_metadata(repo_id)
    if metadata is None:
        return {"found": False, "error": "Repository not found"}

    if metadata.get("status") != "READY":
        return {"found": False, "error": "Repository is not indexed. Please index it first."}

    source_dir = _source_dir(repo_id)
    if not source_dir.exists():
        return {"found": False, "error": "Repository source directory not found"}

    full_path = (source_dir / file_path).resolve()
    if not str(full_path).startswith(str(source_dir.resolve())):
        return {"found": False, "error": "Invalid file path"}
    if not full_path.is_file():
        return {"found": False, "error": "File not found"}

    project_name = _cbm_project_name(source_dir)

    try:
        result = subprocess.run(
            [
                "codebase-memory-mcp", "cli", "search_graph",
                "--project", project_name,
                "--file-pattern", file_path,
                "--limit", "50",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        return {"found": False, "error": "Codebase Memory MCP is not installed or not in PATH"}
    except subprocess.TimeoutExpired:
        return {"found": False, "error": "Codebase Memory MCP request timed out"}

    if result.returncode != 0:
        last_line = (result.stderr or "").strip().split("\n")[-1]
        return {"found": False, "error": last_line or "Context retrieval failed"}

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"found": False, "error": "Failed to parse Codebase Memory MCP response"}

    context = data.get("results", [])

    arch_info = None
    try:
        arch_result = subprocess.run(
            [
                "codebase-memory-mcp", "cli", "get_architecture",
                "--project", project_name,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if arch_result.returncode == 0:
            arch_data = json.loads(arch_result.stdout)
            arch_info = {
                "languages": arch_data.get("languages", []),
                "total_nodes": arch_data.get("total_nodes", 0),
                "entry_points": [
                    {"name": e["name"], "file": e.get("file", "")}
                    for e in arch_data.get("entry_points", [])
                ][:10],
                "packages": [
                    {"name": p["name"], "node_count": p.get("node_count", 0)}
                    for p in arch_data.get("packages", [])
                ],
            }
    except Exception:
        arch_info = None

    return {
        "found": True,
        "file_path": file_path,
        "indexed": True,
        "symbols": [
            {
                "name": s.get("name"),
                "type": s.get("label", "symbol"),
                "file": s.get("file_path", ""),
                "lines": f"{s.get('start_line', '?')}-{s.get('end_line', '?')}",
            }
            for s in context
            if s.get("label") in ("Function", "Method", "Class", "Interface", "Variable")
        ],
        "total_symbols": len(context),
        "project_architecture": arch_info,
    }


def delete_repository(repo_id: str) -> bool:
    repo_dir = _repo_dir(repo_id)
    if not repo_dir.exists():
        return False
    shutil.rmtree(repo_dir)
    logger.info("Deleted repository '%s'", repo_id)
    return True
