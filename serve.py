#!/usr/bin/env python3
"""Dev server with caching disabled, so edited ES modules always reload. Usage: python3 serve.py [port]

Admin proxy: requests to /_admin/<path> are forwarded to the Supabase project with the SECRET key attached, so the
browser never holds it (Supabase refuses secret keys sent from a browser anyway). The key comes from the
CORELINE_SECRET environment variable or a gitignored file named .supabase-secret next to this script.
"""
import os
import re
import sys
import urllib.request
import urllib.error
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))


def read_secret():
    key = os.environ.get('CORELINE_SECRET', '').strip()
    if not key:
        try:
            with open(os.path.join(HERE, '.supabase-secret')) as f:
                key = f.read().strip()
        except OSError:
            key = ''
    return key


def read_project_url():
    with open(os.path.join(HERE, 'src', 'config', 'cloud.js')) as f:
        m = re.search(r"url:\s*'([^']+)'", f.read())
    return m.group(1).rstrip('/') if m else ''


PROJECT = read_project_url()


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

    # ---- admin proxy ----
    def proxy(self):
        # only the local machine may use the proxy
        if self.client_address[0] not in ('127.0.0.1', '::1'):
            self.send_error(403, 'admin proxy is local only'); return
        SECRET = read_secret()   # read per request: dropping the file in needs no restart
        if self.path == '/_admin/status':
            body = b'{"configured": %s}' % (b'true' if SECRET and PROJECT else b'false')
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body); return
        if not SECRET or not PROJECT:
            self.send_error(503, 'set CORELINE_SECRET or create .supabase-secret'); return
        target = PROJECT + self.path[len('/_admin'):]
        length = int(self.headers.get('Content-Length') or 0)
        data = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() in ('content-type', 'prefer', 'accept', 'range', 'x-client-info')}
        headers['apikey'] = SECRET
        headers['Authorization'] = 'Bearer ' + SECRET
        req = urllib.request.Request(target, data=data, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read(); status = r.status; rh = r.headers
        except urllib.error.HTTPError as e:
            body = e.read(); status = e.code; rh = e.headers
        except Exception as e:  # network
            self.send_error(502, str(e)); return
        self.send_response(status)
        for k in ('Content-Type', 'Content-Range'):
            if rh.get(k): self.send_header(k, rh.get(k))
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith('/_admin/'): return self.proxy()
        return super().do_GET()

    def do_POST(self):
        if self.path.startswith('/_admin/'): return self.proxy()
        self.send_error(405)

    do_PUT = do_PATCH = do_DELETE = do_POST


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f'Coreline dev server on http://localhost:{port}/')
    print('admin proxy: ' + ('ready' if read_secret() and PROJECT else 'no secret yet (set CORELINE_SECRET or create .supabase-secret; no restart needed)'))
    ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
