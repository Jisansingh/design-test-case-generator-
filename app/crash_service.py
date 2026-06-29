import os
import re
import signal
import subprocess
import tempfile
import time
import logging

logger = logging.getLogger("compiler")

CRASH_PROGRAM_SOURCE = """
#include <iostream>

void crashFunction() {
    std::cout << "About to crash..." << std::endl;
    int* p = nullptr;
    *p = 42;
}

void processRequest() {
    std::cout << "Processing request..." << std::endl;
    crashFunction();
}

int main() {
    std::cout << "Starting program..." << std::endl;
    processRequest();
    return 0;
}
"""


def write_source_file(directory: str) -> str:
    path = os.path.join(directory, "crash_sim.cpp")
    with open(path, "w") as f:
        f.write(CRASH_PROGRAM_SOURCE)
    logger.info(f"Wrote crash source to {path}")
    return path


def _run_compiler(command: list) -> subprocess.CompletedProcess:
    logger.info(f"Starting compilation...")
    logger.info(f"Compiler command: {' '.join(command)}")
    start = time.time()
    result = subprocess.run(command, capture_output=True, text=True)
    duration = time.time() - start
    if result.returncode != 0:
        logger.error(f"Compilation failed (exit code {result.returncode})")
        if result.stderr:
            logger.error(f"Compiler stderr:\n{result.stderr.strip()}")
        logger.info(f"Compilation time: {duration:.2f} sec")
        raise RuntimeError(f"Compilation failed: {result.stderr}")
    logger.info(f"Compilation completed successfully")
    logger.info(f"Compilation time: {duration:.2f} sec")
    return result


def compile_program(source_path: str, output_path: str) -> None:
    command = ["g++", "-g", "-o", output_path, source_path]
    _run_compiler(command)
    logger.info(f"Compiled {source_path} -> {output_path}")


def extract_backtrace(binary_path: str) -> list:
    cmds = "run\nbt\nquit\n"
    result = subprocess.run(
        ["lldb", "-b", "-s", "/dev/stdin", binary_path],
        input=cmds,
        capture_output=True, text=True,
    )
    output = result.stdout + result.stderr
    frames = _parse_backtrace(output)
    logger.info(f"Extracted {len(frames)} backtrace frames")
    return frames


def _parse_backtrace(output: str) -> list:
    frames = []
    seen = set()
    for line in output.split("\n"):
        if "frame #" in line and "`" in line:
            match = re.search(r"frame #(\d+)", line)
            frame_num = match.group(1) if match else "?"
            parts = line.split("`")
            if len(parts) < 2:
                continue
            func_part = parts[1]
            func_name = re.match(r"([^ ]+)", func_part)
            if func_name:
                name = func_name.group(1)
                if not name.endswith(")"):
                    name += "()"
                entry = f"#{frame_num} {name}"
                if entry not in seen:
                    seen.add(entry)
                    frames.append(entry)
    return frames


def _parse_structured_backtrace(output: str) -> list:
    frames = []
    seen = set()
    frame_pattern = re.compile(
        r"frame\s+#(\d+):\s+0x[0-9a-f]+\s+(\S+?)\s+at\s+([^:]+):(\d+)"
    )
    for line in output.split("\n"):
        match = frame_pattern.search(line)
        if match:
            frame_num = int(match.group(1))
            function = match.group(2)
            file_path = match.group(3)
            line_num = int(match.group(4))
            if not function.endswith(")"):
                function += "()"
            key = (frame_num, function, file_path, line_num)
            if key not in seen:
                seen.add(key)
                frames.append({
                    "frame": frame_num,
                    "function": function,
                    "file": file_path,
                    "line": line_num,
                })
    return frames


def _get_compiler_and_extension(language: str) -> tuple:
    lang = language.lower()
    if lang in ("c",):
        return "gcc", ".c"
    elif lang in ("cpp", "c++", "cxx"):
        return "g++", ".cpp"
    else:
        raise ValueError(f"Unsupported language for crash analysis: {language}")


def _compile_user_code(code: str, language: str, tmpdir: str) -> tuple:
    compiler, ext = _get_compiler_and_extension(language)
    source_path = os.path.join(tmpdir, f"user_code{ext}")
    binary_path = os.path.join(tmpdir, "user_code")
    with open(source_path, "w") as f:
        f.write(code)
    command = [compiler, "-g", "-o", binary_path, source_path]
    _run_compiler(command)
    logger.info(f"Compiled user {language} code -> {binary_path}")
    return source_path, binary_path


def _execute_with_timeout(binary_path: str, timeout: int = 5) -> dict:
    try:
        result = subprocess.run(
            [binary_path],
            capture_output=True, text=True,
            timeout=timeout,
        )
        exit_code = result.returncode
        sig = None
        if exit_code < 0:
            sig = -exit_code
        return {
            "exit_code": exit_code,
            "signal": sig,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired as e:
        return {
            "exit_code": -1,
            "signal": signal.SIGKILL if hasattr(signal, "SIGKILL") else 9,
            "stdout": e.stdout or "",
            "stderr": (e.stderr or "") + "\n[Execution timed out]",
        }


def _extract_backtrace_from_binary(binary_path: str, timeout: int = 10) -> list:
    cmds = "run\nbt\nquit\n"
    try:
        result = subprocess.run(
            ["lldb", "-b", "-s", "/dev/stdin", binary_path],
            input=cmds,
            capture_output=True, text=True,
            timeout=timeout,
        )
        output = result.stdout + result.stderr
        return _parse_structured_backtrace(output)
    except subprocess.TimeoutExpired:
        logger.warning(f"LLDB backtrace extraction timed out after {timeout}s for {binary_path}")
        return []


def analyze_user_code(code: str, language: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            source_path, binary_path = _compile_user_code(code, language, tmpdir)
        except RuntimeError as e:
            return {
                "crashed": False,
                "signal": None,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "backtrace": [],
            }
        exec_result = _execute_with_timeout(binary_path)
        crashed = exec_result["signal"] is not None or exec_result["exit_code"] != 0
        backtrace = []
        if crashed and exec_result["signal"] is not None:
            backtrace = _extract_backtrace_from_binary(binary_path)
        return {
            "crashed": crashed,
            "signal": exec_result["signal"],
            "exit_code": exec_result["exit_code"],
            "stdout": exec_result["stdout"],
            "stderr": exec_result["stderr"],
            "backtrace": backtrace,
        }


def simulate_crash() -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        source_path = write_source_file(tmpdir)
        binary_path = os.path.join(tmpdir, "crash_sim")
        compile_program(source_path, binary_path)
        backtrace = extract_backtrace(binary_path)
        status = "crashed" if backtrace else "failed"
        return {
            "status": status,
            "backtrace": backtrace,
        }
