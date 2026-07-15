# AI Test Generator
## System Architecture

Version: 1.1
Status: Phase 2 Completed
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

Repository Metadata Generation

↓

Repository Ready for Indexing

↓

Codebase Memory MCP Indexing

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

Repository Service

↓

Workspace Manager

↓

Repository Analyzer

↓

Language Detector

↓

Repository Metadata Manager

↓

Codebase Memory MCP Service

↓

Context Retrieval Service

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

READY_FOR_ANALYSIS

↓

ANALYZING

↓

READY_FOR_INDEXING

↓

INDEXING

↓

READY

↓

GENERATING_TESTS

↓

EXECUTING_TESTS

↓

COMPLETED

---

# 7. Repository Workspace

workspace/

repo_<id>/

    source/

    metadata.json

    generated_tests/      (Created in later phases)

    reports/              (Created after execution)

    index/                (Created after MCP indexing)

---

# Repository Analysis

Phase 3 analyzes uploaded repositories before semantic indexing.

The analysis process includes:

- Repository scanning
- Language detection
- File classification
- Repository statistics generation
- Metadata enrichment

No AI models or Codebase Memory MCP are used during this phase.

Repository analysis prepares the repository for semantic indexing in the next phase.

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
- Repository upload
- Repository validation
- Repository workspace management
- Repository metadata generation
- Repository management APIs

Planned

- Repository analysis
- Repository indexing
- Repository explorer
- Context retrieval
- Multi-language execution
- Analytics dashboard

---
# Development Roadmap

Phase 1
- Architecture & Planning

Phase 2
- Repository Upload & Workspace Management

Phase 3
- Repository Analysis & Metadata

Phase 4
- Codebase Memory MCP Indexing

Phase 5
- Repository Explorer & Context Retrieval

Phase 6
- AI Test Generation

Phase 7
- Multi-language Test Execution

Phase 8
- Reports, Analytics & Token Dashboard
# 11. Future Scope

- GitHub repository import
- Incremental indexing
- Repository versioning
- Additional language support
- Code coverage visualization
- CI/CD integration
- Regression testing
- Team collaboration