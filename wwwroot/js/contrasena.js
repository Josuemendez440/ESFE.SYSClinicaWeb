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

        if (strengthBar) {
            strengthBar.style.width = score + "%";
            if (score < 34) strengthBar.style.backgroundColor = "#ef4444";
            else if (score < 67) strengthBar.style.backgroundColor = "#f59e0b";
            else strengthBar.style.backgroundColor = "#10b981";
        }
    });

    // Envío del cambio de contraseña al servidor
    const btnCambiar = document.getElementById('btnCambiarContrasena') || document.querySelector('button[type="submit"]');

    if (btnCambiar) {
        btnCambiar.addEventListener('click', async (e) => {
            e.preventDefault();

            const newPass = document.getElementById('newPassword')?.value;
            const confirmPass = document.getElementById('confirmPassword')?.value;

            const urlParams = new URLSearchParams(window.location.search);
            const email = urlParams.get('email') || sessionStorage.getItem('resetEmail');
            const token = urlParams.get('token') || sessionStorage.getItem('otpVerifiedToken');

            if (!newPass || !confirmPass) {
                Swal.fire({
                    title: 'Atención',
                    text: 'Por favor llena ambos campos.',
                    icon: 'warning',
                    confirmButtonColor: '#277c95'
                });
                return;
            }

            if (newPass !== confirmPass) {
                Swal.fire({
                    title: 'Atención',
                    text: 'Las contraseñas no coinciden.',
                    icon: 'warning',
                    confirmButtonColor: '#277c95'
                });
                return;
            }

            try {
                const response = await fetch('/Account/RestablecerPassword', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        correo: email,
                        tokenValidacion: token,
                        nuevaContrasena: newPass
                    })
                });

                const data = await response.json();

                if (data.exito) {
                    Swal.fire({
                        title: '¡Éxito!',
                        text: '¡Contraseña restablecida con éxito!',
                        icon: 'success',
                        confirmButtonColor: '#277c95',
                        confirmButtonText: 'Aceptar'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            sessionStorage.clear();
                            window.location.href = '/Account/Login';
                        }
                    });
                } else {
                    Swal.fire({
                        title: 'Error',
                        text: data.mensaje || 'No se pudo actualizar la contraseña.',
                        icon: 'error',
                        confirmButtonColor: '#277c95'
                    });
                }
            } catch (error) {
                console.error('Error:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Error al procesar la nueva contraseña.',
                    icon: 'error',
                    confirmButtonColor: '#277c95'
                });
            }
        });
    }
});