
function test(){try{const re=new RegExp($('#pattern').value,$('#flags').value);const text=$('#text').value;const matches=[...text.matchAll(re.global?re:new RegExp(re.source,re.flags+'g'))];$('#result').textContent=matches.length?matches.map((m,i)=>`${i+1}. "${m[0]}" — índice ${m.index}${m.length>1?` — grupos: ${m.slice(1).join(' | ')}`:''}`).join('\n'):'Nenhuma correspondência encontrada.';showStatus(`${matches.length} correspondência(s) encontrada(s).`);}catch(e){showStatus(`Expressão inválida: ${e.message}`,'error')}}
$('#test')?.addEventListener('click',test);
