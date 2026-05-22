import json
import os
import re

from dotenv import load_dotenv
from groq import Groq

# Load API key from .env file
load_dotenv()

# Initialize Groq client once (module-level singleton)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# System prompt that tells the LLM how to behave
SYSTEM_PROMPT = """
You are a software QA engineer.

Generate unique software test cases for the given design description.

Return STRICTLY valid parsable JSON only.

Format:
{
  "functional": [],
  "edge_cases": [],
  "security": []
}

Rules:
- No markdown
- No explanations
- No duplicate tests
- Keep tests concise
- Include realistic edge cases
- Include security scenarios

Each array should contain 3-5 actionable test case descriptions.
"""


def _extract_json(text: str) -> dict:
    """
    Safely extract JSON from LLM response.
    Handles markdown code blocks and trailing commas gracefully.
    """
    # Try to find JSON inside ```json ... ``` blocks
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        text = match.group(1)

    # Clean up trailing commas before closing braces/brackets
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return json.loads(text.strip())


def generate_test_cases(design: str) -> dict:
    """
    Send the design description to Groq and return structured test cases.
    """
    # Build the user message with the design input
    user_prompt = f"Design: {design}"

    # Call Groq API
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    # Extract raw text from LLM response
    raw = response.choices[0].message.content

    # Parse and return structured JSON
    return _extract_json(raw)
