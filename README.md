# AI Test Generator

An AI-driven pipeline that generates source code, categorized test cases, simulated execution results, and downloadable reports from a plain-text software design description. Supports both single-file AI testing and repository-based AI testing.

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

The platform supports two workflows:

- **Single File AI Testing** - Describe a feature and generate code, tests, and reports through a sequential pipeline.
- **Repository-based AI Testing** - Upload a ZIP repository, analyze and index it with Codebase Memory MCP, browse the file tree, retrieve code context, and generate tests for individual source files.

---

## Features

### Single File Workflow

- **AI Code Generation** - Generate code in C, C++, Python, Java, JavaScript, or React with automatic language detection
- **AI Test Case Generation** - Categorized test cases via LLM (functional, edge cases, security)
- **Google Test Generation** - For C++ code, generates GTest unit tests with `TEST()`, `EXPECT_EQ`, `EXPECT_TRUE`, and `EXPECT_FALSE`
- **Test Execution** - Rule-based simulation returning PASS/FAIL per test with remarks and summary counts
- **Report Generation** - Human-readable plain-text report
- **Report Download** - Download the report as `report.txt`
- **Crash Analysis** - Compiles a C++ program with debug symbols, triggers a crash, extracts a backtrace via LLDB, and analyzes it with the LLM to identify the issue, root cause, and suggested fixes

### Repository Workflow

- **Repository Upload** - Upload a ZIP file containing a code repository
- **Repository Analysis** - Scans the repository files, classifies them by type (supported, context, unsupported, ignored), and detects languages
- **Codebase Memory (CBM) Indexing** - Indexes the repository using Codebase Memory MCP for structural code queries
- **Repository Explorer** - Browse the file tree of the uploaded repository
- **Context Retrieval** - Retrieve code graph symbols (functions, classes, methods) for a selected file from the indexed knowledge graph
- **AI Test Generation** - Generate test cases for individual supported source files using file content and code graph context
- **Test Execution** - Same rule-based simulation for repository-generated tests
- **Report Generation** - Plain-text report for repository tests
- **Report Download** - Download the repository test report

---

## System Workflow

### Single File Workflow

```
Description
    |
    v
Generate Code
    |
    v
Generate Tests
    |
    v
Execute Tests
    |
    v
Generate Report
    |
    v
Download Report
```

### Repository Workflow

```
Upload Repository
    |
    v
Analyze Repository
    |
    v
Index Repository (CBM)
    |
    v
Browse Repository
    |
    v
Retrieve Context
    |
    v
Generate Tests
    |
    v
Execute Tests
    |
    v
Generate Report
    |
    v
Download Report
```

### Crash Analysis Pipeline

```
Crash Simulation (compile + run under LLDB)
    |
    v
AI Backtrace Analysis
    |
    v
Diagnosis (issue, root cause, suggestions)
```

---

## Tech Stack

### Frontend

| Tool | Purpose |
|------|---------|
| React 18 | UI framework |
| Vite | Development server and build tool |
| Tailwind CSS | Styling |
| Monaco Editor | Code editor component |

### Backend

| Tool | Purpose |
|------|---------|
| Python 3.13+ | Programming language |
| FastAPI | Web framework |
| Uvicorn | ASGI server |
| Pydantic | Request/response validation |
| Groq SDK | LLM API client |

### AI

| Tool | Purpose |
|------|---------|
| Groq API | LLM provider |
| Llama 3.1 8B Instant | Model used for code, test, and crash analysis generation |

### Developer Tools

| Tool | Purpose |
|------|---------|
| GCC/G++ | C/C++ compiler with debug symbol support |
| LLDB | Debugger for backtrace extraction |
| Codebase Memory MCP | Repository indexing and code graph queries |
| Google Test (GTest) | Unit test framework for C++ |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | Automated syntax verification on push/PR |

---

## Screenshots

### Dashboard

### AI Workspace

### Repository Upload

### Repository Explorer

### Test Generation

