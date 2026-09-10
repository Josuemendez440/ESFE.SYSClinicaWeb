document.addEventListener("DOMContentLoaded", () => {
    const logoutModal = document.getElementById("logoutModal");
    const btnOpenLogout = document.getElementById("btnOpenLogout");
    const btnCancelLogout = document.getElementById("btnCancelLogout");

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
});