import os
from pathlib import Path

WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "workspace"))
LOGS_DIR = Path(os.getenv("LOGS_DIR", "logs"))
LLM_MODEL = "llama-3.1-8b-instant"
LLM_TEMPERATURE = 0.5
CRASH_TEMPERATURE = 0.3
SUPPORTED_LANGUAGES = {"c", "cpp", "python", "java", "javascript", "react"}
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:5175"]

MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB

REPOSITORY_IGNORE_DIRS: set[str] = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "__pycache__",
    "venv",
    ".venv",
    ".idea",
    ".vscode",
    ".DS_Store",
}
