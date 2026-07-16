import json
import logging
import os
import tempfile
import time
from datetime import datetime
from pathlib import Path
from fastapi import BackgroundTasks, FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import CORS_ORIGINS, MAX_UPLOAD_SIZE
from app.log_setup import setup_logging
from app.workspace_manager import WorkspaceManager, derive_project_name, get_extension
from app.responses import success_response, error_response
from app.llm_service import generate_test_cases, generate_code
from app.schemas import (
    DesignInput,
    TestCases,
    CodeGenOutput,
    CrashAnalysisOutput,
    CrashReportInput,
    CrashReportOutput,
    UserCrashAnalysisInput,
    UserCrashAnalysisOutput,
)
from app import repository_service
from app.execution_service import execute_test_cases, generate_text_report
from app.crash_service import simulate_crash, analyze_user_code, compile_and_run_program
from app.crash_ai_service import analyze_backtrace

loggers = setup_logging()
server_log = loggers["server"]
execution_log = loggers["execution"]
compiler_log = loggers["compiler"]
crash_log = loggers["crash"]
report_log = loggers["report"]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Test Generator API",
    description="Generate software test cases from design descriptions using Groq AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ws = WorkspaceManager()


def _ensure_project(request, design: str) -> str:
    project_name = request.project_name or derive_project_name(design)
    lang = getattr(request, "language", None) or ""
    ws.create_project(project_name, lang, description=design)
    return project_name


def _save_code_result(project_name: str, result: dict) -> None:
    ext = get_extension(result["language"])
    ws.save_file(project_name, f"generated_code.{ext}", result["code"])
    if result.get("gtest_code"):
        ws.save_file(project_name, "gtest.cpp", result["gtest_code"])


def _save_test_cases(project_name: str, result: dict) -> None:
    ws.save_file(project_name, "generated_tests.json", json.dumps(result, indent=2))


def _save_execution_result(project_name: str, result: dict) -> None:
    ws.save_file(project_name, "execution_result.json", json.dumps(result, indent=2))


def _save_report(project_name: str, report_text: str) -> None:
    ws.save_file(project_name, "report.txt", report_text)


def _update_stats_from_execution(project_name: str, exec_result: dict, duration: float) -> None:
    total = exec_result["summary"]["total"]
    passed = exec_result["summary"]["passed"]
    failed = exec_result["summary"]["failed"]
    rate = round((passed / max(total, 1)) * 100, 2)
    ws.update_metadata(project_name, {
        "status": "tests_executed",
        "generated_tests": total,
        "passed": passed,
        "failed": failed,
        "success_rate": rate,
        "execution_time": f"{duration:.2f} sec",
    })


@app.get("/")
def root():
    server_log.info("Health check")
    return {"status": "ok", "message": "AI Test Generator is running"}


@app.post("/generate-tests", response_model=TestCases)
def generate_tests(request: DesignInput):
    if not request.design.strip():
        raise HTTPException(status_code=400, detail="Design description cannot be empty")

    project_name = _ensure_project(request, request.design)
    server_log.info("Generating tests for project '%s'", project_name)

    start = time.time()
    result = generate_test_cases(request.design)
    duration = time.time() - start

    total_cases = len(result["functional"]) + len(result["edge_cases"]) + len(result["security"])
    if total_cases == 0:
        raise HTTPException(
            status_code=502,
            detail="AI model returned empty response. Please try again with a more detailed design description.",
        )

    _save_test_cases(project_name, result)
    ws.update_metadata(project_name, {
        "status": "tests_generated",
        "generated_tests": total_cases,
        "generation_time": f"{duration:.2f} sec",
    })
    ws.add_timeline_entry(project_name, {
        "step": "Generate Test Cases",
        "status": "completed",
        "duration": f"{duration:.2f} sec",
    })

    execution_log.info("Generated %d tests for project '%s' in %.2fs", total_cases, project_name, duration)
    return result


