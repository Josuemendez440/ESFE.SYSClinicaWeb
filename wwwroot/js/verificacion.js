document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll(".otp-input");
    const codigoHidden = document.getElementById("codigoCompleto") || document.getElementById("codigoHidden");
    const btnVerificar = document.getElementById('btnVerificar');
    const formOtp = document.getElementById('formOtp');
    const alertBox = document.getElementById('alertBox');

    // Función auxiliar para mostrar alertas en la tarjeta
    function mostrarAlerta(mensaje) {
        if (alertBox) {
            alertBox.textContent = mensaje;
            alertBox.classList.add("show");
        }
    }

    // Función auxiliar para ocultar alertas
    function ocultarAlerta() {
        if (alertBox) {
            alertBox.classList.remove("show");
            alertBox.textContent = "";
        }
    }

    // Mover el foco automáticamente entre las casillas
    inputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            ocultarAlerta();
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
            actualizarCodigo();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            } else if (e.key === "Enter") {
                e.preventDefault();
                validarCodigo();
            }
        });

        // Soporte para pegar los 6 dígitos
        input.addEventListener("paste", (e) => {
            e.preventDefault();
            ocultarAlerta();
            const pastedData = (e.clipboardData || window.clipboardData).getData("text").trim();
            if (/^\d{6}$/.test(pastedData)) {
                pastedData.split("").forEach((char, i) => {
                    if (inputs[i]) inputs[i].value = char;
                });
                inputs[inputs.length - 1].focus();
                actualizarCodigo();
            }
        });
    });

    function actualizarCodigo() {
        let codigo = "";
        inputs.forEach(input => codigo += input.value.trim());
        if (codigoHidden) codigoHidden.value = codigo;
        return codigo;
    }

    // Prevenir el submit nativo del formulario por cualquier vía
    if (formOtp) {
        formOtp.addEventListener('submit', function (e) {
            e.preventDefault();
            validarCodigo();
        });
    }

    if (btnVerificar) {
        btnVerificar.addEventListener('click', function (e) {
            e.preventDefault();
            validarCodigo();
        });
    }

    async function validarCodigo() {
        ocultarAlerta();
        const codigo = actualizarCodigo();
        const urlParams = new URLSearchParams(window.location.search);
        const email = urlParams.get('email') || sessionStorage.getItem('resetEmail');

        // 1. VALIDACIÓN EN CLIENTE: Si está vacío o incompleto NO pasa
        if (!codigo || codigo.length < 6) {
            mostrarAlerta('Por favor ingresa los 6 dígitos del código de verificación.');
            inputs[0].focus();
            return;
        }

        if (!email) {
            mostrarAlerta('No se encontró la dirección de correo. Redirigiendo...');
            setTimeout(() => {
                window.location.href = '/Account/Recuperar';
            }, 2000);
            return;
        }

        const textoOriginal = btnVerificar.textContent;
        btnVerificar.disabled = true;
        btnVerificar.textContent = "VERIFICANDO...";

        try {
            // 2. VALIDACIÓN EN BD MEDIANTE PETICIÓN POST
            const response = await fetch('/Account/ValidarCodigoOtp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo: email, codigo: codigo })
            });

            const data = await response.json();

            // 3. SI LA BD DICE QUE ES CORRECTO -> AVANZA
            if (data.exito) {
                sessionStorage.setItem('otpVerifiedToken', data.tokenValidacion);
                window.location.href = `/Account/Contrasena?email=${encodeURIComponent(email)}&token=${encodeURIComponent(data.tokenValidacion)}`;
            } else {
                // SI EL CÓDIGO ES INCORRECTO/EXPIRADO -> MUESTRA AVISO Y NO DEJA PASAR
                mostrarAlerta(data.mensaje || 'El código ingresado es incorrecto o ha expirado.');
                btnVerificar.disabled = false;
                btnVerificar.textContent = textoOriginal;
            }
        } catch (error) {
            console.error('Error:', error);
            mostrarAlerta('Ocurrió un error al conectar con el servidor.');
            btnVerificar.disabled = false;
            btnVerificar.textContent = textoOriginal;
        }
    }
});