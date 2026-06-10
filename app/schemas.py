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


class CrashReportInput(BaseModel):
    backtrace: List[str]


class CrashReportOutput(BaseModel):
    crash_location: str
    root_cause: str
    severity: str
    suggested_fix: str


class ErrorResponse(BaseModel):
    detail: str