@app.post("/generate-code", response_model=CodeGenOutput, response_model_exclude_none=True)
def generate_code_endpoint(request: DesignInput):
    if not request.design.strip():
        raise HTTPException(status_code=400, detail="Design description cannot be empty")

    project_name = _ensure_project(request, request.design)
    server_log.info("Generating code for project '%s'", project_name)

    try:
        start = time.time()
        result = generate_code(request.design, request.language)
        duration = time.time() - start
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not result["code"].strip():
        raise HTTPException(
            status_code=502,
            detail="AI model returned empty response. Please try again with a more detailed design description.",
        )

    _save_code_result(project_name, result)
    ws.update_metadata(project_name, {
        "language": result["language"],
        "status": "code_generated",
        "generation_time": f"{duration:.2f} sec",
    })
    ws.add_timeline_entry(project_name, {
        "step": "Generate Code",
        "status": "completed",
        "duration": f"{duration:.2f} sec",
    })

    server_log.info("Generated %s code for project '%s' in %.2fs", result["language"], project_name, duration)
    return result


@app.post("/execute-tests")
def execute_tests(request: DesignInput):
    project_name = _ensure_project(request, request.design)
    server_log.info("Executing tests for project '%s'", project_name)

    existing_tests = ws.load_file(project_name, "generated_tests.json")
    if existing_tests:
        generated = json.loads(existing_tests)
        execution_log.info("Using cached test cases for project '%s'", project_name)
    else:
        generated = generate_test_cases(request.design)
        _save_test_cases(project_name, generated)

    start = time.time()
    execution_result = execute_test_cases(
        generated["functional"],
        generated["edge_cases"],
        generated["security"],
    )
    duration = time.time() - start

    _save_execution_result(project_name, execution_result)
    _update_stats_from_execution(project_name, execution_result, duration)
    ws.add_timeline_entry(project_name, {
        "step": "Execute Tests",
        "status": "completed",
        "duration": f"{duration:.2f} sec",
    })

    execution_log.info(
        "Executed %d tests for project '%s': %d passed, %d failed in %.2fs",
        execution_result["summary"]["total"],
        project_name,
        execution_result["summary"]["passed"],
        execution_result["summary"]["failed"],
        duration,
    )
    return execution_result


@app.post("/generate-report")
def generate_report(request: DesignInput):
    project_name = _ensure_project(request, request.design)
    server_log.info("Generating report for project '%s'", project_name)

    existing_exec = ws.load_file(project_name, "execution_result.json")
    if existing_exec:
        execution_result = json.loads(existing_exec)
        report_log.info("Using cached execution results for project '%s'", project_name)
    else:
        existing_tests = ws.load_file(project_name, "generated_tests.json")
        if existing_tests:
            generated = json.loads(existing_tests)
        else:
            generated = generate_test_cases(request.design)
            _save_test_cases(project_name, generated)

        execution_result = execute_test_cases(
            generated["functional"],
            generated["edge_cases"],
            generated["security"],
        )
        _save_execution_result(project_name, execution_result)
        _update_stats_from_execution(project_name, execution_result, 0.0)

    start = time.time()
    report_text = generate_text_report(execution_result)
    duration = time.time() - start

    _save_report(project_name, report_text)
    ws.update_metadata(project_name, {
        "status": "report_generated",
        "last_report": datetime.now().isoformat(),
        "report_generation_time": f"{duration:.2f} sec",
    })
    ws.add_timeline_entry(project_name, {
        "step": "Generate Report",
        "status": "completed",
        "duration": f"{duration:.2f} sec",
    })

    report_log.info("Generated report for project '%s' in %.2fs", project_name, duration)
    return {"report": report_text}


