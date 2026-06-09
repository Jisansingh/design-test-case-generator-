import os
import re
import subprocess
import tempfile
import logging

logger = logging.getLogger(__name__)

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


def compile_program(source_path: str, output_path: str) -> None:
    result = subprocess.run(
        ["g++", "-g", "-o", output_path, source_path],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Compilation failed: {result.stderr}")
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
            func_part = line.split("`")[1]
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
