document.addEventListener("DOMContentLoaded", () => {
    // Mostrar/Ocultar contraseñas
    const toggles = document.querySelectorAll(".toggle-password");
    toggles.forEach(toggle => {
        toggle.addEventListener("click", () => {
            const targetId = toggle.getAttribute("data-target");
            const input = document.getElementById(targetId);
            if (input.type === "password") {
                input.type = "text";
                toggle.classList.replace("fa-eye", "fa-eye-slash");
            } else {
                input.type = "password";
                toggle.classList.replace("fa-eye-slash", "fa-eye");
            }
        });
    });

    // Medidor de seguridad de contraseña
    const newPassword = document.getElementById("newPassword");
    const strengthBar = document.getElementById("strengthBar");

    newPassword?.addEventListener("input", (e) => {
        const val = e.target.value;
        let score = 0;

        if (val.length >= 6) score += 33;
        if (/[A-Z]/.test(val)) score += 33;
        if (/[0-9]/.test(val)) score += 34;

        strengthBar.style.width = score + "%";
        if (score < 34) strengthBar.style.backgroundColor = "#ef4444";
        else if (score < 67) strengthBar.style.backgroundColor = "#f59e0b";
        else strengthBar.style.backgroundColor = "#10b981";
    });
}); document.addEventListener("DOMContentLoaded", () => {
    // Mostrar/Ocultar contraseñas
    const toggles = document.querySelectorAll(".toggle-password");
    toggles.forEach(toggle => {
        toggle.addEventListener("click", () => {
            const targetId = toggle.getAttribute("data-target");
            const input = document.getElementById(targetId);
            if (input.type === "password") {
                input.type = "text";
                toggle.classList.replace("fa-eye", "fa-eye-slash");
            } else {
                input.type = "password";
                toggle.classList.replace("fa-eye-slash", "fa-eye");
            }
        });
    });

    // Medidor de seguridad de contraseña
    const newPassword = document.getElementById("newPassword");
    const strengthBar = document.getElementById("strengthBar");

    newPassword?.addEventListener("input", (e) => {
        const val = e.target.value;
        let score = 0;

        if (val.length >= 6) score += 33;
        if (/[A-Z]/.test(val)) score += 33;
        if (/[0-9]/.test(val)) score += 34;

        strengthBar.style.width = score + "%";
        if (score < 34) strengthBar.style.backgroundColor = "#ef4444";
        else if (score < 67) strengthBar.style.backgroundColor = "#f59e0b";
        else strengthBar.style.backgroundColor = "#10b981";
    });
});