
$('#encode')?.addEventListener('click',()=>{$('#output').value=encodeURIComponent($('#input').value);showStatus('Texto codificado para URL.');});
$('#decode')?.addEventListener('click',()=>{try{$('#output').value=decodeURIComponent($('#input').value);showStatus('URL decodificada.');}catch{showStatus('Conteúdo inválido para decodificação.','error')}});
