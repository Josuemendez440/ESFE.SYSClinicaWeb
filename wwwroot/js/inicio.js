document.addEventListener('DOMContentLoaded', () => {
    const btnOpenLogout = document.getElementById('btnOpenLogout');
    const logoutModal = document.getElementById('logoutModal');
    const btnCancelLogout = document.getElementById('btnCancelLogout');

    // Abrir Modal al hacer clic en "Cerrar Sesión" en la barra lateral
    if (btnOpenLogout && logoutModal) {
        btnOpenLogout.addEventListener('click', (e) => {
            e.preventDefault();
            logoutModal.classList.remove('hidden');
        });
    }

    // Cancelar / Ocultar Modal al hacer clic en "Cancelar"
    if (btnCancelLogout && logoutModal) {
        btnCancelLogout.addEventListener('click', () => {
            logoutModal.classList.add('hidden');
        });
    }

    // Ocultar modal al hacer clic fuera del recuadro
    if (logoutModal) {
        logoutModal.addEventListener('click', (e) => {
            if (e.target === logoutModal) {
                logoutModal.classList.add('hidden');
            }
        });
    }
});