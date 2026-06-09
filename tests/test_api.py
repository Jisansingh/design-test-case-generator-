"""
Basic API tests for the AI Test Generator.

These tests use FastAPI's TestClient to send real requests
to the application. They require a valid GROQ_API_KEY in the
.env file because they call the real LLM to generate tests.
"""

from fastapi.testclient import TestClient
from app.main import app

# Create a test client that sends requests to the app
# without needing to start the server
client = TestClient(app)


def test_root_returns_200_and_correct_message():
    """
    Test 1: GET /
    Checks that the root endpoint is working and returns
    the expected welcome message.
    """
    # Send a GET request to the root URL
    response = client.get("/")

    # The endpoint should always return 200 OK
    assert response.status_code == 200

    # Parse the JSON response
    data = response.json()

    # Verify the message field contains the expected text
    assert data["message"] == "AI Test Generator is running"


def test_generate_tests_returns_categories():
    """
    Test 2: POST /generate-tests
    Sends a design description and checks that the response
    contains the three test categories.
    """
    # Send a POST request with a sample design
    response = client.post(
        "/generate-tests",
        json={"design": "Build a login API with email and password authentication"}
    )

    # Check that the request was successful
    assert response.status_code == 200

    # Parse the response body
    data = response.json()

    # The response should have all three category fields
    assert "functional" in data
    assert "edge_cases" in data
    assert "security" in data

    # Each category should contain at least one test case
    assert len(data["functional"]) > 0
    assert len(data["edge_cases"]) > 0
    assert len(data["security"]) > 0


def test_execute_tests_returns_summary_with_counts():
    """
    Test 3: POST /execute-tests
    Runs the test cases and checks that the summary
    contains total, passed, and failed counts.
    """
    # Send a POST request to execute tests
    response = client.post(
        "/execute-tests",
        json={"design": "Build a login API with email and password authentication"}
    )

    # Check that the request was successful
    assert response.status_code == 200

    # Parse the response body
    data = response.json()

    # The response should have a summary section
    assert "summary" in data

    # The summary should have count fields
    assert "total" in data["summary"]
    assert "passed" in data["summary"]
    assert "failed" in data["summary"]

    # The counts should add up correctly
    assert data["summary"]["total"] == data["summary"]["passed"] + data["summary"]["failed"]


def test_generate_report_contains_report_text():
    """
    Test 4: POST /generate-report
    Generates a plain text report and checks that the
    response contains the report with the correct title.
    """
    # Send a POST request to generate a report
    response = client.post(
        "/generate-report",
        json={"design": "Build a login API with email and password authentication"}
    )

    # Check that the request was successful
    assert response.status_code == 200

    # Parse the response body
    data = response.json()

    # The response should have a report field
    assert "report" in data

    # The report text should contain the title
    assert "AI TEST EXECUTION REPORT" in data["report"]


def test_generate_code_with_explicit_language():
    """
    Test 5: POST /generate-code with explicit language
    Verifies that specifying a language returns code in that language.
    """
    response = client.post(
        "/generate-code",
        json={"design": "A function that adds two numbers", "language": "python"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "python"
    assert len(data["code"]) > 0


def test_generate_code_with_unsupported_language_returns_400():
    """
    Test 6: POST /generate-code with unsupported language
    Verifies that an invalid language returns a 400 error.
    """
    response = client.post(
        "/generate-code",
        json={"design": "A function that adds two numbers", "language": "rust"}
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "Unsupported language" in data["detail"]


def test_generate_code_detects_frontend_keyword():
    """
    Test 7: POST /generate-code without language but with frontend keywords
    Verifies that UI-related descriptions default to React.
    """
    response = client.post(
        "/generate-code",
        json={"design": "Build a login page with email and password fields"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "react"


def test_generate_code_defaults_to_cpp():
    """
    Test 8: POST /generate-code without language for non-UI description
    Verifies that non-frontend descriptions default to C++
    and GTest code is generated.
    """
    response = client.post(
        "/generate-code",
        json={"design": "Binary search algorithm implementation"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "cpp"
    assert "gtest_code" in data
    assert len(data["gtest_code"]) > 0


def test_cpp_generation_includes_gtest():
    """
    Test 9: POST /generate-code with C++ language
    Verifies that C++ code generation includes GTest code
    with proper Google Test macros.
    """
    response = client.post(
        "/generate-code",
        json={"design": "Calculator system", "language": "cpp"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "cpp"
    assert "gtest_code" in data
    assert "#include <gtest/gtest.h>" in data["gtest_code"]
    assert "TEST(" in data["gtest_code"]


def test_cpp_login_system_generates_gtest():
    """
    Test 10: POST /generate-code with 'Login system' design in C++
    Verifies that a login system generates both implementation and GTest code.
    """
    response = client.post(
        "/generate-code",
        json={"design": "Login system", "language": "cpp"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "cpp"
    assert len(data["code"]) > 0
    assert "gtest_code" in data
    assert len(data["gtest_code"]) > 0
    assert "EXPECT_EQ" in data["gtest_code"] or "EXPECT_TRUE" in data["gtest_code"]


def test_non_cpp_language_no_gtest():
    """
    Test 11: POST /generate-code with non-C++ language
    Verifies that non-C++ languages do not include gtest_code.
    """
    response = client.post(
        "/generate-code",
        json={"design": "A function that adds two numbers", "language": "python"}
    )

    assert response.status_code == 200
    data = response.json()
    assert "gtest_code" not in data
