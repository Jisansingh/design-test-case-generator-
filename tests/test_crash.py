import json
import os
import tempfile
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.crash_service import write_source_file, compile_program, simulate_crash

client = TestClient(app)

MOCK_BACKTRACE_JSON = json.dumps({
    "issue": "Null pointer dereference",
    "root_cause": "Null pointer accessed in crashFunction() at line 6",
    "suggestions": [
        "Initialize pointer before use",
        "Add null checks before dereferencing",
        "Use smart pointers instead of raw pointers"
    ]
})


def _mock_groq(content):
    mock = MagicMock()
    mock.choices = [MagicMock()]
    mock.choices[0].message.content = content
    return mock


def test_write_source_creates_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = write_source_file(tmpdir)
        assert os.path.exists(path)
        with open(path) as f:
            content = f.read()
        assert "crashFunction" in content
        assert "nullptr" in content


def test_compile_program_succeeds():
    with tempfile.TemporaryDirectory() as tmpdir:
        source = write_source_file(tmpdir)
        binary = os.path.join(tmpdir, "crash_sim")
        compile_program(source, binary)
        assert os.path.exists(binary)
        assert os.access(binary, os.X_OK)


def test_simulate_crash_returns_backtrace():
    result = simulate_crash()
    assert result["status"] == "crashed"
    assert "backtrace" in result
    assert len(result["backtrace"]) >= 2


def test_simulate_crash_contains_expected_functions():
    result = simulate_crash()
    frames = result["backtrace"]
    frame_text = " ".join(frames)
    assert "crashFunction" in frame_text
    assert "processRequest" in frame_text
    assert "main" in frame_text


def test_simulate_crash_frames_in_order():
    result = simulate_crash()
    frames = result["backtrace"]
    assert "#0" in frames[0]
    assert frames[0].count("crashFunction") > 0


def test_api_analyze_crash_returns_json():
    response = client.post("/analyze-crash")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "crashed"
    assert "backtrace" in data
    assert len(data["backtrace"]) > 0


def test_api_analyze_crash_contains_expected_functions():
    response = client.post("/analyze-crash")
    assert response.status_code == 200
    data = response.json()
    frame_text = " ".join(data["backtrace"])
    assert "crashFunction" in frame_text
    assert "main" in frame_text


@patch("app.crash_ai_service.client.chat.completions.create")
def test_analyze_backtrace_returns_expected_structure(mock_create):
    from app.crash_ai_service import analyze_backtrace
    mock_create.return_value = _mock_groq(MOCK_BACKTRACE_JSON)

    backtrace = [
        "#0 crashFunction()",
        "#1 processRequest()",
        "#2 main()",
    ]
    result = analyze_backtrace(backtrace)
    assert "issue" in result
    assert "root_cause" in result
    assert "suggestions" in result
    assert isinstance(result["suggestions"], list)
    assert len(result["suggestions"]) > 0


@patch("app.crash_ai_service.client.chat.completions.create")
def test_analyze_backtrace_identifies_null_pointer(mock_create):
    from app.crash_ai_service import analyze_backtrace
    mock_create.return_value = _mock_groq(MOCK_BACKTRACE_JSON)

    backtrace = [
        "#0 crashFunction()",
        "#1 processRequest()",
        "#2 main()",
    ]
    result = analyze_backtrace(backtrace)
    issue_lower = result["issue"].lower()
    assert "null" in issue_lower or "pointer" in issue_lower or "dereference" in issue_lower
    assert len(result["root_cause"]) > 0


@patch("app.crash_ai_service.client.chat.completions.create")
def test_api_analyze_crash_report_returns_json(mock_create):
    mock_create.return_value = _mock_groq(MOCK_BACKTRACE_JSON)
    response = client.post(
        "/analyze-crash-report",
        json={"backtrace": ["#0 crashFunction()", "#1 processRequest()", "#2 main()"]},
    )
    assert response.status_code == 200
    data = response.json()
    assert "issue" in data
    assert "root_cause" in data
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0


def test_api_analyze_crash_report_empty_backtrace():
    response = client.post(
        "/analyze-crash-report",
        json={"backtrace": []},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


@patch("app.crash_ai_service.client.chat.completions.create")
def test_crash_simulation_and_ai_analysis_pipeline(mock_create):
    mock_create.return_value = _mock_groq(MOCK_BACKTRACE_JSON)
    crash_result = simulate_crash()
    assert crash_result["status"] == "crashed"
    backtrace = crash_result["backtrace"]
    assert len(backtrace) > 0
    report = client.post(
        "/analyze-crash-report",
        json={"backtrace": backtrace},
    )
    assert report.status_code == 200
    data = report.json()
    assert "issue" in data
    assert "root_cause" in data
    assert len(data["suggestions"]) > 0
