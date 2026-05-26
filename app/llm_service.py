import json
import os
import re
from difflib import SequenceMatcher

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

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
    text = raw.strip()

    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        try:
            text = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if match:
        text = match.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    else:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]

    text = re.sub(r",\s*([}\]])", r"\1", text)

    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    text = text.replace("'", '"')

    return text


def _is_similar(a: str, b: str, threshold: float = 0.8) -> bool:
    """Return True if two strings are similar (e.g. "wrong password" ≈ "incorrect password")."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > threshold


def _as_strings(items: list, max_items: int = 7) -> list:
    seen = []
    out = []

    for item in items:
        if len(out) >= max_items:
            break

        if isinstance(item, str):
            text = item.strip()
        elif isinstance(item, dict):
            text = (item.get("description") or item.get("test_name") or item.get("name") or "").strip()
        else:
            continue

        if not text:
            continue

        # Fuzzy dedup: skip if too similar to any existing item
        dup = any(_is_similar(text, s) for s in seen)
        if dup:
            continue

        seen.append(text)
        out.append(text)

    return out


def _validate_structure(data) -> dict:
    keys = ["functional", "edge_cases", "security"]
    result = {}

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

    for attempt in range(2):
        raw = _call_llm()

        try:
            cleaned = _clean_json_str(raw)
            data = json.loads(cleaned)
            return _validate_structure(data)
        except (json.JSONDecodeError, TypeError, ValueError):
            if attempt == 1:
                return {"functional": [], "edge_cases": [], "security": []}
