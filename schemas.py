from pydantic import BaseModel
from typing import List, Optional


# Request model: what the user sends to our API
class DesignInput(BaseModel):
    design: str


# Response model: what our API returns
class TestCases(BaseModel):
    functional: List[str]
    edge_cases: List[str]
    security: List[str]


# Error response model
class ErrorResponse(BaseModel):
    detail: str
