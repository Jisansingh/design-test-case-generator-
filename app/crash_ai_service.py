import json
import logging
import os
import re
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

logger = logging.getLogger(__name__)

TEMPERATURE = 0.3

BACKTRACE_ANALYSIS_PROMPT = """
You are a senior C++ debugging expert. Analyze the given crash backtrace.

Return ONLY valid JSON with these four fields:
- root_cause: Brief explanation of why the crash happened, referencing the function names
- severity: One of: "critical", "high", "medium", "low"
- suggested_fix: A single actionable fix suggestion (e.g., "Initialize the pointer before using it")

Example output for a null pointer dereference:
{"root_cause": "Null pointer accessed in crashFunction() at line 6 - pointer was never initialized", "severity": "critical", "suggested_fix": "Initialize the pointer to a valid memory address before dereferencing it"}

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


def _parse_crash_location(backtrace: list) -> str:
    """Extract the crashing function name from the first backtrace frame."""
    if not backtrace:
        return "unknown"
    frame = backtrace[0]
    if frame.startswith("#0 "):
        frame = frame[3:]
    return frame


def analyze_backtrace(backtrace: list) -> dict:
    crash_location = _parse_crash_location(backtrace)
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
                "crash_location": crash_location,
                "root_cause": data.get("root_cause", "Could not determine root cause"),
                "severity": data.get("severity", "high"),
                "suggested_fix": data.get("suggested_fix", "Review the code for potential bugs"),
            }
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            if attempt == 1:
                logger.error(f"Error analyzing backtrace on retry: {e}")
                return {
                    "crash_location": crash_location,
                    "root_cause": "Could not parse LLM response",
                    "severity": "high",
                    "suggested_fix": "Try again with a more detailed backtrace",
                }
