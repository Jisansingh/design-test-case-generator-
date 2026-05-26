import logging

from fastapi import FastAPI, HTTPException

from app.llm_service import generate_test_cases
from app.schemas import DesignInput, TestCases

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(
    title="AI Test Generator API",
    description="Generate software test cases from design descriptions using Groq AI",
    version="1.0.0",
)


@app.get("/")
def root():
    return {"status": "ok", "message": "AI Test Generator is running"}


@app.post("/generate-tests", response_model=TestCases)
def generate_tests(request: DesignInput):
    if not request.design.strip():
        raise HTTPException(status_code=400, detail="Design description cannot be empty")

    log.info("Generating tests for: %s", request.design)

    result = generate_test_cases(request.design)

    total = len(result["functional"]) + len(result["edge_cases"]) + len(result["security"])
    if total == 0:
        raise HTTPException(
            status_code=502,
            detail="AI model returned empty response. Please try again with a more detailed design description.",
        )

    return TestCases(**result)
