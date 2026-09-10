document.addEventListener('DOMContentLoaded', () => {
    const correoInput = document.getElementById('txtCorreo');
    const passwordInput = document.getElementById('txtContrasena');
    const chkRecordar = document.getElementById('chkRecordar');
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
                eyeOffIcon.style.display = 'none';
                eyeIcon.style.display = 'block';
                togglePassword.setAttribute('title', 'Ocultar contraseña');
            } else {
                passwordInput.type = 'password';
                eyeIcon.style.display = 'none';
                eyeOffIcon.style.display = 'block';
                togglePassword.setAttribute('title', 'Mostrar contraseña');
            }
        });
    }

    // Petición de Inicio de Sesión
    function ejecutarInicioSesion() {
        const correoVal = correoInput.value.trim();
        const contrasenaVal = passwordInput.value.trim();

        if (!correoVal || !contrasenaVal) {
            if (errorMsg) {
                errorMsg.innerText = "Por favor, complete todos los campos.";
                errorMsg.style.display = 'block';
            }
            return;
        }

        if (errorMsg) errorMsg.style.display = 'none';

        // Si estás dentro de una app con WebView2 (Escritorio)
        if (window.chrome && window.chrome.webview) {
            const payload = {
                accion: "iniciar_sesion",
                correo: correoVal,
                contrasena: contrasenaVal,
                recordar: chkRecordar ? chkRecordar.checked : false
            };
            window.chrome.webview.postMessage(JSON.stringify(payload));
        } else {
            // Petición hacia ASP.NET Core MVC (Web)
            const formData = new FormData();
            formData.append("correo", correoVal);
            formData.append("contrasena", contrasenaVal);

            fetch("/Account/Login", {
                method: "POST",
                body: formData
            })
                .then(response => {
                    // Si C# responde con RedirectToAction, la URL cambia automáticamente
                    if (response.redirected) {
                        window.location.href = response.url;
                    } else if (response.ok) {
                        window.location.href = "/Account/Inicio";
                    } else {
                        if (errorMsg) {
                            errorMsg.innerText = "Correo o contraseña incorrectos.";
                            errorMsg.style.display = 'block';
                        }
                    }
                })
                .catch(err => {
                    console.error("Error de comunicación:", err);
                    if (errorMsg) {
                        errorMsg.innerText = "Ocurrió un error al conectar con el servidor.";
                        errorMsg.style.display = 'block';
                    }
                });
        }
    }

    // Eventos del formulario
    if (btnLogin) btnLogin.addEventListener('click', ejecutarInicioSesion);
    if (passwordInput) passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ejecutarInicioSesion(); });
    if (correoInput) correoInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ejecutarInicioSesion(); });

    // Enlaces alternativos
    if (btnIrRegistro) {
        btnIrRegistro.addEventListener('click', () => {
            window.location.href = "/Account/Registro";
        });
    }

    if (lnkOlvidaste) {
        lnkOlvidaste.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = "/Account/Recuperar";
        });
    }
});