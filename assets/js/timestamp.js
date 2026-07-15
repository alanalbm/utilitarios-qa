
function updateNow(){const d=new Date();$('#result').textContent=`Unix (s): ${Math.floor(d.getTime()/1000)}\nUnix (ms): ${d.getTime()}\nISO 8601: ${d.toISOString()}\nLocal: ${d.toLocaleString('pt-BR')}`;}
$('#now')?.addEventListener('click',()=>{updateNow();showStatus('Data e hora atuais convertidas.');});
$('#convert')?.addEventListener('click',()=>{const v=$('#input').value.trim();let d;if(/^\d+$/.test(v)){let n=Number(v);if(v.length<=10)n*=1000;d=new Date(n);}else d=new Date(v);if(Number.isNaN(d.getTime()))return showStatus('Informe um timestamp ou uma data válida.','error');$('#result').textContent=`Unix (s): ${Math.floor(d.getTime()/1000)}\nUnix (ms): ${d.getTime()}\nISO 8601: ${d.toISOString()}\nLocal: ${d.toLocaleString('pt-BR')}`;showStatus('Valor convertido.');});
