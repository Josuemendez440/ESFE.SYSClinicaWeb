document.addEventListener("DOMContentLoaded", () => {
    // --- LÓGICA MODAL CERRAR SESIÓN ---
    const btnOpenLogout = document.getElementById("btnOpenLogout");
    const btnCancelLogout = document.getElementById("btnCancelLogout");
    const logoutModal = document.getElementById("logoutModal");

    if (btnOpenLogout && logoutModal) {
        btnOpenLogout.addEventListener("click", () => {
            logoutModal.classList.remove("hidden");
        });
    }

    if (btnCancelLogout && logoutModal) {
        btnCancelLogout.addEventListener("click", () => {
            logoutModal.classList.add("hidden");
        });
    }

    if (logoutModal) {
        logoutModal.addEventListener("click", (e) => {
            if (e.target === logoutModal) {
                logoutModal.classList.add("hidden");
            }
        });
    }

    // --- LÓGICA BÚSQUEDA DE PACIENTES ---
    const inputBusqueda = document.getElementById("inputBusqueda");
    const tablaPacientes = document.getElementById("tablaPacientes");

    if (inputBusqueda && tablaPacientes) {
        inputBusqueda.addEventListener("input", (e) => {
            const query = e.target.value.toLowerCase().trim();
            const filas = tablaPacientes.querySelectorAll("tr");

            filas.forEach((fila) => {
                const contenido = fila.textContent.toLowerCase();
                if (contenido.includes(query)) {
                    fila.style.display = "";
                } else {
                    fila.style.display = "none";
                }
            });
        });
    }
});