import json
import os
import re

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Controls how creative vs predictable the output is.
# Lower = more consistent, Higher = more varied.
# 0.5 is a good balance for test generation.
TEMPERATURE = 0.5

SYSTEM_PROMPT = """
You are a senior QA engineer. Generate unique, non-repeating test cases for the given design.

Every test must describe a distinct scenario — no duplicates within or across categories.

--- CATEGORY GUIDELINES ---

functional — happy path, expected behavior, basic validation
  Good example: "Verify login with valid email and correct password returns a JWT token"
  Good example: "Verify login with incorrect password returns 401 Unauthorized"

edge_cases — null/empty inputs, boundary values, special characters, race conditions, large payloads
  Good example: "Verify login fails gracefully when email contains unicode characters"
  Good example: "Verify login with exactly 255-character password processes correctly"

security — injection attacks, token tampering, rate limiting, privilege escalation, data leaks
  Good example: "Verify SQL injection in email field is rejected (try: ' OR 1=1 --)"
  Good example: "Verify expired JWT returns 401 and does not reveal user data"

--- FEW-SHOT EXAMPLE ---

Input: "Build a file upload API with virus scanning"
Output:
{"functional": ["Verify uploading a valid PDF returns 200 and file metadata", "Verify uploading without auth token returns 401", "Verify uploading a file larger than max size returns 413"], "edge_cases": ["Verify uploading an empty file returns 400 with clear error", "Verify uploading a file with no extension is handled gracefully"], "security": ["Verify uploading a .exe is blocked by virus scanner", "Verify path traversal in filename (../../etc/passwd) is rejected"]}

--- FORMAT RULES ---
- Return ONLY valid JSON, no extra text
- Root is a JSON object, NOT an array
- Each value is an array of plain strings, NOT objects
- Tests must be specific and actionable
- Use concise one-sentence descriptions
- No markdown, no backticks, no code fences
"""


def _clean_json_str(raw: str) -> str:
    """
    Clean up common LLM JSON issues before parsing:
    - Markdown code fences
    - Leading/trailing text around JSON
    - Stringified JSON (LLM wraps JSON in a string)
    - Single quotes used as string delimiters
    - Trailing commas
    """
    text = raw.strip()

    # Handle stringified JSON (e.g., '"{...}"' or "'{...}'")
    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        try:
            text = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

    # Strip markdown code fences (```json ... ```)
    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        text = match.group(1).strip()

    # Find the first { and last } to extract the JSON object
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    else:
        # LLM sometimes returns a bare array instead of object
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]

    # Remove trailing commas before closing braces/brackets
    text = re.sub(r",\s*([}\]])", r"\1", text)

    # Try parsing as-is first — this handles the common case
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # If parsing still fails, try converting single-quote delimiters to double quotes.
    # This only runs after the first parse attempt failed, so we know the JSON is
    # already invalid. The replacement fixes LLMs that use ' instead of ".
    text = text.replace("'", '"')

    return text


def _as_strings(items: list, max_items: int = 7) -> list:
    """
    Convert mixed LLM output into a clean list of unique strings.
    Handles both flat strings and objects with description/test_name keys.
    """
    seen = set()
    out = []

    for item in items:
        if len(out) >= max_items:
            break

        # Extract text from string or dict
        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = (item.get("description") or item.get("test_name") or item.get("name") or "").strip()
        else:
            continue

        # Skip empty or duplicate
        if not text or text.lower() in seen:
            continue

        seen.add(text.lower())
        out.append(text)

    return out


def _validate_structure(data) -> dict:
    """
    Ensure the parsed JSON has the expected three keys,
    each being a list of strings. Fill in missing keys with [].

    Also handles the edge case where the LLM returns a flat array
    (treats all items as functional tests).
    """
    keys = ["functional", "edge_cases", "security"]
    result = {}

    # Handle top-level array (LLM returns [...] instead of {...})
    if isinstance(data, list):
        result["functional"] = _as_strings(data)
        result["edge_cases"] = []
        result["security"] = []
        return result

    for key in keys:
        val = data.get(key, [])

        if not isinstance(val, list):
            val = []

        result[key] = _as_strings(val)

    return result


def generate_test_cases(design: str) -> dict:
    """
    Send design to Groq, extract JSON, validate structure.
    Retries once if parsing fails.
    """
    user_prompt = f"Design: {design}"

    def _call_llm() -> str:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=TEMPERATURE,
        )
        return resp.choices[0].message.content

    # Try up to 2 times
    for attempt in range(2):
        raw = _call_llm()

        try:
            cleaned = _clean_json_str(raw)
            data = json.loads(cleaned)
            return _validate_structure(data)
        except (json.JSONDecodeError, TypeError, ValueError):
            if attempt == 1:
                # Final attempt failed — return empty structure instead of crashing
                return {"functional": [], "edge_cases": [], "security": []}
            # First attempt failed — try again
