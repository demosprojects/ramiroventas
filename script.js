import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let productos = [];
let productosFiltrados = [];
let carrito = JSON.parse(localStorage.getItem("carrito")) || [];
let categoriaActual = "Todos";

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────

function showToast(msj, tipo = "success") {
    const t = document.getElementById("toast");
    const icon = tipo === "success"
        ? `<i class="fa-solid fa-circle-check text-green-400"></i>`
        : tipo === "error"
        ? `<i class="fa-solid fa-circle-xmark text-red-400"></i>`
        : `<i class="fa-solid fa-circle-info text-blue-300"></i>`;
    t.innerHTML = `${icon} <span class="truncate">${msj}</span>`;
    t.classList.remove("translate-y-32");
    setTimeout(() => t.classList.add("translate-y-32"), 2800);
}

function showConfirm({ titulo, mensaje, labelOk = "Confirmar", labelCancel = "Cancelar", onOk }) {
    const overlay = document.getElementById("modal-confirm");
    document.getElementById("confirm-titulo").innerText = titulo;
    document.getElementById("confirm-mensaje").innerText = mensaje;
    const btnOk = document.getElementById("confirm-ok");
    btnOk.innerText = labelOk;
    const close = () => overlay.classList.add("hidden");
    btnOk.onclick = () => { close(); onOk(); };
    document.getElementById("confirm-cancel").onclick = close;
    document.getElementById("confirm-close").onclick = close;
    overlay.classList.remove("hidden");
}

function showAlert({ titulo, mensaje, labelOk = "Entendido", icono = "fa-circle-info", colorIcono = "text-[#0056b3]" }) {
    const overlay = document.getElementById("modal-alert");
    document.getElementById("alert-icono").innerHTML = `<i class="fa-solid ${icono} ${colorIcono}"></i>`;
    document.getElementById("alert-titulo").innerText = titulo;
    document.getElementById("alert-mensaje").innerText = mensaje;
    const btnOk = document.getElementById("alert-ok");
    btnOk.innerText = labelOk;
    const close = () => overlay.classList.add("hidden");
    btnOk.onclick = close;
    document.getElementById("alert-close").onclick = close;
    overlay.classList.remove("hidden");
}

// ─── CARGA CON SKELETONS ──────────────────────────────────────────────────────

function renderSkeletons() {
    const contenedor = document.getElementById("productos-grid");
    const skeletonHTML = `
        <div class="bg-white rounded-2xl overflow-hidden shadow border-2 border-transparent">
            <div class="skeleton aspect-square w-full"></div>
            <div class="p-3 sm:p-5 space-y-3">
                <div class="skeleton h-4 w-3/4 rounded"></div>
                <div class="skeleton h-6 w-1/2 rounded"></div>
                <div class="skeleton h-10 w-full rounded-xl"></div>
            </div>
        </div>
    `;
    contenedor.innerHTML = skeletonHTML.repeat(8);
}

async function cargarProductos() {
    renderSkeletons();
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        productos = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        productosFiltrados = [...productos];

        // ── Verificar stock de los items en el carrito ──
        verificarStockCarrito();

        renderProductos();
        actualizarContador();
    } catch (e) {
        console.error("Error cargando productos:", e);
        showAlert({
            titulo: "Error de conexion",
            mensaje: "No se pudieron cargar los productos. Por favor recarga la pagina.",
            icono: "fa-triangle-exclamation",
            colorIcono: "text-red-500"
        });
    }
}

// ─── VERIFICAR STOCK DEL CARRITO ──────────────────────────────────────────────
// Compara los items guardados en localStorage contra el stock actual de Firebase.
// Marca como sinStock los que quedaron sin disponibilidad y muestra un aviso.

