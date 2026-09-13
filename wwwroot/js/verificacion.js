document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll(".otp-input");
    const codigoHidden = document.getElementById("codigoHidden") || document.getElementById("codigoCompleto");
    const btnVerificar = document.getElementById('btnVerificar') || document.querySelector('.btn-primary');

    // Mover el foco automáticamente entre las casillas de texto
    inputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            actualizarCodigo();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    function actualizarCodigo() {
        let codigo = "";
        inputs.forEach(input => codigo += input.value);
        if (codigoHidden) codigoHidden.value = codigo;
    }

    // Petición AJAX al hacer clic en Verificar
    if (btnVerificar) {
        btnVerificar.addEventListener('click', async (e) => {
            e.preventDefault();

            actualizarCodigo(); // Concatena los 6 dígitos en el input hidden
            const codigo = codigoHidden ? codigoHidden.value : "";
            const email = new URLSearchParams(window.location.search).get('email') || sessionStorage.getItem('resetEmail');

            if (!codigo || codigo.length !== 6) {
                alert('Por favor ingresa los 6 dígitos del código.');
                return;
            }

            try {
                const response = await fetch('/Account/ValidarCodigoOtp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo: email, codigo: codigo })
                });

                const data = await response.json();

                if (data.exito) {
                    sessionStorage.setItem('otpVerifiedToken', data.tokenValidacion);
                    window.location.href = `/Account/Contrasena?email=${encodeURIComponent(email)}&token=${encodeURIComponent(data.tokenValidacion)}`;
                } else {
                    alert(data.mensaje || 'El código es incorrecto o ha expirado.');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al validar el código.');
            }
        });
    }
});