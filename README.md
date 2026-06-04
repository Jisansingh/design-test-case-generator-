# AI-Powered Test Case Generator

An AI-driven pipeline that generates React source code, categorized test cases, simulated execution results, and downloadable reports from a plain-text software design description — all through a modern chat-style web interface.

## Overview

Describe any feature or design in natural language, and the system produces:

- A **React component** implementing the described design
- **Test cases** organized into functional, edge case, and security categories
- A **simulated execution** of those tests with PASS/FAIL results
- A **formatted report** available for download as a `.txt` file

The backend is powered by FastAPI and uses Groq's Llama 3.1 8B model for all AI generation. The execution engine uses keyword-based rules to simulate test results — no real system under test is required.

---

## Features

- **Code Generation** — Generate a single-file React component from a design description
- **Test Case Generation** — Categorized test cases via LLM:
  - **Functional** — expected behavior, happy paths, basic validation
  - **Edge Cases** — empty/null inputs, boundary values, special characters, large payloads
  - **Security** — SQL injection, XSS, expired tokens, rate limiting, CSRF
- **Test Execution** — Rule-based simulation returning PASS/FAIL per test with remarks
- **Execution Summary** — Total/passed/failed counts with a visual progress bar
- **Report Generation** — Human-readable plain-text report
- **Report Download** — Download the report as `report.txt`
- **Frontend Interface** — Chat-style UI with bottom prompt bar, pipeline progress indicator, and tabbed results
- **Swagger/OpenAPI** — Interactive API documentation at `/docs`
- **CI/CD** — GitHub Actions workflow with syntax verification on push/PR

---

## System Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Frontend   │────▶│   Backend   │────▶│  Groq LLM    │
│  React+Vite │     │  FastAPI    │     │  Llama 3.1   │
│  :5173      │     │  :8000      │     │               │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                           ▼
                   ┌───────────────┐
                   │   Execution   │
                   │    Engine     │
                   │  (rule-based) │
                   └───────┬───────┘
                           │
                           ▼
                   ┌───────────────┐
                   │    Report     │
                   │  Generator    │
                   └───────────────┘
```

1. The user enters a design description in the frontend
2. The frontend calls the backend API sequentially through the pipeline
3. The backend invokes the Groq LLM to generate code and test cases
4. Test cases pass through the rule-based execution engine
5. Results are formatted into a report and returned to the frontend

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
| Llama 3.1 8B Instant | Model used for code and test generation |

### CI/CD

| Tool | Purpose |
|---|---|
| GitHub Actions | Automated syntax verification on push/PR |

---

## Workflow

```
Design Description
       │
       ▼
  ┌────────────┐
  │  Generate  │
  │   Code     │──── JSON: { language, code }
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

Generates a single-file React component based on the design description.

**Request Body:**
```json
{
  "design": "A counter button that increments on click"
}
```

**Response:**
```json
{
  "language": "javascript",
  "code": "function Counter() {\n  const [count, setCount] = useState(0);\n  ...\n}\n\nexport default Counter;"
}
```

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

**Response:** File download (`report.txt`) with `Content-Type: text/plain`.

---

## Frontend Features

The frontend is a single-page React application with a dark-themed chat-style interface:

- **Bottom Prompt Bar** — Fixed input at the bottom of the screen with Enter-to-submit and Shift+Enter for newlines
- **Pipeline Progress Indicator** — Horizontal step indicator showing Code → Tests → Execute → Report with green checkmarks for completed steps
- **Prompt Summary Card** — Displays the submitted design description above the tabs
- **Tabbed Results** — Three tabs organize the output:
  - **Code** — Generated React component in a code card with macOS-style window dots
  - **Tests** — Execution summary dashboard (total/passed/failed counts with progress bar) followed by categorized test results with PASS/FAIL badges
  - **Report** — Cleanly formatted plain-text report with a download button
- **Loading States** — Different loading screens for each pipeline phase, preserving previously generated content
- **Error Handling** — Full-screen error for code generation failure; inline error banners for test/execution/report failures

---

## Installation and Setup

### Backend

```bash
# 1. Clone the repository
git clone https://github.com/your-username/ai-test-generator.git
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

The project includes automated API tests using pytest and FastAPI's TestClient. The tests make real requests to the Groq API, so a valid `GROQ_API_KEY` must be configured.

```bash
source venv/bin/activate
python -m pytest tests/test_api.py -v
```

The test suite covers:
- `GET /` — status code and response message
- `POST /generate-tests` — all three categories returned with content
- `POST /execute-tests` — summary with total/passed/failed counts that add up
- `POST /generate-report` — report contains the title header

---

## CI/CD

The GitHub Actions workflow (`.github/workflows/python-app.yml`) runs on every push or pull request to the `main` branch:

1. Checks out the code
2. Sets up Python 3.13
3. Installs dependencies from `requirements.txt`
4. Verifies Python syntax for all source files using `py_compile`

The pipeline validates syntax only. It does not run the pytest suite because the tests require a Groq API key, which is not available in the CI environment.

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
│   ├── schemas.py                # Pydantic models (DesignInput, TestCases, CodeGenOutput, ErrorResponse)
│   ├── llm_service.py            # Groq LLM client — code and test case generation
│   └── execution_service.py      # Rule-based test execution and report formatting
│
├── tests/                        # Backend tests
│   ├── __init__.py
│   └── test_api.py               # Pytest tests for all endpoints
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

## Screenshots

### Swagger Documentation

![Swagger UI](https://via.placeholder.com/800x500?text=Swagger+Documentation)
*Interactive API documentation at /docs*

### Code Generation

![Code Generation](https://via.placeholder.com/800x500?text=Code+Generation)
*Generated React component displayed in the Code tab*

### Test Results

![Test Results](https://via.placeholder.com/800x500?text=Test+Results)
*Execution summary and categorized test results with PASS/FAIL badges*

### Generated Report

![Generated Report](https://via.placeholder.com/800x500?text=Generated+Report)
*Formatted report with download button*

---

## Future Improvements

- **Advanced Execution Engine** — Replace rule-based simulation with real test execution against an actual system under test
- **Additional Test Categories** — Add performance, accessibility, and integration test categories
- **Cloud Deployment** — Deploy the backend and frontend to cloud infrastructure
- **Performance Optimization** — Caching, streaming LLM responses, and request batching
- **Analytics Dashboard** — Track generation history, pass rates over time, and trend visualizations
- **Multiple LLM Providers** — Support OpenAI, Anthropic, and other providers
- **PDF Export** — Generate and download reports in PDF format

---

## Contributors

- **Jisan Singh**
