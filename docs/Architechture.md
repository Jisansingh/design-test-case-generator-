# AI Test Generator
## System Architecture

Version: 1.0
Status: Phase 1 Completed

---

# 1. Overview

The AI Test Generator is an AI-assisted software testing platform that generates, executes, and analyzes unit tests for software projects.

The existing platform supports code snippet generation and testing. The next phase extends the platform to support complete software repositories using semantic repository indexing through Codebase Memory MCP.

---

# 2. Objectives

- Support repository-level AI test generation
- Reduce LLM token usage through semantic retrieval
- Support multiple programming languages
- Execute generated tests automatically
- Provide reports and analytics

---

# 3. Supported Languages

## Repository Parsing

- C
- C++
- Python
- Java
- JavaScript
- React (JSX / TSX)
- HTML
- CSS
- JSON
- YAML

## Test Generation & Execution

- C
- C++
- Python
- JavaScript
- React
- Java

---

# 4. System Workflow

Repository Upload

↓

Repository Validation

↓

Repository Extraction

↓

Repository Analysis

↓

Language Detection

↓

Repository Indexing

↓

Repository Explorer

↓

File Selection

↓

Context Retrieval

↓

AI Test Generation

↓

Test Execution

↓

Reports & Analytics

---

# 5. High-Level Architecture

Frontend

- Repository Upload
- Repository Explorer
- Test Generation
- Execution Results
- Reports Dashboard

↓

FastAPI Backend

↓

Repository Service

↓

Workspace Manager

↓

Repository Analyzer

↓

Language Detector

↓

Codebase Memory MCP Service

↓

Context Retrieval Service

↓

AI Test Generation Service

↓

Execution Service

↓

Report Service

↓

Workspace Storage

---

# 6. Repository Lifecycle

UPLOADING

↓

VALIDATING

↓

EXTRACTING

↓

ANALYZING

↓

INDEXING

↓

READY

↓

GENERATING TESTS

↓

EXECUTING TESTS

↓

COMPLETED

---

# 7. Repository Workspace

workspace/

repo_<id>/

    source/

    generated_tests/

    reports/

    index/

    metadata.json

---

# 8. Codebase Memory MCP

Instead of sending an entire repository to the LLM, the repository is indexed once.

When a user selects one or more files:

Selected Files

↓

Semantic Retrieval

↓

Relevant Context

↓

LLM

↓

Generated Tests

This minimizes prompt size while preserving relevant context.

---

# 9. Repository Analytics

The platform records:

Repository

- Total files
- Supported files
- Context files
- Languages detected
- Repository size

AI

- Selected files
- Retrieved files
- Estimated tokens without MCP
- Estimated tokens with MCP
- Token reduction

Execution

- Tests generated
- Passed tests
- Failed tests
- Execution time

---

# 10. Current MVP

Implemented

- AI code generation
- AI test generation
- Google Test execution
- Crash analysis
- Report generation

Planned

- Repository upload
- Repository indexing
- Repository explorer
- Context retrieval
- Multi-language execution
- Analytics dashboard

---

# 11. Future Scope

- GitHub repository import
- Incremental indexing
- Repository versioning
- Additional language support
- Code coverage visualization
- CI/CD integration
- Regression testing
- Team collaboration