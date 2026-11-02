"""Run provider-boundary integration tests against an isolated PostgreSQL database."""
import json, os, re, shutil, subprocess
from pathlib import Path
root = Path(__file__).resolve().parent.parent
cfg = json.loads((root / '.local/settings.json').read_text())
connection = cfg.get('integrationConnectionString') or re.sub(r'(?i)Database=("[^"]*"|[^;]*)', 'Database=clubline_gateway_tests', cfg.get('localConnectionString', cfg['connectionString']))
env = os.environ.copy()
env.update({'ConnectionStrings__Database': connection, 'ASPNETCORE_ENVIRONMENT': 'Development', 'App__MigrateOnStart': 'true', 'App__SeedDemo': 'false', 'App__WorkersEnabled': 'false', 'App__VerifyStampEveryRequest': 'true', 'App__PublicUrl': 'http://localhost', 'App__DataPath': str(root / '.local/gateway-test-data'), 'Billing__SecretKey': 'sk_test_transport_fixture', 'Billing__WebhookSecret': 'gateway-test-signature-secret', 'Billing__ClubPriceId': 'price_club_fixture', 'Billing__CommunityPriceId': 'price_community_fixture', 'Billing__LiveMode': 'false', 'Logging__LogLevel__Default': 'Warning', 'Logging__LogLevel__Microsoft': 'Warning'})
dotnet = os.environ.get('DOTNET_BIN') or shutil.which('dotnet') or str(root.parent / 'dotnet/dotnet')
raise SystemExit(subprocess.call([dotnet, 'test', 'api/Clubline.IntegrationTests', '--logger', 'trx;LogFileName=integration.trx'], cwd=root, env=env))
