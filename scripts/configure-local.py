"""Accept a database URI on hidden stdin and keep local secrets out of Git."""
import json,os,sys,termios
from pathlib import Path
from urllib.parse import urlparse,unquote
if sys.stdin.isatty():
    settings=termios.tcgetattr(sys.stdin.fileno());settings[3]&=~termios.ECHO;termios.tcsetattr(sys.stdin.fileno(),termios.TCSANOW,settings)
print('Ready for local database configuration on stdin.',flush=True)
value=json.loads(sys.stdin.readline());u=urlparse(value['uri'])
assert u.scheme in ('postgres','postgresql') and u.hostname
def q(s):return '"'+s.replace('"','""')+'"'
connection=';'.join([f'Host={u.hostname}',f'Port={u.port or 5432}',f'Database={q(u.path.lstrip("/"))}',f'Username={q(unquote(u.username or ""))}',f'Password={q(unquote(u.password or ""))}','SSL Mode=VerifyFull','Timeout=15'])
root=Path(__file__).resolve().parent.parent;local=root/'.local';local.mkdir(exist_ok=True)
p=local/'settings.json';p.write_text(json.dumps({'connectionString':connection}));p.chmod(0o600)
(root/'.env.local').write_text('API_INTERNAL_URL=http://127.0.0.1:5225\nNEXT_PUBLIC_APP_URL=http://127.0.0.1:3000\n')
print('Local database configuration saved. Credential values were not printed.',flush=True)
