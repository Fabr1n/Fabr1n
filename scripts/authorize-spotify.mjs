import http from 'node:http';
import {randomBytes} from 'node:crypto';

const base='http://127.0.0.1:8888';
const redirect=base+'/callback';
let session=null;
const csrf=randomBytes(32).toString('hex');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=body=>'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Conectar Spotify ao perfil</title><style>body{max-width:720px;margin:50px auto;padding:24px;background:#0d1117;color:#c9d1d9;font:16px system-ui}h1{color:#1db954}label{display:block;margin-top:24px}input,textarea{box-sizing:border-box;width:100%;padding:12px;margin-top:8px;background:#161b22;color:#fff;border:1px solid #30363d;border-radius:6px}button{margin-top:24px;padding:12px 24px;background:#1db954;color:#000;border:0;border-radius:6px;font-weight:700}a{color:#58a6ff}code{color:#56d4bc}</style>'+body+'</html>';
const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  if(req.headers.host!=='127.0.0.1:8888'){res.writeHead(403);return res.end('Host inválido');}
  const url=new URL(req.url,base);
  if(req.method==='GET'&&url.pathname==='/') return res.end(page(`<h1>Spotify no seu GitHub</h1><p>Este assistente local solicita apenas leitura das músicas recentes. Os nomes e artistas das três faixas distintas mais recentes serão publicados no seu perfil do GitHub.</p><p>Crie um app no <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">Spotify Developer Dashboard</a> e configure o Redirect URI como <code>${redirect}</code>.</p><form action="/start" method="post"><input type="hidden" name="csrf" value="${csrf}"><label>Client ID<input name="client_id" required autocomplete="off"></label><label>Client Secret<input name="client_secret" type="password" required autocomplete="off"></label><button>Continuar para autorização no Spotify</button></form><p>Os valores ficam somente na memória deste processo. Não os envie pelo chat.</p>`));
  if(req.method==='POST'&&url.pathname==='/start'){
    if(req.headers.origin!==base){res.writeHead(403);return res.end('Origem inválida');}
    let body='';
    for await(const chunk of req){body+=chunk;if(body.length>8192){res.writeHead(413);return res.end('Pedido muito grande');}}
    const form=new URLSearchParams(body);
    if(form.get('csrf')!==csrf){res.writeHead(403);return res.end('Pedido inválido');}
    const id=form.get('client_id')?.trim(),secret=form.get('client_secret')?.trim();
    if(!id||!secret){res.writeHead(400);return res.end('Preencha os dois campos');}
    session={id,secret,state:randomBytes(32).toString('hex'),created:Date.now()};
    const params=new URLSearchParams({client_id:id,response_type:'code',redirect_uri:redirect,scope:'user-read-recently-played',state:session.state});
    res.writeHead(303,{Location:'https://accounts.spotify.com/authorize?'+params});return res.end();
  }
  if(req.method==='GET'&&url.pathname==='/callback'){
    if(!session||Date.now()-session.created>600000||url.searchParams.get('state')!==session.state){res.writeHead(400);return res.end('Autorização inválida ou expirada. Reinicie em '+base);}
    const current=session;session=null;
    if(url.searchParams.has('error')) return res.end(page('<h1>Autorização não concluída</h1><p>Você pode fechar esta página ou tentar novamente.</p>'));
    const code=url.searchParams.get('code');
    if(!code){res.writeHead(400);return res.end('Código ausente');}
    try{
      const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(current.id+':'+current.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirect}),signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw new Error('Spotify retornou HTTP '+response.status);
      const tokens=await response.json();
      if(!tokens.refresh_token) throw new Error('Spotify não retornou refresh token');
      res.end(page(`<h1>Autorização concluída</h1><p>Salve estes três valores em <a href="https://github.com/Fabr1n/Fabr1n/settings/secrets/actions" target="_blank" rel="noreferrer">GitHub → Settings → Secrets and variables → Actions</a>, como Repository secrets.</p><label>SPOTIFY_CLIENT_ID<textarea readonly>${escape(current.id)}</textarea></label><label>SPOTIFY_CLIENT_SECRET<textarea readonly>${escape(current.secret)}</textarea></label><label>SPOTIFY_REFRESH_TOKEN<textarea readonly>${escape(tokens.refresh_token)}</textarea></label><p>Depois execute <a href="https://github.com/Fabr1n/Fabr1n/actions/workflows/metrics.yml" target="_blank" rel="noreferrer">Profile metrics → Run workflow</a>. Feche esta aba e encerre este assistente com Ctrl+C.</p><p>Não salve estes valores em arquivos do repositório.</p>`));
    }catch(error){res.writeHead(502);res.end(page('<h1>Não foi possível concluir</h1><p>'+escape(error.message)+'</p><a href="/">Tentar novamente</a>'));}
    return;
  }
  res.writeHead(404);res.end('Não encontrado');
});
server.listen(8888,'127.0.0.1',()=>console.log('Abra '+base+' no navegador. Encerre com Ctrl+C. Nenhuma credencial será registrada no terminal.'));
