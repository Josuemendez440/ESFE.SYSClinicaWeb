document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('.otp-input');
    const codigoCompleto = document.getElementById('codigoCompleto');
    const formOtp = document.getElementById('formOtp');

    inputs.forEach((input, index) => {
        // Mover al siguiente campo al escribir
        input.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // Mover al campo anterior al presionar Backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
    });

    // Unir los dígitos antes del envío
    formOtp?.addEventListener('submit', () => {
        let otp = '';
        inputs.forEach(input => otp += input.value);
        codigoCompleto.value = otp;
    });
});