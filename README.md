# QA Tools — portal estático para GitHub Pages

Projeto multipágina em HTML, CSS e JavaScript, sem dependências e compatível com GitHub Pages.

## Publicação

1. Faça backup do repositório atual.
2. Substitua os arquivos da branch publicada pelo conteúdo desta pasta.
3. Faça commit e push.
4. Em **Settings > Pages**, mantenha a publicação pela branch principal e pasta raiz.
5. Abra `https://alanalbm.github.io/utilsQA/` e teste os links.

## Ajustes obrigatórios antes de divulgar

- O contato está direcionado para as Issues do repositório. Você pode substituí-lo por um e-mail dedicado quando desejar.
- Revise os textos de Sobre, Privacidade e Termos para refletirem exatamente sua operação.
- Caso compre domínio, substitua as URLs canônicas, `sitemap.xml` e `robots.txt`.
- Não coloque uma linha falsa em `ads.txt`.

## AdSense

Os blocos de anúncio já existem no HTML, mas ficam ocultos por padrão. Depois da aprovação:

1. Adicione o script oficial do AdSense no `<head>` de todas as páginas.
2. Substitua o conteúdo dos blocos `.ad-slot` pelas unidades oficiais e adicione `data-active="true"`, ou habilite anúncios automáticos.
3. Publique em `ads.txt` exatamente a linha exibida na sua conta.
4. Configure consentimento de cookies quando necessário.

A estrutura melhora a qualidade do site, mas nenhuma implementação garante aprovação.
