import json
import subprocess


def index_repository(repo_path):
    result = subprocess.run(
        ["codebase-memory-mcp", "cli", "index_repository", "--repo-path", repo_path],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        last_line = (result.stderr or "").strip().split("\n")[-1]
        try:
            error_data = json.loads(last_line)
            return {"success": False, "error": error_data.get("hint", str(error_data))}
        except (json.JSONDecodeError, IndexError):
            return {"success": False, "error": (result.stderr or result.stdout or "Indexing failed").strip()}

    try:
        data = json.loads(result.stdout)
        return {"success": True, "data": data}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Failed to parse response: {e}"}
