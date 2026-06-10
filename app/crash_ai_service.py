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
You are a senior C/C++ debugging expert. Analyze the given crash.

Return ONLY valid JSON with these four fields:
- root_cause: Brief, specific explanation referencing actual function names and line numbers
- severity: One of: "critical", "high", "medium", "low"
- suggested_fix: A single actionable, beginner-friendly fix

Example output for a null pointer dereference:
{"root_cause": "Null pointer dereference at line 6 in main() - pointer 'ptr' was set to nullptr then immediately dereferenced", "severity": "critical", "suggested_fix": "Check if the pointer is valid with 'if (ptr != nullptr)' before dereferencing, or allocate memory with 'new' or 'malloc()'"}

Rules:
- Return ONLY the JSON object, no extra text
- No markdown, no backticks, no code fences
- Reference actual line numbers and variable names from the source code
- Be specific about what is wrong and how to fix it
"""


def _extract_json(raw: str) -> dict:
    text = raw.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    return json.loads(text)


def _parse_crash_location(backtrace: list, backtrace_frames: list = None) -> str:
    if backtrace_frames:
        for frame in backtrace_frames:
            f = frame if isinstance(frame, dict) else frame.model_dump()
            if f.get("frame") == 0:
                loc = f.get("function", "unknown")
                if f.get("file") and f.get("line"):
                    loc += f" at {f['file']}:{f['line']}"
                return loc
    if not backtrace:
        return "unknown"
    frame = backtrace[0]
    if frame.startswith("#0 "):
        frame = frame[3:]
    return frame


def _get_crash_line(code: str, backtrace_frames: list = None) -> int:
    if not backtrace_frames or not code:
        return None
    for frame in backtrace_frames:
        f = frame if isinstance(frame, dict) else frame.model_dump()
        if f.get("frame") == 0:
            return f.get("line")
    return None


def _get_lines_around(code: str, line: int, context: int = 3) -> str:
    if not code or not line:
        return ""
    lines = code.split("\n")
    start = max(0, line - 1 - context)
    end = min(len(lines), line + context)
    result_lines = []
    for i in range(start, end):
        marker = ">>>" if i == line - 1 else "   "
        result_lines.append(f"{marker} {i + 1}: {lines[i]}")
    return "\n".join(result_lines)


def _classify_sigsegv(code: str, crash_line: int) -> dict:
    if not code or not crash_line:
        return None
    lines = code.split("\n")
    idx = crash_line - 1
    if idx < 0 or idx >= len(lines):
        return None
    crash_line_text = lines[idx]

    context_start = max(0, idx - 5)
    context_lines = lines[context_start : idx + 1]
    context_text = "\n".join(context_lines)

    null_assign_pattern = re.compile(
        r"(int\s*\*?\s*\w+\s*=\s*(nullptr|NULL|0|nullptr_t))|"
        r"(\w+\s*=\s*(nullptr|NULL|0))\s*;"
    )
    deref_pattern = re.compile(r"\*\s*\w+")
    free_pattern = re.compile(r"(free|delete)\s*\(\s*\w+\s*\)")
    arr_access_pattern = re.compile(r"\w+\[\s*\w+\s*\]")

    has_null_assign = bool(null_assign_pattern.search(context_text))
    has_deref = bool(deref_pattern.search(crash_line_text))
    has_free_before = bool(free_pattern.search(context_text[:-len(crash_line_text)] or context_text))
    has_arr_access = bool(arr_access_pattern.search(crash_line_text))

    if has_null_assign and has_deref:
        match = re.search(r"(\w+)\s*=\s*(nullptr|NULL|0)\s*;", context_text)
        var_name = match.group(1) if match else "a pointer"
        return {
            "root_cause": f"Null pointer dereference at line {crash_line} — pointer '{var_name}' was assigned null then dereferenced",
            "severity": "critical",
            "suggested_fix": f"Before dereferencing '{var_name}', check if it is valid: 'if ({var_name} != nullptr)'. Use 'new' or 'malloc()' to allocate memory first.",
        }

    if has_free_before and has_deref:
        match = re.search(r"(free|delete)\s*\(\s*(\w+)\s*\)", context_text)
        var_name = match.group(2) if match else "a pointer"
        return {
            "root_cause": f"Use-after-free at line {crash_line} — '{var_name}' was freed/deleted then accessed again",
            "severity": "critical",
            "suggested_fix": f"After freeing '{var_name}', set it to nullptr to detect use-after-free: '{var_name} = nullptr;'. Avoid accessing memory that has been freed.",
        }

    if "*" in crash_line_text and "=" in crash_line_text:
        match = re.search(r"\*\s*(\w+)", crash_line_text)
        var_name = match.group(1) if match else "a pointer"
        return {
            "root_cause": f"Invalid memory access at line {crash_line} — '{var_name}' points to invalid memory",
            "severity": "critical",
            "suggested_fix": f"Ensure '{var_name}' points to valid allocated memory before using it. Initialize pointers with 'new' or 'malloc()' and verify with 'if ({var_name} != nullptr)'.",
        }

    return None


def _classify_sigfpe(code: str, crash_line: int) -> dict:
    if not code or not crash_line:
        return None
    lines = code.split("\n")
    idx = crash_line - 1
    if idx < 0 or idx >= len(lines):
        return None
    crash_line_text = lines[idx]

    div_pattern = re.compile(r"/\s*(\w+|\d+)")
    mod_pattern = re.compile(r"%\s*(\w+|\d+)")
    zero_literal = re.compile(r"/\s*0(?:\D|$)")

    if zero_literal.search(crash_line_text):
        return {
            "root_cause": f"Division by zero at line {crash_line} — the divisor is the literal 0",
            "severity": "critical",
            "suggested_fix": "Change the divisor to a non-zero value, or add a check before dividing: 'if (divisor != 0) { result = x / divisor; }'",
        }

    match = div_pattern.search(crash_line_text) or mod_pattern.search(crash_line_text)
    if match:
        divisor = match.group(1)
        if divisor.isdigit():
            return {
                "root_cause": f"Division by zero at line {crash_line} — the divisor evaluates to zero",
                "severity": "critical",
                "suggested_fix": "Ensure the divisor is never zero before performing division. Add a guard: 'if (divisor != 0)'",
            }
        return {
            "root_cause": f"Arithmetic error (likely division by zero) at line {crash_line} — the divisor '{divisor}' may be zero",
            "severity": "high",
            "suggested_fix": f"Before dividing, check that '{divisor}' is not zero: 'if ({divisor} != 0)'",
        }

    return None


def _classify_sigabrt(code: str, crash_line: int, stderr: str = None) -> dict:
    if not code or not crash_line:
        return None
    lines = code.split("\n")
    idx = crash_line - 1
    if idx < 0 or idx >= len(lines):
        return None
    crash_line_text = lines[idx]

    if "assert(" in crash_line_text or "assert (" in crash_line_text:
        match = re.search(r"assert\(\s*(.+?)\s*\)", crash_line_text)
        condition = match.group(1) if match else "a condition"
        return {
            "root_cause": f"Assertion failed at line {crash_line}: '{condition}' was false",
            "severity": "high",
            "suggested_fix": f"Review the assertion condition '{condition}'. Either the code logic is incorrect, or the assumption made by assert() does not hold. Fix the logic so '{condition}' evaluates to true.",
        }

    if "abort()" in crash_line_text or "abort (" in crash_line_text:
        msg = ""
        if stderr:
            msg = f" — stderr: {stderr.strip()[:200]}"
        return {
            "root_cause": f"Program called abort() at line {crash_line}{msg}",
            "severity": "high",
            "suggested_fix": "Remove the abort() call or replace it with proper error handling. If abort() is in a catch block, handle the error gracefully instead of terminating.",
        }

    if stderr and ("Assertion" in stderr or "failed" in stderr):
        return {
            "root_cause": f"Runtime assertion failure at line {crash_line} — stderr: {stderr.strip()[:200]}",
            "severity": "high",
            "suggested_fix": "Check the assertion condition and the program logic around the crash location. Ensure all preconditions are met before the failing operation.",
        }

    return None


def _classify_crash(signal: int, code: str, crash_line: int, stderr: str = None) -> dict:
    if signal == 11:
        return _classify_sigsegv(code, crash_line)
    elif signal == 8:
        return _classify_sigfpe(code, crash_line)
    elif signal == 6:
        return _classify_sigabrt(code, crash_line, stderr)
    return None


def _get_default_result(signal: int, crash_location: str) -> dict:
    signal_map = {
        11: ("SIGSEGV (segmentation fault)", "critical"),
        8: ("SIGFPE (floating point exception)", "critical"),
        6: ("SIGABRT (abort)", "high"),
    }
    name, severity = signal_map.get(signal, (f"signal {signal}", "high"))
    return {
        "crash_location": crash_location,
        "root_cause": f"Program terminated by {name} in {crash_location}",
        "severity": severity,
        "suggested_fix": f"Review the code around {crash_location} for common bugs like null pointer dereferences, invalid memory access, or division by zero.",
    }


def analyze_backtrace(backtrace: list, code: str = None, signal: int = None, stderr: str = None, backtrace_frames: list = None) -> dict:
    crash_location = _parse_crash_location(backtrace, backtrace_frames)
    crash_line = _get_crash_line(code, backtrace_frames)

    if signal is not None:
        rule_result = _classify_crash(signal, code, crash_line, stderr)
        if rule_result:
            rule_result["crash_location"] = crash_location
            return rule_result

    if crash_line and code:
        lines = code.split("\n")
        idx = crash_line - 1
        if 0 <= idx < len(lines):
            crash_location = f"{crash_location} (line {crash_line}: \"{lines[idx].strip()}\")"

    backtrace_text = "\n".join(backtrace)
    context = _get_lines_around(code, crash_line)
    user_prompt_parts = [f"Backtrace:\n{backtrace_text}"]
    if signal is not None:
        signal_names = {11: "SIGSEGV", 8: "SIGFPE", 6: "SIGABRT"}
        name = signal_names.get(signal, f"signal {signal}")
        user_prompt_parts.append(f"Signal: {name} ({signal})")
    if context:
        user_prompt_parts.append(f"Source code around crash line:\n{context}")
    if stderr:
        user_prompt_parts.append(f"Stderr:\n{stderr[:500]}")
    user_prompt = "\n\n".join(user_prompt_parts)

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
                return _get_default_result(signal, crash_location)
