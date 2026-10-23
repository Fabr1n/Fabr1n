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

// Compact dashboard inspired by lowlighter/metrics. Public calendar only.
const calendarResponse = await fetch(`https://github.com/users/${user}/contributions`, {headers:{'User-Agent':'profile-metrics'},signal:AbortSignal.timeout(45000)});
if(!calendarResponse.ok) throw new Error('Unable to fetch public contribution calendar: '+calendarResponse.status);
const calendarHTML = await calendarResponse.text();
const tooltipCounts = new Map();
for(const match of calendarHTML.matchAll(/<tool-tip\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/tool-tip>/g)) {
  const raw=match[2].replace(/<[^>]+>/g,'').trim();
  const found=raw.match(/^([\d,]+) contributions?\b/);
  tooltipCounts.set(match[1],found?Number(found[1].replaceAll(',','')):0);
}
const days=[];
for(const match of calendarHTML.matchAll(/<td\b[^>]*data-date="([^"]+)"[^>]*id="([^"]+)"[^>]*data-level="(\d+)"[^>]*>/g)) {
  if(!tooltipCounts.has(match[2])) throw new Error('Calendar markup changed: missing tooltip');
  days.push({date:match[1],level:Number(match[3]),count:tooltipCounts.get(match[2])});
}
days.sort((a,b)=>a.date.localeCompare(b.date));
if(days.length<350) throw new Error('Calendar markup changed or incomplete');
const contributions=days.reduce((n,d)=>n+d.count,0);
const weekday=Array(7).fill(0);
for(const d of days) weekday[new Date(d.date+'T12:00:00Z').getUTCDay()]+=d.count;
const hourly=Array(24).fill(0);
const pushes=events.filter(e=>e.type==='PushEvent');
for(const e of pushes) {
 const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'America/Sao_Paulo'}).format(new Date(e.created_at)));
 hourly[hour]++;
}
let spotify={status:'not-connected',tracks:[],updated:null};
const credentials=['SPOTIFY_CLIENT_ID','SPOTIFY_CLIENT_SECRET','SPOTIFY_REFRESH_TOKEN'];
if(credentials.every(key=>process.env[key])) {
  try {
    const auth=Buffer.from(process.env.SPOTIFY_CLIENT_ID+':'+process.env.SPOTIFY_CLIENT_SECRET).toString('base64');
    const tr=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:process.env.SPOTIFY_REFRESH_TOKEN}),signal:AbortSignal.timeout(15000)});
    if(!tr.ok) throw new Error('Spotify authorization '+tr.status);
    const token=await tr.json();
    const response=await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});
    if(!response.ok) {
      const body=await response.text();
      let message=body;
      try { const detail=JSON.parse(body); message=detail.error?.message||detail.error_description||detail.error||body; } catch {}
      message=String(message).replace(/[\r\n]+/g,' ').slice(0,500);
      for(const key of credentials) message=message.split(process.env[key]).join('[redacted]');
      message=message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email redacted]');
      throw new Error('Spotify history '+response.status+': '+message);
    }
    const history=await response.json();
    const unique=new Map();
    for(const item of history.items||[]) if(item.track&&!unique.has(item.track.id)) unique.set(item.track.id,{name:item.track.name,artists:item.track.artists.map(a=>a.name).join(', '),url:item.track.external_urls.spotify});
    spotify={status:'connected',tracks:[...unique.values()].slice(0,3),updated:now.toISOString()};
  } catch(error) {
    console.warn('::warning::'+error.message);
    spotify.status='temporarily-unavailable';
  }
}
const green=['#161b22','#0e4429','#006d32','#26a641','#39d353'];
const parts=[];
const T=(x,y,s,size=14,c='#8b949e',w=400)=>parts.push(text(x,y,s,size,c,w));
const line=(x1,y1,x2,y2,c='#30363d')=>parts.push(`<path d="M${x1} ${y1}H${x2}" stroke="${c}"/>`);
T(24,34,'Tiago Fabrini',24,'#58a6ff',650);
T(24,58,'Researcher @ CEIA · PDC · Software Engineering @ UFG',12);
T(24,91,contributions+' contributions',17,'#c9d1d9',600);
T(24,113,days[0].date+' — '+days.at(-1).date,11);
for(const [i,d] of days.slice(-20).entries()) parts.push(`<rect x="${270+i*9}" y="85" width="7" height="7" rx="1" fill="${green[d.level]}"/>`);
const summary=[
[repositories.length+' public repositories',profile.followers+' followers'],
[stats[1][0]+' stars · owned originals',original.reduce((n,r)=>n+r.forks_count,0)+' forks · owned originals'],
[events.length+' recent public events',Object.keys(languages).length+' languages in public code']
];
summary.forEach((row,i)=>{T(24,150+i*28,row[0],13,'#c9d1d9');T(270,150+i*28,row[1],13,'#c9d1d9');});
line(24,222,466,222);
T(24,251,'Coding activity',17,'#58a6ff',600);
T(24,274,'Public push events by hour · São Paulo',12);
T(24,292,`Sample: ${pushes.length} pushes in ${events.length} recent public events`,10);
const maxH=Math.max(1,...hourly);
hourly.forEach((n,h)=>{const x=28+h*18,height=n/maxH*65;parts.push(`<rect x="${x}" y="${376-height}" width="10" height="${height||1}" rx="3" fill="${n?'#39d353':'#21262d'}"/>`);if(n)T(x,370-height,n,9);if(h%3===0)T(x,393,String(h).padStart(2,'0'),9);});
T(24,431,'Contributions by weekday',12);
const maxD=Math.max(1,...weekday);
weekday.forEach((n,i)=>{const x=30+i*61,height=n/maxD*76;parts.push(`<rect x="${x}" y="${536-height}" width="20" height="${height||1}" rx="4" fill="#26a641"/>`);T(x,530-height,n,10);T(x-2,554,['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i],11);});
T(24,600,'Languages & technologies',17,'#58a6ff',600);
const tech=['Python','Go','JavaScript','Node.js','Express','MySQL','Git','HTML / CSS'];
tech.forEach((name,i)=>{const x=24+(i%4)*110,y=619+Math.floor(i/4)*35;parts.push(`<rect x="${x}" y="${y}" width="100" height="26" rx="5" fill="#161b22" stroke="#30363d"/>`);T(x+10,y+18,name,12,'#c9d1d9');});
T(24,716,'Interests: AI · Robotics · Scientific computing',12);
T(510,34,'Contributions calendar',17,'#58a6ff',600);
T(510,58,'Public GitHub calendar · isometric view',12);
// Isometric grid: one column per week, one row per weekday.
const firstDate=new Date(days[0].date+'T00:00:00Z');
for(const d of days) {
 const date=new Date(d.date+'T00:00:00Z');
 const index=Math.round((date-firstDate)/86400000);
 const week=Math.floor((index+firstDate.getUTCDay())/7),day=date.getUTCDay();
 const x=566+week*6.8-day*7.3,y=112+week*2.15+day*4.3;
 const height=d.count?Math.min(44,5+Math.sqrt(d.count)*5):0;
 const top=`${x},${y-height} ${x+6},${y+2-height} ${x-0.5},${y+6-height} ${x-6.5},${y+4-height}`;
 if(height) {
   parts.push(`<polygon points="${x-6.5},${y+4-height} ${x-0.5},${y+6-height} ${x-0.5},${y+6} ${x-6.5},${y+4}" fill="#0e4429"/>`);
   parts.push(`<polygon points="${x-0.5},${y+6-height} ${x+6},${y+2-height} ${x+6},${y+2} ${x-0.5},${y+6}" fill="#006d32"/>`);
 }
 parts.push(`<polygon points="${top}" fill="${d.count?green[d.level]:'#21262d'}"><title>${d.date}: ${d.count} contributions</title></polygon>`);
}
T(510,279,'Less',10);green.forEach((c,i)=>parts.push(`<rect x="${542+i*15}" y="269" width="11" height="11" rx="2" fill="${c}"/>`));T(624,279,'More',10);
T(510,316,'Spotify · Recently played',17,'#1db954',600);
T(510,338,'Listening history · refreshed with the dashboard',11);
if(spotify.status==='connected'&&spotify.tracks.length) {
 spotify.tracks.forEach((track,i)=>{
 const y=370+i*47;
 T(514,y,'♫',21,'#1db954');
 T(544,y,track.name.length>43?track.name.slice(0,40)+'…':track.name,14,'#c9d1d9');
 T(544,y+17,track.artists.length>55?track.artists.slice(0,52)+'…':track.artists,11);
 });
} else {
 T(514,380,spotify.status==='not-connected'?'Spotify connection pending':spotify.status==='connected'?'No recent tracks returned':'Spotify temporarily unavailable',14,'#c9d1d9');
 T(514,405,spotify.status==='not-connected'?'Ready for your authorization.':'Listening data will refresh on the next successful run.',12);
 T(514,428,'No sample tracks or simulated listening data.',11);
}
T(510,520,'Most used languages',17,'#58a6ff',600);
T(510,543,'Code bytes · public owned repositories · excludes forks',11);
let offset=510;
rows.forEach(([name,bytes],i)=>{const width=total?bytes/total*442:0;parts.push(`<rect x="${offset}" y="563" width="${width}" height="8" fill="${palette[i]}"/>`);offset+=width;});
rows.forEach(([name,bytes],i)=>{const x=510+(i%2)*220,y=599+Math.floor(i/2)*25;parts.push(`<circle cx="${x+4}" cy="${y-4}" r="4" fill="${palette[i]}"/>`);T(x+15,y,name+' '+(total?bytes/total*100:0).toFixed(1)+'%',12);});
T(510,716,'Language share measures code volume, not proficiency.',11);
line(24,740,952,740);
T(24,765,'Updated '+updated+' · GitHub public data · Spotify requires a separate connection',10);
const dashboard=`<svg xmlns="http://www.w3.org/2000/svg" width="976" height="784" viewBox="0 0 976 784" role="img" aria-labelledby="dashboard-title"><title id="dashboard-title">Tiago Fabrini: GitHub activity, isometric contributions, languages and Spotify listening status</title><rect width="976" height="784" rx="12" fill="#0d1117"/><g font-family="Segoe UI,Arial,sans-serif">${parts.join('')}</g></svg>\n`;
await writeFile(`${output}/dashboard.svg`,dashboard);
await writeFile(`${output}/calendar.json`,JSON.stringify({updated:now.toISOString(),source:`https://github.com/users/${user}/contributions`,contributions,days},null,2)+'\n');
console.log(`Compact dashboard: ${days.length} calendar days, ${contributions} contributions; Spotify: ${spotify.status}.`);