function verificarStockCarrito() {
    if (!carrito.length) return;

    let productosAgotados = [];

    carrito = carrito.map(item => {
        const productoActual = productos.find(p => p.id === item.id);

        // Si el producto ya no existe en la base de datos o quedó sin stock
        if (!productoActual || productoActual.disponible === false) {
            productosAgotados.push(item.nombre);
            return { ...item, sinStock: true };
        }

        // Producto sigue disponible → limpiar flag por si lo tenía de antes
        const { sinStock, ...itemLimpio } = item;
        return itemLimpio;
    });

    guardarCarrito();

    if (productosAgotados.length > 0) {
        // Pequeño delay para que el toast sea visible después de que cargue la UI
        setTimeout(() => {
            showToast(
                productosAgotados.length === 1
                    ? `"${productosAgotados[0]}" se quedó sin stock`
                    : `${productosAgotados.length} productos de tu carrito se quedaron sin stock`,
                "error"
            );
        }, 600);
    }
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderProductos() {
    const contenedor = document.getElementById("productos-grid");

    if (productosFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="col-span-full py-16 text-center">
                <i class="fa-solid fa-magnifying-glass text-3xl text-gray-200 mb-3 block"></i>
                <p class="text-sm font-bold text-gray-400 italic">No se encontraron productos con ese criterio.</p>
            </div>`;
        return;
    }

    contenedor.innerHTML = productosFiltrados.map(p => {
        const disponible = p.disponible !== false;
        const enOferta = p.enOferta === true;
        const precioAnterior = p.precioAnterior ? Number(p.precioAnterior) : null;

        // Badges en la imagen
        let badgeTop = `
            <div class="absolute top-2 left-2 flex flex-col gap-1">
                <span class="bg-yellow-400 text-blue-900 text-[8px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase italic shadow-sm">
                    ${p.categoria || 'Novedad'}
                </span>
                ${enOferta ? `<span class="bg-red-500 text-white text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full uppercase italic shadow-sm flex items-center gap-0.5"><i class="fa-solid fa-tag text-[7px]"></i> Oferta</span>` : ''}
            </div>
        `;

        // Badge sin stock
        let badgeSinStock = !disponible
            ? `<div class="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl sm:rounded-none">
                <span class="bg-slate-800 text-white text-[9px] sm:text-xs font-black px-3 py-1.5 rounded-full uppercase italic tracking-wider shadow">Sin stock</span>
               </div>`
            : '';

        // Bloque de precios
        let precioHTML;
        if (enOferta && precioAnterior) {
            const descuento = Math.round(((precioAnterior - Number(p.precio)) / precioAnterior) * 100);
            precioHTML = `
                <div class="flex items-baseline gap-1.5 flex-wrap mb-2 sm:mb-3">
                    <p class="card-price text-base sm:text-xl font-black text-red-600">$${Number(p.precio).toLocaleString('es-AR')}</p>
                    <p class="text-gray-400 font-bold text-xs sm:text-sm line-through">$${precioAnterior.toLocaleString('es-AR')}</p>
                    ${descuento > 0 ? `<span class="bg-red-100 text-red-600 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase italic">-${descuento}%</span>` : ''}
                </div>
            `;
        } else {
            precioHTML = `<p class="card-price text-base sm:text-xl font-black text-[#0056b3] mb-2 sm:mb-3">$${Number(p.precio).toLocaleString('es-AR')}</p>`;
        }

        // Botón agregar
        const btnAgregar = disponible
            ? `<button onclick="agregarCarrito('${p.id}')" class="card-btn w-full bg-gray-900 text-white py-2 sm:py-2.5 rounded-xl font-black hover:bg-[#0056b3] transition-colors flex items-center justify-center gap-1.5 italic uppercase text-[0.62rem] sm:text-xs">
                <i class="fa-solid fa-plus text-[0.6rem]"></i> Agregar al carrito
               </button>`
            : `<button disabled class="card-btn w-full bg-gray-100 text-gray-400 py-2 sm:py-2.5 rounded-xl font-black cursor-not-allowed italic uppercase text-[0.62rem] sm:text-xs">
                <i class="fa-solid fa-ban text-[0.6rem]"></i> Sin stock
               </button>`;

        return `
            <div class="product-card bg-white rounded-2xl overflow-hidden shadow border-2 border-transparent hover:border-[#0056b3] transition-all duration-300 group ${!disponible ? 'opacity-75' : ''}">
                <div class="card-img relative aspect-square overflow-hidden bg-gray-100 cursor-pointer" onclick="verDetalles('${p.id}')">
                    <img src="${p.imagenes[0]}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${!disponible ? 'grayscale' : ''}" loading="lazy">
                    ${badgeTop}
                    ${badgeSinStock}
                </div>
                <div class="card-body p-3 sm:p-5">
                    <h3 class="card-name font-black text-[0.7rem] sm:text-sm md:text-base mb-1 uppercase truncate leading-tight">${p.nombre}</h3>
                    ${precioHTML}
                    ${btnAgregar}
                </div>
            </div>
        `;
    }).join("");
}

// ─── FILTROS Y BUSCADOR ───────────────────────────────────────────────────────

window.filtrarCategoria = function(cat) {
    categoriaActual = cat;
    document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-[#0056b3]', 'text-white');
        btn.classList.add('bg-gray-100', 'text-gray-700');
        if (btn.innerText.trim() === cat || (cat === "Todos" && btn.innerText.trim() === "Ver Todo")) {
            btn.classList.add('active');
            btn.classList.remove('bg-gray-100', 'text-gray-700');
        }
    });
    aplicarFiltros();
};

document.addEventListener('DOMContentLoaded', () => {
    const buscador = document.getElementById('buscador-principal');
    if (buscador) {
        buscador.addEventListener('input', aplicarFiltros);
    }
});

function aplicarFiltros() {
    const buscador = document.getElementById('buscador-principal');
    const texto = (buscador ? buscador.value : '').toLowerCase().trim();
    
    productosFiltrados = productos.filter(p => {
        const matchText =
            p.nombre.toLowerCase().includes(texto) ||
            (p.descripcion && p.descripcion.toLowerCase().includes(texto)) ||
            (p.categoria && p.categoria.toLowerCase().includes(texto));
        const matchCat = (categoriaActual === "Todos") || (p.categoria === categoriaActual);
        return matchText && matchCat;
    });
    renderProductos();
}

// ─── DETALLE ──────────────────────────────────────────────────────────────────

window.verDetalles = function(id) {
    const p = productos.find(x => x.id === id);
    if (!p) return;

    const disponible = p.disponible !== false;
    const enOferta = p.enOferta === true;
    const precioAnterior = p.precioAnterior ? Number(p.precioAnterior) : null;

    let precioDetalleHTML;
    if (enOferta && precioAnterior) {
        const descuento = Math.round(((precioAnterior - Number(p.precio)) / precioAnterior) * 100);
        precioDetalleHTML = `
            <div class="flex items-center gap-3 flex-wrap mb-3 sm:mb-6">
                <p class="text-2xl sm:text-4xl font-black text-red-600">$${Number(p.precio).toLocaleString('es-AR')}</p>
                <div class="flex flex-col">
                    <span class="text-gray-400 font-bold text-sm sm:text-base line-through">$${precioAnterior.toLocaleString('es-AR')}</span>
                    ${descuento > 0 ? `<span class="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-md uppercase italic text-center">-${descuento}% OFF</span>` : ''}
                </div>
            </div>
        `;
    } else {
        precioDetalleHTML = `<p class="text-2xl sm:text-4xl font-black text-red-600 mb-3 sm:mb-6">$${Number(p.precio).toLocaleString('es-AR')}</p>`;
    }

    const sinStockBanner = !disponible
        ? `<div class="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
            <i class="fa-solid fa-circle-exclamation text-orange-400"></i>
            <p class="text-orange-700 font-black text-xs uppercase italic">Producto sin stock — podés consultar disponibilidad</p>
           </div>`
        : '';

    const btnDetalle = disponible
        ? `<button onclick="agregarCarrito('${p.id}')" class="mt-auto bg-[#0056b3] text-white py-3.5 sm:py-5 rounded-2xl font-black hover:scale-105 transition-all text-sm sm:text-xl shadow-xl italic uppercase">
            <i class="fa-solid fa-cart-plus mr-2"></i>Agregar al carrito
           </button>`
        : `<button onclick="cerrarModal('modal-detalles'); enviarConsultaWhatsApp('${p.id}')" class="mt-auto bg-green-500 text-white py-3.5 sm:py-5 rounded-2xl font-black hover:scale-105 transition-all text-sm sm:text-xl shadow-xl italic uppercase">
            <i class="fa-brands fa-whatsapp mr-2"></i>Consultar disponibilidad
           </button>`;

    document.getElementById("detalle-contenido").innerHTML = `
        <div class="w-full sm:w-1/2 p-3 sm:p-4 bg-gray-50 flex flex-col gap-2 sm:gap-3">
            <div class="rounded-2xl overflow-hidden bg-white shadow-inner" style="height:clamp(180px,45vw,400px)">
                <img id="main-img" src="${p.imagenes[0]}" class="w-full h-full object-cover ${!disponible ? 'grayscale' : ''}">
            </div>
            <div class="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                ${p.imagenes.map(img => `
                    <img src="${img}" onclick="document.getElementById('main-img').src='${img}'"
                        class="w-14 h-14 sm:w-20 sm:h-20 object-cover rounded-xl cursor-pointer hover:ring-2 ring-[#0056b3] flex-shrink-0 transition-all">
                `).join("")}
            </div>
        </div>
        <div class="flex flex-col flex-1 p-4 sm:p-8">
            <div class="flex flex-wrap gap-2 mb-3">
                <span class="bg-yellow-400 text-blue-900 text-[10px] font-black px-3 py-1 rounded-full uppercase italic">${p.categoria || 'Novedad'}</span>
                ${enOferta ? `<span class="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic"><i class="fa-solid fa-tag mr-1"></i>Oferta</span>` : ''}
                ${!disponible ? `<span class="bg-slate-700 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic">Sin stock</span>` : ''}
            </div>
            <h2 class="text-xl sm:text-3xl font-black uppercase italic mb-2 leading-tight">${p.nombre}</h2>
            ${sinStockBanner}
            ${precioDetalleHTML}
            <p class="text-gray-600 font-semibold mb-4 border-l-4 border-yellow-400 pl-3 text-xs sm:text-sm leading-relaxed">${p.descripcion || ''}</p>
            <div class="bg-blue-50 p-3 sm:p-5 rounded-2xl mb-4 sm:mb-6">
                <h4 class="text-[10px] font-black uppercase text-[#0056b3] mb-1.5">Caracteristicas:</h4>
                <pre class="font-sans text-xs font-bold text-gray-700 whitespace-pre-line">${p.caracteristicas || 'Consultanos por mas informacion.'}</pre>
            </div>
            ${btnDetalle}
        </div>
    `;
    document.getElementById("modal-detalles").classList.remove("hidden");
    document.body.classList.add("modal-active");
};

// ─── CARRITO ──────────────────────────────────────────────────────────────────

window.agregarCarrito = function(id) {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    if (prod.disponible === false) {
        showToast("Producto sin stock", "error");
        return;
    }
    const existe = carrito.find(p => p.id === id);
    if (existe) existe.cantidad++;
    else carrito.push({ ...prod, cantidad: 1 });
    guardarCarrito();
    actualizarContador();
    const nombre = prod.nombre.length > 28 ? prod.nombre.slice(0, 28) + '…' : prod.nombre;
    showToast(`${nombre} agregado`, "success");
};

window.cambiarCantidad = function(id, delta) {
    const item = carrito.find(p => p.id === id);
    if (!item) return;

    // No permitir aumentar cantidad de productos sin stock
    if (delta > 0 && item.sinStock) {
        showToast("Este producto está sin stock", "error");
        return;
    }

    if (item.cantidad + delta <= 0) {
        showConfirm({
            titulo: "Eliminar producto",
            mensaje: `¿Queres quitar "${item.nombre}" del carrito?`,
            labelOk: "Eliminar",
            onOk: () => {
                carrito = carrito.filter(p => p.id !== id);
                guardarCarrito(); actualizarContador(); abrirCarrito();
                showToast("Producto eliminado", "info");
            }
        });
        return;
    }
    item.cantidad += delta;
    guardarCarrito(); actualizarContador(); abrirCarrito();
};

window.quitarItem = function(id) {
    const item = carrito.find(p => p.id === id);
    if (!item) return;
    showConfirm({
        titulo: "Eliminar producto",
        mensaje: `¿Queres quitar "${item.nombre}" del carrito?`,
        labelOk: "Eliminar",
        onOk: () => {
            carrito = carrito.filter(p => p.id !== id);
            guardarCarrito(); actualizarContador(); abrirCarrito();
            showToast("Producto eliminado", "info");
        }
    });
};

window.vaciarCarrito = function() {
    if (!carrito.length) return;
    showConfirm({
        titulo: "Vaciar carrito",
        mensaje: "Esta accion eliminara todos los productos. ¿Continuar?",
        labelOk: "Vaciar todo",
        onOk: () => {
            carrito = [];
            guardarCarrito(); actualizarContador(); abrirCarrito();
            showToast("Carrito vaciado", "info");
        }
    });
};

function guardarCarrito() {
    localStorage.setItem("carrito", JSON.stringify(carrito));
}

window.abrirCarrito = function() {
    const lista = document.getElementById("carrito-lista");
    let total = 0;
    const hayProductosSinStock = carrito.some(p => p.sinStock);

    if (!carrito.length) {
        lista.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center py-12 gap-3">
                <div class="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                    <i class="fa-solid fa-cart-shopping text-2xl text-gray-300"></i>
                </div>
                <div>
                    <p class="font-black text-gray-500 text-sm uppercase tracking-wide">El carrito esta vacio</p>
                    <p class="text-gray-400 text-xs mt-1 font-semibold">Agrega productos para comenzar</p>
                </div>
            </div>`;
    } else {
        // Banner de aviso general si hay algún producto sin stock
        const bannerSinStock = hayProductosSinStock
            ? `<div class="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 mb-2 flex items-start gap-2">
                <i class="fa-solid fa-triangle-exclamation text-orange-400 mt-0.5 flex-shrink-0 text-sm"></i>
                <p class="text-orange-700 font-bold text-[11px] leading-snug">
                    Algunos productos se quedaron sin stock. Podés eliminarlos o consultarlos por WhatsApp.
                </p>
               </div>`
            : '';

        lista.innerHTML = `
            <div class="flex justify-end mb-1">
                <button onclick="vaciarCarrito()" class="text-[10px] text-red-400 hover:text-red-600 font-bold uppercase tracking-wide transition-colors">
                    <i class="fa-solid fa-trash-can mr-1"></i> Vaciar
                </button>
            </div>
            ${bannerSinStock}
            ${carrito.map(p => {
                // Solo sumar al total los productos con stock
                if (!p.sinStock) total += p.precio * p.cantidad;

                // Tarjeta diferenciada para productos sin stock
                if (p.sinStock) {
                    return `
                    <div class="flex items-center gap-2.5 bg-orange-50 p-2.5 sm:p-3 rounded-xl border border-orange-200 relative">
                        <div class="relative flex-shrink-0">
                            <img src="${p.imagenes[0]}" class="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl shadow-sm grayscale opacity-60">
                            <div class="absolute inset-0 flex items-center justify-center">
                                <span class="bg-slate-800/80 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase leading-tight text-center">Sin<br>stock</span>
                            </div>
                        </div>
                        <div class="flex-grow min-w-0">
                            <h4 class="font-black text-[0.65rem] sm:text-xs uppercase truncate leading-tight text-gray-500">${p.nombre}</h4>
                            <p class="text-orange-500 font-black text-[10px] mt-0.5 flex items-center gap-1">
                                <i class="fa-solid fa-circle-exclamation text-[9px]"></i> Sin stock
                            </p>
                            <button onclick="cerrarModal('modal-carrito'); enviarConsultaWhatsApp('${p.id}')"
                                class="mt-1 text-[9px] text-green-600 hover:text-green-700 font-black uppercase flex items-center gap-0.5 transition-colors">
                                <i class="fa-brands fa-whatsapp text-[10px]"></i> Consultar
                            </button>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button onclick="quitarItem('${p.id}')" class="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <i class="fa-solid fa-trash-can text-[10px]"></i>
                            </button>
                        </div>
                    </div>`;
                }

                // Tarjeta normal para productos con stock
                return `
                <div class="flex items-center gap-2.5 bg-gray-50 p-2.5 sm:p-3 rounded-xl border border-gray-100">
                    <img src="${p.imagenes[0]}" class="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded-xl shadow-sm flex-shrink-0">
                    <div class="flex-grow min-w-0">
                        <h4 class="font-black text-[0.65rem] sm:text-xs uppercase truncate leading-tight">${p.nombre}</h4>
                        <p class="text-[#0056b3] font-black text-xs sm:text-sm">$${(p.precio * p.cantidad).toLocaleString('es-AR')}</p>
                        <p class="text-gray-400 text-[10px] font-semibold">$${p.precio.toLocaleString('es-AR')} c/u</p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button onclick="cambiarCantidad('${p.id}', -1)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-red-100 hover:text-red-600 transition-colors">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <span class="w-5 text-center font-black text-xs">${p.cantidad}</span>
                        <button onclick="cambiarCantidad('${p.id}', 1)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-[#0056b3] hover:text-white transition-colors">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                        <button onclick="quitarItem('${p.id}')" class="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-0.5">
                            <i class="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                    </div>
                </div>`;
            }).join("")}`;
    }

    document.getElementById("total-carrito").innerText = `$${total.toLocaleString('es-AR')}`;

    // Si hay productos sin stock, deshabilitar el botón de enviar pedido
    const btnEnviar = document.querySelector("#modal-carrito button[onclick='enviarWhatsApp()']");
    if (btnEnviar) {
        if (hayProductosSinStock) {
            btnEnviar.disabled = true;
            btnEnviar.classList.add("opacity-50", "cursor-not-allowed");
            btnEnviar.title = "Eliminá los productos sin stock para poder enviar el pedido";
        } else {
            btnEnviar.disabled = false;
            btnEnviar.classList.remove("opacity-50", "cursor-not-allowed");
            btnEnviar.title = "";
        }
    }

    document.getElementById("modal-carrito").classList.remove("hidden");
    document.body.classList.add("modal-active");
};

window.cerrarModal = (id) => {
    document.getElementById(id).classList.add("hidden");
    document.body.classList.remove("modal-active");
};

function actualizarContador() {
    const count = carrito.reduce((acc, p) => acc + p.cantidad, 0);
    const counterElement = document.getElementById("cart-count");
    if (counterElement) counterElement.innerText = count;
}

window.enviarConsultaWhatsApp = function(id) {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    const msj = `Hola Ramiro! Te escribo desde la web. Quería consultar si tienen disponible: *${prod.nombre}*. Muchas gracias!`;
    window.open(`https://wa.me/5493735538773?text=${encodeURIComponent(msj)}`);
};

window.enviarWhatsApp = function() {
    if (!carrito.length) {
        showAlert({
            titulo: "Carrito vacio",
            mensaje: "Agrega al menos un producto antes de enviar tu pedido.",
            icono: "fa-cart-shopping",
            colorIcono: "text-gray-400"
        });
        return;
    }

    // Bloquear envío si hay productos sin stock
    const hayProductosSinStock = carrito.some(p => p.sinStock);
    if (hayProductosSinStock) {
        showAlert({
            titulo: "Hay productos sin stock",
            mensaje: "Eliminá los productos marcados como sin stock antes de enviar tu pedido.",
            icono: "fa-triangle-exclamation",
            colorIcono: "text-orange-400"
        });
        return;
    }

    let msj = "Hola Ramiro! Te escribo desde la web. Quiero consultar por estos productos:%0A%0A";
    let total = 0;
    carrito.forEach(p => {
        msj += `*- ${p.nombre}* (x${p.cantidad}) - $${(p.precio * p.cantidad).toLocaleString('es-AR')}%0A`;
        total += p.precio * p.cantidad;
    });
    msj += `%0A*TOTAL: $${total.toLocaleString('es-AR')}*%0A%0AEstan disponibles? Muchas gracias!`;
    window.open(`https://wa.me/5493735538773?text=${msj}`);
};

cargarProductos();