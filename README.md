# AI Test Generator

A Python-based API that generates software test cases from a plain-text design description using Groq AI (powered by Llama 3.1). Built with FastAPI during an internship project.


## Overview

This project takes a design description (like "Build a login API with email and password authentication"), sends it to the Groq LLM, and gets back a set of test cases organised into three categories: functional, edge cases, and security. These test cases can then be "executed" using a simple rule-based simulation that returns PASS/FAIL results with remarks. You can also generate and download a plain-text execution report.

The execution is **not** running real tests against an actual application. It uses keyword-based rules to simulate whether a test would pass or fail. This was done to demonstrate the workflow without needing a real system under test.

---

## Features

- Generate test cases from a design description using Groq AI (Llama 3.1)
- Test cases are categorised into:
  - **Functional** — expected behaviour and happy paths
  - **Edge Cases** — boundary values, empty inputs, special characters
  - **Security** — SQL injection, XSS, expired tokens, rate limiting
- Simulate test execution with PASS/FAIL results and descriptive remarks
- Generate a human-readable execution report
- Download the report as a `.txt` file
- All endpoints accept and return JSON
- Automated API tests using pytest and FastAPI TestClient
- Continuous integration via GitHub Actions

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Python 3.13 | Programming language |
| FastAPI | Web framework for building the API |
| Uvicorn | ASGI server to run the application |
| Groq (Groq SDK) | LLM provider for generating test cases |
| Llama 3.1 8B | AI model used for test generation |
| Pydantic | Request/response validation |
| Pytest | API testing |
| HTTPX | HTTP client used by FastAPI TestClient |
| GitHub Actions | CI pipeline |

---

## Project Structure

```
ai-test-generator/
├── .env                    # Groq API key (not committed)
├── .github/
│   └── workflows/
│       └── python-app.yml  # CI pipeline definition
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI app and all endpoints
│   ├── schemas.py          # Pydantic models (DesignInput, TestCases)
│   ├── llm_service.py      # Calls Groq API to generate test cases
│   └── execution_service.py# Simulates execution and builds reports
├── tests/
│   ├── __init__.py
│   └── test_api.py         # Pytest tests for all endpoints
├── requirements.txt
├── test.py                 # Standalone script to test Groq API
└── README.md
```

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ai-test-generator.git
cd ai-test-generator
```

### 2. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate      # On Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure the .env file

Create a `.env` file in the project root with your Groq API key:

```
GROQ_API_KEY=gsk_your_api_key_here
```

You can get a free API key from [console.groq.com](https://console.groq.com).

---

## Running the Application

Start the server with:

```bash
uvicorn app.main:app --reload
```

The API will be available at: `http://127.0.0.1:8000`

---

## Swagger Documentation

FastAPI automatically generates interactive API documentation at:

- **Swagger UI:** http://127.0.0.1:8000/docs
- **ReDoc:** http://127.0.0.1:8000/redoc

You can test all endpoints directly from the Swagger UI without using a separate HTTP client.

---

## API Endpoints

### GET /

Health check endpoint. Returns a simple message to confirm the server is running.

**Request:** None

**Response:**
```json
{
  "status": "ok",
  "message": "AI Test Generator is running"
}
```

---

### POST /generate-tests

Generates test cases from a design description using Groq AI.

**Request Body:**
```json
{
  "design": "Build a login API with email and password authentication"
}
```

**Response:**
```json
{
  "functional": [
    "Verify login with valid email and password returns a JWT token",
    "Verify login with incorrect password returns 401 Unauthorized"
  ],
  "edge_cases": [
    "Verify login fails gracefully when email contains unicode characters"
  ],
  "security": [
    "Verify SQL injection in email field is rejected",
    "Verify expired JWT returns 401 and does not reveal user data"
  ]
}
```

---

### POST /execute-tests

Generates test cases and then simulates running them. Returns PASS/FAIL results for each test along with a summary.

**Request Body:**
```json
{
  "design": "Build a login API with email and password authentication"
}
```

**Response:**
```json
{
  "summary": {
    "total": 6,
    "passed": 4,
    "failed": 2
  },
  "functional": [
    {
      "test_case": "Verify login with valid credentials returns a token",
      "status": "PASS",
      "remarks": "Test executed successfully"
    }
  ],
  "edge_cases": [
    {
      "test_case": "Verify login with empty password returns error",
      "status": "FAIL",
      "remarks": "Application did not reject empty password"
    }
  ],
  "security": [
    {
      "test_case": "Verify SQL injection in email field is rejected",
      "status": "PASS",
      "remarks": "SQL injection attempt was blocked"
    }
  ]
}
```

---

### POST /generate-report

Generates test cases, executes them, and returns a plain-text report as JSON.

**Request Body:**
```json
{
  "design": "Build a login API with email and password authentication"
}
```

**Response:**
```json
{
  "report": "==================================================\n           AI TEST EXECUTION REPORT\n==================================================\n..."
}
```

The `report` field contains a human-readable formatted string.

---

### POST /download-report

Generates test cases, executes them, builds a report, and returns the report as a downloadable `.txt` file.

**Request Body:**
```json
{
  "design": "Build a login API with email and password authentication"
}
```

**Response:** A file download (`report.txt`) with `Content-Type: text/plain`.

---

## Running Tests

The project includes automated API tests using pytest. These tests make real requests to the Groq API, so you need a valid `GROQ_API_KEY` in your `.env` file.

```bash
# Activate the virtual environment
source venv/bin/activate

# Run all tests
python3 -m pytest tests/test_api.py -v
```

The test suite covers:
- `GET /` — checks status code and response message
- `POST /generate-tests` — checks that all three categories are returned
- `POST /execute-tests` — checks that the summary contains total, passed, and failed counts
- `POST /generate-report` — checks that the report contains the title

---

## CI/CD

This project uses GitHub Actions for continuous integration. The workflow is defined in `.github/workflows/python-app.yml`.

On every push or pull request to the `main` branch, the CI pipeline:
1. Checks out the code
2. Sets up Python 3.13
3. Installs dependencies from `requirements.txt`
4. Verifies Python syntax for all source files using `py_compile`

The CI pipeline does **not** run the pytest suite because the tests require a Groq API key, which is not configured in the CI environment.

---

## Future Scope

- Replace the rule-based simulation with real test execution against an actual system under test
- Add support for multiple LLM providers (OpenAI, Anthropic, etc.)
- Store test results in a database for historical tracking
- Add endpoint for viewing past reports
- Add authentication and rate limiting to the API itself
- Export reports in PDF format

---

## Frontend Integration

This repository contains the **backend API only**. Any frontend or client application that wants to use this API can send HTTP requests to the endpoints listed above. The API returns JSON responses (or a file download for `/download-report`), so it can be consumed by any web or mobile application.

---

## Contributors

- **Jisan Singh** — Intern developer

---
