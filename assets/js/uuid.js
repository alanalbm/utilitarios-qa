
function uuid(){if(crypto.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]%16,v=c==='x'?r:(r&3|8);return v.toString(16)});}
$('#generate')?.addEventListener('click',()=>{const count=Math.min(100,Math.max(1,Number($('#count').value)||1));$('#result').textContent=Array.from({length:count},uuid).join('\n');showStatus(`${count} UUID${count>1?'s':''} gerado${count>1?'s':''}.`);});
