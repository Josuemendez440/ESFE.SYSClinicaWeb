document.addEventListener("DOMContentLoaded", () => {
    // 1. Recuperar datos desde localStorage enviados desde Agendar.cshtml
    const datosCita = JSON.parse(localStorage.getItem("citaAgendada")) || {
        paciente: "Carlos Eduardo Mendoza",
        especialidad: "Cardiología",
        medico: "Dr. Roberto Gómez",
        fecha: "2026-09-15",
        hora: "10:00 AM"
    };

    // Formatear Fecha
    let fechaFormateada = datosCita.fecha;
    if (datosCita.fecha.includes("-")) {
        const [year, month, day] = datosCita.fecha.split("-");
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        fechaFormateada = `${parseInt(day)} de ${meses[parseInt(month) - 1]}, ${year}`;
    }

    // Insertar datos en la pantalla
    document.getElementById("resumenPaciente").textContent = datosCita.paciente;
    document.getElementById("resumenMedico").textContent = `${datosCita.especialidad} – ${datosCita.medico}`;
    document.getElementById("resumenFechaHora").textContent = `${fechaFormateada} – ${datosCita.hora}`;

    // 2. Efecto visual dinámico de la tarjeta de crédito
    const cardNameInput = document.getElementById("cardName");
    const cardNumberInput = document.getElementById("cardNumber");
    const cardExpInput = document.getElementById("cardExp");

    const cardNameDisplay = document.getElementById("cardNameDisplay");
    const cardNumDisplay = document.getElementById("cardNumDisplay");
    const cardExpDisplay = document.getElementById("cardExpDisplay");

    cardNameInput.addEventListener("input", (e) => {
        cardNameDisplay.textContent = e.target.value.toUpperCase() || "NOMBRE COMPLETO";
    });

    cardNumberInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        val = val.substring(0, 16);
        let formatted = val.match(/.{1,4}/g)?.join(" ") || "";
        e.target.value = formatted;
        cardNumDisplay.textContent = formatted || "•••• •••• •••• ••••";
    });

    cardExpInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length >= 2) {
            val = val.substring(0, 2) + "/" + val.substring(2, 4);
        }
        e.target.value = val;
        cardExpDisplay.textContent = val || "MM/AA";
    });

    // 3. Procesar Formulario de Pago
    document.getElementById("paymentForm").addEventListener("submit", (e) => {
        e.preventDefault();
        alert("¡Pago procesado con éxito! Tu cita ha sido agendada correctamente.");
        localStorage.removeItem("citaAgendada");
        window.location.href = "/Account/Citas";
    });
});