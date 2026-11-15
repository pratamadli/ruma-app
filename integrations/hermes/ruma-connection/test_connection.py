import importlib.util
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location("ruma_connection", Path(__file__).with_name("__init__.py"))
plugin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plugin)
CODE = "ABCD-1234-ABCD-1234-ABCD-1234"


def source(sender, **fields):
    return SimpleNamespace(platform="telegram", chat_type=fields.get("chat_type", "dm"),
                           user_id=sender, chat_id=fields.get("chat_id", sender), is_bot=False)


class ConnectionTests(unittest.TestCase):
    def test_uses_transport_identity_and_keeps_households_separate(self):
        with patch.object(plugin, "_request", side_effect=[
            {"linked": True, "household": {"name": "Household A"}},
            {"linked": True, "household": {"name": "Household B"}},
        ]) as request:
            first = plugin.handle_command("connect\na@example.test\n" + CODE, platform="telegram", source=source("100"))
            second = plugin.handle_command("connect b@example.test " + CODE, platform="telegram", source=source("200"))
        self.assertIn("Household A", first)
        self.assertNotIn("Household B", first)
        self.assertIn("Household B", second)
        self.assertEqual([call.args[2] for call in request.call_args_list], ["100", "200"])

    def test_rejects_groups_missing_identity_and_forged_sender_argument(self):
        with patch.object(plugin, "_request") as request:
            for event in [None, source("100", chat_type="group"), source("100", chat_id="200")]:
                self.assertIn("private Telegram", plugin.handle_command("status", platform="telegram", source=event))
            self.assertIn("one-time code", plugin.handle_command("connect a@example.test " + CODE + " 999", platform="telegram", source=source("100")))
            request.assert_not_called()

    def test_connector_builds_authenticated_request_without_redirects(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'{"linked":true,"household":{"name":"Test"}}'
        opener = MagicMock()
        opener.open.return_value = response
        with patch.dict(os.environ, {"RUMA_API_URL": "https://api.example.test", "HERMES_SERVICE_TOKEN": "test-service-token-at-least-32-characters"}), patch.object(plugin, "build_opener", return_value=opener) as build:
            result = plugin._request("POST", "connect", "100", {"email": "a@example.test", "code": CODE})
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.example.test/v1/integrations/hermes/telegram/connect")
        self.assertEqual(request.get_header("X-telegram-user-id"), "100")
        self.assertEqual(json.loads(request.data)["code"], CODE)
        self.assertIsInstance(build.call_args.args[0], plugin.NoRedirect)
        self.assertTrue(result["linked"])

    def test_rejects_public_http_and_does_not_claim_success_on_errors(self):
        for url in ["http://api.example.test", "https://api.example.test:invalid"]:
            with patch.dict(os.environ, {"RUMA_API_URL": url, "HERMES_SERVICE_TOKEN": "test-service-token-at-least-32-characters"}), patch.object(plugin, "build_opener") as build:
                with self.assertRaises(plugin.ConnectionFailure):
                    plugin._request("GET", "connection", "100")
                build.assert_not_called()
        with patch.object(plugin, "_request", side_effect=plugin.ConnectionFailure("Unavailable")):
            self.assertEqual(plugin.handle_command("status", platform="telegram", source=source("100")), "Connection error: Unavailable")
        with patch.object(plugin, "_request", return_value={"linked": False}):
            self.assertIn("Connection error:", plugin.handle_command("connect a@example.test " + CODE, platform="telegram", source=source("100")))


if __name__ == "__main__":
    unittest.main()
