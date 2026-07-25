// Gerenciador de Transições de Página
document.addEventListener('DOMContentLoaded', function() {
  // Fade in da página ao carregar
  document.body.style.animation = 'fadeInPage 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards';

  // Interceptar cliques em links para transição suave
  document.querySelectorAll('a').forEach(link => {
    // Evitar interceptar links de saída ou com onclick
    if (link.getAttribute('href') && 
        !link.getAttribute('href').startsWith('#') &&
        !link.onclick &&
        !link.getAttribute('target')) {
      
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // Permitir navegação normal para URLs externas
        if (href.startsWith('http')) {
          return;
        }

        e.preventDefault();
        
        // Adicionar classe de saída para animar
        document.body.classList.add('page-exit');
        
        // Redirecionar após animação
        setTimeout(() => {
          window.location.href = href;
        }, 500);
      });
    }
  });

  // Interceptar cliques em botões que redirecionam
  document.querySelectorAll('button').forEach(btn => {
    if (btn.hasAttribute('onclick') && btn.getAttribute('onclick').includes('window.location')) {
      btn.addEventListener('click', function() {
        document.body.classList.add('page-exit');
      });
    }
  });
});
