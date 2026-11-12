"""Live inbox-only self-test. Reads local test credentials; never prints secrets/tokens.
BNI_INBOUND_TEST_CONFIG points to private credentials.json created by the operator.
"""
import base64,datetime,hashlib,hmac,json,os,pathlib,subprocess,sys,urllib.error,urllib.request
p=pathlib.Path(os.environ['BNI_INBOUND_TEST_CONFIG']);c=json.loads(p.read_text());base=sys.argv[1]
allowed=['https://www.matoer.id/api/integrasi/bni','https://qocejvxjfrmlpnejtcwh.supabase.co/functions/v1/matoer-bni']
if base not in allowed:raise SystemExit('Refusing unknown target')
results=[]
def call(name,path,body,headers):
 raw=json.dumps(body,separators=(',',':')).encode();req=urllib.request.Request(base+path,data=raw,headers={'Content-Type':'application/json',**headers},method='POST')
 try:
  with urllib.request.urlopen(req,timeout=25) as r:status=r.status;data=json.load(r)
 except urllib.error.HTTPError as e:status=e.code;data=json.load(e)
 safe={k:v for k,v in data.items() if k!='accessToken'};results.append({'scenario':name,'http':status,'response':safe});print(name,status,safe.get('responseCode',safe.get('error')));return status,data
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
sig=base64.b64encode(subprocess.run(['openssl','dgst','-sha256','-sign',str(p.parent/'selftest-bank-private.pem')],input=(c['selftestClientId']+'|'+stamp).encode(),stdout=subprocess.PIPE,check=True).stdout).decode()
h={'X-CLIENT-KEY':c['selftestClientId'],'X-TIMESTAMP':stamp,'X-SIGNATURE':sig}
s,t=call('RSA token normal','/get-token',{'grantType':'client_credentials'},h);assert s==200 and t['responseCode']=='2007300';token=t['accessToken']
s,_=call('RSA token forged','/get-token',{'grantType':'client_credentials'},{**h,'X-SIGNATURE':'AAAA'});assert s==401
s,_=call('Unregistered BNI signer remains disabled','/get-token',{'grantType':'client_credentials'},{**h,'X-CLIENT-KEY':c['clientId']});assert s==401
run=datetime.datetime.now().strftime('%Y%m%d%H%M%S');external='SELFTEST'+run
body={'originalReferenceNo':'MATOER-SELFTEST-'+run,'originalPartnerReferenceNo':'MATOER-SELFTEST-REF','latestTransactionStatus':'00','amount':{'value':'1.00','currency':'IDR'},'additionalInfo':{'test':True}}
def headers(b,ext=external):
 raw=json.dumps(b,separators=(',',':')).encode();string='POST:/api/integrasi/bni/callback:'+token+':'+hashlib.sha256(raw).hexdigest()+':'+stamp
 sig=base64.b64encode(hmac.new(c['selftestSecret'].encode(),string.encode(),hashlib.sha512).digest()).decode()
 return {'Authorization':'Bearer '+token,'X-PARTNER-ID':c['selftestClientId'],'X-TIMESTAMP':stamp,'X-SIGNATURE':sig,'X-EXTERNAL-ID':ext,'CHANNEL-ID':'API'}
s,_=call('Success notification to sandbox inbox','/callback',body,headers(body));assert s==200
s,_=call('Identical duplicate','/callback',body,headers(body));assert s==200
changed={**body,'latestTransactionStatus':'06'}
s,_=call('Reused external ID with different body','/callback',changed,headers(changed));assert s==409
s,_=call('Tampered body','/callback',changed,headers(body));assert s==401
s,_=call('Invalid token','/callback',body,{**headers(body),'Authorization':'Bearer invalid'});assert s==401
s,_=call('Failed notification to sandbox inbox','/callback',changed,headers(changed,external+'F'));assert s==200
out=p.parent/('live-app-evidence.json' if 'www.matoer.id' in base else 'live-edge-evidence.json');out.write_text(json.dumps({'base':base,'time':stamp,'selftestOnly':True,'results':results},indent=2));print('Verified',len(results),'cases')
