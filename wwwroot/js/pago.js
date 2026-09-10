document.addEventListener("DOMContentLoaded", () => {
    const cardNumber = document.getElementById("cardNumber");
    const expiry = document.getElementById("expiry");
    const paymentForm = document.getElementById("paymentForm");

    // Formato para tarjeta en bloques de 4 dígitos
    cardNumber?.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        value = value.replace(/(.{4})/g, "$1 ").trim();
        e.target.value = value;
    });

    // Formato para la expiración (MM/AA)
    expiry?.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length >= 2) {
            value = value.substring(0, 2) + "/" + value.substring(2, 4);
        }
        e.target.value = value;
    });

    // Envío exitoso y redirección de navegación a 'Mis Citas'
    paymentForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("¡Pago procesado exitosamente!");
        window.location.href = "/Citas/Index";
    });
});