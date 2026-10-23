import {mkdir, writeFile} from 'node:fs/promises';

const user = process.env.METRICS_USER || 'Fabr1n';
const output = process.env.METRICS_OUTPUT || 'assets/metrics';
const headers = {'Accept':'application/vnd.github+json','User-Agent':'profile-metrics','X-GitHub-Api-Version':'2022-11-28'};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
async function api(path) {
  const response = await fetch('https://api.github.com'+path, {headers, signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json();
}
const profile = await api(`/users/${user}`);
let repositories = [];
for (let page=1; ; page++) {
  const batch = await api(`/users/${user}/repos?type=owner&per_page=100&page=${page}`);
  repositories.push(...batch.filter(r=>!r.private));
  if (batch.length<100) break;
}
const original = repositories.filter(r=>!r.fork);
const languages = {};
for (const repo of original) {
  const values = await api(`/repos/${user}/${repo.name}/languages`);
  for (const [name,bytes] of Object.entries(values)) languages[name]=(languages[name]||0)+bytes;
}
// The public events API is a sample, not a full contribution calendar.
let events = [];
for(let page=1; page<=3; page++) {
  const batch = await api(`/users/${user}/events/public?per_page=100&page=${page}`);
  events.push(...batch);
  if(batch.length<100) break;
}
const now = new Date();
const updated = new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'America/Sao_Paulo'}).format(now);
const escape = value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const text = (x,y,value,size=14,color='#c9d1d9',weight=400)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}">${escape(value)}</text>`;
function card(title,subtitle,body,height=340) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}" role="img" aria-label="${escape(title+' — '+subtitle)}"><rect x="1" y="1" width="798" height="${height-2}" rx="16" fill="#0d1117" stroke="#30363d"/><g font-family="Segoe UI,Arial,sans-serif">${text(28,39,title,21,'#f0f6fc',600)}${text(28,64,subtitle,12,'#8b949e')}${body}${text(28,height-20,'PUBLIC DATA · GitHub API · Updated '+updated,11,'#8b949e')}</g></svg>\n`;
}
const stats = [
  [repositories.length,'Public repositories'],
  [original.reduce((n,r)=>n+r.stargazers_count,0),'Stars · owned originals'],
  [profile.followers,'Followers'],
  [Object.keys(languages).length,'Languages · owned originals']
];
const overview=card('GitHub at a glance','Fabr1n · Research, software engineering and open development',stats.map(([n,label],i)=>{
  const x=28+(i%2)*390,y=92+Math.floor(i/2)*94;
  return `<rect x="${x}" y="${y}" width="368" height="80" rx="10" fill="#161b22"/>${text(x+18,y+37,n,30,i%2?'#56d4bc':'#58a6ff',600)}${text(x+18,y+61,label,12)}`;
}).join(''),310);
const total = Object.values(languages).reduce((a,b)=>a+b,0);
const ranked = Object.entries(languages).sort((a,b)=>b[1]-a[1]);
const rows = ranked.slice(0,6);
if(ranked.length>6) rows.push(['Other',ranked.slice(6).reduce((n,r)=>n+r[1],0)]);
const palette=['#58a6ff','#56d4bc','#bc8cff','#e3b341','#f78166','#79c0ff','#8b949e'];
const langBody = rows.map(([name,bytes],i)=>{
  const y=104+i*32,percentage=total?bytes/total*100:0;
  return text(28,y,name,13)+`<rect x="150" y="${y-12}" width="530" height="12" rx="4" fill="#21262d"/><rect x="150" y="${y-12}" width="${(percentage*5.3).toFixed(2)}" height="12" rx="4" fill="${palette[i]}"/>`+text(705,y,percentage.toFixed(1)+'%',13);
}).join('');
const lang=card('Languages across public repositories','Share of code bytes · owned, non-fork repositories · not a proficiency score',langBody,Math.max(230,rows.length*32+135));
const names={PushEvent:'Pushes',IssuesEvent:'Issue activity',PullRequestEvent:'Pull request activity',IssueCommentEvent:'Issue comments',CreateEvent:'Branches / repositories',WatchEvent:'Stars given',ForkEvent:'Forks',PullRequestReviewEvent:'Reviews',PullRequestReviewCommentEvent:'Review comments',DeleteEvent:'Branch / tag deletions'};
const counts={};
for(const event of events) counts[event.type]=(counts[event.type]||0)+1;
const groups=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5);
const max=Math.max(1,...groups.map(r=>r[1]));
const oldest=events.length?events.at(-1).created_at.slice(0,10):'—';
const latest=events.length?events[0].created_at.slice(0,10):'—';
const activity=card('Recent public activity',`${events.length} events returned by GitHub · sample window: ${oldest} to ${latest}`,groups.map(([name,count],i)=>{
  const y=106+i*38;
  return text(28,y,names[name]||name,13)+`<rect x="205" y="${y-14}" width="490" height="18" rx="4" fill="#21262d"/><rect x="205" y="${y-14}" width="${count/max*490}" height="18" rx="4" fill="${i%2?'#56d4bc':'#58a6ff'}"/>`+text(722,y,count,14);
}).join('')+text(28,306,'Events include pushes, issues and discussions; they are not commit totals.',11,'#8b949e'),350);
await mkdir(output,{recursive:true});
for(const [name,svg] of Object.entries({overview,languages:lang,activity})) await writeFile(`${output}/${name}.svg`,svg);
await writeFile(`${output}/data.json`,JSON.stringify({updated:now.toISOString(),scope:'Public data only. Languages exclude forks. Events are a sample of at most 300.',repositories:repositories.length,stars:stats[1][0],followers:profile.followers,languages,eventCount:events.length,eventTypes:counts,oldest,latest},null,2)+'\n');
console.log(`Generated 3 metric panels from ${repositories.length} public repositories and ${events.length} events.`);
