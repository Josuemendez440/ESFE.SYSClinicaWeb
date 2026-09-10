document.addEventListener("DOMContentLoaded", function () {
    const inputs = document.querySelectorAll(".otp-input");
    const codigoHidden = document.getElementById("codigoCompleto");
    const formOtp = document.getElementById("formOtp");

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
        codigoHidden.value = codigo;
    }

    formOtp.addEventListener("submit", function () {
        actualizarCodigo();
        // Deja que el formulario haga submit nativo hacia el servidor
    });
});