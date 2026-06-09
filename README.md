# AI-Powered Test Case Generator

An AI-driven pipeline that generates source code, categorized test cases, simulated execution results, downloadable reports, and crash analysis — all from a plain-text software design description.

The backend is powered by FastAPI and uses Groq's Llama 3.1 8B model for AI generation. The execution engine uses keyword-based rules to simulate test results. Crash analysis uses a compiled C++ program with LLDB backtrace extraction and AI-powered root cause analysis.

---

## Overview

Describe any feature or design in natural language, and the system produces:

- **Source code** in C, C++, Python, Java, JavaScript, or React (auto-detected or user-specified)
- **Test cases** organized into functional, edge case, and security categories
- **Google Test (GTest) code** for C++ implementations
- A **simulated execution** of those tests with PASS/FAIL results
- A **formatted report** available for download as a `.txt` file
- **Crash simulation and backtrace extraction** for C++ programs
- **AI-powered crash report analysis** identifying the issue, root cause, and suggested fixes

---

## Features

- **Multi-Language Code Generation** — Generate code in C, C++, Python, Java, JavaScript, or React
- **Automatic Language Detection** — Frontend/UI descriptions default to React; everything else defaults to C++; can be overridden explicitly
- **Test Case Generation** — Categorized test cases via LLM:
  - **Functional** — expected behavior, happy paths, basic validation
  - **Edge Cases** — empty/null inputs, boundary values, special characters, large payloads
  - **Security** — SQL injection, XSS, expired tokens, rate limiting, CSRF
- **Google Test Generation** — For C++ code, generates GTest unit tests with `TEST()`, `EXPECT_EQ`, `EXPECT_TRUE`, and `EXPECT_FALSE`
- **Test Execution** — Rule-based simulation returning PASS/FAIL per test with remarks
- **Execution Summary** — Total/passed/failed counts
- **Report Generation** — Human-readable plain-text report
- **Report Download** — Download the report as `report.txt`
- **Crash Simulation** — Compiles a C++ program with debug symbols (`-g`) and triggers a null-pointer dereference crash
- **Backtrace Extraction** — Runs the crashed program under LLDB and extracts a full stack backtrace
- **AI Crash Analysis** — Analyzes a backtrace using the LLM to identify the likely issue, root cause, and suggested fixes
- **Frontend Interface** — Chat-style UI with bottom prompt bar, pipeline progress indicator, and tabbed results
- **Swagger/OpenAPI** — Interactive API documentation at `/docs`
- **CI/CD** — GitHub Actions workflow with syntax verification on push/PR

---

## System Architecture

```
                        ┌──────────────────────────────────┐
                        │          Frontend                │
                        │       React + Vite :5173          │
                        └────────────┬─────────────────────┘
                                     │ /api (proxied)
                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI :8000)                    │
│                                                                  │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  LLM Service   │  │  Crash       │  │  Crash AI          │   │
│  │  (code +       │  │  Service     │  │  Service           │   │
│  │   tests)       │  │  (simulate   │  │  (analyze          │   │
│  └───────┬────────┘  │   & extract) │  │   backtrace)       │   │
│          │           └──────────────┘  └────────────────────┘   │
│          ▼                                                      │
│  ┌────────────────┐                                             │
│  │  Execution     │                                             │
│  │  Engine        │                                             │
│  │  (rule-based)  │                                             │
│  └───────┬────────┘                                             │
│          ▼                                                      │
│  ┌────────────────┐                                             │
│  │  Report        │                                             │
│  │  Generator     │                                             │
│  └────────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────┐    ┌──────────────────────┐
│   Groq LLM      │    │  g++ / LLDB          │
│   Llama 3.1     │    │  (crash analysis)     │
└─────────────────┘    └──────────────────────┘
```

### Pipeline Flow (Test Generation)

1. The user enters a design description in the frontend
2. The frontend calls the backend API sequentially through the pipeline
3. The backend invokes the Groq LLM to generate code and test cases
4. Test cases pass through the rule-based execution engine
5. Results are formatted into a report and returned to the frontend

