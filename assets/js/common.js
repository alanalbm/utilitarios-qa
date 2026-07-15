
const $=(s,c=document)=>c.querySelector(s);const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const navToggle=$('.nav-toggle'),navLinks=$('.nav-links');if(navToggle){navToggle.addEventListener('click',()=>{const open=navLinks.classList.toggle('open');navToggle.setAttribute('aria-expanded',String(open));});}
function showStatus(msg,type='success'){const el=$('#status');if(!el)return;el.textContent=msg;el.className=`status show ${type}`;}
async function copyText(text){try{await navigator.clipboard.writeText(text);showStatus('Copiado para a área de transferência.');}catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove();showStatus('Copiado para a área de transferência.');}}
$$('[data-copy-target]').forEach(b=>b.addEventListener('click',()=>{const el=$(b.dataset.copyTarget);copyText(el.value||el.textContent);}));
const year=$('#year');if(year)year.textContent=new Date().getFullYear();
const search=$('#tool-search');if(search){search.addEventListener('input',()=>{const q=search.value.toLowerCase().trim();$$('[data-tool]').forEach(card=>card.classList.toggle('hidden',!card.dataset.tool.includes(q)));});}
