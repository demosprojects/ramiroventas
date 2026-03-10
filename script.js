import { db } from "./firebase.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let productos = [];
let productosFiltrados = [];
let carrito = JSON.parse(localStorage.getItem("carrito-ramiro")) || [];
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

function verificarStockCarrito() {
    if (!carrito.length) return;

    carrito = carrito.map(item => {
        if (!item.carritoKey) return { ...item, carritoKey: item.id };
        return item;
    });

    let productosAgotados = [];

    carrito = carrito.map(item => {
        const productoActual = productos.find(p => p.id === item.id);

        if (!productoActual || productoActual.disponible === false) {
            productosAgotados.push(item.nombre);
            return { ...item, sinStock: true };
        }

        if (item.variante) {
            const varianteActual = Array.isArray(productoActual.variantes)
                ? productoActual.variantes.find(v => v.nombre === item.variante)
                : null;

            if (!varianteActual || varianteActual.disponible === false) {
                const etiqueta = `${item.nombre} (${item.variante})`;
                productosAgotados.push(etiqueta);
                return { ...item, sinStock: true };
            }
        }

        const { sinStock, ...itemLimpio } = item;
        return itemLimpio;
    });

    guardarCarrito();
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

        // Botón ver producto
        const btnAgregar = disponible
            ? `<button onclick="verDetalles('${p.id}')" class="card-btn w-full bg-gray-900 text-white py-2 sm:py-2.5 rounded-xl font-black hover:bg-[#0056b3] transition-colors flex items-center justify-center gap-1.5 italic uppercase text-[0.62rem] sm:text-xs">
                <i class="fa-solid fa-eye text-[0.6rem]"></i> Ver producto
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
    const tieneVariantes = Array.isArray(p.variantes) && p.variantes.length > 0;

    // ── Bloque de precio (puede ser reemplazado dinámicamente si hay variantes) ──
    function buildPrecioHTML(precio, anterior = null) {
        if (enOferta && anterior) {
            const descuento = Math.round(((anterior - precio) / anterior) * 100);
            return `
                <div class="flex items-center gap-3 flex-wrap mb-3 sm:mb-4" id="precio-detalle-wrap">
                    <p class="text-2xl sm:text-4xl font-black text-red-600" id="precio-detalle-val">$${precio.toLocaleString('es-AR')}</p>
                    <div class="flex flex-col">
                        <span class="text-gray-400 font-bold text-sm sm:text-base line-through">$${anterior.toLocaleString('es-AR')}</span>
                        ${descuento > 0 ? `<span class="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-md uppercase italic text-center">-${descuento}% OFF</span>` : ''}
                    </div>
                </div>
            `;
        }
        return `
            <div id="precio-detalle-wrap" class="mb-3 sm:mb-4">
                <p class="text-2xl sm:text-4xl font-black text-[#0056b3]" id="precio-detalle-val">$${precio.toLocaleString('es-AR')}</p>
            </div>
        `;
    }

    const precioDetalleHTML = buildPrecioHTML(Number(p.precio), precioAnterior);

    // ── Selector de variantes ──
    let variantesHTML = '';
    if (tieneVariantes) {
        variantesHTML = `
            <div class="mb-4 sm:mb-5">
                <p class="text-[10px] font-black uppercase text-gray-500 mb-2 tracking-wider">Seleccioná tu variante:</p>
                <div class="flex flex-wrap gap-2" id="variantes-btns">
                    ${p.variantes.map((v) => {
                        const varDisp = v.disponible !== false;
                        if (!varDisp) {
                            return `
                                <div class="relative variante-btn-agotada border-2 border-slate-100 rounded-xl px-3 py-2 opacity-60 cursor-not-allowed leading-tight bg-slate-50">
                                    <span class="block font-black text-[11px] uppercase italic text-slate-400 line-through">${v.nombre}</span>
                                    <span class="block text-[9px] font-black text-slate-400 mt-0.5">$${Number(v.precio).toLocaleString('es-AR')}</span>
                                    <span class="absolute -top-1.5 -right-1.5 bg-slate-700 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">Agotado</span>
                                </div>`;
                        }
                        return `
                            <button
                                type="button"
                                data-precio="${v.precio}"
                                data-nombre="${v.nombre}"
                                onclick="seleccionarVariante(this, '${id}')"
                                class="variante-btn border-2 border-slate-200 text-slate-600 hover:border-[#0056b3] hover:text-[#0056b3] rounded-xl px-3 py-2 font-black text-[11px] uppercase italic transition-all leading-tight">
                                <span class="block">${v.nombre}</span>
                                <span class="block text-[10px] font-bold text-[#0056b3] mt-0.5">$${Number(v.precio).toLocaleString('es-AR')}</span>
                            </button>`;
                    }).join('')}
                </div>
                <p id="variante-aviso" class="text-[10px] text-orange-500 font-bold mt-1.5 hidden"><i class="fa-solid fa-circle-exclamation mr-1"></i>Elegí una variante para continuar</p>
            </div>
        `;
    }

    const sinStockBanner = !disponible
        ? `<div class="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
            <i class="fa-solid fa-circle-exclamation text-orange-400"></i>
            <p class="text-orange-700 font-black text-xs uppercase italic">Producto sin stock — podés consultar disponibilidad</p>
           </div>`
        : '';

    const btnCerrarInline = `<button onclick="cerrarModal('modal-detalles')" class="flex-shrink-0 bg-gray-100 text-gray-600 hover:bg-gray-200 py-3.5 px-4 rounded-2xl font-black transition-colors text-sm uppercase flex items-center justify-center gap-1.5">
            <i class="fa-solid fa-xmark"></i> Cerrar
           </button>`;

    const btnDetalle = disponible
        ? `<div class="flex gap-2">${btnCerrarInline}<button onclick="agregarCarrito('${p.id}')" id="btn-detalle-agregar" class="flex-1 bg-[#0056b3] text-white py-3.5 rounded-2xl font-black hover:bg-blue-700 transition-colors text-sm sm:text-base shadow-lg italic uppercase flex items-center justify-center gap-2">
            <i class="fa-solid fa-cart-plus"></i>Agregar al carrito
           </button></div>`
        : `<div class="flex gap-2">${btnCerrarInline}<button onclick="cerrarModal('modal-detalles'); enviarConsultaWhatsApp('${p.id}')" class="flex-1 bg-green-500 text-white py-3.5 rounded-2xl font-black hover:bg-green-600 transition-colors text-sm sm:text-base shadow-lg italic uppercase flex items-center justify-center gap-2">
            <i class="fa-brands fa-whatsapp"></i>Consultar
           </button></div>`;

    document.getElementById("detalle-contenido").innerHTML = `
        <div class="detalle-col-galeria">
            <div class="detalle-img-wrap" onclick="abrirLightboxActual()">
                <img id="main-img"
                    src="${p.imagenes[0]}"
                    class="w-full h-full object-cover transition-opacity duration-300 ${!disponible ? 'grayscale' : ''}"
                    alt="${p.nombre}">
                <div class="absolute bottom-2 right-2 bg-black/40 text-white rounded-full w-7 h-7 flex items-center justify-center pointer-events-none">
                    <i class="fa-solid fa-magnifying-glass-plus text-[10px]"></i>
                </div>
            </div>
            ${p.imagenes.length > 1 ? `
            <div class="flex gap-2 p-2.5 overflow-x-auto no-scrollbar border-t border-slate-100 bg-white flex-shrink-0">
                ${p.imagenes.map((img, idx) => `
                    <button type="button"
                        onclick="cambiarImagenDetalle('${img}', this); event.stopPropagation()"
                        class="thumb-btn flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 ${idx === 0 ? 'border-[#0056b3]' : 'border-transparent'} hover:border-[#0056b3] transition-all">
                        <img src="${img}" class="w-full h-full object-cover" alt="">
                    </button>
                `).join('')}
            </div>` : ''}
        </div>

        <div class="detalle-col-info">
            <div class="detalle-info-body">
                <div class="flex flex-wrap gap-1.5 mb-2.5">
                    <span class="bg-yellow-400 text-blue-900 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase italic">${p.categoria || 'Novedad'}</span>
                    ${enOferta ? `<span class="bg-red-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase italic"><i class="fa-solid fa-tag mr-1"></i>Oferta</span>` : ''}
                    ${!disponible ? `<span class="bg-slate-700 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase italic">Sin stock</span>` : ''}
                    ${tieneVariantes ? `<span class="bg-blue-100 text-blue-700 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase italic"><i class="fa-solid fa-sliders mr-1"></i>${p.variantes.length} variantes</span>` : ''}
                </div>
                <h2 class="text-lg sm:text-2xl font-black uppercase italic mb-2 leading-tight text-gray-900">${p.nombre}</h2>
                ${sinStockBanner}
                ${precioDetalleHTML}
                ${variantesHTML}
                ${p.descripcion ? `<p class="text-gray-600 font-semibold mb-3 border-l-4 border-yellow-400 pl-3 text-xs sm:text-sm leading-relaxed">${p.descripcion}</p>` : ''}
                ${p.caracteristicas ? `
                <div class="bg-blue-50 p-3 rounded-2xl mb-2">
                    <h4 class="text-[9px] font-black uppercase text-[#0056b3] mb-1.5 tracking-wider">Características:</h4>
                    <pre class="font-sans text-xs font-bold text-gray-700 whitespace-pre-line leading-relaxed">${p.caracteristicas}</pre>
                </div>` : ''}
            </div>
            <div class="detalle-btn-wrap">
                ${btnDetalle}
            </div>
        </div>
    `;

    // Guardar imágenes en variable global para el lightbox
    lightboxImagenes = p.imagenes;
    lightboxIndex    = 0;

    document.getElementById("modal-detalles").classList.remove("hidden");
    document.body.classList.add("modal-active");
};

// ─── GALERÍA / LIGHTBOX ───────────────────────────────────────────────────────

let lightboxImagenes = [];
let lightboxIndex    = 0;

window.cambiarImagenDetalle = function(src, thumbBtn) {
    const mainImg = document.getElementById('main-img');
    if (mainImg) {
        mainImg.style.opacity = '0';
        setTimeout(() => { mainImg.src = src; mainImg.style.opacity = '1'; }, 150);
    }
    // Actualizar borde de miniaturas
    document.querySelectorAll('.thumb-btn').forEach(b => b.classList.replace('border-[#0056b3]', 'border-transparent') || b.classList.remove('border-[#0056b3]'));
    thumbBtn.classList.add('border-[#0056b3]');
    thumbBtn.classList.remove('border-transparent');
    // Sincronizar índice para el lightbox
    lightboxIndex = lightboxImagenes.indexOf(src);
};

window.abrirLightboxActual = function() {
    abrirLightbox(lightboxIndex);
};

window.abrirLightbox = function(idx) {
    if (!lightboxImagenes.length) return;
    lightboxIndex = idx ?? 0;
    const lb    = document.getElementById('lightbox');
    const img   = document.getElementById('lightbox-img');
    const count = document.getElementById('lightbox-counter');
    img.src = lightboxImagenes[lightboxIndex];
    count.textContent = lightboxImagenes.length > 1 ? `${lightboxIndex + 1} / ${lightboxImagenes.length}` : '';
    // Ocultar flechas si hay solo 1 imagen
    document.getElementById('lightbox-prev').style.display = lightboxImagenes.length > 1 ? '' : 'none';
    document.getElementById('lightbox-next').style.display = lightboxImagenes.length > 1 ? '' : 'none';
    lb.classList.add('open');
};

window.cerrarLightbox = function() {
    document.getElementById('lightbox').classList.remove('open');
};

window.lightboxNav = function(dir) {
    lightboxIndex = (lightboxIndex + dir + lightboxImagenes.length) % lightboxImagenes.length;
    const img   = document.getElementById('lightbox-img');
    const count = document.getElementById('lightbox-counter');
    img.style.opacity = '0';
    setTimeout(() => { img.src = lightboxImagenes[lightboxIndex]; img.style.opacity = '1'; }, 120);
    count.textContent = `${lightboxIndex + 1} / ${lightboxImagenes.length}`;
};

// Cerrar lightbox al hacer click en el fondo o con Escape
document.getElementById('lightbox')?.addEventListener('click', function(e) {
    if (e.target === this) cerrarLightbox();
});
document.addEventListener('keydown', function(e) {
    const lb = document.getElementById('lightbox');
    if (!lb?.classList.contains('open')) return;
    if (e.key === 'Escape')      cerrarLightbox();
    if (e.key === 'ArrowLeft')   lightboxNav(-1);
    if (e.key === 'ArrowRight')  lightboxNav(1);
});



// Estado de la variante seleccionada en el modal de detalle
let varianteSeleccionada = null; // { nombre, precio }

window.seleccionarVariante = function(btn, productId) {
    // Desmarcar todos
    document.querySelectorAll('#variantes-btns .variante-btn').forEach(b => {
        b.classList.remove('border-[#0056b3]', 'bg-blue-50', 'text-[#0056b3]');
        b.classList.add('border-slate-200', 'text-slate-600');
    });
    // Marcar el elegido
    btn.classList.add('border-[#0056b3]', 'bg-blue-50', 'text-[#0056b3]');
    btn.classList.remove('border-slate-200', 'text-slate-600');

    const precio = Number(btn.dataset.precio);
    const nombre = btn.dataset.nombre;
    varianteSeleccionada = { nombre, precio, productId };

    // Actualizar precio en pantalla
    const valEl = document.getElementById('precio-detalle-val');
    if (valEl) valEl.innerText = `$${precio.toLocaleString('es-AR')}`;

    // Ocultar aviso
    const aviso = document.getElementById('variante-aviso');
    if (aviso) aviso.classList.add('hidden');
};



// ─── CARRITO ──────────────────────────────────────────────────────────────────

window.agregarCarrito = function(id) {
    const prod = productos.find(p => p.id === id);
    if (!prod) return;
    if (prod.disponible === false) {
        showToast("Producto sin stock", "error");
        return;
    }

    const tieneVariantes = Array.isArray(prod.variantes) && prod.variantes.length > 0;

    // Si el producto tiene variantes y se llama desde la card (sin modal de detalle),
    // abrir el modal de detalle para que el usuario elija
    if (tieneVariantes) {
        const modalAbierto = !document.getElementById('modal-detalles').classList.contains('hidden');
        if (!modalAbierto) {
            verDetalles(id);
            return;
        }
        // Está el modal abierto → validar que eligió variante
        if (!varianteSeleccionada || varianteSeleccionada.productId !== id) {
            const aviso = document.getElementById('variante-aviso');
            if (aviso) aviso.classList.remove('hidden');
            showToast("Elegí una variante primero", "error");
            return;
        }
        // Validar que la variante elegida no esté agotada
        const varObj = prod.variantes.find(v => v.nombre === varianteSeleccionada.nombre);
        if (varObj && varObj.disponible === false) {
            showToast("Esa variante está agotada", "error");
            return;
        }
    }

    // Construir clave única: id + variante (si aplica)
    const varianteNombre = tieneVariantes ? varianteSeleccionada.nombre : null;
    const precioFinal    = tieneVariantes ? varianteSeleccionada.precio  : prod.precio;
    const carritoKey     = tieneVariantes ? `${id}__${varianteNombre}` : id;

    const existe = carrito.find(p => p.carritoKey === carritoKey);
    if (existe) {
        existe.cantidad++;
    } else {
        carrito.push({
            ...prod,
            carritoKey,
            precio:   precioFinal,
            variante: varianteNombre,
            cantidad: 1
        });
    }

    guardarCarrito();
    actualizarContador();

    const etiqueta = varianteNombre ? `${prod.nombre} (${varianteNombre})` : prod.nombre;
    const nombreCorto = etiqueta.length > 30 ? etiqueta.slice(0, 30) + '…' : etiqueta;
    showToast(`${nombreCorto} agregado`, "success");

    // Limpiar variante seleccionada
    varianteSeleccionada = null;
};

window.cambiarCantidad = function(key, delta) {
    const item = carrito.find(p => p.carritoKey === key);
    if (!item) return;

    // No permitir aumentar cantidad de productos sin stock
    if (delta > 0 && item.sinStock) {
        showToast("Este producto está sin stock", "error");
        return;
    }

    if (item.cantidad + delta <= 0) {
        showConfirm({
            titulo: "Eliminar producto",
            mensaje: `¿Queres quitar "${item.nombre}${item.variante ? ' ('+item.variante+')' : ''}" del carrito?`,
            labelOk: "Eliminar",
            onOk: () => {
                carrito = carrito.filter(p => p.carritoKey !== key);
                guardarCarrito(); actualizarContador(); abrirCarrito();
                showToast("Producto eliminado", "info");
            }
        });
        return;
    }
    item.cantidad += delta;
    guardarCarrito(); actualizarContador(); abrirCarrito();
};

window.quitarItem = function(key) {
    const item = carrito.find(p => p.carritoKey === key);
    if (!item) return;
    showConfirm({
        titulo: "Eliminar producto",
        mensaje: `¿Queres quitar "${item.nombre}${item.variante ? ' ('+item.variante+')' : ''}" del carrito?`,
        labelOk: "Eliminar",
        onOk: () => {
            carrito = carrito.filter(p => p.carritoKey !== key);
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
    localStorage.setItem("carrito-ramiro", JSON.stringify(carrito));
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
                    Algunos productos se quedaron sin stock. Eliminalos para continuar con la compra.
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
                            ${p.variante ? `<span class="inline-block text-[9px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md uppercase italic mb-0.5">${p.variante}</span>` : ''}
                            <p class="text-orange-500 font-black text-[10px] mt-0.5 flex items-center gap-1">
                                <i class="fa-solid fa-circle-exclamation text-[9px]"></i> Sin stock
                            </p>
                            <button onclick="cerrarModal('modal-carrito'); enviarConsultaWhatsApp('${p.id}')"
                                class="mt-1 text-[9px] text-green-600 hover:text-green-700 font-black uppercase flex items-center gap-0.5 transition-colors">
                                <i class="fa-brands fa-whatsapp text-[10px]"></i> Consultar
                            </button>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <button onclick="quitarItem('${p.carritoKey}')" class="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
                        ${p.variante ? `<span class="inline-block text-[9px] font-black bg-blue-100 text-[#0056b3] px-1.5 py-0.5 rounded-md uppercase italic mb-0.5">${p.variante}</span>` : ''}
                        <p class="text-[#0056b3] font-black text-xs sm:text-sm">$${(p.precio * p.cantidad).toLocaleString('es-AR')}</p>
                        <p class="text-gray-400 text-[10px] font-semibold">$${p.precio.toLocaleString('es-AR')} c/u</p>
                    </div>
                    <div class="flex items-center gap-1 flex-shrink-0">
                        <button onclick="cambiarCantidad('${p.carritoKey}', -1)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-red-100 hover:text-red-600 transition-colors">
                            <i class="fa-solid fa-minus text-[10px]"></i>
                        </button>
                        <span class="w-5 text-center font-black text-xs">${p.cantidad}</span>
                        <button onclick="cambiarCantidad('${p.carritoKey}', 1)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 hover:bg-[#0056b3] hover:text-white transition-colors">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                        </button>
                        <button onclick="quitarItem('${p.carritoKey}')" class="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-0.5">
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
    const msj = `Hola Ramiro! Te escribo desde la web. Quiero los siguientes productos: *${prod.nombre}*. Muchas gracias!`;
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
        const etiqueta = p.variante ? `${p.nombre} (${p.variante})` : p.nombre;
        msj += `*- ${etiqueta}* (x${p.cantidad}) - $${(p.precio * p.cantidad).toLocaleString('es-AR')}%0A`;
        total += p.precio * p.cantidad;
    });
    msj += `%0A*TOTAL: $${total.toLocaleString('es-AR')}*%0A%0AEstan disponibles? Muchas gracias!`;
    window.open(`https://wa.me/5493735538773?text=${msj}`);
};

cargarProductos();

