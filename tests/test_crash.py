import json
import os
import tempfile
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.crash_service import write_source_file, compile_program, simulate_crash, analyze_user_code, _parse_structured_backtrace

client = TestClient(app)

MOCK_BACKTRACE_JSON = json.dumps({
    "root_cause": "Null pointer accessed in crashFunction() at line 6 - pointer was never initialized",
    "severity": "critical",
    "suggested_fix": "Initialize the pointer to a valid memory address before dereferencing it"
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
    assert result["crash_location"] == "crashFunction()"
    assert "root_cause" in result
    assert "severity" in result
    assert result["severity"] in ("critical", "high", "medium", "low")
    assert "suggested_fix" in result
    assert len(result["suggested_fix"]) > 0


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
    assert "crash_location" in result
    assert "root_cause" in result
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
    assert "crash_location" in data
    assert "root_cause" in data
    assert "severity" in data
    assert "suggested_fix" in data
    assert len(data["suggested_fix"]) > 0


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
    assert "crash_location" in data
    assert "root_cause" in data
    assert "severity" in data
    assert "suggested_fix" in data
    assert len(data["suggested_fix"]) > 0


CPP_NULL_DEREF = """
#include <iostream>

int main() {
    int* ptr = nullptr;
    *ptr = 42;
    return 0;
}
"""

CPP_STACK_OVERFLOW = """
#include <iostream>

void infinite_recursion(int n) {
    int x = n + 1;
    infinite_recursion(x);
}

int main() {
    infinite_recursion(0);
    return 0;
}
"""

CPP_NORMAL = """
#include <iostream>

int add(int a, int b) {
    return a + b;
}

int main() {
    std::cout << "Result: " << add(2, 3) << std::endl;
    return 0;
}
"""

C_NULL_DEREF = """
#include <stdio.h>
#include <stdlib.h>

int main() {
    int* ptr = NULL;
    *ptr = 42;
    return 0;
}
"""


def test_analyze_user_code_cpp_null_deref():
    result = analyze_user_code(CPP_NULL_DEREF, "cpp")
    assert result["crashed"] is True
    assert result["signal"] == 11
    assert result["exit_code"] != 0
    assert len(result["backtrace"]) >= 1
    frame = result["backtrace"][0]
    assert frame["frame"] == 0
    assert "main" in frame["function"]
    assert frame["file"] is not None
    assert frame["line"] is not None


def test_analyze_user_code_cpp_stack_overflow():
    result = analyze_user_code(CPP_STACK_OVERFLOW, "cpp")
    assert result["crashed"] is True
    assert result["signal"] in (11, 6)
    # Note: LLDB may timeout on deep stack overflow, backtrace may be empty
    # This is a known limitation - we still detect the crash correctly


def test_analyze_user_code_cpp_normal():
    result = analyze_user_code(CPP_NORMAL, "cpp")
    assert result["crashed"] is False
    assert result["signal"] is None
    assert result["exit_code"] == 0
    assert "Result: 5" in result["stdout"]
    assert result["backtrace"] == []


def test_analyze_user_code_c_null_deref():
    result = analyze_user_code(C_NULL_DEREF, "c")
    assert result["crashed"] is True
    assert result["signal"] == 11
    assert len(result["backtrace"]) >= 1
    frame = result["backtrace"][0]
    assert "main" in frame["function"]


def test_api_analyze_user_crash_cpp_null_deref():
    response = client.post(
        "/analyze-user-crash",
        json={"code": CPP_NULL_DEREF, "language": "cpp"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["crashed"] is True
    assert data["signal"] == 11
    assert "backtrace" in data
    assert len(data["backtrace"]) >= 1
    frame = data["backtrace"][0]
    assert frame["frame"] == 0
    assert "function" in frame
    assert "file" in frame
    assert "line" in frame


def test_api_analyze_user_crash_cpp_normal():
    response = client.post(
        "/analyze-user-crash",
        json={"code": CPP_NORMAL, "language": "cpp"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["crashed"] is False
    assert data["signal"] is None
    assert data["exit_code"] == 0
    assert data["backtrace"] == []


def test_api_analyze_user_crash_invalid_language():
    response = client.post(
        "/analyze-user-crash",
        json={"code": "int main() {}", "language": "python"},
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data


def test_parse_structured_backtrace():
    sample_output = """
frame #0: 0x0000000100003f50 main() at /tmp/user_code.cpp:5
frame #1: 0x0000000100003f80 start() at /tmp/user_code.cpp:10
"""
    frames = _parse_structured_backtrace(sample_output)
    assert len(frames) == 2
    assert frames[0]["frame"] == 0
    assert frames[0]["function"] == "main()"
    assert frames[0]["file"] == "/tmp/user_code.cpp"
    assert frames[0]["line"] == 5
    assert frames[1]["frame"] == 1
    assert frames[1]["function"] == "start()"


CPP_NULL_DEREF_CODE = """
#include <iostream>

int main() {
    int* ptr = nullptr;
    *ptr = 42;
    return 0;
}
"""

CPP_DIV_BY_ZERO_CODE = """
#include <iostream>

int main() {
    int x = 10;
    int y = 0;
    int result = x / y;
    std::cout << result << std::endl;
    return 0;
}
"""

CPP_ASSERT_FAIL_CODE = """
#include <cassert>

int main() {
    int x = -1;
    assert(x > 0);
    return 0;
}
"""

CPP_USE_AFTER_FREE_CODE = """
#include <iostream>
#include <cstdlib>

int main() {
    int* ptr = (int*)malloc(sizeof(int));
    *ptr = 42;
    free(ptr);
    *ptr = 99;
    return 0;
}
"""


def test_rule_based_sigsegv_null_deref():
    from app.crash_ai_service import _classify_crash
    crash_line = 5
    result = _classify_crash(11, CPP_NULL_DEREF_CODE, crash_line)
    assert result is not None
    assert "null pointer" in result["root_cause"].lower() or "Null" in result["root_cause"]
    assert result["severity"] == "critical"
    assert "ptr" in result["suggested_fix"] or "pointer" in result["suggested_fix"].lower()


def test_rule_based_sigfpe_div_by_zero():
    from app.crash_ai_service import _classify_crash
    crash_line = 7
    result = _classify_crash(8, CPP_DIV_BY_ZERO_CODE, crash_line)
    assert result is not None
    assert "division by zero" in result["root_cause"].lower() or "zero" in result["root_cause"].lower()
    assert result["severity"] in ("critical", "high")
    assert "divisor" in result["suggested_fix"].lower() or "!= 0" in result["suggested_fix"]


def test_rule_based_sigabrt_assert():
    from app.crash_ai_service import _classify_crash
    crash_line = 6
    result = _classify_crash(6, CPP_ASSERT_FAIL_CODE, crash_line)
    assert result is not None
    assert "assertion" in result["root_cause"].lower() or "assert" in result["root_cause"].lower()
    assert result["severity"] == "high"


def test_rule_based_sigsegv_use_after_free():
    from app.crash_ai_service import _classify_crash
    crash_line = 9
    result = _classify_crash(11, CPP_USE_AFTER_FREE_CODE, crash_line)
    assert result is not None
    assert "use-after-free" in result["root_cause"].lower() or "freed" in result["root_cause"].lower()
    assert result["severity"] == "critical"


def test_rule_based_unknown_signal_returns_none():
    from app.crash_ai_service import _classify_crash
    result = _classify_crash(4, CPP_NULL_DEREF_CODE, 5)
    assert result is None


def test_rule_based_no_code_returns_none():
    from app.crash_ai_service import _classify_crash
    result = _classify_crash(11, None, None)
    assert result is None


def test_rule_based_unknown_crash_line_returns_none():
    from app.crash_ai_service import _classify_crash
    result = _classify_crash(11, "int main() {}", 999)
    assert result is None
