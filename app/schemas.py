from pydantic import BaseModel
from typing import List, Optional


class DesignInput(BaseModel):
    design: str
    language: Optional[str] = None


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


class CrashReportOutput(BaseModel):
    crash_location: str
    root_cause: str
    severity: str
    suggested_fix: str


class UserCrashAnalysisInput(BaseModel):
    code: str
    language: str


class UserCrashAnalysisOutput(BaseModel):
    crashed: bool
    signal: Optional[int] = None
    exit_code: int
    stdout: str
    stderr: str
    backtrace: List[BacktraceFrame] = []


class ErrorResponse(BaseModel):
    detail: str
