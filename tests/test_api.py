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
