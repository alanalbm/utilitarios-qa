
$('#generate')?.addEventListener('click',async()=>{const algo=$('#algorithm').value;const data=new TextEncoder().encode($('#input').value);const digest=await crypto.subtle.digest(algo,data);$('#result').textContent=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');showStatus(`Hash ${algo.replace('-','-')} calculado no navegador.`);});
