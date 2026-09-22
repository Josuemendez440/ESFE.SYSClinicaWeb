document.addEventListener("DOMContentLoaded", () => {
    // ─── Bloquear fechas pasadas en el campo fecha-cita ───────────────────────
    const hoyIso = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
    const fechaCitaInputInit = document.getElementById("fechaCita");
    if (fechaCitaInputInit) {
        fechaCitaInputInit.setAttribute("min", hoyIso);
    }
    // ─────────────────────────────────────────────────────────────────────────
    const medicosPorEspecialidad = {
        "Cardiología": [
            { id: 1, nombre: "Dr. Roberto Gómez" },
            { id: 2, nombre: "Dra. Sofía Alvarado" }
        ],
        "Medicina General": [
            { id: 3, nombre: "Dra. Elena Ramos" },
            { id: 4, nombre: "Dr. Roberto Fuentes" }
        ],
        "Pediatría": [
            { id: 5, nombre: "Dra. Lucía Méndez" },
            { id: 6, nombre: "Dr. Mario Castillo" }
        ]
    };

    const horariosDisponibles = [
        "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
        "02:00 PM", "03:00 PM", "04:00 PM"
    ];

    const agendarForm = document.getElementById("agendarForm") || document.getElementById("formAgendar") || document.querySelector("form");
    const especialidadSelect = document.getElementById("especialidad");
    const medicoSelect = document.getElementById("medico");
    const horaConsultaSelect = document.getElementById("horaConsulta");
    const inputDui = document.getElementById("dui");
    const inputTelefono = document.getElementById("telefono");
    const inputFechaNacimiento = document.getElementById("fechaNacimiento");

    if (inputDui) {
        inputDui.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 9) val = val.substring(0, 9);
            if (val.length > 8) {
                val = val.substring(0, 8) + "-" + val.substring(8);
            }
            e.target.value = val;
        });
    }

    if (inputTelefono) {
        inputTelefono.addEventListener("input", (e) => {
            let val = e.target.value.replace(/\D/g, "");
            if (val.length > 8) val = val.substring(0, 8);
            if (val.length > 4) {
                val = val.substring(0, 4) + "-" + val.substring(4);
            }
            e.target.value = val;
        });
    }

    if (especialidadSelect && medicoSelect) {
        especialidadSelect.addEventListener("change", (e) => {
            const espSelected = e.target.value;
            medicoSelect.innerHTML = '<option value="" disabled selected>Seleccione Especialista</option>';

            if (medicosPorEspecialidad[espSelected]) {
                medicosPorEspecialidad[espSelected].forEach((m) => {
                    const opt = document.createElement("option");
                    opt.value = m.nombre;
                    opt.textContent = m.nombre;
                    medicoSelect.appendChild(opt);
                });
                medicoSelect.disabled = false;
            } else {
                medicoSelect.disabled = true;
            }

            if (horaConsultaSelect) {
                horaConsultaSelect.innerHTML = '<option value="" disabled selected>Seleccione Médico primero</option>';
                horaConsultaSelect.disabled = true;
            }
        });
    }

    if (medicoSelect && horaConsultaSelect) {
        medicoSelect.addEventListener("change", () => {
            horaConsultaSelect.innerHTML = '<option value="" disabled selected>Seleccione Hora</option>';
            horariosDisponibles.forEach((h) => {
                const opt = document.createElement("option");
                opt.value = h;
                opt.textContent = h;
                horaConsultaSelect.appendChild(opt);
            });
            horaConsultaSelect.disabled = false;
        });
    }

    // ─── Función de utilidad para mostrar errores en formulario ──────────────
    function mostrarErrorForm(input, mensaje) {
        if (typeof marcarError === "function") {
            marcarError(input, mensaje);
        } else {
            alert(mensaje);
        }
    }

    function limpiarErrorForm(input) {
        if (typeof limpiarError === "function") limpiarError(input);
    }

    // ─── Validar fecha cita al cambiar el valor ───────────────────────────────
    const fechaCitaEl = document.getElementById("fechaCita");
    if (fechaCitaEl) {
        fechaCitaEl.addEventListener("change", () => {
            const res = (typeof validarFechaCita === "function")
                ? validarFechaCita(fechaCitaEl.value)
                : { valido: true, mensaje: "" };
            if (!res.valido) {
                mostrarErrorForm(fechaCitaEl, res.mensaje);
            } else {
                limpiarErrorForm(fechaCitaEl);
            }
        });
    }

    if (agendarForm) {
        agendarForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const nombresEl   = document.getElementById("nombres");
            const apellidosEl = document.getElementById("apellidos");
            const fechaCitaInput = document.getElementById("fechaCita");

            const nombres  = nombresEl?.value.trim()  || "";
            const apellidos = apellidosEl?.value.trim() || "";
            const dui      = inputDui?.value.trim()   || "";
            const telefono = inputTelefono?.value.trim() || "";
            const fechaNac = inputFechaNacimiento?.value || "";
            const fechaCita = fechaCitaInput?.value   || "";
            const esp  = especialidadSelect?.value    || "Medicina General";
            const med  = medicoSelect?.value          || "Dr. Roberto Gómez";
            const hora = horaConsultaSelect?.value    || "08:00 AM";

            let hayError = false;

            // Validar nombres
            if (!nombres) {
                mostrarErrorForm(nombresEl, "Por favor ingrese su(s) nombre(s).");
                hayError = true;
            } else {
                limpiarErrorForm(nombresEl);
            }

            // Validar apellidos
            if (!apellidos) {
                mostrarErrorForm(apellidosEl, "Por favor ingrese su(s) apellido(s).");
                hayError = true;
            } else {
                limpiarErrorForm(apellidosEl);
            }

            // ─── VALIDACIÓN DE FECHA DE CITA (no puede ser pasada) ───────────
            if (!fechaCita) {
                mostrarErrorForm(fechaCitaInput, "Seleccione la fecha de la cita.");
                hayError = true;
            } else {
                const resFecha = (typeof validarFechaCita === "function")
                    ? validarFechaCita(fechaCita)
                    : { valido: true, mensaje: "" };

                if (!resFecha.valido) {
                    mostrarErrorForm(fechaCitaInput, resFecha.mensaje);
                    hayError = true;
                } else {
                    // Máximo 12 meses hacia adelante
                    const hoy = new Date();
                    hoy.setHours(0, 0, 0, 0);
                    const maxFecha = new Date(hoy);
                    maxFecha.setFullYear(maxFecha.getFullYear() + 1);
                    const partes = fechaCita.split("-");
                    const seleccionada = new Date(
                        parseInt(partes[0], 10),
                        parseInt(partes[1], 10) - 1,
                        parseInt(partes[2], 10)
                    );
                    if (seleccionada > maxFecha) {
                        mostrarErrorForm(fechaCitaInput, "No puede agendar citas con más de 12 meses de anticipación.");
                        hayError = true;
                    } else {
                        limpiarErrorForm(fechaCitaInput);
                    }
                }
            }
            // ─────────────────────────────────────────────────────────────────

            if (hayError) return;

            const nombreCompleto = `${nombres} ${apellidos}`.trim();
            const costoConsulta = esp === "Cardiología" ? 50.00 : (esp === "Pediatría" ? 35.00 : 25.00);

            const horaFormateada = convertirHora24(hora);
            const fechaHoraIso = fechaCita ? `${fechaCita}T${horaFormateada}` : new Date().toISOString();

            const datosCita = {
                paciente: nombreCompleto,
                nombres: nombres,
                apellidos: apellidos,
                dui: dui || "00000000-0",
                telefono: telefono,
                fechaNacimiento: fechaNac,
                especialidad: esp,
                medico: med,
                fecha: fechaCita,
                hora: hora,
                fechaHora: fechaHoraIso,
                especialidadMedico: `${esp} – ${med}`,
                costo: costoConsulta,
                montoAnticipo: costoConsulta * 0.25,
                saldoPendiente: costoConsulta * 0.75,
                pagoConfirmado: false
            };

            localStorage.setItem("resumenCitaData", JSON.stringify(datosCita));
            localStorage.setItem("citaAgendada", JSON.stringify(datosCita));

            try {
                const response = await fetch("/Account/Agendar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(datosCita)
                });

                if (response.ok) {
                    const resData = await response.json();
                    if (resData.exito === false) {
                        // Error de negocio devuelto por el servidor (ej. cita duplicada)
                        const msg = resData.mensaje || "No se pudo agendar la cita.";
                        if (typeof mostrarAlertaError === "function") {
                            mostrarAlertaError(msg);
                        } else {
                            alert(msg);
                        }
                        return;
                    }
                    if (resData.exito && resData.citaId) {
                        datosCita.citaId = resData.citaId;
                        localStorage.setItem("resumenCitaData", JSON.stringify(datosCita));
                        window.location.href = resData.redirectUrl || `/Account/Confirma_pago?id=${resData.citaId}`;
                        return;
                    }
                } else {
                    // Error HTTP 4xx/5xx con JSON
                    try {
                        const errData = await response.json();
                        const msg = errData.mensaje || `Error del servidor (${response.status}).`;
                        alert(msg);
                    } catch (_) {
                        alert(`Error del servidor (${response.status}).`);
                    }
                    return;
                }
            } catch (err) {
                console.error("Error al registrar la cita preliminar:", err);
            }

            window.location.href = "/Account/Confirma_pago";
        });
    }

    function convertirHora24(hora12) {
        if (!hora12) return "08:00:00";
        const [time, modifier] = hora12.split(" ");
        let [hours, minutes] = time.split(":");
        if (hours === "12") hours = "00";
        if (modifier === "PM") hours = parseInt(hours, 10) + 12;
        return `${hours.toString().padStart(2, "0")}:${minutes}:00`;
    }

    function formatearFecha(fechaStr) {
        if (!fechaStr) return "";
        const partes = fechaStr.split("-");
        if (partes.length !== 3) return fechaStr;

        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        return `${parseInt(partes[2], 10)} de ${meses[parseInt(partes[1], 10) - 1]}, ${partes[0]}`;
    }
});