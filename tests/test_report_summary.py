"""Test consistent summary schema across generate-tests, execute-tests, generate-report."""

import json
import io
import zipfile
from unittest.mock import patch
from fastapi.testclient import TestClient

MOCK_TESTS = {"functional": ["fn"], "edge_cases": ["ec"], "security": ["sec"]}
MOCK_TESTS2 = {"functional": ["fn2"], "edge_cases": ["ec2"], "security": ["sec2"]}
MOCK_EXEC = {
    "summary": {"total": 3, "passed": 2, "failed": 1},
    "functional": [{"test_case": "t1", "status": "PASS", "remarks": "ok"}],
    "edge_cases": [],
    "security": [],
}
MOCK_EXEC2 = {
    "summary": {"total": 3, "passed": 3, "failed": 0},
    "functional": [{"test_case": "t1", "status": "PASS", "remarks": "ok"}],
    "edge_cases": [],
    "security": [],
}


def _make_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("src/main.py", "def add(a, b): return a + b")
        zf.writestr("src/utils.py", "def sub(a, b): return a - b")
        zf.writestr("README.md", "# Test")
    buf.seek(0)
    return buf


def _upload_repo(client):
    resp = client.post("/upload-repository", files={"file": ("test.zip", _make_zip(), "application/zip")})
    return resp.json()["data"]["repository_id"]


PATCH_TARGETS = {
    "generate_test_cases": "app.main.generate_test_cases",
    "execute_test_cases": "app.main.execute_test_cases",
    "generate_text_report": "app.main.generate_text_report",
    "generate_combined_repository_report": "app.main.generate_combined_repository_report",
}


