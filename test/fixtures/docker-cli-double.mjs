#!/usr/bin/env node
// A process-level Docker protocol double for lifecycle tests, NOT an OS sandbox.
import fs from 'node:fs';
import path from 'node:path';
const home = process.env.HOME, file = path.join(home,'fake-container.json'), log = path.join(home,'fake-calls.jsonl');
let args = process.argv.slice(2); if (args[0] === '--context') args = args.slice(2);
fs.appendFileSync(log,JSON.stringify(args)+'\n');
const scenario = fs.readFileSync(path.join(home,'scenario'),'utf8'), image = 'sha256:'+'a'.repeat(64);
const print = value => console.log(JSON.stringify([value]));
if(args[0] === 'context') print({Name:'test-local',Endpoints:{docker:{Host:scenario==='remote'?'tcp://remote:2375':'unix:///tmp/mock-only.sock'}}});
else if(args[0] === 'image') { if(scenario==='missing-image')process.exit(1);print({Id:image,Os:'linux',Config:{}}); }
else if(args[0] === 'create') {
  const get = key => args[args.indexOf(key)+1], name=get('--name'), entry=get('--entrypoint'), mount=get('--mount');
  const value={Image:image,Name:name,Config:{User:get('--user'),Labels:{'localmcp.check':name},Entrypoint:[entry],Cmd:args.slice(args.indexOf(image)+1)},
    HostConfig:{NetworkMode:'none',IpcMode:'none',ReadonlyRootfs:true,Privileged:scenario==='tampered',Init:true,CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],Memory:536870912,MemorySwap:536870912,PidsLimit:128,NanoCpus:1e9,Tmpfs:{'/tmp':'rw,nosuid,nodev,size=64m,mode=1777','/workspace':'rw,nosuid,nodev,size=128m,mode=1777'}},
    Mounts:[{Type:'bind',Source:mount.match(/src=(.*),dst=/)[1],Destination:'/input',RW:false}],State:{Running:false,ExitCode:0}};
  fs.writeFileSync(file,JSON.stringify(value)); console.log('b'.repeat(64));
} else if(args[0]==='container') print(JSON.parse(fs.readFileSync(file,'utf8')));
else if(args[0]==='start') {
  const v=JSON.parse(fs.readFileSync(file,'utf8'));v.State.Running=['timeout','unknown'].includes(scenario);v.State.ExitCode=scenario==='test-failed'?7:0;fs.writeFileSync(file,JSON.stringify(v));
  if(scenario==='timeout')setInterval(()=>{},1000);else{console.log('protocol-double-result');process.exitCode=v.State.ExitCode;}
} else if(args[0]==='rm') { if(scenario==='cleanup-failed')process.exit(1);fs.unlinkSync(file);console.log(args.at(-1)); }
else process.exit(9);
