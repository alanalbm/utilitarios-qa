
const utf8ToB64=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s)));const b64ToUtf8=s=>new TextDecoder().decode(Uint8Array.from(atob(s),c=>c.charCodeAt(0)));
$('#encode')?.addEventListener('click',()=>{try{$('#output').value=utf8ToB64($('#input').value);showStatus('Texto codificado em Base64.');}catch(e){showStatus(e.message,'error')}});
$('#decode')?.addEventListener('click',()=>{try{$('#output').value=b64ToUtf8($('#input').value.trim());showStatus('Base64 decodificado.');}catch{showStatus('Conteúdo Base64 inválido.','error')}});
