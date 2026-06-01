import logging
from fastapi import FastAPI, HTTPException
from app.llm_service import generate_test_cases
from app.schemas import DesignInput, TestCases
from app.execution_service import execute_test_cases
# Standard basic logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    # Input Validation
    if not request.design.strip():
        raise HTTPException(status_code=400, detail="Design description cannot be empty")

    logger.info(f"Generating tests for design description starting with: {request.design[:50]}...")

    # Call the service layer
    result = generate_test_cases(request.design)

    # Validate that we actually got tests back
    total_cases = len(result["functional"]) + len(result["edge_cases"]) + len(result["security"])
    if total_cases == 0:
        raise HTTPException(
            status_code=502,
            detail="AI model returned empty response. Please try again with a more detailed design description.",
        )

    # FastAPI will automatically validate and parse this dictionary into the TestCases schema
    return result

@app.post("/execute-tests")
def execute_tests(request: DesignInput):

    # Generate test cases first
    generated = generate_test_cases(request.design)

    # Execute all generated test cases
    all_tests = (
        generated["functional"]
        + generated["edge_cases"]
        + generated["security"]
    )

    execution_result = execute_test_cases(all_tests)

    return execution_result
