from fastapi import FastAPI, HTTPException
from schemas import DesignInput, TestCases
from llm_service import generate_test_cases
import json

# Create the FastAPI app instance
app = FastAPI(
    title="AI Test Generator API",
    description="Generate software test cases from design descriptions using Groq AI",
    version="1.0.0",
)


@app.get("/")
def root():
    """Health-check endpoint."""
    return {"status": "ok", "message": "AI Test Generator is running"}


@app.post("/generate-tests", response_model=TestCases)
def generate_tests(request: DesignInput):
    """
    Accept a design description and return AI-generated test cases
    grouped into functional, edge_cases, and security categories.
    """
    try:
        result = generate_test_cases(request.design)
        # Validate the response has the expected keys
        return TestCases(
            functional=result.get("functional", []),
            edge_cases=result.get("edge_cases", []),
            security=result.get("security", []),
        )
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}",
        )
