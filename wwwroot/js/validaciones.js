/**
 * validaciones.js - Sistema Centralizado de Validaciones para Curavita (El Salvador)
 * Proporciona validación oficial para DUI, Teléfono, Fechas, Nombres, Signos Vitales y UI feedback.
 */

// ============================================================
// EXPRESIONES REGULARES OFICIALES
// ============================================================
const REGEX_DUI_FORMAT = /^\d{8}-\d$/;
const REGEX_TEL_FORMAT = /^\d{4}-\d{4}$/;
const REGEX_EMAIL_ADDR = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const REGEX_TEXT_NAMES = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'.-]{2,60}$/;
const REGEX_PASSWORD_ST = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

// ============================================================
// MÁSCARAS AUTOMÁTICAS (AUTO-FORMATTING EN TIEMPO REAL)
// ============================================================

/**
 * Aplica máscara de DUI de El Salvador (00000000-0)
 */
function aplicarMascaraDui(input) {
    if (!input) return;
    input.setAttribute("maxlength", "10");
    input.setAttribute("placeholder", "00000000-0");
    input.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 9) val = val.substring(0, 9);
        if (val.length > 8) {
            val = val.substring(0, 8) + "-" + val.substring(8);
        }
        e.target.value = val;
    });
}

/**
 * Aplica máscara de Teléfono de El Salvador (0000-0000)
 */
function aplicarMascaraTelefono(input) {
    if (!input) return;
    input.setAttribute("maxlength", "9");
    input.setAttribute("placeholder", "0000-0000");
    input.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 8) val = val.substring(0, 8);
        if (val.length > 4) {
            val = val.substring(0, 4) + "-" + val.substring(4);
        }
        e.target.value = val;
    });
}

// ============================================================
// VALIDACIONES DE IDENTIDAD Y CONTACTO (EL SALVADOR)
// ============================================================

/**
 * Valida formato y dígito verificador del DUI salvadoreño
 */
function validarDui(valor) {
    const val = (valor || "").trim();
    if (!val) return { valido: false, mensaje: "El DUI es obligatorio." };
    if (!REGEX_DUI_FORMAT.test(val)) {
        return { valido: false, mensaje: "Formato de DUI inválido. Use 00000000-0 (8 dígitos y guión)." };
    }

    // Validación de dígito verificador oficial salvadoreño
    const soloNumeros = val.replace("-", "");
    if (soloNumeros.length === 9) {
        let suma = 0;
        for (let i = 0; i < 8; i++) {
            suma += parseInt(soloNumeros[i], 10) * (9 - i);
        }
        const digitoCalculado = (10 - (suma % 10)) % 10;
        const digitoReal = parseInt(soloNumeros[8], 10);
        if (digitoCalculado !== digitoReal) {
            return { valido: false, mensaje: "El número de DUI no es válido según el dígito verificador oficial." };
        }
    }

    return { valido: true, mensaje: "" };
}

/**
 * Valida teléfono de El Salvador (8 dígitos: 0000-0000)
 */
