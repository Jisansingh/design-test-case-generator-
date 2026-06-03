import logging
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.llm_service import generate_test_cases, generate_code
from app.schemas import DesignInput, TestCases, CodeGenOutput
from app.execution_service import execute_test_cases, generate_text_report
# Standard basic logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Test Generator API",
    description="Generate software test cases from design descriptions using Groq AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.post("/generate-code", response_model=CodeGenOutput)
def generate_code_endpoint(request: DesignInput):
    if not request.design.strip():
        raise HTTPException(status_code=400, detail="Design description cannot be empty")

    logger.info(f"Generating code for design description starting with: {request.design[:50]}...")

    result = generate_code(request.design)

    if not result["code"].strip():
        raise HTTPException(
            status_code=502,
            detail="AI model returned empty response. Please try again with a more detailed design description.",
        )

    return result


@app.post("/execute-tests")
def execute_tests(request: DesignInput):
    # Generate test cases using the LLM
    generated = generate_test_cases(request.design)

    # Pull out each category of tests
    functional_tests = generated["functional"]
    edge_cases_tests = generated["edge_cases"]
    security_tests = generated["security"]

    # Pass each category separately so the report stays organized
    execution_result = execute_test_cases(
        functional_tests,
        edge_cases_tests,
        security_tests
    )

    return execution_result


@app.post("/generate-report")
def generate_report(request: DesignInput):
    # Step 1: Generate test cases using the LLM
    generated = generate_test_cases(request.design)

    # Step 2: Pull out each category of tests
    functional_tests = generated["functional"]
    edge_cases_tests = generated["edge_cases"]
    security_tests = generated["security"]

    # Step 3: Execute all the test cases
    execution_result = execute_test_cases(
        functional_tests,
        edge_cases_tests,
        security_tests
    )

    # Step 4: Convert the execution result into a plain text report
    report_text = generate_text_report(execution_result)

    # Step 5: Return the report as JSON
    return {"report": report_text}


@app.post("/download-report")
def download_report(request: DesignInput):
    # Step 1: Generate test cases using the LLM
    generated = generate_test_cases(request.design)

    # Step 2: Pull out each category of tests
    functional_tests = generated["functional"]
    edge_cases_tests = generated["edge_cases"]
    security_tests = generated["security"]

    # Step 3: Execute all the test cases
    execution_result = execute_test_cases(
        functional_tests,
        edge_cases_tests,
        security_tests
    )

    # Step 4: Generate the plain text report
    report_text = generate_text_report(execution_result)

    # Step 5: Write the report to a temporary .txt file
    # Using delete=False so the file stays around for FileResponse to read
    temp_file = tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".txt",
        delete=False
    )
    temp_file.write(report_text)
    temp_file.close()

    # Step 6: Return the file as a download
    return FileResponse(
        path=temp_file.name,
        media_type="text/plain",
        filename="report.txt"
    )
