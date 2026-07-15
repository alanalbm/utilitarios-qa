
function digits(n){return Array.from({length:n},()=>Math.floor(Math.random()*10));}
function cpfCheck(d){let s=0;for(let i=0;i<d.length;i++)s+=d[i]*(d.length+1-i);const r=(s*10)%11;return r===10?0:r;}
function genCPF(){const d=digits(9);d.push(cpfCheck(d));d.push(cpfCheck(d));return d.join('');}
function genCNPJ(){const d=[...digits(8),0,0,0,1];const calc=a=>{const w=a.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];const sum=a.reduce((s,n,i)=>s+n*w[i],0);const r=sum%11;return r<2?0:11-r};d.push(calc(d));d.push(calc(d));return d.join('');}
function maskCPF(v){return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4')}
function maskCNPJ(v){return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,'$1.$2.$3/$4-$5')}
function validCPF(v){v=v.replace(/\D/g,'');if(v.length!==11||/^(\d)\1+$/.test(v))return false;const a=v.split('').map(Number);return a[9]===cpfCheck(a.slice(0,9))&&a[10]===cpfCheck(a.slice(0,10));}
function validCNPJ(v){v=v.replace(/\D/g,'');if(v.length!==14||/^(\d)\1+$/.test(v))return false;const a=v.split('').map(Number);const calc=x=>{const w=x.length===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];const r=x.reduce((s,n,i)=>s+n*w[i],0)%11;return r<2?0:11-r};return a[12]===calc(a.slice(0,12))&&a[13]===calc(a.slice(0,13));}
$('#generate')?.addEventListener('click',()=>{const type=$('#doc-type').value,masked=$('#masked').checked;const raw=type==='cpf'?genCPF():genCNPJ();$('#result').textContent=masked?(type==='cpf'?maskCPF(raw):maskCNPJ(raw)):raw;showStatus('Documento de teste gerado localmente.');});
$('#validate')?.addEventListener('click',()=>{const v=$('#document').value;const n=v.replace(/\D/g,'');const ok=n.length===11?validCPF(v):n.length===14?validCNPJ(v):false;showStatus(ok?'Documento matematicamente válido.':'Documento inválido. Confira a quantidade de dígitos.',ok?'success':'error');});