@app.post("/download-report")
def download_report(request: DesignInput):
    project_name = _ensure_project(request, request.design)
    server_log.info("Downloading report for project '%s'", project_name)

    existing_report = ws.load_file(project_name, "report.txt")
    if existing_report is None:
        existing_exec = ws.load_file(project_name, "execution_result.json")
        if existing_exec:
            execution_result = json.loads(existing_exec)
        else:
            existing_tests = ws.load_file(project_name, "generated_tests.json")
            if existing_tests:
                generated = json.loads(existing_tests)
            else:
                generated = generate_test_cases(request.design)
                _save_test_cases(project_name, generated)

            execution_result = execute_test_cases(
                generated["functional"],
                generated["edge_cases"],
                generated["security"],
            )
            _save_execution_result(project_name, execution_result)
            _update_stats_from_execution(project_name, execution_result, 0.0)

        report_text = generate_text_report(execution_result)
        _save_report(project_name, report_text)
        ws.update_metadata(project_name, {
            "status": "report_generated",
            "last_report": datetime.now().isoformat(),
        })
        ws.add_timeline_entry(project_name, {
            "step": "Generate Report",
            "status": "completed",
        })

    report_path = ws.get_project_dir(project_name) / "report.txt"
    report_log.info("Serving report for project '%s'", project_name)
    return FileResponse(
        path=str(report_path),
        media_type="text/plain",
        filename="report.txt",
    )


@app.post("/analyze-crash", response_model=CrashAnalysisOutput)
def analyze_crash():
    server_log.info("Running crash simulation")

    try:
        start = time.time()
        result = simulate_crash()
        duration = time.time() - start

        crash_log.info("Crash simulation completed with %d frames in %.2fs", len(result["backtrace"]), duration)
        return result

    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        crash_log.error("Crash simulation failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Crash analysis failed. Ensure g++ and lldb are installed.",
        )


@app.post("/analyze-crash-report", response_model=CrashReportOutput)
def analyze_crash_report(request: CrashReportInput):
    if not request.backtrace:
        raise HTTPException(status_code=400, detail="Backtrace cannot be empty")

    project_name = request.project_name
    if project_name:
        server_log.info("Analyzing crash report for project '%s' (%d frames)", project_name, len(request.backtrace))
    else:
        server_log.info("Analyzing crash report (%d frames)", len(request.backtrace))

    start = time.time()
    result = analyze_backtrace(
        request.backtrace,
        code=request.code,
        signal=request.signal,
        stderr=request.stderr,
        backtrace_frames=request.backtrace_frames,
    )
    duration = time.time() - start

    if project_name and ws.project_exists(project_name):
        existing = json.loads(ws.load_file(project_name, "crash_analysis.json") or "{}")
        existing["ai_analysis"] = result
        ws.save_file(project_name, "crash_analysis.json", json.dumps(existing, indent=2))
        ws.add_timeline_entry(project_name, {
            "step": "AI Crash Analysis",
            "status": "completed",
            "duration": f"{duration:.2f} sec",
        })

    crash_log.info("AI crash analysis completed in %.2fs", duration)
    return result


