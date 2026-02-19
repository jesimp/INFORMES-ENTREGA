const URL_GOOGLE = "https://script.google.com/macros/s/AKfycbzJ5yqU1S9b4Ny45Oy2ffZSrY0XYCJJWWtxfkCNeG4OObIdcJrFyKGXwPtRMaegSRiR/exec";

// --- INICIO DEL SISTEMA ---
document.addEventListener("DOMContentLoaded", () => {
    iniciarMatrix();
    cargarDatos();
    document.getElementById('btn-guardar').onclick = guardarCambios;
});

// --- GESTIÓN DE DATOS (LECTURA) ---
async function cargarDatos() {
    const body = document.getElementById('table-body');
    try {
        const res = await fetch(URL_GOOGLE);
        const datos = await res.json();
        
        if (!datos || datos.length === 0) {
            body.innerHTML = '<tr><td colspan="9" style="text-align:center;">No se encontraron registros activos.</td></tr>';
            return;
        }

        renderizarTabla(datos);
        actualizarResumen(datos);
        document.getElementById('last-update').textContent = "SISTEMA ONLINE: " + new Date().toLocaleTimeString();
    } catch (e) {
        console.error("Error de carga:", e);
        body.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#ff4444;">ERROR DE CONEXIÓN CON DATACLOUD</td></tr>';
    }
}

// --- RENDERIZADO DE TABLA ---
function renderizarTabla(datos) {
    const body = document.getElementById('table-body');
    body.innerHTML = '';
    
    datos.forEach(fila => {
        const tr = document.createElement('tr');
        const totalOriginal = parseFloat(fila.TOTAL) || 0;
        
        // Función para obtener valores de entrega
        const getE = (n) => parseFloat(fila[`ENTREGADO${n}`]) || 0;
        const sumaEntregas = getE(1) + getE(2) + getE(3) + getE(4) + getE(5);
        const stockActual = totalOriginal - sumaEntregas;

        tr.innerHTML = `
            <td style="color:var(--neon-green); font-weight:700;">${fila.DESCRIPCION || 'S/N'}</td>
            <td>${fila.ORDEN || '-'}</td>
            <td>${fila.MTV || '-'}</td>
            <td class="col-total">${stockActual.toFixed(0)}</td>
        `;

        for (let i = 1; i <= 5; i++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = "number";
            input.className = "input-entregado";
            const val = fila[`ENTREGADO${i}`];
            
            // Si el valor es 0 o nulo, mostrar campo vacío
            input.value = (val == 0 || !val) ? "" : val;
            input.placeholder = "0";

            input.oninput = () => {
                let s = 0;
                tr.querySelectorAll('.input-entregado').forEach(inp => s += (parseFloat(inp.value) || 0));
                const celdaT = tr.querySelector('.col-total');
                const final = totalOriginal - s;
                celdaT.textContent = final.toFixed(0);

                // FEEDBACK DE COLORES (Semáforo de stock)
                if (final <= 0) { 
                    celdaT.style.background = "#ff4444"; 
                    celdaT.style.boxShadow = "0 0 15px #ff4444";
                } else if (final < (totalOriginal * 0.2)) {
                    celdaT.style.background = "#ffae00"; 
                    celdaT.style.boxShadow = "0 0 15px #ffae00";
                } else {
                    celdaT.style.background = "#ffffff"; 
                    celdaT.style.boxShadow = "none";
                }
            };
            td.appendChild(input);
            tr.appendChild(td);
        }
        body.appendChild(tr);
        
        // Aplicar color inicial al cargar
        tr.querySelector('.input-entregado').oninput();
    });
}

// --- PANEL DE RESUMEN (HORIZONTAL EN GRUPOS DE 4) ---
function actualizarResumen(datos) {
    const contenedor = document.getElementById('resumen-totales');
    const totales = {};

    datos.forEach(f => {
        const desc = f.DESCRIPCION || "S/D";
        const sumE = (parseFloat(f.ENTREGADO1)||0) + (parseFloat(f.ENTREGADO2)||0) + 
                     (parseFloat(f.ENTREGADO3)||0) + (parseFloat(f.ENTREGADO4)||0) + (parseFloat(f.ENTREGADO5)||0);
        const real = (parseFloat(f.TOTAL)||0) - sumE;
        totales[desc] = (totales[desc] || 0) + real;
    });

    contenedor.innerHTML = '';
    for (const [key, val] of Object.entries(totales)) {
        const div = document.createElement('div');
        div.className = 'summary-card';
        div.innerHTML = `<h3>${key}</h3><p>${val.toFixed(0)}</p>`;
        contenedor.appendChild(div);
    }
}

// --- BUSCADOR ---
function filtrarTabla() {
    const val = document.getElementById("input-busqueda").value.toUpperCase();
    const rows = document.querySelectorAll("#table-body tr");
    rows.forEach(r => {
        // Filtra por todo el contenido de la fila (Descripción, Orden, MTV)
        const text = r.innerText.toUpperCase();
        r.style.display = text.includes(val) ? "" : "none";
    });
}

// --- GUARDADO DE DATOS (POST) ---
async function guardarCambios() {
    const btn = document.getElementById('btn-guardar');
    const originalText = btn.textContent;
    btn.textContent = "⌛ SINCRONIZANDO...";
    btn.disabled = true;

    const payload = [];
    document.querySelectorAll('#table-body tr').forEach(tr => {
        if (tr.cells.length < 4) return; 

        const ins = tr.querySelectorAll('.input-entregado');
        const rest = parseFloat(tr.querySelector('.col-total').textContent) || 0;
        const sumI = Array.from(ins).reduce((a, b) => a + (parseFloat(b.value) || 0), 0);

        payload.push({
            DESCRIPCION: tr.cells[0].textContent,
            ORDEN: tr.cells[1].textContent,
            MTV: tr.cells[2].textContent,
            TOTAL: (rest + sumI).toString(), // Se guarda el total original reconstruido
            ENTREGADO1: ins[0].value || "0", 
            ENTREGADO2: ins[1].value || "0", 
            ENTREGADO3: ins[2].value || "0", 
            ENTREGADO4: ins[3].value || "0", 
            ENTREGADO5: ins[4].value || "0"
        });
    });

    try {
        await fetch(URL_GOOGLE, { 
            method: 'POST', 
            mode: 'no-cors', 
            body: JSON.stringify(payload) 
        });
        alert("🛰️ COMPLETADO: DATOS EN NUBE");
        await cargarDatos(); // Recarga visual sin refrescar pestaña
    } catch (e) { 
        alert("ERROR EN LA TRANSMISIÓN. Verifique conexión."); 
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// --- MOTOR DE LLUVIA MATRIX (RESPONSIVO) ---
function iniciarMatrix() {
    const canvas = document.getElementById('matrix-canvas');
    const ctx = canvas.getContext('2d');

    function ajustarTamano() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    ajustarTamano();
    window.addEventListener('resize', ajustarTamano);

    const chars = "0123456789ABCDEFHIJKLMNOPQRSTUVWXYZ";
    const size = 16;
    let drops = Array(Math.floor(canvas.width / size)).fill(1);

    function draw() {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#0F0"; // Verde Matrix
        ctx.font = size + "px monospace";
        
        drops.forEach((y, i) => {
            const text = chars[Math.floor(Math.random() * chars.length)];
            ctx.fillText(text, i * size, y * size);
            
            if (y * size > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        });
    }
    setInterval(draw, 35);
}