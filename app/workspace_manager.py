import json
import logging
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from app.config import WORKSPACE_DIR

logger = logging.getLogger("server")

EXTENSION_MAP: dict[str, str] = {
    "python": "py",
    "javascript": "js",
    "react": "jsx",
    "java": "java",
    "c": "c",
    "cpp": "cpp",
}

DEFAULT_METADATA: dict[str, Any] = {
    "project_name": "",
    "language": "",
    "created_at": "",
    "updated_at": "",
    "status": "created",
    "generated_tests": 0,
    "passed": 0,
    "failed": 0,
    "success_rate": 0.0,
    "generation_time": "",
    "compilation_time": "",
    "execution_time": "",
    "report_generation_time": "",
    "last_report": "",
}


def derive_project_name(design: str) -> str:
    name = design.strip()
    if not name:
        return "untitled"
    name = name[:60]
    name = re.sub(r'[<>:"/\\|?*]', "", name)
    name = re.sub(r"\s+", "_", name)
    name = name.strip("._")
    if not name:
        name = "untitled"
    return name


def get_extension(language: str) -> str:
    return EXTENSION_MAP.get(language, "txt")


class WorkspaceManager:
    def __init__(self, workspace_dir: Optional[Path] = None) -> None:
        self.workspace_dir = workspace_dir or WORKSPACE_DIR
        self.workspace_dir.mkdir(parents=True, exist_ok=True)

    def _project_dir(self, project_name: str) -> Path:
        sanitized = self._sanitize_name(project_name)
        return self.workspace_dir / sanitized

    def _sanitize_name(self, name: str) -> str:
        sanitized = re.sub(r'[<>:"/\\|?*]', "", name)
        sanitized = re.sub(r"\s+", "_", sanitized)
        sanitized = sanitized.strip("._")
        if not sanitized:
            sanitized = "untitled"
        return sanitized

    def _save_json(self, path: Path, data: Any) -> None:
        path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _load_json(self, path: Path) -> Any:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def create_project(self, project_name: str, language: str = "", description: str = "") -> dict:
        pdir = self._project_dir(project_name)
        if pdir.exists():
            existing = self._load_json(pdir / "metadata.json")
            if existing:
                return existing
        pdir.mkdir(parents=True, exist_ok=True)
        now = datetime.now().isoformat()
        metadata = dict(DEFAULT_METADATA)
        metadata["project_name"] = project_name
        metadata["language"] = language
        metadata["created_at"] = now
        metadata["updated_at"] = now
        self._save_json(pdir / "metadata.json", metadata)
        self._save_json(pdir / "timeline.json", [])
        if description:
            self.save_file(project_name, "requirement.txt", description)
        logger.info("Created project '%s' (language=%s)", project_name, language)
        return metadata

    def project_exists(self, project_name: str) -> bool:
        return self._project_dir(project_name).exists()

    def get_project(self, project_name: str) -> Optional[dict]:
        metadata = self._load_json(self._project_dir(project_name) / "metadata.json")
        return metadata

    def list_projects(self) -> list[dict]:
        projects = []
        if not self.workspace_dir.exists():
            return projects
        for child in sorted(self.workspace_dir.iterdir()):
            if child.is_dir():
                metadata = self._load_json(child / "metadata.json")
                if metadata:
                    projects.append(metadata)
        return projects

    def delete_project(self, project_name: str) -> bool:
        pdir = self._project_dir(project_name)
        if not pdir.exists():
            return False
        shutil.rmtree(pdir)
        logger.info("Deleted project '%s'", project_name)
        return True

    def delete_all_projects(self) -> int:
        count = 0
        if self.workspace_dir.exists():
            for child in list(self.workspace_dir.iterdir()):
                if child.is_dir():
                    shutil.rmtree(child)
                    count += 1
            if count:
                logger.info("Deleted all %d projects", count)
        return count

    def save_file(self, project_name: str, filename: str, content: str) -> Path:
        pdir = self._project_dir(project_name)
        pdir.mkdir(parents=True, exist_ok=True)
        filepath = pdir / filename
        filepath.write_text(content, encoding="utf-8")
        return filepath

    def load_file(self, project_name: str, filename: str) -> Optional[str]:
        filepath = self._project_dir(project_name) / filename
        if not filepath.exists():
            return None
        return filepath.read_text(encoding="utf-8")

    def list_files(self, project_name: str) -> list[dict]:
        pdir = self._project_dir(project_name)
        if not pdir.exists():
            return []
        files = []
        skip_names = {"metadata.json", "timeline.json"}
        for child in sorted(pdir.iterdir()):
            if child.is_file() and child.name not in skip_names:
                stat = child.stat()
                files.append({
                    "name": child.name,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
        return files

    def update_metadata(self, project_name: str, updates: dict) -> Optional[dict]:
        pdir = self._project_dir(project_name)
        metadata = self._load_json(pdir / "metadata.json")
        if metadata is None:
            return None
        metadata.update(updates)
        metadata["updated_at"] = datetime.now().isoformat()
        self._save_json(pdir / "metadata.json", metadata)
        return metadata

    def get_timeline(self, project_name: str) -> list[dict]:
        timeline = self._load_json(self._project_dir(project_name) / "timeline.json")
        return timeline if timeline is not None else []

    def add_timeline_entry(self, project_name: str, entry: dict) -> list[dict]:
        pdir = self._project_dir(project_name)
        timeline = self._load_json(pdir / "timeline.json") or []
        entry["timestamp"] = datetime.now().isoformat()
        timeline.append(entry)
        self._save_json(pdir / "timeline.json", timeline)
        return timeline

    def get_project_dir(self, project_name: str) -> Path:
        return self._project_dir(project_name)
