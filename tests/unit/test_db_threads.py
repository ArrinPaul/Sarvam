"""Handlers run in a thread pool: each thread must get its own connection (no shared cursors)."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

from backend.store.db import ThreadLocalConnection, init_db


def test_each_thread_gets_its_own_connection_and_reads_are_consistent(tmp_path):
    path = tmp_path / "t.db"
    init_db(path).close()
    db = ThreadLocalConnection(path)
    db.execute("INSERT INTO settings (key, value_json, updated_at) VALUES ('k', 'v', 'now')")
    db.commit()

    seen: set[int] = set()
    guard = threading.Lock()

    def read(_: int) -> str | None:
        row = db.execute("SELECT value_json FROM settings WHERE key = 'k'").fetchone()
        with guard:
            seen.add(threading.get_ident())
        return row["value_json"] if row else None

    with ThreadPoolExecutor(16) as pool:
        results = list(pool.map(read, range(800)))

    assert results == ["v"] * 800
    assert len(db._opened) == len(seen) + 1  # one per pool thread, plus this thread's insert
    db.close()


def test_close_releases_every_connection(tmp_path):
    path = tmp_path / "t.db"
    init_db(path).close()
    db = ThreadLocalConnection(path)
    with ThreadPoolExecutor(4) as pool:
        list(pool.map(lambda _: db.execute("SELECT 1").fetchone(), range(20)))
    db.close()
    assert db._opened == []
