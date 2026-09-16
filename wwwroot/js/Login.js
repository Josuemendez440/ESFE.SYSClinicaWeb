document.addEventListener('DOMContentLoaded', () => {
    const correoInput = document.getElementById('txtCorreo');
    const passwordInput = document.getElementById('txtContrasena');
    const togglePassword = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeOffIcon = document.getElementById('eyeOffIcon');
    const btnLogin = document.getElementById('btnLogin');
    const btnCuenta = document.getElementById('btnIrRegistro') || document.getElementById('btnCuenta');
    const errorMsg = document.getElementById('errorMsg');
    const lnkOlvidaste = document.getElementById('lnkOlvidaste');

    // Mostrar/Ocultar contraseña
    if (togglePassword) {
        togglePassword.addEventListener('click', (e) => {
            e.preventDefault();
            const esPassword = passwordInput.type === 'password';

            if (esPassword) {
                passwordInput.type = 'text';
                if (eyeOffIcon) eyeOffIcon.style.display = 'none';
                if (eyeIcon) eyeIcon.style.display = 'block';
                togglePassword.setAttribute('title', 'Ocultar contraseña');
            } else {
                passwordInput.type = 'password';
                if (eyeIcon) eyeIcon.style.display = 'none';
                if (eyeOffIcon) eyeOffIcon.style.display = 'block';
                togglePassword.setAttribute('title', 'Mostrar contraseña');
            }
        });
    }

    // Petición de Inicio de Sesión
    function ejecutarInicioSesion() {
        const correoVal = correoInput ? correoInput.value.trim() : '';
        const contrasenaVal = passwordInput ? passwordInput.value.trim() : '';

        if (!correoVal || !contrasenaVal) {
            if (errorMsg) {
                errorMsg.innerText = "Por favor, complete todos los campos.";
                errorMsg.style.display = 'block';
            }
            return;
        }

        if (errorMsg) errorMsg.style.display = 'none';

        const formData = new FormData();
        formData.append("correo", correoVal);
        formData.append("contrasena", contrasenaVal);

        fetch("/Account/Login", {
            method: "POST",
            body: formData
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error("Credenciales incorrectas");
                }
                return response.json();
            })
            .then(data => {
                if (data.exito || data.success) {
                    sessionStorage.clear();

                    const nombreReal = data.usuario || data.nombreUsuario || data.nombreCompleto || data.nombre || data.correo || 'Usuario';
                    const rolReal = data.rol || data.nombreRol || data.especialidad || '';
                    const modulosReal = data.modulos || data.modulosPermitidos || [];

                    sessionStorage.setItem('usuario', nombreReal);
                    sessionStorage.setItem('rol', rolReal);
                    sessionStorage.setItem('modulos', JSON.stringify(modulosReal));
                    if (data.correo) {
                        sessionStorage.setItem('correo', data.correo);
                    }
                    sessionStorage.setItem('redirectUrl', data.redirectUrl || '/Account/Inicio');

                    if (window.chrome && window.chrome.webview) {
                        window.chrome.webview.postMessage(JSON.stringify({
                            accion: "sesion_iniciada",
                            usuario: nombreReal,
                            rol: rolReal
                        }));
                    }

                    window.location.href = data.redirectUrl || '/Account/Inicio';
                } else {
                    if (errorMsg) {
                        errorMsg.innerText = data.mensaje || "Error al iniciar sesión.";
                        errorMsg.style.display = 'block';
                    }
                }
            })
            .catch(err => {
                console.error("Error de comunicación:", err);
                if (errorMsg) {
                    errorMsg.innerText = "Correo o contraseña incorrectos o error de servidor.";
                    errorMsg.style.display = 'block';
                }
            });
    }

    // Eventos del formulario
    if (btnLogin) btnLogin.addEventListener('click', ejecutarInicioSesion);
    if (passwordInput) passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ejecutarInicioSesion(); });
    if (correoInput) correoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ejecutarInicioSesion(); });

    // Redirección a la vista Cuenta (/Account/Cuenta)
    if (btnCuenta) {
        btnCuenta.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = "/Account/Cuenta";
        });
    }

    // Enlace: Olvidaste tu contraseña
    if (lnkOlvidaste) {
        lnkOlvidaste.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = "/Account/Recuperar";
        });
    }
});