### Test Execution

### Report Generation

---

## Project Structure

```
ai-test-generator/
├── .env                          # API keys (not committed)
├── .gitignore
├── requirements.txt
├── README.md
│
├── .github/
│   └── workflows/
│       └── python-app.yml        # GitHub Actions CI pipeline
│
├── app/                          # Backend application
│   ├── __init__.py
│   ├── main.py                   # FastAPI app, CORS, and all API routes
│   ├── config.py                 # Configuration constants
│   ├── schemas.py                # Pydantic models
│   ├── responses.py              # Response helpers
│   ├── workspace_manager.py      # Project CRUD and file storage
│   ├── repository_service.py     # Repository upload, analysis, indexing, context retrieval
│   ├── indexing_service.py       # Codebase Memory MCP integration
│   ├── llm_service.py            # Groq LLM client for code and test case generation
│   ├── execution_service.py      # Rule-based test execution and report formatting
│   ├── crash_service.py          # C++ crash simulation, compilation, and backtrace extraction
│   ├── crash_ai_service.py       # AI-powered backtrace analysis
│   └── log_setup.py              # Logging configuration
│
├── tests/                        # Backend tests
│   ├── __init__.py
│   ├── test_api.py               # API endpoint tests
│   └── test_crash.py             # Crash analysis tests
│
└── frontend/                     # React frontend application
    ├── index.html
    ├── package.json
    ├── vite.config.js            # Vite config with proxy settings
    └── src/
        ├── main.jsx              # React entry point
        ├── App.jsx               # Main layout with routing
        ├── api/
        │   └── index.js          # Axios-based API client
        ├── pages/
        │   ├── Workspace.jsx     # Main workspace (single-file pipeline)
        │   ├── Projects.jsx      # Project listing and management
        │   ├── ProjectDetail.jsx # Project timeline, files, and reports
        │   ├── Dashboard.jsx     # Recent projects and reports overview
        │   └── Repositories.jsx  # Repository management UI
        ├── components/
        │   └── common/           # Reusable UI components (Button, Card, Badge, Modal, etc.)
        ├── hooks/
        │   ├── useProjects.js    # Project list, delete, and refresh
        │   └── useReports.js     # Report list, delete, and refresh
        ├── context/
        │   └── WorkspaceContext.jsx  # Workspace state context
        └── utils/
            └── formatters.js     # Date, duration, status, and language formatters
```

---

## Installation and Running

### Prerequisites

- Python 3.13+
- Node.js 18+ (for frontend)
- GCC/G++ (for crash analysis)
- LLDB (for backtrace extraction; included on macOS)
- Codebase Memory MCP CLI (for repository indexing)

### Backend

```bash
# 1. Clone the repository
git clone https://github.com/Jisansingh/design-test-case-generator-.git
cd ai-test-generator

# 2. Create a virtual environment
python3 -m venv venv
source venv/bin/activate

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

### Codebase Memory MCP

For repository indexing, install the Codebase Memory MCP CLI:

```bash
pip install codebase-memory-mcp
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for LLM access. Get one at [console.groq.com](https://console.groq.com) |
| `WORKSPACE_DIR` | No | Workspace directory path (default: `workspace`) |
| `LOGS_DIR` | No | Logs directory path (default: `logs`) |

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

---

## API Documentation

FastAPI generates interactive OpenAPI documentation automatically:

- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **ReDoc:** `http://127.0.0.1:8000/redoc`

All endpoints can be tested directly from the Swagger UI.

---

## Future Scope

- **Repository-wide test generation and execution** - Extend from per-file to whole-repository test generation
- **Real compilation and build execution** - Replace rule-based simulation with actual compilation and test execution for supported languages
- **Code coverage integration** - Measure and report code coverage from test execution
- **CI/CD integration** - Trigger test generation and execution from CI pipelines
- **Incremental repository indexing** - Re-index only changed files instead of the full repository

---

## Contributors

- **Jisan Singh**
