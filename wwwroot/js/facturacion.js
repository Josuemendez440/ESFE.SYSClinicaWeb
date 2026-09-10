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

    // --- LÓGICA DEL FORMULARIO DE FACTURACIÓN ---
    const metodoPagoSelect = document.getElementById("metodoPago");
    const grupoEfectivo = document.getElementById("grupoEfectivo");
    const grupoCambio = document.getElementById("grupoCambio");

    if (metodoPagoSelect) {
        metodoPagoSelect.addEventListener("change", (e) => {
            if (e.target.value === "Tarjeta") {
                grupoEfectivo.classList.add("hidden");
                grupoCambio.classList.add("hidden");
            } else {
                grupoEfectivo.classList.remove("hidden");
                grupoCambio.classList.remove("hidden");
            }
        });
    }
});