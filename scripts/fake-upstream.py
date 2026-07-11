from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def respond(self) -> None:
        status = 503 if self.path == "/api/v1/upstream-503" else 200
        length = int(self.headers.get("Content-Length", "0"))
        request_body = self.rfile.read(length).decode() if length else ""
        body = f"{self.command} {self.path} {request_body}\n".encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        self.respond()

    def do_POST(self) -> None:
        self.respond()

    def log_message(self, format: str, *args: object) -> None:
        return


ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
