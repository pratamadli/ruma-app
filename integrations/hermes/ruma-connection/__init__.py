"""Trusted /ruma connection commands; credentials never become model arguments."""

import json
import logging
import os
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

logger = logging.getLogger(__name__)
HELP = (
    "Open your RUMA household dashboard > Connect to Telegram.\n"
    "Send: /ruma connect <your RUMA email> <one-time code>\n"
    "Use /ruma status or /ruma disconnect. Never send your password."
)
CODE = re.compile(r"[A-F0-9]{4}(?:-[A-F0-9]{4}){5}", re.IGNORECASE)


class ConnectionFailure(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _request(method, action, sender_id, payload=None):
    base = os.environ.get("RUMA_API_URL", "").rstrip("/")
    token = os.environ.get("HERMES_SERVICE_TOKEN", "")
    try:
        url = urlsplit(base)
        valid = (
            url.hostname
            and not url.username and not url.password
            and not url.query and not url.fragment and not url.path
            and (url.port is None or 0 < url.port <= 65535)
            and (url.scheme == "https" or url.scheme == "http" and url.hostname in ("127.0.0.1", "localhost", "::1"))
        )
    except ValueError:
        valid = False
    if not valid or len(token) < 32:
        raise ConnectionFailure("RUMA connector is not configured. Ask the administrator to set its API origin and service token.")
    request = Request(
        base + "/v1/integrations/hermes/telegram/" + action,
        data=json.dumps(payload).encode("utf-8") if payload is not None else None,
        headers={"Authorization": "Bearer " + token, "x-telegram-user-id": sender_id, "Content-Type": "application/json"},
        method=method,
    )
    try:
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            raw = response.read(8193)
    except HTTPError as error:
        error.close()
        messages = {
            400: "Email or code is invalid, expired, or no longer authorized. Generate a new code in your household dashboard.",
            401: "RUMA connector authentication failed. Ask the administrator to check its service token.",
            404: "No active RUMA household connection was found, or the API endpoint is unavailable. Check your dashboard and the connector deployment.",
            409: "This Telegram account or RUMA user is already connected. Disconnect the existing connection first.",
            429: "Too many connection attempts. Wait a minute before trying again.",
        }
        logger.warning("ruma_connection_http_error status=%s", error.code)
        raise ConnectionFailure(messages.get(error.code, "RUMA is unavailable. No connection change could be confirmed.")) from None
    except (URLError, TimeoutError, OSError):
        logger.warning("ruma_connection_network_error")
        raise ConnectionFailure("RUMA could not be reached. Check /ruma status before retrying a connection change.") from None
    try:
        if len(raw) > 8192:
            raise ValueError("Response too large")
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError("Invalid response")
        return result
    except (ValueError, UnicodeError):
        raise ConnectionFailure("RUMA returned an invalid response. Check /ruma status before retrying.") from None


def handle_command(raw_args, *, platform="", source=None):
    source_platform = getattr(source, "platform", None)
    source_platform = getattr(source_platform, "value", source_platform)
    sender = getattr(source, "user_id", None)
    if (
        platform != "telegram" or source_platform != "telegram"
        or getattr(source, "chat_type", None) != "dm"
        or getattr(source, "is_bot", False)
        or not isinstance(sender, str) or not re.fullmatch(r"[1-9]\d{0,15}", sender)
        or getattr(source, "chat_id", None) != sender
    ):
        return "RUMA connection commands are available only in your private Telegram chat with the bot."
    parts = raw_args.split()
    try:
        if len(parts) == 3 and parts[0] == "connect":
            if "@" not in parts[1] or not CODE.fullmatch(parts[2]):
                return HELP
            result = _request("POST", "connect", sender, {"email": parts[1], "code": parts[2]})
        elif parts == ["status"]:
            result = _request("GET", "connection", sender)
        elif parts == ["disconnect"]:
            result = _request("DELETE", "connection", sender)
            if result.get("ok") is not True:
                raise ConnectionFailure("RUMA did not confirm disconnection. Check /ruma status.")
            return "Disconnected from RUMA. Your household data has not been deleted."
        else:
            return HELP
        household = result.get("household")
        if result.get("linked") is not True or not isinstance(household, dict) or not isinstance(household.get("name"), str):
            raise ConnectionFailure("RUMA did not confirm a household connection. Check your dashboard.")
        return "Connected to RUMA household: " + household["name"] + ".\nFinancial writes still require explicit confirmation."
    except ConnectionFailure as error:
        return "Connection error: " + str(error)


def register(ctx):
    ctx.register_command(
        "ruma",
        handler=handle_command,
        description="Connect your private Telegram chat to a verified RUMA household",
        args_hint="connect <email> <code> | status | disconnect",
    )
