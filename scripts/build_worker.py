"""Embed the PWA shell in the standalone hosted Worker."""
from pathlib import Path
import base64
import json
import mimetypes

ROOT = Path(__file__).resolve().parents[1]
dist = ROOT / 'dist'
assets = {}
for path in sorted(dist.rglob('*')):
    if not path.is_file() or path.relative_to(dist).parts[0] in ('server', '.openai'):
        continue
    mime = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
    assets['/' + path.relative_to(dist).as_posix()] = [mime,base64.b64encode(path.read_bytes()).decode('ascii')]
api = (ROOT / 'worker/edition.mjs').read_text()
if api.count('export default') != 1:
    raise ValueError('Expected a single default API handler')
router = """
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/edition') return editionHandler.fetch(request,env,ctx);
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
    const asset = embeddedAssets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Not found',{status:404});
    const headers={'Content-Type':asset[0], 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff'};
    const body=request.method==='HEAD'?null:Uint8Array.from(atob(asset[1]), c=>c.charCodeAt(0));
    return new Response(body,{headers});
  }
};
"""
output = dist / 'server/index.js'
output.parent.mkdir(exist_ok=True)
output.write_text(api.replace('export default','const editionHandler =') + '\nconst embeddedAssets=' + json.dumps(assets) + ';\n' + router)
