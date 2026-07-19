import json
import logging
import os
import re
from difflib import SequenceMatcher
from dotenv import load_dotenv
from groq import Groq

# Load environment variables (API keys, etc.)
load_dotenv()

# Initialize Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

logger = logging.getLogger(__name__)

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

    # Log estimated prompt size before sending
    total_prompt_chars = len(SYSTEM_PROMPT) + len(user_prompt)
    logger.info(
        "Groq request prep: system_prompt=%d chars, user_prompt=%d chars, total=%d chars, "
        "estimated_prompt_tokens=~%d (at 3 chars/token), max_tokens=%d",
        len(SYSTEM_PROMPT), len(user_prompt), total_prompt_chars,
        total_prompt_chars // 3, 4096,
    )

    def _call_llm() -> tuple[str, dict]:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=TEMPERATURE,
            max_tokens=4096,
        )
        usage = {
            "prompt_tokens": resp.usage.prompt_tokens,
            "completion_tokens": resp.usage.completion_tokens,
            "total_tokens": resp.usage.total_tokens,
        }
        content = resp.choices[0].message.content
        logger.info(
            "Groq response: prompt_tokens=%d completion_tokens=%d total_tokens=%d content_len=%d",
            usage["prompt_tokens"], usage["completion_tokens"],
            usage["total_tokens"], len(content),
        )
        return content, usage

    # Attempt generation with a retry block for robust error handling
    for attempt in range(2):
        try:
            raw_output, actual_usage = _call_llm()
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
                logger.error(f"Error generating test cases on retry attempt: {e}")
                return {"functional": [], "edge_cases": [], "security": []}


SUPPORTED_LANGUAGES = {"c", "cpp", "python", "java", "javascript", "react"}

FRONTEND_KEYWORDS = [
    "frontend", "react", "ui", "dashboard", "webpage", "website",
    "login page", "signup page", "component", "form",
]

LANGUAGE_PROMPTS = {
    "react": """
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
""",
    "python": """
You are a senior Python developer. Generate Python code based on the given design description.

Rules:
- Output ONLY valid Python code wrapped in a single markdown code block with the language label "python".
- Use Python's standard library only (no external packages like requests, numpy, etc.).
- Write clean, well-structured code with helpful comments where needed.
- Include a main() function with a if __name__ == "__main__": guard.
- Use descriptive variable and function names.
- Prefer simple, readable solutions over complex optimizations.
- Use functions for reusable logic; use classes only when they make sense.
- Do NOT include explanations before or after the code block.

Example output for "A program that greets the user":
```python
def greet(name):
    return f"Hello, {name}! Welcome to the program."

def main():
    user_name = input("Enter your name: ")
    message = greet(user_name)
    print(message)

if __name__ == "__main__":
    main()
```
""",
    "javascript": """
You are a senior JavaScript developer. Generate JavaScript code based on the given design description.

Rules:
- Output ONLY valid JavaScript code wrapped in a single markdown code block with the language label "javascript".
- Use modern JavaScript (ES6+) — arrow functions, const/let, template literals, etc.
- Do NOT use TypeScript.
- Do NOT include HTML or CSS unless the design specifically asks for it.
- Write clean, well-structured code with helpful comments where needed.
- Use functions for reusable logic.
- Keep the code beginner-friendly and self-contained.
- Do NOT include explanations before or after the code block.

Example output for "A function that filters even numbers from an array":
```javascript
function filterEvenNumbers(numbers) {
  return numbers.filter(num => num % 2 === 0);
}

const numbers = [1, 2, 3, 4, 5, 6];
const evens = filterEvenNumbers(numbers);
console.log("Even numbers:", evens);
```
""",
    "c": """
You are a senior C developer writing in ANSI C (C99). Generate C code based on the given design description.

Rules:
- Output ONLY valid C code wrapped in a single markdown code block with the language label "c".
- Use ONLY standard C libraries: stdio.h, stdlib.h, string.h, math.h, etc.
- NEVER use C++ features: no iostream, no class, no std::, no using namespace std, no new/delete, no templates, no nullptr.
- Use malloc() and free() for dynamic memory (not new/delete).
- Use structs (not classes).
- Include a main() function that demonstrates the functionality.
- Write clean, beginner-friendly code with simple solutions.
- Add comments only when they clarify intent.
- Do NOT include explanations before or after the code block.

Example output for "A program that calculates the factorial of a number":
```c
#include <stdio.h>

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

int main() {
    int num = 5;
    printf("Factorial of %d is %d\\n", num, factorial(num));
    return 0;
}
```""",
    "cpp": """
You are a senior C++ developer. Generate C++ code based on the given design description.

Rules:
- Output ONLY valid C++ code wrapped in a single markdown code block with the language label "cpp".
- Use standard C++ libraries (iostream, string, vector, algorithm, etc.).
- Write clean, well-structured code with helpful comments where needed.
- Include a main() function that demonstrates the functionality.
- Use descriptive variable and function names.
- Prefer simple, readable solutions over complex optimizations.
- Use modern C++ features (e.g., auto, range-based for loops) where appropriate.
- Do NOT include explanations before or after the code block.

Example output for "A program that stores and displays a list of students":
```cpp
#include <iostream>
#include <vector>
#include <string>

using namespace std;

struct Student {
    string name;
    int grade;
};

int main() {
    vector<Student> students = {{"Alice", 85}, {"Bob", 92}};

    for (const auto& s : students) {
        cout << s.name << ": " << s.grade << endl;
    }

    return 0;
}
```
""",
    "java": """
You are a senior Java developer. Generate Java code based on the given design description.

Rules:
- Output ONLY valid Java code wrapped in a single markdown code block with the language label "java".
- Use standard Java libraries only (java.util, java.io, java.math, etc.).
- Write clean, well-structured code with helpful comments where needed.
- Include a public class with a main() method that demonstrates the functionality.
- Use descriptive variable, method, and class names.
- Prefer simple, readable solutions over complex optimizations.
- Follow Java naming conventions (camelCase methods, PascalCase classes).
- Do NOT include explanations before or after the code block.

Example output for "A program that finds the largest number in an array":
```java
import java.util.Arrays;

public class LargestNumber {
    public static int findLargest(int[] numbers) {
        int largest = numbers[0];
        for (int num : numbers) {
            if (num > largest) {
                largest = num;
            }
        }
        return largest;
    }

    public static void main(String[] args) {
        int[] numbers = {3, 7, 2, 9, 5};
        System.out.println("Largest: " + findLargest(numbers));
    }
}
```
""",
}


