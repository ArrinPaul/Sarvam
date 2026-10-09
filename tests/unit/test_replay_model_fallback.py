"""REPLAY finds a recorded LLM request even when the configured model name differs (B-39)."""

from __future__ import annotations

import asyncio

import pytest

from backend.gateway import GatewayError
from backend.gateway.record_replay import RecordMode, RecordReplay

MSGS = [{"role": "user", "content": "extractor.v1: hello"}]


def _call(rr: RecordReplay, model: str, messages=MSGS, live=None):
    async def default_live():
        return {"text": "ok"}

    key = {"model": model, "messages": messages, "temperature": 0.0}
    return asyncio.run(rr.call("llm", key, live or default_live))


def test_replay_uses_recorded_model_when_configured_model_differs(tmp_path):
    _call(RecordReplay(tmp_path, RecordMode.RECORD), "model-a")
    replay = RecordReplay(tmp_path, RecordMode.REPLAY)
    assert _call(replay, "model-b") == {"text": "ok"}


def test_exact_model_match_still_wins(tmp_path):
    rec = RecordReplay(tmp_path, RecordMode.RECORD)

    async def a():
        return {"text": "from-a"}

    async def b():
        return {"text": "from-b"}

    _call(rec, "model-a", live=a)
    _call(rec, "model-b", live=b)
    replay = RecordReplay(tmp_path, RecordMode.REPLAY)
    assert _call(replay, "model-b") == {"text": "from-b"}
    assert _call(RecordReplay(tmp_path, RecordMode.REPLAY), "model-a") == {"text": "from-a"}


def test_different_messages_still_miss(tmp_path):
    _call(RecordReplay(tmp_path, RecordMode.RECORD), "model-a")
    replay = RecordReplay(tmp_path, RecordMode.REPLAY)
    with pytest.raises(GatewayError, match="replay miss"):
        _call(replay, "model-b", messages=[{"role": "user", "content": "something else"}])


def test_repeated_identical_requests_replay_in_order(tmp_path):
    rec = RecordReplay(tmp_path, RecordMode.RECORD)
    answers = iter(["first", "second"])

    async def live():
        return {"text": next(answers)}

    _call(rec, "model-a", live=live)
    _call(rec, "model-a", live=live)
    replay = RecordReplay(tmp_path, RecordMode.REPLAY)
    assert _call(replay, "model-b")["text"] == "first"
    assert _call(replay, "model-b")["text"] == "second"