@app.post("/analyze-user-crash", response_model=UserCrashAnalysisOutput)
def analyze_user_crash(request: UserCrashAnalysisInput):
    project_name = request.project_name
    if project_name:
        server_log.info("Analyzing user code for project '%s'", project_name)
    else:
        server_log.info("Analyzing user code")

    try:
        start = time.time()
        result = analyze_user_code(request.code, request.language)
        duration = time.time() - start

        if project_name and ws.project_exists(project_name):
            ws.save_file(project_name, "crash_analysis.json", json.dumps(result, indent=2))
            ws.update_metadata(project_name, {
                "status": "crashed" if result["crashed"] else "ok",
                "compilation_time": f"{duration:.2f} sec",
            })
            ws.add_timeline_entry(project_name, {
                "step": "User Code Crash Analysis",
                "status": "completed",
                "duration": f"{duration:.2f} sec",
            })

        crash_log.info(
            "User code analysis: crashed=%s, signal=%s, duration=%.2fs",
            result["crashed"], result["signal"], duration,
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        crash_log.error("User crash analysis failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Crash analysis failed. Ensure gcc/g++ and lldb are installed.",
        )


COMPILE_LANGUAGES = {"c", "cpp"}


@app.post("/run-program")
def run_program(request: UserCrashAnalysisInput):
    server_log.info("Running program for project '%s'", request.project_name or "(no project)")

    if request.language not in COMPILE_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Compilation not supported for language: {request.language}")

    start = time.time()
    result = compile_and_run_program(request.code, request.language)
    duration = time.time() - start

    project_name = request.project_name
    if project_name and ws.project_exists(project_name):
        ws.save_file(project_name, "output.json", json.dumps(result, indent=2))
        ws.update_metadata(project_name, {
            "program_output_time": f"{duration:.2f} sec",
        })
        ws.add_timeline_entry(project_name, {
            "step": "Run Program",
            "status": "completed" if result["success"] else "failed",
            "duration": f"{duration:.2f} sec",
        })

    server_log.info(
        "Program run completed: success=%s, exit_code=%s, time=%.2fs",
        result["success"], result["exit_code"], duration,
    )
    return result


@app.get("/projects")
def list_projects():
    projects = ws.list_projects()
    server_log.info("Listed %d projects", len(projects))
    return success_response(data=projects, message=f"Found {len(projects)} projects")


@app.delete("/projects")
def delete_all_projects():
    count = ws.delete_all_projects()
    server_log.info("Deleted all %d projects", count)
    return success_response(message=f"Deleted {count} projects")


@app.get("/projects/{project_name}")
def get_project(project_name: str):
    project = ws.get_project(project_name)
    if project is None:
        return error_response("not_found", f"Project '{project_name}' not found")
    return success_response(data=project, message="Project found")


@app.delete("/projects/{project_name}")
def delete_project(project_name: str):
    if not ws.project_exists(project_name):
        return error_response("not_found", f"Project '{project_name}' not found")
    ws.delete_project(project_name)
    server_log.info("Deleted project '%s'", project_name)
    return success_response(message=f"Project '{project_name}' deleted")


@app.get("/projects/{project_name}/files")
def list_project_files(project_name: str):
    if not ws.project_exists(project_name):
        return error_response("not_found", f"Project '{project_name}' not found")
    files = ws.list_files(project_name)
    return success_response(data=files, message=f"Found {len(files)} files")


@app.get("/projects/{project_name}/file/{file_name}")
def get_project_file(project_name: str, file_name: str):
    if not ws.project_exists(project_name):
        return error_response("not_found", f"Project '{project_name}' not found")
    safe_name = Path(file_name).name
    content = ws.load_file(project_name, safe_name)
    if content is None:
        return error_response("not_found", f"File '{safe_name}' not found in project '{project_name}'")
    return success_response(data={"name": safe_name, "content": content}, message="File found")


@app.get("/projects/{project_name}/timeline")
def get_project_timeline(project_name: str):
    if not ws.project_exists(project_name):
        return error_response("not_found", f"Project '{project_name}' not found")
    timeline = ws.get_timeline(project_name)
    return success_response(data=timeline, message=f"Found {len(timeline)} timeline entries")


@app.get("/reports")
def list_reports():
    projects = ws.list_projects()
    reports = []
    for p in projects:
        pname = p.get("project_name", "")
        report_content = ws.load_file(pname, "report.txt")
        if report_content is not None:
            report_path = ws.get_project_dir(pname) / "report.txt"
            stat = report_path.stat() if report_path.exists() else None
            reports.append({
                "project_name": pname,
                "report_file": "report.txt",
                "generated_at": p.get("last_report", ""),
                "size": stat.st_size if stat else 0,
            })
    return success_response(data=reports, message=f"Found {len(reports)} reports")


@app.get("/reports/{project_name}")
def get_report(project_name: str):
    if not ws.project_exists(project_name):
        return error_response("not_found", f"Project '{project_name}' not found")
    report_text = ws.load_file(project_name, "report.txt")
    if report_text is None:
        return error_response("not_found", f"No report found for project '{project_name}'")
    return success_response(data={"project_name": project_name, "report": report_text}, message="Report found")


@app.delete("/reports/{project_name}")
def delete_report(project_name: str):
    if not ws.project_exists(project_name):
        return error_response("not_found", f"Project '{project_name}' not found")
    report_path = ws.get_project_dir(project_name) / "report.txt"
    if not report_path.exists():
        return error_response("not_found", f"No report found for project '{project_name}'")
    os.remove(str(report_path))
    ws.update_metadata(project_name, {"status": "report_deleted", "last_report": ""})
    report_log.info("Deleted report for project '%s'", project_name)
    return success_response(message=f"Report deleted for project '{project_name}'")


@app.post("/upload-repository")
def upload_repository(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Only ZIP files are accepted",
        )

    content = file.file.read()
    file_size = len(content)

    if file_size > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB",
        )

    try:
        metadata = repository_service.upload_repository(content, file.filename)
        server_log.info(
            "Uploaded repository '%s' (id=%s)",
            metadata["repository_name"], metadata["repository_id"],
        )
        return success_response(data=metadata, message="Repository uploaded successfully")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        server_log.error("Repository upload failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Repository upload failed. Please try again.",
        )


