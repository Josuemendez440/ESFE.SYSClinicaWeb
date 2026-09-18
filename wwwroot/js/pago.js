document.addEventListener("DOMContentLoaded", function () {
    // Cargar información guardada previamente desde localStorage
    var datosCitaRaw = localStorage.getItem("resumenCitaData") || localStorage.getItem("citaAgendada");
    var datosCita = null;

    if (datosCitaRaw) {
        try {
            datosCita = JSON.parse(datosCitaRaw);

            // Calcular precios dinámicamente desde costo real de la cita
            var costoTotal = parseFloat(datosCita.costo) || 25.00;
            var anticipo = parseFloat((costoTotal * 0.25).toFixed(2));
            var saldo = parseFloat((costoTotal * 0.75).toFixed(2));
            window.curavitaAnticipoActual = anticipo;

            var elPrecioTotal = document.getElementById("precioTotalDisplay");
            var elSaldo = document.getElementById("saldoPendienteDisplay");
            var elAnticipo = document.getElementById("anticipoDisplay");
            var elModalAnticipo = document.getElementById("modalAnticipo");
            var elModalSaldo = document.getElementById("modalSaldo");
            var elBtnPayText = document.getElementById("btnPayText");
            var elDisclaimer = document.querySelector(".pay-disclaimer");

            if (elPrecioTotal) elPrecioTotal.textContent = "$" + costoTotal.toFixed(2);
            if (elSaldo) elSaldo.textContent = "$" + saldo.toFixed(2);
            if (elAnticipo) elAnticipo.textContent = "$" + anticipo.toFixed(2);
            if (elModalAnticipo) elModalAnticipo.textContent = "$" + anticipo.toFixed(2);
            if (elModalSaldo) elModalSaldo.textContent = "$" + saldo.toFixed(2);
            if (elBtnPayText) elBtnPayText.textContent = "Pagar $" + anticipo.toFixed(2) + " y Confirmar Cita";
            if (elDisclaimer) {
                elDisclaimer.textContent = "Al hacer clic en pagar, autorizas el cobro del 25% ($" + anticipo.toFixed(2) + ") para la reserva de tu cita. El 75% restante ($" + saldo.toFixed(2) + ") se abonará en la recepción el día de tu consulta.";
            }

            // 1. Cargar Paciente
            var elPaciente = document.getElementById("resumenPaciente");
            if (elPaciente && datosCita.paciente) {
                elPaciente.textContent = datosCita.paciente;
            }

            // 2. Cargar Médico y Especialidad
            var elMedico = document.getElementById("resumenMedico");
            if (elMedico) {
                if (datosCita.especialidadMedico) {
                    elMedico.textContent = datosCita.especialidadMedico;
                } else if (datosCita.especialidad || datosCita.medico) {
                    elMedico.textContent = (datosCita.especialidad || "") + " – " + (datosCita.medico || "");
                }
            }

            // 3. Cargar Fecha y Hora
            var elFechaHora = document.getElementById("resumenFechaHora");
            if (elFechaHora) {
                if (datosCita.fechaHora) {
                    elFechaHora.textContent = datosCita.fechaHora;
                } else if (datosCita.fecha) {
                    var fechaFormateada = datosCita.fecha;
                    if (datosCita.fecha.indexOf("-") !== -1) {
                        var partes = datosCita.fecha.split("-");
                        var year = partes[0];
                        var month = partes[1];
                        var day = partes[2];
                        var meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

                        fechaFormateada = parseInt(day, 10) + " de " + meses[parseInt(month, 10) - 1] + ", " + year;
                    }
                    elFechaHora.textContent = fechaFormateada + " – " + (datosCita.hora || "");
                }
            }
        } catch (e) {
            console.error("Error al procesar el resumen de la cita:", e);
        }
    }

    // Bindings visuales interactivos de la tarjeta de crédito
    var cardNameInput = document.getElementById("cardName");
    var cardNumberInput = document.getElementById("cardNumber");
    var cardExpInput = document.getElementById("cardExp");
    var cardCvvInput = document.getElementById("cardCvv");

    var cardNameDisplay = document.getElementById("cardNameDisplay");
    var cardNumDisplay = document.getElementById("cardNumDisplay");
    var cardExpDisplay = document.getElementById("cardExpDisplay");

    if (cardNameInput) {
        cardNameInput.addEventListener("input", function (e) {
            cardNameDisplay.textContent = e.target.value.toUpperCase() || "NOMBRE COMPLETO";
        });
    }

    if (cardNumberInput) {
        cardNumberInput.addEventListener("input", function (e) {
            var val = e.target.value.replace(/\D/g, "").substring(0, 16);
            var matches = val.match(/.{1,4}/g);
            var formatted = matches ? matches.join(" ") : "";
            e.target.value = formatted;
            cardNumDisplay.textContent = formatted || "•••• •••• •••• ••••";
        });
    }

    if (cardExpInput) {
        cardExpInput.addEventListener("input", function (e) {
            var val = e.target.value.replace(/\D/g, "");
            if (val.length >= 2) {
                val = val.substring(0, 2) + "/" + val.substring(2, 4);
            }
            e.target.value = val;
            cardExpDisplay.textContent = val || "MM/AA";
        });
    }

    if (cardCvvInput) {
        cardCvvInput.addEventListener("input", function (e) {
            e.target.value = e.target.value.replace(/\D/g, "");
        });
    }

    // Manejo del Submit de Pago Asíncrono (AJAX / Fetch)
    var paymentForm = document.getElementById("paymentForm");
    var btnPay = document.getElementById("btnPay");
    var btnPayText = document.getElementById("btnPayText");
    var btnPayIcon = document.getElementById("btnPayIcon");
    var alertError = document.getElementById("alertError");
    var modalPagoExitoso = document.getElementById("modalPagoExitoso");
    var btnVerCitas = document.getElementById("btnVerCitas");

    function mostrarError(mensaje) {
        if (alertError) {
            alertError.textContent = mensaje;
            alertError.style.display = "block";
            alertError.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
            alert(mensaje);
        }
    }

    function setCargando(cargando) {
        if (!btnPay) return;
        btnPay.disabled = cargando;

        if (cargando) {
            if (btnPayIcon) btnPayIcon.style.display = "none";
            var spinner = document.createElement("span");
            spinner.className = "spinner";
            spinner.id = "btnSpinner";
            btnPay.prepend(spinner);
            if (btnPayText) btnPayText.textContent = "Procesando pago seguro...";
        } else {
            var spinnerExistente = document.getElementById("btnSpinner");
            if (spinnerExistente) spinnerExistente.remove();
            if (btnPayIcon) btnPayIcon.style.display = "block";
            var antVal = (window.curavitaAnticipoActual || 6.25).toFixed(2);
            if (btnPayText) btnPayText.textContent = "Pagar $" + antVal + " y Confirmar Cita";
        }
    }

    if (paymentForm) {
        paymentForm.addEventListener("submit", function (e) {
            e.preventDefault();

            if (alertError) {
                alertError.style.display = "none";
                alertError.textContent = "";
            }

            var titular = cardNameInput ? cardNameInput.value.trim() : "";
            var numero = cardNumberInput ? cardNumberInput.value.replace(/\s+/g, "").trim() : "";
            var exp = cardExpInput ? cardExpInput.value.trim() : "";
            var cvv = cardCvvInput ? cardCvvInput.value.trim() : "";

            if (!titular) {
                mostrarError("Por favor ingresa el nombre del titular de la tarjeta.");
                return;
            }
            if (numero.length < 15) {
                mostrarError("Por favor ingresa un número de tarjeta válido (15 o 16 dígitos).");
                return;
            }
            if (exp.length < 5) {
                mostrarError("Por favor ingresa la fecha de expiración en formato MM/AA.");
                return;
            }
            if (cvv.length < 3) {
                mostrarError("Por favor ingresa el código de seguridad CVV (3 o 4 dígitos).");
                return;
            }

            // Extraer datos de la cita desde el almacenamiento local o elementos del DOM
            var paciente = (datosCita && datosCita.paciente) ? datosCita.paciente : (document.getElementById("resumenPaciente")?.textContent.trim() || "");
            var especialidad = (datosCita && datosCita.especialidad) ? datosCita.especialidad : "";
            var medico = (datosCita && datosCita.medico) ? datosCita.medico : "";
            var fecha = (datosCita && datosCita.fecha) ? datosCita.fecha : "";
            var hora = (datosCita && datosCita.hora) ? datosCita.hora : "";
            var fechaHora = (datosCita && datosCita.fechaHora) ? datosCita.fechaHora : (document.getElementById("resumenFechaHora")?.textContent.trim() || "");
            var correo = sessionStorage.getItem("correo") || (datosCita && datosCita.correo) || "";

            if (!especialidad && datosCita && datosCita.especialidadMedico) {
                var partesEsp = datosCita.especialidadMedico.split("–");
                if (partesEsp.length > 0) especialidad = partesEsp[0].trim();
                if (partesEsp.length > 1) medico = partesEsp[1].trim();
            }

            // Separación de Nombres y Apellidos para la BD [dbo].[Pacientes]
            var partesNombre = paciente.trim().split(" ");
            var nombresVal = (datosCita && datosCita.nombres) ? datosCita.nombres : (partesNombre[0] || "Paciente");
            var apellidosVal = (datosCita && datosCita.apellidos) ? datosCita.apellidos : (partesNombre.slice(1).join(" ") || "General");

            var payload = {
                paciente: paciente,
                nombres: nombresVal,
                apellidos: apellidosVal,
                dui: (datosCita && datosCita.dui) ? datosCita.dui : "00000000-0",
                telefono: (datosCita && datosCita.telefono) ? datosCita.telefono : null,
                especialidad: especialidad || "Medicina General",
                medico: medico || "Dr. Roberto Gómez",
                fecha: fecha,
                hora: hora,
                fechaHora: fechaHora,
                correo: correo,
                precioTotal: (datosCita && datosCita.costo) ? parseFloat(datosCita.costo) : 25.00,
                montoAnticipo: (datosCita && datosCita.costo) ? parseFloat((datosCita.costo * 0.25).toFixed(2)) : 6.25,
                saldoPendiente: (datosCita && datosCita.costo) ? parseFloat((datosCita.costo * 0.75).toFixed(2)) : 18.75,
                titularTarjeta: titular,
                numeroTarjeta: numero,
                expiracion: exp,
                cvv: cvv
            };

            setCargando(true);

            // Petición asíncrona Fetch al endpoint POST /Account/ConfirmarPago
            fetch("/Account/ConfirmarPago", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    if (!response.ok) {
                        throw new Error(data.mensaje || "Error al procesar el pago (" + response.status + ")");
                    }
                    return data;
                });
            })
            .then(function (data) {
                setCargando(false);
                if (data.exito) {
                    // Limpiar localStorage temporal tras pago exitoso
                    localStorage.removeItem("resumenCitaData");
                    localStorage.removeItem("citaAgendada");

                    // Rellenar datos en el Modal Flotante
                    var modalPac = document.getElementById("modalPaciente");
                    if (modalPac) modalPac.textContent = paciente || "Paciente";

                    var modalMed = document.getElementById("modalMedico");
                    if (modalMed) {
                        modalMed.textContent = (especialidad ? (especialidad + " – ") : "") + (medico || "Médico Especialista");
                    }

                    var modalFH = document.getElementById("modalFechaHora");
                    if (modalFH) modalFH.textContent = fechaHora || "Fecha confirmada";

                    // Desplegar el Modal Flotante sobre el contenido
                    if (modalPagoExitoso) {
                        modalPagoExitoso.classList.remove("hidden");
                    }
                } else {
                    mostrarError(data.mensaje || "Ocurrió un inconveniente al procesar el pago.");
                }
            })
            .catch(function (error) {
                setCargando(false);
                mostrarError(error.message || "Error al comunicar con el servidor. Intente nuevamente.");
            });
        });
    }

    // Redirección al listado de expedientes desde el botón del modal
    if (btnVerCitas) {
        btnVerCitas.addEventListener("click", function () {
            window.location.href = "/Account/Expedientes";
        });
    }
});