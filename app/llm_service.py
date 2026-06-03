import json
import os
import re
from difflib import SequenceMatcher
from dotenv import load_dotenv
from groq import Groq

# Load environment variables (API keys, etc.)
load_dotenv()

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Controls the creativity level of the LLM output
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
    Cleans up the raw LLM output to make it safely parseable by json.loads().
    Handles common LLM quirks: markdown blocks, leading/trailing text, and trailing commas.
    """
    text = raw.strip()

    # 1. Strip markdown code fences if present (e.g. ```json ... ```)
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            # Remove optional 'json' identifier
            if part.startswith("json"):
                part = part[4:].strip()
            # Extract the actual JSON block
            if part.startswith("{") and part.endswith("}"):
                text = part
                break

    # 2. Extract contents between first '{' and last '}' to strip conversational text
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]

    # 3. Strip trailing commas inside arrays or objects (Python's json.loads is very strict about this)
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text


def _is_similar(a: str, b: str, threshold: float = 0.8) -> bool:
    """
    Checks if two test descriptions are lexically similar to prevent redundancy.
    Example: 'wrong password' vs 'incorrect password' -> returns True
    """
    return SequenceMatcher(None, a.lower(), b.lower()).ratio() > threshold


def generate_test_cases(design: str) -> dict:
    """
    Communicates with the Groq API to generate categorized software test cases.
    Retries once if a JSON parsing error occurs.
    """
    user_prompt = f"Design: {design}"
    result = {"functional": [], "edge_cases": [], "security": []}

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

    # Attempt generation with a retry block for robust error handling
    for attempt in range(2):
        try:
            raw_output = _call_llm()
            cleaned_json = _clean_json_str(raw_output)
            data = json.loads(cleaned_json)

            # Structure validation and fuzzy deduplication
            keys = ["functional", "edge_cases", "security"]
            for key in keys:
                val = data.get(key, [])
                if not isinstance(val, list):
                    val = []

                # Clean strings & filter duplicates
                seen = []
                for item in val:
                    if isinstance(item, str):
                        cleaned_item = item.strip()
                    elif isinstance(item, dict):
                        # Extract description/name fields if the LLM output returns objects
                        cleaned_item = (item.get("description") or item.get("test_name") or item.get("name") or "").strip()
                    else:
                        continue

                    # Fuzzy check: skip if too similar to any existing item in categories
                    if cleaned_item and not any(_is_similar(cleaned_item, s) for s in seen):
                        seen.append(cleaned_item)

                # Limit to 7 items max per category as specified by prompt limits
                result[key] = seen[:7]

            return result

        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            # If it fails on first try, let's retry. If second fails, return default gracefully.
            if attempt == 1:
                print(f"Error generating test cases on retry attempt: {e}")
                return {"functional": [], "edge_cases": [], "security": []}


CODE_GENERATION_PROMPT = """
You are a senior frontend developer. Generate a single-file React component based on the given design description.

Rules:
- Output ONLY valid JavaScript/JSX code wrapped in a single markdown code block with the language label "jsx".
- Use React functional components with basic hooks (useState, useEffect) only.
- Do NOT use TypeScript.
- Do NOT include multiple files or folder structures.
- Do NOT include explanations before or after the code block.
- Include only the component code — no import for React is needed (assume it's available).
- Style using inline styles or a simple CSS object — avoid external CSS imports.
- Keep the component self-contained and beginner-friendly.

Example output for "A counter button that increments on click":
```jsx
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

export default Counter;
```
"""


def _extract_code_block(raw: str) -> str:
    """
    Extracts code from a markdown code block. Returns the raw string
    if no markdown fences are found.
    """
    text = raw.strip()

    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            # Skip empty parts and language labels
            if not part or part.startswith("jsx") or part.startswith("javascript") or part.startswith("js"):
                continue
            # Take the first substantial code block
            if len(part) > 20:
                return part

    return text


def generate_code(design: str) -> dict:
    """
    Communicates with the Groq API to generate a React component
    based on a design description. Returns a dict with language and code keys.
    """
    user_prompt = f"Design: {design}"

    def _call_llm() -> str:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": CODE_GENERATION_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=TEMPERATURE,
        )
        return resp.choices[0].message.content

    for attempt in range(2):
        try:
            raw_output = _call_llm()
            code = _extract_code_block(raw_output)

            if not code.strip():
                raise ValueError("Empty code generated")

            return {"language": "javascript", "code": code.strip()}

        except Exception as e:
            if attempt == 1:
                print(f"Error generating code on retry attempt: {e}")
                return {"language": "javascript", "code": "// Code generation failed. Please try again with a more detailed description."}
