import json,os,sys,shutil
from pathlib import Path
root=Path(__file__).resolve().parent.parent
cfg=json.loads((root/'.local/settings.json').read_text())
env=os.environ.copy();env.update({'ConnectionStrings__Database':cfg.get('localConnectionString',cfg['connectionString']),'ASPNETCORE_ENVIRONMENT':'Development','ASPNETCORE_URLS':'http://127.0.0.1:5225','App__PublicUrl':'http://127.0.0.1:3000','App__SeedDemo':'true','App__VerifyStampEveryRequest':'true','Billing__WebhookSecret':'clubline-local-webhook-fixture','Logging__LogLevel__Microsoft':'Warning','App__MigrateOnStart':'true','App__DevelopmentInbox':'true','App__DataPath':str(root/'.local/data')})
sdk=root.parent/'dotnet/dotnet'
dotnet=os.environ.get('DOTNET_BIN') or shutil.which('dotnet') or str(sdk)
if '--binary' in sys.argv:
 os.execvpe(dotnet,[dotnet,str(root/'api/Clubline.Api/bin/Debug/net10.0/Clubline.Api.dll')],env)
os.execvpe(dotnet,[dotnet,'run','--project',str(root/'api/Clubline.Api'),'--no-launch-profile']+sys.argv[1:],env)
