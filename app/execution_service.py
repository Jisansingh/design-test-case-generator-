def simulate_test(test_description):
    # This function checks what kind of test it is by looking
    # at keywords in the description. It decides if the test
    # passes or fails based on simple rules.

    test_lower = test_description.lower()

    # Validation failures — things the app should reject
    if "empty password" in test_lower:
        return "FAIL", "Application did not reject empty password"
    elif "invalid username" in test_lower:
        return "FAIL", "Invalid username was not handled properly"
    elif "empty input" in test_lower:
        return "FAIL", "Empty input was accepted by the system"
    elif "null value" in test_lower:
        return "FAIL", "Null value caused unexpected behavior"
    elif "special character" in test_lower:
        return "FAIL", "Special characters were not sanitized correctly"

    # Security tests — protections working as expected
    elif "sql injection" in test_lower:
        return "PASS", "SQL injection attempt was blocked"
    elif "xss" in test_lower or "cross site" in test_lower:
        return "PASS", "Cross-site scripting was prevented"
    elif "unauthorized" in test_lower:
        return "PASS", "Unauthorized access was denied"
    elif "expired token" in test_lower:
        return "PASS", "Expired token was rejected correctly"
    elif "csrf" in test_lower:
        return "PASS", "CSRF token validation passed"
    elif "rate limit" in test_lower:
        return "PASS", "Rate limiting prevented abuse"

    # Edge cases — works correctly
    elif "unicode" in test_lower:
        return "PASS", "Unicode input was handled correctly"
    elif "long input" in test_lower or "large payload" in test_lower:
        return "PASS", "Large input was processed without errors"

    # Everything else passes by default
    else:
        return "PASS", "Test executed successfully"


def run_one_category(tests):
    # Helper that runs all tests in a single category
    # and returns a list of result dictionaries.
    results = []
    for test in tests:
        status, remarks = simulate_test(test)
        results.append({
            "test_case": test,
            "status": status,
            "remarks": remarks
        })
    return results


def execute_test_cases(functional, edge_cases, security):
    # Run each category separately
    functional_results = run_one_category(functional)
    edge_cases_results = run_one_category(edge_cases)
    security_results = run_one_category(security)

    # Count total, passed, and failed
    all_results = (
        functional_results
        + edge_cases_results
        + security_results
    )

    total_tests = len(all_results)
    total_passed = 0
    total_failed = 0

    for result in all_results:
        if result["status"] == "PASS":
            total_passed = total_passed + 1
        else:
            total_failed = total_failed + 1

    # Build the final report
    report = {
        "summary": {
            "total": total_tests,
            "passed": total_passed,
            "failed": total_failed
        },
        "functional": functional_results,
        "edge_cases": edge_cases_results,
        "security": security_results
    }

    return report


def generate_text_report(execution_report):
    # Takes the dictionary returned by execute_test_cases()
    # and builds a plain text report that is easy to read.

    summary = execution_report["summary"]
    functional = execution_report["functional"]
    edge_cases = execution_report["edge_cases"]
    security = execution_report["security"]

    # Start building the text report
    lines = []

    # Title
    lines.append("=" * 50)
    lines.append("           AI TEST EXECUTION REPORT")
    lines.append("=" * 50)
    lines.append("")

    # Summary section
    lines.append("SUMMARY")
    lines.append("-" * 50)
    lines.append(f"  Total Tests  :  {summary['total']}")
    lines.append(f"  Passed       :  {summary['passed']}")
    lines.append(f"  Failed       :  {summary['failed']}")
    lines.append("")

    # Helper to print a section of test results
    def print_section(lines, section_name, section_results):
        lines.append(section_name)
        lines.append("-" * 50)
        if len(section_results) == 0:
            lines.append("  (No tests in this category)")
        else:
            for result in section_results:
                status = result["status"]
                description = result["test_case"]
                remarks = result["remarks"]
                lines.append(f"  [{status}]  {description}")
                lines.append(f"           Remarks: {remarks}")
                lines.append("")
        lines.append("")

    # Print each category
    print_section(lines, "FUNCTIONAL TESTS", functional)
    print_section(lines, "EDGE CASES", edge_cases)
    print_section(lines, "SECURITY TESTS", security)

    # Footer
    lines.append("=" * 50)
    lines.append("           END OF REPORT")
    lines.append("=" * 50)

    # Join everything into one string
    report_text = "\n".join(lines)

    return report_text
