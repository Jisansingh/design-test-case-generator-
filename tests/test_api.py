import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Mock responses for Groq LLM API calls

MOCK_TEST_RESPONSE = json.dumps({
    "functional": [
        "Verify login with valid email and password returns a JWT token",
        "Verify login with incorrect password returns 401 Unauthorized"
    ],
    "edge_cases": [
        "Verify login fails gracefully when email contains unicode characters",
        "Verify login with exactly 255-character password processes correctly"
    ],
    "security": [
        "Verify SQL injection in email field is rejected",
        "Verify brute force login attempts are rate limited"
    ]
})

MOCK_PYTHON_CODE = "```python\ndef add(a, b):\n    return a + b\n```"

MOCK_REACT_CODE = """```jsx
function LoginPage() {
  return <div>Login Page</div>;
}
export default LoginPage;
```"""

MOCK_CPP_CODE = """```cpp
#include <iostream>
int binarySearch(int arr[], int l, int r, int x) {
    if (r >= l) {
        int mid = l + (r - l) / 2;
        if (arr[mid] == x) return mid;
        if (arr[mid] > x) return binarySearch(arr, l, mid - 1, x);
        return binarySearch(arr, mid + 1, r, x);
    }
    return -1;
}
```"""

MOCK_C_CODE = """```c
#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;
};

struct Node* createNode(int data) {
    struct Node* node = (struct Node*)malloc(sizeof(struct Node));
    node->data = data;
    node->next = NULL;
    return node;
}
```"""

MOCK_JAVASCRIPT_CODE = """```javascript
function filterEvenNumbers(numbers) {
    return numbers.filter(function(num) { return num % 2 === 0; });
}
```"""

MOCK_GTEST_CODE = """```cpp
#include <gtest/gtest.h>

TEST(BinarySearchTest, Found) {
    int arr[] = {1, 2, 3, 4, 5};
    EXPECT_EQ(binarySearch(arr, 0, 4, 3), 2);
}

TEST(BinarySearchTest, NotFound) {
    int arr[] = {1, 2, 3, 4, 5};
    EXPECT_EQ(binarySearch(arr, 0, 4, 10), -1);
}
```"""


def _mock_groq(content):
    mock = MagicMock()
    mock.choices = [MagicMock()]
    mock.choices[0].message.content = content
    return mock


def test_root_returns_200_and_correct_message():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "AI Test Generator is running"


@patch("app.llm_service.client.chat.completions.create")
def test_generate_tests_returns_categories(mock_create):
    mock_create.return_value = _mock_groq(MOCK_TEST_RESPONSE)
    response = client.post(
        "/generate-tests",
        json={"design": "Build a login API with email and password authentication"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "functional" in data
    assert "edge_cases" in data
    assert "security" in data
    assert len(data["functional"]) > 0
    assert len(data["edge_cases"]) > 0
    assert len(data["security"]) > 0


@patch("app.llm_service.client.chat.completions.create")
def test_execute_tests_returns_summary_with_counts(mock_create):
    mock_create.return_value = _mock_groq(MOCK_TEST_RESPONSE)
    response = client.post(
        "/execute-tests",
        json={"design": "Build a login API with email and password authentication"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "total" in data["summary"]
    assert "passed" in data["summary"]
    assert "failed" in data["summary"]
    assert data["summary"]["total"] == data["summary"]["passed"] + data["summary"]["failed"]


@patch("app.llm_service.client.chat.completions.create")
def test_generate_report_contains_report_text(mock_create):
    mock_create.return_value = _mock_groq(MOCK_TEST_RESPONSE)
    response = client.post(
        "/generate-report",
        json={"design": "Build a login API with email and password authentication"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "report" in data
    assert "AI TEST EXECUTION REPORT" in data["report"]


@patch("app.llm_service.client.chat.completions.create")
def test_generate_code_with_explicit_language(mock_create):
    mock_create.return_value = _mock_groq(MOCK_PYTHON_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "A function that adds two numbers", "language": "python"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "python"
    assert len(data["code"]) > 0


def test_generate_code_with_unsupported_language_returns_400():
    response = client.post(
        "/generate-code",
        json={"design": "A function that adds two numbers", "language": "rust"}
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "Unsupported language" in data["detail"]


@patch("app.llm_service.client.chat.completions.create")
def test_generate_code_detects_frontend_keyword(mock_create):
    mock_create.return_value = _mock_groq(MOCK_REACT_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "Build a login page with email and password fields"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "react"


@patch("app.llm_service.client.chat.completions.create")
def test_generate_code_defaults_to_cpp(mock_create):
    mock_create.side_effect = [
        _mock_groq(MOCK_CPP_CODE),
        _mock_groq(MOCK_GTEST_CODE),
    ]
    response = client.post(
        "/generate-code",
        json={"design": "Binary search algorithm implementation"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "cpp"
    assert "gtest_code" in data
    assert len(data["gtest_code"]) > 0


@patch("app.llm_service.client.chat.completions.create")
def test_cpp_generation_includes_gtest(mock_create):
    mock_create.side_effect = [
        _mock_groq(MOCK_CPP_CODE),
        _mock_groq(MOCK_GTEST_CODE),
    ]
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


@patch("app.llm_service.client.chat.completions.create")
def test_cpp_login_system_generates_gtest(mock_create):
    mock_create.side_effect = [
        _mock_groq(MOCK_CPP_CODE),
        _mock_groq(MOCK_GTEST_CODE),
    ]
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


@patch("app.llm_service.client.chat.completions.create")
def test_non_cpp_language_no_gtest(mock_create):
    mock_create.return_value = _mock_groq(MOCK_PYTHON_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "A function that adds two numbers", "language": "python"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "gtest_code" not in data


@patch("app.llm_service.client.chat.completions.create")
def test_c_generation_valid_c_code(mock_create):
    mock_create.return_value = _mock_groq(MOCK_C_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "Linked list implementation", "language": "c"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "c"
    assert "#include <stdio.h>" in data["code"]
    assert "#include <stdlib.h>" in data["code"]
    assert "struct" in data["code"]
    assert "malloc" in data["code"]
    assert "gtest_code" not in data


@patch("app.llm_service.client.chat.completions.create")
def test_c_generation_explicit_language(mock_create):
    mock_create.return_value = _mock_groq(MOCK_C_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "Linked list implementation", "language": "c"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "c"
    assert len(data["code"]) > 0


@patch("app.llm_service.client.chat.completions.create")
def test_javascript_generation(mock_create):
    mock_create.return_value = _mock_groq(MOCK_JAVASCRIPT_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "A function that filters even numbers", "language": "javascript"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "javascript"
    assert len(data["code"]) > 0
    assert "function" in data["code"]
    assert "gtest_code" not in data


@patch("app.llm_service.client.chat.completions.create")
def test_react_generation(mock_create):
    mock_create.return_value = _mock_groq(MOCK_REACT_CODE)
    response = client.post(
        "/generate-code",
        json={"design": "Build a login page", "language": "react"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "react"
    assert len(data["code"]) > 0
    assert "export default" in data["code"]
    assert "gtest_code" not in data


def test_all_supported_languages_listed():
    from app.llm_service import SUPPORTED_LANGUAGES
    expected = {"c", "cpp", "python", "java", "javascript", "react"}
    assert SUPPORTED_LANGUAGES == expected
