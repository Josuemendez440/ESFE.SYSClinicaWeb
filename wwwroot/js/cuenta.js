document.addEventListener("DOMContentLoaded", () => {
    // 1. Manejo del toggle para ver/ocultar contraseñas
    const setupPasswordToggle = (toggleId, inputId) => {
        const toggleBtn = document.getElementById(toggleId);
        const inputField = document.getElementById(inputId);

        if (toggleBtn && inputField) {
            toggleBtn.addEventListener("click", () => {
                const eyeOff = toggleBtn.querySelector(".eyeOff");
                const eye = toggleBtn.querySelector(".eye");

                if (inputField.type === "password") {
                    inputField.type = "text";
                    if (eyeOff) eyeOff.style.display = "none";
                    if (eye) eye.style.display = "inline";
                } else {
                    inputField.type = "password";
                    if (eyeOff) eyeOff.style.display = "inline";
                    if (eye) eye.style.display = "none";
                }
            });
        }
    };

    setupPasswordToggle("toggleRegPass", "txtClaveReg");
    setupPasswordToggle("toggleConfirmPass", "txtConfirmarClaveReg");

    // 2. Manejo del envío AJAX del formulario para forzar la redirección al Login
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nombreInput = document.getElementById("txtNombreReg");
            const correoInput = document.getElementById("txtCorreoReg");
            const passInput = document.getElementById("txtClaveReg");
            const confirmPassInput = document.getElementById("txtConfirmarClaveReg");

            const nombre = nombreInput?.value.trim() || "";
            const correo = correoInput?.value.trim() || "";
            const pass = passInput?.value || "";
            const confirmPass = confirmPassInput?.value || "";

            // Limpiar errores visuales
            [nombreInput, correoInput, passInput, confirmPassInput].forEach(inp => {
                if (typeof limpiarError === "function") limpiarError(inp);
            });

            if (typeof validarNombre === "function") {
                const resNom = validarNombre(nombre, "El nombre completo");
                if (!resNom.valido) {
                    mostrarModal(resNom.mensaje, false);
                    if (typeof marcarError === "function") marcarError(nombreInput, resNom.mensaje);
                    nombreInput?.focus();
                    return;
                }
            }

            if (typeof validarEmail === "function") {
                const resEmail = validarEmail(correo);
                if (!resEmail.valido) {
                    mostrarModal(resEmail.mensaje, false);
                    if (typeof marcarError === "function") marcarError(correoInput, resEmail.mensaje);
                    correoInput?.focus();
                    return;
                }
            }

            if (typeof validarPassword === "function") {
                const resPass = validarPassword(pass);
                if (!resPass.valido) {
                    mostrarModal(resPass.mensaje, false);
                    if (typeof marcarError === "function") marcarError(passInput, resPass.mensaje);
                    passInput?.focus();
                    return;
                }
            }

            if (pass !== confirmPass) {
                mostrarModal("Las contraseñas no coinciden. Por favor verifique.", false);
                if (typeof marcarError === "function") marcarError(confirmPassInput, "Las contraseñas no coinciden.");
                confirmPassInput?.focus();
                return;
            }

            const formData = new FormData(registerForm);

            try {
                const response = await fetch(registerForm.action, {
                    method: "POST",
                    body: formData,
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    }
                });

                if (response.redirected) {
                    window.location.href = response.url;
                    return;
                }

                const data = await response.json();

                if (data.exito) {
                    // Muestra el modal del sistema antes de redireccionar
                    mostrarModal("¡Cuenta creada con éxito! Haz clic en Aceptar para iniciar sesión.", true, data.redirectUrl || "/Account/Login");
                } else if (data.mensaje) {
                    mostrarModal(data.mensaje, false);
                } else {
                    window.location.reload();
                }
            } catch (error) {
                registerForm.submit();
            }
        });
    }

    // 3. Función auxiliar para controlar el Modal con estilo Curavita
    function mostrarModal(mensaje, esExito, redirectUrl = null) {
        const overlay = document.getElementById("curavitaModalOverlay");
        const titleElem = document.getElementById("modalTitle");
        const msgElem = document.getElementById("modalMessage");
        const btnConfirm = document.getElementById("btnModalConfirm");
        const svgSuccess = document.getElementById("svgSuccess");
        const svgError = document.getElementById("svgError");

        if (overlay && titleElem && msgElem && btnConfirm) {
            msgElem.textContent = mensaje;
            titleElem.textContent = esExito ? "¡REGISTRO EXITOSO!" : "ATENCIÓN";
            titleElem.style.color = esExito ? "var(--primary-dark)" : "#d94e4e";

            if (svgSuccess && svgError) {
                svgSuccess.style.display = esExito ? "block" : "none";
                svgError.style.display = esExito ? "none" : "block";
            }

            overlay.style.display = "flex";

            btnConfirm.onclick = () => {
                overlay.style.display = "none";
                if (esExito && redirectUrl) {
                    window.location.href = redirectUrl;
                }
            };
        } else {
            // Fallback en caso de no encontrar la estructura
            alert(mensaje);
            if (esExito && redirectUrl) {
                window.location.href = redirectUrl;
            }
        }
    }
});