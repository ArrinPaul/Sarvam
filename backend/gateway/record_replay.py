"""Record/replay boundary (SSOT FR-26, ADR-108).

RECORD stores the raw provider response (search, fetch and every individual LLM attempt) under
record_dir. REPLAY serves them deterministically with no network and no API keys; a miss is a typed
BLOCKED error. A replayed run is always labelled REPLAY and never presented as live.

Files are flat and content-addressed: <record_dir>/<kind>-<key[:16]>.json. The Nth identical request
within one run (same kind and key material, N >= 1) is stored as <kind>-<key[:16]>-<N>.json, so a
request whose answer changes between attempts (a timeout, then the retry that succeeds) replays
exactly as it happened. Replay is strict: attempt N of a request needs recorded attempt N.
"""

from __future__ import annotations

import hashlib
import json
from collections.abc import Awaitable, Callable
from enum import StrEnum
from pathlib import Path
from typing import Any

from backend.gateway import GatewayError
from contracts.models import FailureType


class RecordMode(StrEnum):
    OFF = "off"
    RECORD = "record"
    REPLAY = "replay"


def cache_key(key_material: dict[str, Any]) -> str:
    canonical = json.dumps(key_material, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class RecordReplay:
    def __init__(self, record_dir: str | Path, mode: RecordMode) -> None:
        self.record_dir = Path(record_dir)
        self.mode = mode
        self._attempts: dict[tuple[str, str], int] = {}
        self._models: list[str] | None = None

    def _path(self, kind: str, key: str, attempt: int = 0) -> Path:
        suffix = f"-{attempt}" if attempt else ""
        return self.record_dir / f"{kind}-{key[:16]}{suffix}.json"

    def _recorded_models(self) -> list[str]:
        """Model names present in the recorded LLM requests, sorted, read once."""
        if self._models is None:
            found: set[str] = set()
            for path in self.record_dir.glob("llm-*.json"):
                try:
                    model = json.loads(path.read_text(encoding="utf-8"))["key"].get("model")
                except (OSError, ValueError, KeyError, AttributeError):
                    continue
                if isinstance(model, str):
                    found.add(model)
            self._models = sorted(found)
        return self._models

    def _replay_key(self, kind: str, key_material: dict[str, Any]) -> str:
        """The key to replay under.

        A recording is made with specific model names. If the configured model differs (for
        example a different .env), the same request is still found by trying the models the
        recording actually contains. Only the model field is substituted: the messages, which
        carry the role, prompt id and all inputs, must match exactly (B-39).
        """
        key = cache_key(key_material)
        if kind != "llm" or self._path(kind, key).exists():
            return key
        for model in self._recorded_models():
            alt = cache_key({**key_material, "model": model})
            if self._path(kind, alt).exists():
                return alt
        return key

    async def call(
        self,
        kind: str,
        key_material: dict[str, Any],
        live: Callable[[], Awaitable[dict[str, Any]]],
    ) -> dict[str, Any]:
        """Return the JSON-serialisable response for one provider call (live, recorded or replayed).

        Typed GatewayErrors are recorded and replayed too, so failure paths reproduce.
        """
        if self.mode is RecordMode.OFF:
            return await live()
        key = (
            self._replay_key(kind, key_material)
            if self.mode is RecordMode.REPLAY
            else cache_key(key_material)
        )
        # Counted synchronously at call time, so the order is the gateway's admission order.
        attempt = self._attempts.get((kind, key), 0)
        self._attempts[(kind, key)] = attempt + 1
        path = self._path(kind, key, attempt)
        if self.mode is RecordMode.REPLAY:
            if not path.exists():
                raise GatewayError(
                    FailureType.BLOCKED, f"replay miss: {path.stem} (attempt {attempt + 1})"
                )
            saved = json.loads(path.read_text(encoding="utf-8"))
            if "error" in saved:
                err = saved["error"]
                raise GatewayError(FailureType(err["failure"]), err["message"])
            return saved["response"]
        try:
            response = await live()
        except GatewayError as exc:
            self._write(path, {"key": key_material, "attempt": attempt, "error": _error(exc)})
            raise
        self._write(path, {"key": key_material, "attempt": attempt, "response": response})
        return response

    def _write(self, path: Path, data: dict[str, Any]) -> None:
        self.record_dir.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, sort_keys=True, default=str), encoding="utf-8")


def _error(exc: GatewayError) -> dict[str, str]:
    return {"failure": exc.failure.value, "message": exc.message}