function validarTelefono(valor) {
    const val = (valor || "").trim();
    if (!val) return { valido: false, mensaje: "El número telefónico es obligatorio." };
    if (!REGEX_TEL_FORMAT.test(val)) {
        return { valido: false, mensaje: "Formato inválido. Ingrese 8 dígitos (ej: 7890-1234)." };
    }
    // Números de El Salvador comienzan con 2 (fijo), 6 o 7 (móvil)
    const primerDigito = val[0];
    if (!["2", "6", "7"].includes(primerDigito)) {
        return { valido: false, mensaje: "En El Salvador los teléfonos inician con 2 (fijo), 6 o 7 (móvil)." };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida nombres y apellidos humanos (solo letras y acentos)
 */
function validarNombre(valor, campoNombre = "El nombre") {
    const val = (valor || "").trim();
    if (!val) return { valido: false, mensaje: `${campoNombre} es obligatorio.` };
    if (val.length < 2) return { valido: false, mensaje: `${campoNombre} debe tener al menos 2 caracteres.` };
    if (!REGEX_TEXT_NAMES.test(val)) {
        return { valido: false, mensaje: `${campoNombre} solo debe contener letras y acentos, sin números ni símbolos.` };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida correo electrónico
 */
function validarEmail(valor) {
    const val = (valor || "").trim();
    if (!val) return { valido: false, mensaje: "El correo electrónico es obligatorio." };
    if (!REGEX_EMAIL_ADDR.test(val)) {
        return { valido: false, mensaje: "Ingrese un correo electrónico válido (ejemplo: usuario@correo.com)." };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida contraseña
 */
function validarPassword(valor) {
    const val = valor || "";
    if (!val) return { valido: false, mensaje: "La contraseña es obligatoria." };
    if (val.length < 6) return { valido: false, mensaje: "La contraseña debe tener mínimo 6 caracteres." };
    if (!REGEX_PASSWORD_ST.test(val)) {
        return { valido: false, mensaje: "Debe contener al menos una letra y un número." };
    }
    return { valido: true, mensaje: "" };
}

// ============================================================
// VALIDACIONES DE FECHA Y EDAD
// ============================================================

/**
 * Calcula la edad exacta y maneja casos de fechas futuras o recién nacidos
 */
function calcularEdadExacta(fechaNacStr) {
    if (!fechaNacStr) return { edad: 0, etiqueta: "-- años", valido: false };
    
    let anio, mes, dia;
    if (fechaNacStr.includes("-")) {
        const p = fechaNacStr.split("-");
        if (p[0].length === 4) {
            anio = parseInt(p[0], 10);
            mes = parseInt(p[1], 10) - 1;
            dia = parseInt(p[2], 10);
        } else {
            dia = parseInt(p[0], 10);
            mes = parseInt(p[1], 10) - 1;
            anio = parseInt(p[2], 10);
        }
    } else if (fechaNacStr.includes("/")) {
        const p = fechaNacStr.split("/");
        dia = parseInt(p[0], 10);
        mes = parseInt(p[1], 10) - 1;
        anio = parseInt(p[2], 10);
    } else {
        return { edad: 0, etiqueta: "-- años", valido: false };
    }

    const nac = new Date(anio, mes, dia);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (isNaN(nac.getTime()) || nac > hoy) {
        return { edad: 0, etiqueta: "0 años (Recién nacido)", valido: false, error: "Fecha en el futuro" };
    }

    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) {
        edad--;
    }

    if (edad < 0) edad = 0;

    let etiqueta = "";
    if (edad === 0) {
        let meses = (hoy.getFullYear() - nac.getFullYear()) * 12 + (hoy.getMonth() - nac.getMonth());
        if (hoy.getDate() < nac.getDate()) meses--;
        meses = Math.max(0, meses);
        etiqueta = meses <= 1 ? "1 mes" : `${meses} meses`;
    } else if (edad === 1) {
        etiqueta = "1 año";
    } else {
        etiqueta = `${edad} años`;
    }

    return { edad: edad, etiqueta: etiqueta, valido: true };
}

/**
 * Valida fecha de nacimiento (no puede ser futura, edad 0-120)
 */
function validarFechaNacimiento(valor) {
    if (!valor) return { valido: false, mensaje: "La fecha de nacimiento es requerida." };
    const res = calcularEdadExacta(valor);
    if (!res.valido) {
        return { valido: false, mensaje: "La fecha de nacimiento no puede ser una fecha futura." };
    }
    if (res.edad > 120) {
        return { valido: false, mensaje: "La edad calculada excede el límite razonable (máximo 120 años)." };
    }
    return { valido: true, mensaje: "", edad: res.edad, etiqueta: res.etiqueta };
}

/**
 * Valida fecha de cita (no puede ser en el pasado)
 */
function validarFechaCita(valor) {
    if (!valor) return { valido: false, mensaje: "La fecha de la cita es requerida." };
    const partes = valor.split("-");
    if (partes.length !== 3) return { valido: false, mensaje: "Formato de fecha de cita no válido." };
    const fecha = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (isNaN(fecha.getTime())) return { valido: false, mensaje: "Fecha de cita inválida." };
    if (fecha < hoy) return { valido: false, mensaje: "La fecha de la cita no puede ser anterior al día de hoy." };
    return { valido: true, mensaje: "" };
}

// ============================================================
// VALIDACIONES DE SIGNOS VITALES Y CLÍNICA (CONSULTA MÉDICA)
// ============================================================

/**
 * Valida Presión Arterial (formato Sistólica/Diastólica ej: 120/80)
 */
function validarPresionArterial(valor) {
    const v = (valor || "").trim();
    if (!v) return { valido: false, mensaje: "La Presión Arterial es obligatoria (ej: 120/80)." };
    const partes = v.split("/");
    if (partes.length !== 2) {
        return { valido: false, mensaje: "Formato requerido: Sistólica/Diastólica (ej: 120/80)." };
    }
    const sis = parseInt(partes[0], 10);
    const dia = parseInt(partes[1], 10);
    if (isNaN(sis) || isNaN(dia)) {
        return { valido: false, mensaje: "Los valores deben ser números (ej: 120/80)." };
    }
    if (sis < 60 || sis > 240) {
        return { valido: false, mensaje: `Sistólica (${sis}) fuera de rango clínico (60-240 mmHg).` };
    }
    if (dia < 35 || dia > 140) {
        return { valido: false, mensaje: `Diastólica (${dia}) fuera de rango clínico (35-140 mmHg).` };
    }
    if (sis <= dia) {
        return { valido: false, mensaje: "La sistólica debe ser mayor a la diastólica." };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida Frecuencia Cardíaca (30 - 220 lpm)
 */
function validarFrecuenciaCardiaca(valor) {
    const v = (valor || "").toString().trim();
    if (!v) return { valido: false, mensaje: "La Frecuencia Cardíaca es obligatoria (ej: 75)." };
    const num = parseInt(v, 10);
    if (isNaN(num)) return { valido: false, mensaje: "La F.C. debe ser un número entero (lpm)." };
    if (num < 30 || num > 220) {
        return { valido: false, mensaje: `Frecuencia Cardíaca (${num}) fuera de rango clínico (30-220 lpm).` };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida Temperatura Corporal (34.0 - 43.0 °C)
 */
function validarTemperatura(valor) {
    const v = (valor || "").toString().trim();
    if (!v) return { valido: false, mensaje: "La Temperatura es obligatoria (ej: 36.5)." };
    const num = parseFloat(v);
    if (isNaN(num)) return { valido: false, mensaje: "La temperatura debe ser un número (ej: 36.5)." };
    if (num < 34.0 || num > 43.0) {
        return { valido: false, mensaje: `Temperatura (${num} °C) fuera de rango viable (34.0 - 43.0 °C).` };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida Peso del Paciente (1.0 - 350.0 Kg)
 */
function validarPeso(valor) {
    const v = (valor || "").toString().trim();
    if (!v) return { valido: false, mensaje: "El Peso es obligatorio (ej: 68 o 70.5)." };
    const num = parseFloat(v);
    if (isNaN(num)) return { valido: false, mensaje: "El peso debe ser numérico en Kg (ej: 68)." };
    if (num < 1.0 || num > 350.0) {
        return { valido: false, mensaje: `Peso (${num} Kg) fuera de rango admisible (1 - 350 Kg).` };
    }
    return { valido: true, mensaje: "" };
}

/**
 * Valida Diagnóstico Clínico
 */
function validarDiagnostico(valor) {
    const v = (valor || "").trim();
    if (!v) return { valido: false, mensaje: "El diagnóstico clínico u observaciones son obligatorios." };
    if (v.length < 5) return { valido: false, mensaje: "El diagnóstico debe ser más descriptivo (mínimo 5 caracteres)." };
    return { valido: true, mensaje: "" };
}

// ============================================================
// HELPERS VISUALES DE ERROR Y ESTILOS DE RETROALIMENTACIÓN
// ============================================================

/**
 * Resalta el campo con borde rojo sutil y mensaje explicativo
 */
function marcarError(input, mensaje) {
    if (!input) return;
    const parent = input.closest(".vital-box") || input.closest(".form-group") || input.parentElement;
    if (!parent) return;

    // Remover mensaje previo si existía
    const prevMsg = parent.querySelector(".val-error-feedback");
    if (prevMsg) prevMsg.remove();

    if (mensaje) {
        input.classList.add("input-is-invalid");
        input.classList.remove("input-is-valid");
        input.style.borderColor = "#ef4444";
        input.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.18)";

        const span = document.createElement("div");
        span.className = "val-error-feedback";
        span.textContent = mensaje;
        span.style.cssText = "color: #dc2626; font-size: 11.5px; font-weight: 600; margin-top: 4px; display: block; line-height: 1.3;";
        parent.appendChild(span);
    } else {
        limpiarError(input);
    }
}

/**
 * Limpia el estado de error de un campo
 */
function limpiarError(input) {
    if (!input) return;
    const parent = input.closest(".vital-box") || input.closest(".form-group") || input.parentElement;
    if (parent) {
        const prevMsg = parent.querySelector(".val-error-feedback");
        if (prevMsg) prevMsg.remove();
    }
    input.classList.remove("input-is-invalid");
    input.classList.add("input-is-valid");
    input.style.borderColor = "";
    input.style.boxShadow = "";
}

/**
 * Escucha cambios en un input para limpiar su error automáticamente
 */
function enlazarLimpiezaEnInput(input) {
    if (!input) return;
    input.addEventListener("input", () => {
        if (input.classList.contains("input-is-invalid")) {
            limpiarError(input);
        }
    });
}
