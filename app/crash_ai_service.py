import json
import os
import re
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

TEMPERATURE = 0.3

BACKTRACE_ANALYSIS_PROMPT = """
You are a senior C++ debugging expert. Analyze the given crash backtrace and identify the issue.

Return ONLY valid JSON with these three fields:
- issue: Short one-line description of the bug (e.g., "Null pointer dereference")
- root_cause: Brief explanation of why the crash happened, referencing the function names
- suggestions: Array of 2-4 actionable fix suggestions

Example output:
{"issue": "Null pointer dereference", "root_cause": "Null pointer accessed in crashFunction()", "suggestions": ["Initialize pointer before use", "Add null checks before dereferencing", "Use smart pointers instead of raw pointers"]}

Rules:
- Return ONLY the JSON object, no extra text
- No markdown, no backticks, no code fences
"""


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return json.loads(text)


def analyze_backtrace(backtrace: list) -> dict:
    backtrace_text = "\n".join(backtrace)
    user_prompt = f"Backtrace:\n{backtrace_text}"

    for attempt in range(2):
        try:
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": BACKTRACE_ANALYSIS_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=TEMPERATURE,
            )
            raw = resp.choices[0].message.content
            data = _extract_json(raw)
            return {
                "issue": data.get("issue", "Unknown issue"),
                "root_cause": data.get("root_cause", "Could not determine root cause"),
                "suggestions": data.get("suggestions", ["Review the code for potential bugs"]),
            }
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            if attempt == 1:
                print(f"Error analyzing backtrace on retry: {e}")
                return {
                    "issue": "Analysis failed",
                    "root_cause": "Could not parse LLM response",
                    "suggestions": ["Try again with a more detailed backtrace"],
                }
