document.addEventListener('DOMContentLoaded', () => {
    const correoInput = document.getElementById('txtCorreo');
    const passwordInput = document.getElementById('txtContrasena');
    const togglePassword = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeOffIcon = document.getElementById('eyeOffIcon');
    const btnLogin = document.getElementById('btnLogin');
    const btnIrRegistro = document.getElementById('btnIrRegistro');
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

        // Petición hacia ASP.NET Core MVC
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
                    // Limpiar sesión previa para evitar mantener datos desfasados
                    sessionStorage.clear();

                    // Extraer propiedades recibidas dinámicamente desde el backend
                    const nombreReal = data.usuario || data.nombreUsuario || data.nombreCompleto || data.nombre || data.correo || 'Usuario';
                    const rolReal = data.rol || data.nombreRol || data.especialidad || '';
                    const modulosReal = data.modulos || data.modulosPermitidos || [];

                    // Guardar datos actualizados en sessionStorage
                    sessionStorage.setItem('usuario', nombreReal);
                    sessionStorage.setItem('rol', rolReal);
                    sessionStorage.setItem('modulos', JSON.stringify(modulosReal));
                    sessionStorage.setItem('redirectUrl', data.redirectUrl || '/Account/Inicio');

                    // Notificación si se ejecuta en WebView2 (Desktop)
                    if (window.chrome && window.chrome.webview) {
                        window.chrome.webview.postMessage(JSON.stringify({
                            accion: "sesion_iniciada",
                            usuario: nombreReal,
                            rol: rolReal
                        }));
                    }

                    // Redirección a la vista de Inicio
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

    // Enlace: Ir a Crear Cuenta
    if (btnIrRegistro) {
        btnIrRegistro.addEventListener('click', () => {
            window.location.href = "/Account/Registro";
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