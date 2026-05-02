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

  // Efeito de particulas ao passar mouse em elementos interativos
  addButtonGlowEffect();
});

function addButtonGlowEffect() {
  const buttons = document.querySelectorAll('button, .menu a, input');
  
  buttons.forEach(elem => {
    elem.addEventListener('mousemove', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Criar efeito de luz seguindo o mouse
      let glow = this.querySelector('.glow-effect');
      if (!glow) {
        glow = document.createElement('div');
        glow.className = 'glow-effect';
        this.appendChild(glow);
      }
      
      glow.style.left = x + 'px';
      glow.style.top = y + 'px';
    });
  });
}

// Adicionar estilo CSS para o efeito de glow
const style = document.createElement('style');
style.textContent = `
  button, .menu a, input {
    position: relative;
  }

  .glow-effect {
    position: absolute;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 212, 255, 0.4), transparent);
    pointer-events: none;
    transform: translate(-50%, -50%);
    filter: blur(20px);
    opacity: 0.6;
    z-index: 1;
  }

  /* Animação suave para transições */
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-15px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .container, .header, .page {
    animation: slideDown 0.8s ease-out forwards;
  }
`;
document.head.appendChild(style);
