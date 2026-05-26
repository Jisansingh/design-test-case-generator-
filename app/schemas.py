from pydantic import BaseModel
from typing import List, Optional


class DesignInput(BaseModel):
    design: str


class TestCases(BaseModel):
    functional: List[str]
    edge_cases: List[str]
    security: List[str]


class ErrorResponse(BaseModel):
    detail: str
