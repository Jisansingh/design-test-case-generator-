from pydantic import BaseModel
from typing import Any, List, Optional
from datetime import datetime


class DesignInput(BaseModel):
    design: str
    language: Optional[str] = None
    project_name: Optional[str] = None


class TestCases(BaseModel):
    functional: List[str]
    edge_cases: List[str]
    security: List[str]


class CodeGenOutput(BaseModel):
    language: str
    code: str
    gtest_code: Optional[str] = None


class CrashAnalysisOutput(BaseModel):
    status: str
    backtrace: List[str]


class BacktraceFrame(BaseModel):
    frame: int
    function: str
    file: Optional[str] = None
    line: Optional[int] = None


class CrashReportInput(BaseModel):
    backtrace: List[str]
    code: Optional[str] = None
    signal: Optional[int] = None
    stderr: Optional[str] = None
    backtrace_frames: Optional[List[BacktraceFrame]] = None
    project_name: Optional[str] = None


class CrashReportOutput(BaseModel):
    crash_location: str
    root_cause: str
    severity: str
    suggested_fix: str


class UserCrashAnalysisInput(BaseModel):
    code: str
    language: str
    project_name: Optional[str] = None


class UserCrashAnalysisOutput(BaseModel):
    crashed: bool
    signal: Optional[int] = None
    exit_code: int
    stdout: str
    stderr: str
    backtrace: List[BacktraceFrame] = []


class ErrorResponse(BaseModel):
    detail: str


class ProjectInfo(BaseModel):
    project_name: str
    language: str
    created_at: str
    updated_at: str
    status: str
    generated_tests: int
    passed: int
    failed: int
    success_rate: float
    generation_time: str
    compilation_time: str
    execution_time: str
    report_generation_time: str
    last_report: str


class FileInfo(BaseModel):
    name: str
    size: int
    modified: str


class ProjectListResponse(BaseModel):
    success: bool
    message: str
    data: Optional[List[ProjectInfo]] = None


class ProjectDetailResponse(BaseModel):
    success: bool
    message: str
    data: Optional[ProjectInfo] = None


class FileListResponse(BaseModel):
    success: bool
    message: str
    data: Optional[List[FileInfo]] = None


class ReportInfo(BaseModel):
    project_name: str
    report_file: str
    generated_at: str
    size: int


class ReportListResponse(BaseModel):
    success: bool
    message: str
    data: Optional[List[ReportInfo]] = None


class TimelineEntry(BaseModel):
    step: str
    status: str
    duration: Optional[str] = None
    timestamp: Optional[str] = None


class TimelineResponse(BaseModel):
    success: bool
    message: str
    data: Optional[List[TimelineEntry]] = None


class GenerateTestsRequest(BaseModel):
    selected_files: List[str]


class RepositoryExecutionRequest(BaseModel):
    selected_files: List[str]
    test_cases: Optional[TestCases] = None
    test_cases_map: Optional[dict[str, TestCases]] = None


class RepositoryReportRequest(BaseModel):
    selected_files: List[str]
    execution_results: Optional[dict[str, Any]] = None


class RepositoryInfo(BaseModel):
    repository_id: str
    repository_name: str
    status: str
    upload_time: str
    repository_path: str
    repository_size: int
    total_files: int


class RepositoryUploadResponse(BaseModel):
    success: bool
    message: str
    data: Optional[RepositoryInfo] = None


class RepositoryListResponse(BaseModel):
    success: bool
    message: str
    data: Optional[List[RepositoryInfo]] = None