GTEST_PROMPT = """
You are a senior C++ developer writing Google Test unit tests. Given a C++ implementation and the original design description, write comprehensive GTest test cases.

Rules:
- Output ONLY valid C++ code wrapped in a single markdown code block with the label "cpp".
- Use #include <gtest/gtest.h>
- Use TEST() macro to organize test cases
- Use EXPECT_EQ(), EXPECT_TRUE(), EXPECT_FALSE() for assertions
- Cover functional (happy path) test cases
- Cover edge cases (empty inputs, boundaries, invalid inputs)
- Use descriptive test case names
- Do NOT include a main() function (assume gtest_main is linked)
- Write clean code with helpful comments where needed
- Keep tests beginner-friendly and readable

Example GTest structure:
```cpp
#include <gtest/gtest.h>
#include "calculator.h"

TEST(CalculatorTest, AddTwoNumbers) {
    EXPECT_EQ(add(2, 3), 5);
}

TEST(CalculatorTest, AddWithZero) {
    EXPECT_EQ(add(0, 5), 5);
    EXPECT_EQ(add(0, 0), 0);
}
```
"""


def detect_language(design: str, language: str = None) -> str:
    """
    Determines the programming language for code generation.

    If a language is explicitly provided, it is validated against supported languages.
    If no language is provided, the design description is analyzed for frontend-related keywords
    to decide between React (for UI descriptions) and C++ (for everything else).
    """
    if language:
        lang = language.strip().lower()
        if lang not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language: '{language}'. "
                f"Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
            )
        return lang

    design_lower = design.lower()
    for keyword in FRONTEND_KEYWORDS:
        if keyword in design_lower:
            return "react"

    return "cpp"


def build_code_prompt(design: str, language: str) -> tuple:
    """
    Builds the system and user prompts for code generation based on the target language.
    Returns (system_prompt, user_prompt).
    """
    system_prompt = LANGUAGE_PROMPTS[language]
    user_prompt = f"Design: {design}"
    return system_prompt, user_prompt


def _generate_gtest_code(design: str, implementation_code: str) -> str:
    """
    Generates Google Test code for a given C++ implementation using the Groq API.
    """
    user_prompt = (
        f"Design: {design}\n\n"
        f"C++ Implementation:\n"
        f"```cpp\n{implementation_code}\n```\n\n"
        f"Write comprehensive GTest unit tests for this implementation."
    )

    for attempt in range(2):
        try:
            resp = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[
                    {"role": "system", "content": GTEST_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=TEMPERATURE,
            )
            raw_output = resp.choices[0].message.content
            gtest_code = _extract_code_block(raw_output)
            if gtest_code.strip():
                return gtest_code.strip()
        except Exception as e:
            if attempt == 1:
                logger.error(f"Error generating GTest code: {e}")
                return "// GTest code generation failed."

    return "// GTest code generation failed."


def _extract_code_block(raw: str) -> str:
    """
    Extracts code from a markdown code block using regex.
    Handles blocks with optional language labels like ```python ... ```.
    Returns the raw string if no code fences are found.
    """
    text = raw.strip()

    if "```" in text:
        match = re.search(r"```(?:\w+)?\n(.*?)```", text, re.DOTALL)
        if match:
            return match.group(1).strip()

    return text


def generate_code(design: str, language: str = None) -> dict:
    """
    Generates code in the specified or detected language using the Groq API.
    Accepts an optional language parameter — if not provided, the language
    is auto-detected from the design description.

    For C++, also generates Google Test code.
    """
    lang = detect_language(design, language)
    system_prompt, user_prompt = build_code_prompt(design, lang)

    def _call_llm() -> str:
        resp = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=TEMPERATURE,
        )
        return resp.choices[0].message.content

    # Generate implementation code
    code = ""
    for attempt in range(2):
        try:
            raw_output = _call_llm()
            code = _extract_code_block(raw_output)
            if code.strip():
                break
        except Exception as e:
            if attempt == 1:
                logger.error(f"Error generating code for {lang} on retry attempt: {e}")
                code = ""

    result = {
        "language": lang,
        "code": code.strip() if code.strip() else "// Code generation failed. Please try again with a more detailed description."
    }

    # For C++, also generate GTest unit tests
    if lang == "cpp" and code.strip():
        result["gtest_code"] = _generate_gtest_code(design, code.strip())

    return result
