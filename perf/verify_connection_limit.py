#!/usr/bin/env python3
"""Verify Nginx limit_conn using slow, incomplete HTTP request bodies."""

import argparse
import json
import select
import socket
import time
from datetime import datetime, timezone


def open_slow_connection(host: str, port: int) -> socket.socket:
    connection = socket.create_connection((host, port), timeout=2)
    connection.sendall(
        (
            "POST /exchange HTTP/1.1\r\n"
            f"Host: {host}\r\n"
            "Content-Type: application/json\r\n"
            "Content-Length: 12000\r\n"
            "Connection: close\r\n"
            "\r\n"
            "{"
        ).encode()
    )
    return connection


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5555)
    parser.add_argument("--connections", type=int, default=25)
    parser.add_argument("--interval", type=float, default=0.06)
    parser.add_argument("--hold-seconds", type=float, default=2)
    args = parser.parse_args()

    connections: list[socket.socket] = []
    connection_errors: list[str] = []

    try:
        for _ in range(args.connections):
            try:
                connections.append(open_slow_connection(args.host, args.port))
            except OSError as error:
                connection_errors.append(str(error))
            time.sleep(args.interval)

        readable, _, _ = select.select(connections, [], [], 0.75)
        responses: dict[int, str] = {}
        for connection in readable:
            try:
                response = connection.recv(4096).decode(errors="replace")
                status_line = response.split("\r\n", 1)[0] if response else "closed"
            except OSError as error:
                status_line = f"socket error: {error}"
            responses[connection.fileno()] = status_line

        rejected = sum(" 429 " in status for status in responses.values())
        pending = sum(connection.fileno() not in responses for connection in connections)

        result = {
            "executedAt": datetime.now(timezone.utc).isoformat(),
            "target": f"http://{args.host}:{args.port}/exchange",
            "attemptedConnections": args.connections,
            "openedSockets": len(connections),
            "pendingIncompleteRequests": pending,
            "rejectedWith429": rejected,
            "connectionErrors": connection_errors,
            "immediateResponses": list(responses.values()),
            "expected": {
                "pendingIncompleteRequests": 20,
                "rejectedWith429": args.connections - 20,
            },
        }
        result["passed"] = (
            len(connections) == args.connections
            and pending == result["expected"]["pendingIncompleteRequests"]
            and rejected == result["expected"]["rejectedWith429"]
            and not connection_errors
        )

        print(json.dumps(result, indent=2))
        time.sleep(args.hold_seconds)
        return 0 if result["passed"] else 1
    finally:
        for connection in connections:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