### Crash Analysis Flow

1. `POST /analyze-crash` — writes a C++ source file, compiles with `-g`, runs under LLDB, extracts the backtrace
2. `POST /analyze-crash-report` — sends the backtrace to the LLM, which identifies the issue, root cause, and suggestions

---

## Technology Stack

### Frontend

| Tool | Purpose |
|---|---|
| React 18 | UI framework |
| Vite 6 | Development server and build tool |
| CSS | Styling (dark theme, no external libraries) |

### Backend

| Tool | Purpose |
|---|---|
| Python 3.13 | Programming language |
| FastAPI | Web framework |
| Uvicorn | ASGI server |
| Pydantic | Request/response validation |
| Groq SDK | LLM API client |
| Python-dotenv | Environment variable loading |

### AI

| Tool | Purpose |
|---|---|
| Groq API | LLM provider |
| Llama 3.1 8B Instant | Model used for code, test, and crash analysis generation |

### Crash Analysis

| Tool | Purpose |
|---|---|
| g++ (Clang) | C++ compiler with debug symbol support (`-g`) |
| LLDB | Debugger for backtrace extraction |

### CI/CD

| Tool | Purpose |
|---|---|
| GitHub Actions | Automated syntax verification on push/PR |

---

## Workflow

### Test Generation Pipeline

```
Design Description
       │
       ▼
  ┌────────────┐
  │  Generate  │
  │   Code     │──── JSON: { language, code [, gtest_code] }
  └────────────┘
       │
       ▼
  ┌────────────┐
  │  Generate  │
  │   Tests    │──── JSON: { functional[], edge_cases[], security[] }
  └────────────┘
       │
       ▼
  ┌────────────┐
  │  Execute   │
  │   Tests    │──── JSON: { summary, functional[], edge_cases[], security[] }
  └────────────┘
       │
       ▼
  ┌────────────┐
  │  Generate  │
  │   Report   │──── JSON: { report: "..." }
  └────────────┘
       │
       ▼
  ┌────────────┐
  │  Download  │
  │   Report   │──── File: report.txt
  └────────────┘
```

### Crash Analysis Pipeline

```
  ┌──────────────────┐
  │  Crash Simulation│
  │  (compile + run) │──── Backtrace: ["#0 crashFunction()", ...]
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │  AI Analysis     │──── JSON: { issue, root_cause, suggestions }
  └──────────────────┘
```

---

## API Endpoints

### GET /

Health check endpoint.

**Request:** None

**Response:**
```json
{
  "status": "ok",
  "message": "AI Test Generator is running"
}
```

---

### POST /generate-code

Generates code in the specified (or auto-detected) language. Supports C, C++, Python, Java, JavaScript, and React. For C++, also generates Google Test code.

**Request Body:**
```json
{
  "design": "A counter button that increments on click",
  "language": "react"
}
```

The `language` field is optional. If omitted, the language is auto-detected from the design description:
- Frontend/UI keywords (frontend, react, ui, dashboard, webpage, login page, form, etc.) → React
- Everything else → C++

**Response (C++ with GTest):**
```json
{
  "language": "cpp",
  "code": "#include <iostream>\nint add(int a, int b) { return a + b; }\n...",
  "gtest_code": "#include <gtest/gtest.h>\n#include \"implementation.h\"\nTEST(CalculatorTest, Add) {\n  EXPECT_EQ(add(2, 3), 5);\n}"
}
```

**Response (non-C++):**
```json
{
  "language": "python",
  "code": "def greet(name):\n    return f\"Hello, {name}!\""
}
```

**Validation:**
- `design` cannot be empty (returns 400)
- `language` must be one of: `c`, `cpp`, `python`, `java`, `javascript`, `react` (returns 400 if invalid)

---

### POST /generate-tests

Generates categorized test cases from a design description using Groq AI.

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

Generates test cases, simulates execution, and returns PASS/FAIL results with a summary.

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

