from typing import Any, Optional


def success_response(data: Any = None, message: str = "Success") -> dict:
    response: dict[str, Any] = {
        "success": True,
        "message": message,
    }
    if data is not None:
        response["data"] = data
    return response


def error_response(
    error_type: str,
    message: str,
    details: Optional[str] = None,
) -> dict:
    error: dict[str, Any] = {
        "type": error_type,
        "message": message,
    }
    if details:
        error["details"] = details

    return {
        "success": False,
        "error": error,
    }
