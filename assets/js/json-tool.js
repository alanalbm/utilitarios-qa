
$('#format')?.addEventListener('click',()=>{try{const o=JSON.parse($('#input').value);$('#output').value=JSON.stringify(o,null,2);showStatus('JSON válido e formatado.');}catch(e){showStatus(`JSON inválido: ${e.message}`,'error');}});
$('#minify')?.addEventListener('click',()=>{try{$('#output').value=JSON.stringify(JSON.parse($('#input').value));showStatus('JSON minificado.');}catch(e){showStatus(`JSON inválido: ${e.message}`,'error');}});