class TestSummaryConsistency:
    """Verify the summary dict has consistent keys across all 3 endpoints."""

    EXPECTED_GEN_KEYS = {
        "files_selected", "files_processed", "files_skipped",
        "files_with_errors", "tests_generated",
    }
    EXPECTED_EXEC_KEYS = EXPECTED_GEN_KEYS | {
        "tests_executed", "passed", "failed", "overall_pass_percentage",
    }

    def _make_client(self):
        from app.main import app
        return TestClient(app)

    def test_single_file_summary_keys(self):
        client = self._make_client()
        repo_id = _upload_repo(client)

        with patch(PATCH_TARGETS["generate_test_cases"], return_value=MOCK_TESTS):
            resp = client.post(f"/repositories/{repo_id}/generate-tests", json={"selected_files": ["src/main.py"]})
            d = resp.json()
            assert d["success"]
            gen_keys = set(d["data"]["summary"].keys())
            assert gen_keys == self.EXPECTED_GEN_KEYS, f"Gen keys mismatch: {gen_keys}"
            assert d["data"]["summary"]["tests_generated"] == 3

            tc = d["data"]["files"][0]["test_cases"]

            with patch(PATCH_TARGETS["execute_test_cases"], return_value=MOCK_EXEC):
                resp = client.post(f"/repositories/{repo_id}/execute-tests", json={
                    "selected_files": ["src/main.py"],
                    "test_cases": tc,
                })
                d = resp.json()
                assert d["success"]
                exec_keys = set(d["data"]["summary"].keys())
                assert exec_keys == self.EXPECTED_EXEC_KEYS, f"Exec keys mismatch: {exec_keys}"
                assert d["data"]["summary"]["tests_generated"] == 3
                assert d["data"]["summary"]["tests_executed"] == 3
                assert d["data"]["summary"]["passed"] == 2
                assert d["data"]["summary"]["failed"] == 1

                with patch(PATCH_TARGETS["generate_text_report"], return_value="REPORT"):
                    resp = client.post(f"/repositories/{repo_id}/generate-report", json={
                        "selected_files": ["src/main.py"],
                    })
                    d = resp.json()
                    assert d["success"]
                    rpt_keys = set(d["data"]["summary"].keys())
                    assert rpt_keys == self.EXPECTED_EXEC_KEYS, f"Report keys mismatch: {rpt_keys}"
                    assert d["data"]["summary"]["tests_generated"] == 3
                    assert d["data"]["summary"]["tests_executed"] == 3
                    assert d["data"]["summary"]["passed"] == 2
                    assert d["data"]["summary"]["failed"] == 1
                    assert d["data"]["summary"]["overall_pass_percentage"] == 66.67

        client.delete(f"/repositories/{repo_id}")

    def test_multi_file_summary_keys(self):
        client = self._make_client()
        repo_id = _upload_repo(client)

        with patch(PATCH_TARGETS["generate_test_cases"]) as mg:
            mg.side_effect = [MOCK_TESTS, MOCK_TESTS2]
            resp = client.post(f"/repositories/{repo_id}/generate-tests", json={
                "selected_files": ["src/main.py", "src/utils.py"]
            })
            d = resp.json()
            assert d["success"]
            gen_keys = set(d["data"]["summary"].keys())
            assert gen_keys == self.EXPECTED_GEN_KEYS, f"Multi gen keys mismatch: {gen_keys}"
            assert d["data"]["summary"]["tests_generated"] == 6
            assert d["data"]["summary"]["files_processed"] == 2

            tcm = {f["selected_file"]: f["test_cases"] for f in d["data"]["files"]}

            with patch(PATCH_TARGETS["execute_test_cases"]) as me:
                me.side_effect = [MOCK_EXEC, MOCK_EXEC2]
                resp = client.post(f"/repositories/{repo_id}/execute-tests", json={
                    "selected_files": ["src/main.py", "src/utils.py"],
                    "test_cases_map": tcm,
                })
                d = resp.json()
                assert d["success"]
                exec_keys = set(d["data"]["summary"].keys())
                assert exec_keys == self.EXPECTED_EXEC_KEYS, f"Multi exec keys mismatch: {exec_keys}"
                assert d["data"]["summary"]["tests_generated"] == 6
                assert d["data"]["summary"]["tests_executed"] == 6
                assert d["data"]["summary"]["passed"] == 5
                assert d["data"]["summary"]["failed"] == 1

                em = {f["selected_file"]: f["execution_result"] for f in d["data"]["files"] if f["status"] == "success"}

                with patch(PATCH_TARGETS["generate_combined_repository_report"], return_value="COMBINED REPORT"):
                    resp = client.post(f"/repositories/{repo_id}/generate-report", json={
                        "selected_files": ["src/main.py", "src/utils.py"],
                        "execution_results": em,
                    })
                    d = resp.json()
                    assert d["success"]
                    rpt_keys = set(d["data"]["summary"].keys())
                    assert rpt_keys == self.EXPECTED_EXEC_KEYS, f"Multi report keys mismatch: {rpt_keys}"
                    assert d["data"]["summary"]["tests_generated"] == 6
                    assert d["data"]["summary"]["tests_executed"] == 6
                    assert d["data"]["summary"]["passed"] == 5
                    assert d["data"]["summary"]["failed"] == 1

        client.delete(f"/repositories/{repo_id}")

    def test_partial_failure_summary(self):
        client = self._make_client()
        repo_id = _upload_repo(client)

        with patch(PATCH_TARGETS["generate_test_cases"]) as mg:
            mg.side_effect = [MOCK_TESTS, Exception("LLM error")]
            resp = client.post(f"/repositories/{repo_id}/generate-tests", json={
                "selected_files": ["src/main.py", "src/utils.py"]
            })
            d = resp.json()
            assert d["success"]
            s = d["data"]["summary"]
            assert s["files_processed"] == 1
            assert s["files_with_errors"] == 1
            assert s["files_skipped"] == 0
            assert s["tests_generated"] == 3
            assert d["data"]["files"][0]["status"] == "success"
            assert d["data"]["files"][1]["status"] == "error"

        client.delete(f"/repositories/{repo_id}")

    def test_skipped_file_summary(self):
        client = self._make_client()
        repo_id = _upload_repo(client)

        with patch(PATCH_TARGETS["generate_test_cases"], return_value=MOCK_TESTS):
            resp = client.post(f"/repositories/{repo_id}/generate-tests", json={
                "selected_files": ["src/main.py", "README.md"]
            })
            d = resp.json()
            assert d["success"]
            s = d["data"]["summary"]
            assert s["files_processed"] == 1
            assert s["files_skipped"] == 1
            assert s["files_with_errors"] == 0
            assert s["tests_generated"] == 3
            assert d["data"]["files"][0]["status"] == "success"
            assert d["data"]["files"][1]["status"] == "skipped"

        client.delete(f"/repositories/{repo_id}")