Generates test cases, executes them, and returns a plain-text report.

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

---

### POST /download-report

Generates test cases, executes them, builds a report, and returns it as a downloadable `.txt` file.

**Request Body:**
```json
{
  "design": "Build a login API with email and password authentication"
}
```

**Response:** File download (`report.txt`) with `Content-Type: text/plain; charset=utf-8`.

---

### POST /analyze-crash

Simulates a C++ crash, compiles a test program with debug symbols (`-g`), runs it under LLDB, and extracts the backtrace.

**Request:** None (no request body required)

**Response:**
```json
{
  "status": "crashed",
  "backtrace": [
    "#0 crashFunction()",
    "#1 processRequest()",
    "#2 main",
    "#3 start"
  ]
}
```

**Requirements:** `g++` and `lldb` must be installed on the system.

---

### POST /analyze-crash-report

Analyzes a crash backtrace using the Groq LLM and returns an AI-generated diagnosis with suggested fixes.

**Request Body:**
```json
{
  "backtrace": [
    "#0 crashFunction()",
    "#1 processRequest()",
    "#2 main()"
  ]
}
```

**Response:**
```json
{
  "issue": "Null pointer dereference",
  "root_cause": "Null pointer accessed in crashFunction() at line 6",
  "suggestions": [
    "Initialize pointer before use",
    "Add null checks before dereferencing",
    "Use smart pointers instead of raw pointers"
  ]
}
```

**Validation:** `backtrace` cannot be empty (returns 400).

---

## Frontend Features

The frontend is a single-page React application with a dark-themed chat-style interface:

- **Bottom Prompt Bar** — Fixed input at the bottom of the screen with Enter-to-submit and Shift+Enter for newlines
- **Pipeline Progress Indicator** — Horizontal step indicator showing Code → Tests → Execute → Report with green checkmarks for completed steps
- **Prompt Summary Card** — Displays the submitted design description above the tabs
- **Tabbed Results** — Three tabs organize the output:
  - **Code** — Generated component code in a code card with macOS-style window dots
  - **Tests** — Execution summary dashboard (total/passed/failed counts with progress bar) followed by categorized test results with PASS/FAIL badges
  - **Report** — Cleanly formatted plain-text report with a download button
- **Loading States** — Different loading screens for each pipeline phase, preserving previously generated content
- **Error Handling** — Full-screen error for code generation failure; inline error banners for test/execution/report failures

---

## Installation and Setup

### Prerequisites

- Python 3.13+
- Node.js 18+ (for frontend)
- `g++` / `clang++` (for crash analysis)
- `lldb` (for backtrace extraction; macOS default)

### Backend