@app.get("/repositories")
def list_repositories():
    repos = repository_service.list_repositories()
    server_log.info("Listed %d repositories", len(repos))
    return success_response(data=repos, message=f"Found {len(repos)} repositories")


@app.get("/repositories/{repository_id}")
def get_repository(repository_id: str):
    metadata = repository_service.get_repository(repository_id)
    if metadata is None:
        return error_response("not_found", f"Repository '{repository_id}' not found")
    return success_response(data=metadata, message="Repository found")


@app.delete("/repositories/{repository_id}")
def delete_repository(repository_id: str):
    if not repository_service.delete_repository(repository_id):
        return error_response("not_found", f"Repository '{repository_id}' not found")
    server_log.info("Deleted repository '%s'", repository_id)
    return success_response(message=f"Repository '{repository_id}' deleted")


@app.post("/repositories/{repository_id}/analyze")
def analyze_repository(repository_id: str):
    metadata = repository_service.analyze_repository(repository_id)
    if metadata is None:
        return error_response("not_found", f"Repository '{repository_id}' not found")
    server_log.info(
        "Analyzed repository '%s' (%s)",
        repository_id, metadata.get("status"),
    )
    return success_response(data=metadata, message="Repository analyzed successfully")


@app.get("/repositories/{repository_id}/tree")
def get_repository_tree(repository_id: str):
    tree = repository_service.get_repository_tree(repository_id)
    if tree is None:
        return error_response("not_found", f"Repository '{repository_id}' not found")
    server_log.info("Retrieved tree for repository '%s'", repository_id)
    return success_response(data=tree, message="Repository tree retrieved")


@app.get("/repositories/{repository_id}/context")
def get_file_context(repository_id: str, path: str):
    metadata = repository_service.get_repository(repository_id)
    if metadata is None:
        return error_response("not_found", f"Repository '{repository_id}' not found")

    result = repository_service.retrieve_file_context(repository_id, path)
    if not result.get("found"):
        return success_response(
            data={"found": False, "file_path": path, "reason": result.get("error", "Unknown error")},
            message=result.get("error", "Context not available"),
        )
    server_log.info("Retrieved context for '%s' in repository '%s' (%d symbols)", path, repository_id, result.get("total_symbols", 0))
    return success_response(data=result, message="Context retrieved")


@app.get("/repositories/{repository_id}/source-file")
def get_source_file(repository_id: str, path: str):
    content = repository_service.get_source_file_content(repository_id, path)
    if content is None:
        return error_response("not_found", f"File '{path}' not found in repository '{repository_id}'")
    server_log.info("Retrieved source file '%s' from repository '%s'", path, repository_id)
    return success_response(data={"path": path, "content": content}, message="File content retrieved")


@app.post("/repositories/{repository_id}/index")
def index_repository(repository_id: str):
    metadata = repository_service.index_repository(repository_id)
    if metadata is None:
        return error_response("not_found", f"Repository '{repository_id}' not found")
    server_log.info(
        "Indexed repository '%s' (%s)",
        repository_id, metadata.get("status"),
    )
    return success_response(data=metadata, message="Repository indexed successfully")