```bash
# 1. Clone the repository
git clone https://github.com/Jisansingh/design-test-case-generator-.git
cd ai-test-generator

# 2. Create a virtual environment
python3 -m venv venv
source venv/bin/activate    # On Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
echo "GROQ_API_KEY=gsk_your_api_key_here" > .env

# 5. Start the backend server
uvicorn app.main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.

### Frontend

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`. It proxies `/api` requests to the backend at `http://localhost:8000`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | Yes | Groq API key for LLM access. Get one at [console.groq.com](https://console.groq.com) |

---

## Running Tests

The project includes automated tests using pytest and FastAPI's TestClient. The tests make real requests to the Groq API and the system compiler/debugger, so a valid `GROQ_API_KEY`, `g++`, and `lldb` must be available.

```bash
source venv/bin/activate

# Run all tests
python -m pytest tests/ -v

# Run only API tests
python -m pytest tests/test_api.py -v

# Run only crash analysis tests
python -m pytest tests/test_crash.py -v
```

### Test Coverage (23 tests)

**API tests** (`tests/test_api.py` — 11 tests):
- `GET /` — status code and response message
- `POST /generate-tests` — all three categories returned with content
- `POST /execute-tests` — summary with total/passed/failed counts that add up
- `POST /generate-report` — report contains the title header
- `POST /generate-code` — explicit language selection (Python, C++, unsupported)
- `POST /generate-code` — automatic language detection (frontend → React, non-UI → C++)
- `POST /generate-code` — C++ generates GTest code with `#include <gtest/gtest.h>` and `TEST()` macros
- `POST /generate-code` — non-C++ languages do not include `gtest_code`

**Crash analysis tests** (`tests/test_crash.py` — 12 tests):
- Source file creation and content verification
- C++ program compilation with debug symbols
- Crash simulation returns valid backtrace with expected function names
- Backtrace frames in correct order
- `POST /analyze-crash` — API returns JSON with backtrace
- AI backtrace analysis — returns expected structure (issue, root_cause, suggestions)
- AI analysis correctly identifies null pointer dereference
- `POST /analyze-crash-report` — API returns JSON with diagnosis
- `POST /analyze-crash-report` — empty backtrace returns 400
- Full pipeline: crash simulation → backtrace extraction → AI analysis

---

## CI/CD

The GitHub Actions workflow (`.github/workflows/python-app.yml`) runs on every push or pull request to the `main` branch:

1. Checks out the code
2. Sets up Python 3.13
3. Installs dependencies from `requirements.txt`
4. Verifies Python syntax for all source files using `py_compile`

The pipeline validates syntax only. It does not run the pytest suite because the tests require a Groq API key and system tools (g++, lldb) that are not available in the CI environment.

---

## Project Structure

```
ai-test-generator/
├── .env                          # Groq API key (not committed)
├── .gitignore
├── requirements.txt
├── test.py                       # Standalone script to test Groq API connectivity
├── README.md
│
├── .github/
│   └── workflows/
│       └── python-app.yml        # GitHub Actions CI pipeline
│
├── app/                          # Backend application
│   ├── __init__.py
│   ├── main.py                   # FastAPI app, CORS, and all API routes
│   ├── schemas.py                # Pydantic models (DesignInput, TestCases, CodeGenOutput, ...)
│   ├── llm_service.py            # Groq LLM client — code and test case generation
│   ├── execution_service.py      # Rule-based test execution and report formatting
│   ├── crash_service.py          # C++ crash simulation, compilation, and backtrace extraction
│   └── crash_ai_service.py       # AI-powered backtrace analysis using Groq LLM
│
├── tests/                        # Backend tests
│   ├── __init__.py
│   ├── test_api.py               # API endpoint tests (11 tests)
│   └── test_crash.py             # Crash analysis tests (12 tests)
│
└── frontend/                     # React frontend application
    ├── index.html
    ├── package.json
    ├── vite.config.js            # Vite config with proxy settings
    └── src/
        ├── main.jsx              # React entry point
        ├── App.jsx               # Main layout — header, results area, prompt bar
        ├── App.css               # Global styles and app layout
        ├── useAppState.js        # Custom hook — all state management and API calls
        └── components/
            ├── ResultsPanel.jsx  # Tabbed results, pipeline indicator, code/tests/report panes
            └── ResultsPanel.css  # All component styles
```

---

## API Documentation

FastAPI generates interactive OpenAPI documentation automatically:

- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

All endpoints can be tested directly from the Swagger UI.

---

## Future Improvements

- **Advanced Execution Engine** — Replace rule-based simulation with real test execution against an actual system under test
- **Additional Test Categories** — Add performance, accessibility, and integration test categories
- **Cloud Deployment** — Deploy the backend and frontend to cloud infrastructure
- **Performance Optimization** — Caching, streaming LLM responses, and request batching
- **Analytics Dashboard** — Track generation history, pass rates over time, and trend visualizations
- **Multiple LLM Providers** — Support OpenAI, Anthropic, and other providers
- **PDF Export** — Generate and download reports in PDF format
- **Frontend Crash Analysis UI** — Web interface for crash simulation and AI analysis
- **Sandboxed Crash Execution** — Run crash simulations in an isolated container environment

---

## Contributors

- **Jisan Singh**
