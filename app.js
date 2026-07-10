const supabaseUrl = 'https://eqvlivvaqnadasfchnzp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdmxpdnZhcW5hZGFzZmNobnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDA4NDAsImV4cCI6MjA5ODk3Njg0MH0.szN2eZVtOi8-MV[...]
const banco = supabase.createClient(supabaseUrl, supabaseKey);

// Funções de validação de regra de negócio OTIF
function isOrderOT(order) {
    if (!order.data_entrega || !order.data_entrega_original) return false;
    const dtEntrega = new Date(order.data_entrega).toISOString().split('T')[0];
    const dtOriginal = new Date(order.data_entrega_original).toISOString().split('T')[0];
    return dtEntrega <= dtOriginal;
}

function isOrderIF(order) {
    const sItem = (order.situacao_item || '').trim().toLowerCase();
    const sAtend = (order.situacao_atend_item || '').trim().toLowerCase();
    const sNf = (order.situacao_nf || '').trim().toLowerCase();
    return sItem === 'entregue' && sAtend === 'atendido' && sNf === 'nota emitida';
}

// Controle de Estado do Dashboard - CENTRALIZADO
let state = {
    orders: [],
    filters: {
        month: "",
        startDate: "",
        endDate: "",
        cliente: "",
        ped_id: "",
        numero_pedido: "",
        tipo_pedido: "",
        desc_tipo_movimento: "",
        volume_hectolitro: "",
        situacao_item: "",
        situacao_atend_item: "",
        situacao_nf: ""
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0
    },
    sorting: {
        column: "ped_id",
        direction: "asc"
    },
    theme: "dark",
    editingOrderId: null,
    activeTab: "pdv"
};

// Referências dos Gráficos do Chart.js
let charts = {
    trendPdv: null,
    pdvOtif: null,
    pdvCauses: null,
    trendHl: null,
    hlCategories: null,
    skuShare: null,
    skuOtif: null
};

// Elementos da DOM
const DOM = {
    themeToggle: document.getElementById("theme-toggle"),
    filterMonth: document.getElementById("filter-month"),
    filterStartDate: document.getElementById("filter-start-date"),
    filterEndDate: document.getElementById("filter-end-date"),
    filterCliente: document.getElementById("filter-cliente"),
    btnClearFilters: document.getElementById("btn-clear-filters"),
    btnClearFiltersTable: document.getElementById("btn-clear-filters-table"),
    
    // KPI Cards
    kpiOtif: document.getElementById("kpi-otif-value"),
    kpiOt: document.getElementById("kpi-ot-value"),
    kpiIf: document.getElementById("kpi-if-value"),
    kpiTotal: document.getElementById("kpi-total-value"),
    
    circleOtif: document.querySelector("#kpi-card-otif .progress"),
    circleOt: document.querySelector("#kpi-card-ot .progress"),
    circleIf: document.querySelector("#kpi-card-if .progress"),
    circleTotal: document.querySelector("#kpi-card-total .progress"),
    
    // Tabela
    tableBody: document.getElementById("table-body"),
    tableInfo: document.getElementById("table-info"),
    btnPrevPage: document.getElementById("btn-prev-page"),
    btnNextPage: document.getElementById("btn-next-page"),
    currentPageIndicator: document.getElementById("current-page-indicator"),
    
    // Rankings
    rankingPdvBody: document.getElementById("ranking-pdv-body"),
    rankingHlClientBody: document.getElementById("ranking-hl-client-body"),
    rankingSkuBody: document.getElementById("ranking-sku-body")
};

// Inicialização
document.addEventListener("DOMContentLoaded", async () => {
    loadTheme();
    setupEventListeners();
    await loadInitialData();
});

// Carregar Tema
function loadTheme() {
    const savedTheme = localStorage.getItem("otif-theme") || "dark";
    state.theme = savedTheme;
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    if (state.theme === "light") {
        DOM.themeToggle.innerHTML = '<i data-lucide="moon"></i>';
    } else {
        DOM.themeToggle.innerHTML = '<i data-lucide="sun"></i>';
    }
    lucide.createIcons();
}

function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("otif-theme", state.theme);
    updateThemeIcon();
    renderCharts(getFilteredData());
}

// Carregar dados iniciais do Supabase
async function loadInitialData() {
    try {
        const { data, error } = await banco.from('Pedidos').select('*');
        if (error) throw error;
        state.orders = data || [];
        console.log(`✅ Carregados ${state.orders.length} pedidos do banco`);
    } catch (error) {
        console.warn('⚠️ Erro ao carregar dados:', error.message);
        state.orders = [];
    }
    
    populateFilterDropdowns();
    updateDashboard();
}

// Preencher dropdowns de filtro
function populateFilterDropdowns() {
    const clientes = [...new Set(state.orders.map(o => o.cod_cliente).filter(Boolean))].sort();
    fillDropdown(DOM.filterCliente, clientes, "Todos os Clientes");
    
    const monthKeys = [...new Set(state.orders
        .filter(o => o.data_entrega_original)
        .map(o => o.data_entrega_original.slice(0, 7))
    )].sort().reverse();
    
    const MONTH_NAMES_PT = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    
    let html = `<option value="">Todos os Meses</option>`;
    monthKeys.forEach(key => {
        const [year, month] = key.split("-");
        const label = `${MONTH_NAMES_PT[parseInt(month, 10) - 1]}/${year}`;
        html += `<option value="${key}">${label}</option>`;
    });
    DOM.filterMonth.innerHTML = html;
}

function fillDropdown(element, list, defaultText) {
    let html = `<option value="">${defaultText}</option>`;
    list.forEach(item => {
        html += `<option value="${item}">${item}</option>`;
    });
    element.innerHTML = html;
}

// Registro de Event Listeners
function setupEventListeners() {
    DOM.themeToggle.addEventListener("click", toggleTheme);
    
    // Abas
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            switchTab(tab);
        });
    });
    
    // Filtros principais
    DOM.filterMonth.addEventListener("change", () => {
        state.filters.month = DOM.filterMonth.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterStartDate.addEventListener("change", () => {
        state.filters.startDate = DOM.filterStartDate.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterEndDate.addEventListener("change", () => {
        state.filters.endDate = DOM.filterEndDate.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterCliente.addEventListener("change", () => {
        state.filters.cliente = DOM.filterCliente.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    if (DOM.btnClearFilters) {
        DOM.btnClearFilters.addEventListener("click", clearFilters);
    }
    
    if (DOM.btnClearFiltersTable) {
        DOM.btnClearFiltersTable.addEventListener("click", clearFilters);
    }
    
    // Paginação
    DOM.btnPrevPage.addEventListener("click", () => {
        if (state.pagination.currentPage > 1) {
            state.pagination.currentPage--;
            updateDashboard();
        }
    });
    
    DOM.btnNextPage.addEventListener("click", () => {
        const filtered = getFilteredData();
        const maxPage = Math.ceil(filtered.length / state.pagination.itemsPerPage);
        if (state.pagination.currentPage < maxPage) {
            state.pagination.currentPage++;
            updateDashboard();
        }
    });
    
    // Filtros de coluna da tabela (com debounce)
    let filterTimeout;
    document.querySelectorAll('.filters-row input').forEach(input => {
        input.addEventListener('input', (e) => {
            clearTimeout(filterTimeout);
            filterTimeout = setTimeout(() => {
                const coluna = e.target.getAttribute('data-filter');
                state.filters[coluna] = e.target.value.trim();
                state.pagination.currentPage = 1;
                updateDashboard();
            }, 300);
        });
    });
    
    // Ordenação
    document.querySelectorAll(".orders-table th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const column = th.getAttribute("data-sort");
            if (state.sorting.column === column) {
                state.sorting.direction = state.sorting.direction === "asc" ? "desc" : "asc";
            } else {
                state.sorting.column = column;
                state.sorting.direction = "asc";
            }
            
            document.querySelectorAll(".orders-table th[data-sort]").forEach(h => {
                h.classList.remove("sorted-asc", "sorted-desc");
            });
            th.classList.add(state.sorting.direction === "asc" ? "sorted-asc" : "sorted-desc");
            
            updateDashboard();
        });
    });
}

// Alternância de Abas
function switchTab(tab) {
    state.activeTab = tab;
    
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tab);
    });
    
    document.querySelectorAll(".tab-panel-content").forEach(panel => {
        panel.classList.toggle("active", panel.getAttribute("id") === `tab-panel-${tab}`);
    });
    
    updateDashboard();
}

// Limpar Filtros
function clearFilters() {
    state.filters = {
        month: "",
        startDate: "",
        endDate: "",
        cliente: "",
        ped_id: "",
        numero_pedido: "",
        tipo_pedido: "",
        desc_tipo_movimento: "",
        volume_hectolitro: "",
        situacao_item: "",
        situacao_atend_item: "",
        situacao_nf: ""
    };
    state.pagination.currentPage = 1;
    
    DOM.filterMonth.value = "";
    DOM.filterStartDate.value = "";
    DOM.filterEndDate.value = "";
    DOM.filterCliente.value = "";
    document.querySelectorAll('.filters-row input').forEach(input => input.value = '');
    document.querySelectorAll(".orders-table th[data-sort]").forEach(h => h.classList.remove("sorted-asc", "sorted-desc"));
    
    updateDashboard();
}

// Filtrar dados aplicando todos os critérios
function getFilteredData() {
    return state.orders.filter(order => {
        const matchesMonth = !state.filters.month || (order.data_entrega_original && order.data_entrega_original.slice(0, 7) === state.filters.month);
        const matchesStartDate = !state.filters.startDate || order.data_entrega_original >= state.filters.startDate;
        const matchesEndDate = !state.filters.endDate || order.data_entrega_original <= state.filters.endDate;
        const matchesCliente = !state.filters.cliente || order.cod_cliente === state.filters.cliente;
        
        // Filtros de coluna da tabela
        const matchesPedId = !state.filters.ped_id || String(order.ped_id || '').toLowerCase().includes(state.filters.ped_id.toLowerCase());
        const matchesNumeroPedido = !state.filters.numero_pedido || String(order.numero_pedido || '').toLowerCase().includes(state.filters.numero_pedido.toLowerCase());
        const matchesTipoPedido = !state.filters.tipo_pedido || (order.tipo_pedido || '').toLowerCase().includes(state.filters.tipo_pedido.toLowerCase());
        const matchesDescMovimento = !state.filters.desc_tipo_movimento || (order.desc_tipo_movimento || '').toLowerCase().includes(state.filters.desc_tipo_movimento.toLowerCase());
        const matchesVolume = !state.filters.volume_hectolitro || String(order.volume_hectolitro || '').includes(state.filters.volume_hectolitro);
        const matchesSituacaoItem = !state.filters.situacao_item || (order.situacao_item || '').toLowerCase().includes(state.filters.situacao_item.toLowerCase());
        const matchesSituacaoAtend = !state.filters.situacao_atend_item || (order.situacao_atend_item || '').toLowerCase().includes(state.filters.situacao_atend_item.toLowerCase());
        const matchesSituacaoNf = !state.filters.situacao_nf || (order.situacao_nf || '').toLowerCase().includes(state.filters.situacao_nf.toLowerCase());
        
        return matchesMonth && matchesStartDate && matchesEndDate && matchesCliente &&
               matchesPedId && matchesNumeroPedido && matchesTipoPedido && matchesDescMovimento &&
               matchesVolume && matchesSituacaoItem && matchesSituacaoAtend && matchesSituacaoNf;
    });
}

// Ordenar dados
function sortData(data) {
    const col = state.sorting.column;
    const dir = state.sorting.direction === "asc" ? 1 : -1;
    
    return [...data].sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        if (col.includes("data")) {
            valA = new Date(valA || "1970-01-01").getTime();
            valB = new Date(valB || "1970-01-01").getTime();
        } else if (col === "volume_hectolitro" || col === "ped_id") {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        } else {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
        }
        
        if (valA < valB) return -1 * dir;
        if (valA > valB) return 1 * dir;
        return 0;
    });
}

// Destruir gráficos antigos
function destroyAllCharts() {
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    });
}

// ⭐ FUNÇÃO CENTRAL DO DASHBOARD - Tudo passa por aqui!
function updateDashboard() {
    const filtered = getFilteredData();
    state.pagination.totalItems = filtered.length;
    
    calculateMetrics(filtered);
    renderTable(filtered);
    renderRankingTables(filtered);
    renderCharts(filtered);
    
    lucide.createIcons();
}

// Calcular métricas KPI
function calculateMetrics(data) {
    let processedData = data;
    if (state.activeTab === "pdv") {
        const visitas = {};
        data.forEach(order => {
            const num = order.numero_pedido;
            if (!num) return;
            if (!visitas[num]) {
                visitas[num] = { isOt: false, isIf: false, fake: true };
            }
            if (isOrderOT(order) && isOrderIF(order)) {
                visitas[num].isOt = true;
                visitas[num].isIf = true;
            } else if (isOrderOT(order)) {
                visitas[num].isOt = true;
            } else if (isOrderIF(order)) {
                visitas[num].isIf = true;
            }
        });
        processedData = Object.values(visitas);
    }
    const total = processedData.length;
    
    const kpiCard1 = document.querySelector(".kpi-otif");
    const kpiCard2 = document.querySelector(".kpi-ot");
    const kpiCard3 = document.querySelector(".kpi-if");
    const kpiCard4 = document.querySelector(".kpi-total");
    
    if (total === 0) {
        DOM.kpiOtif.textContent = "0.0%";
        DOM.kpiOt.textContent = "0.0%";
        DOM.kpiIf.textContent = "0.0%";
        DOM.kpiTotal.textContent = "0";
        
        setRadialProgress(DOM.circleOtif, 0);
        setRadialProgress(DOM.circleOt, 0);
        setRadialProgress(DOM.circleIf, 0);
        return;
    }
    
    let otCount = 0, ifCount = 0, otifCount = 0;
    let totalVolumePedido = 0, totalVolumeEntregue = 0, otifVolume = 0, otVolume = 0;
    
    processedData.forEach(order => {
        let isOt = false, isIf = false;
        
        if (order.fake) {
            isOt = order.isOt;
            isIf = order.isIf;
        } else {
            isOt = isOrderOT(order);
            isIf = isOrderIF(order);
        }
        
        if (isOt) otCount++;
        if (isIf) ifCount++;
        if (isOt && isIf) otifCount++;
    });
    
    data.forEach(order => {
        const vol = parseFloat(order.volume_hectolitro) || 0;
        totalVolumePedido += vol;
        
        const volEntregue = isOrderIF(order) ? vol : 0;
        totalVolumeEntregue += volEntregue;
        
        if (isOrderOT(order)) otVolume += vol;
        if (isOrderOT(order) && isOrderIF(order)) otifVolume += volEntregue;
    });
    
    const pctOtif = (otifCount / total) * 100;
    const pctOt = (otCount / total) * 100;
    const pctIf = (ifCount / total) * 100;
    
    const pctOtifVol = totalVolumePedido > 0 ? (otifVolume / totalVolumePedido) * 100 : 0;
    const pctOtVol = totalVolumePedido > 0 ? (otVolume / totalVolumePedido) * 100 : 0;
    const pctIfVol = totalVolumePedido > 0 ? (totalVolumeEntregue / totalVolumePedido) * 100 : 0;
    const totalVolumeCorte = totalVolumePedido - totalVolumeEntregue;
    
    if (state.activeTab === "hl") {
        kpiCard1.querySelector("h3").textContent = "OTIF Volumétrico";
        DOM.kpiOtif.textContent = `${pctOtifVol.toFixed(1)}%`;
        setRadialProgress(DOM.circleOtif, pctOtifVol);
        
        kpiCard2.querySelector("h3").textContent = "Volume Pedido";
        DOM.kpiOt.textContent = `${totalVolumePedido.toFixed(0)} HL`;
        setRadialProgress(DOM.circleOt, 100);
        
        kpiCard3.querySelector("h3").textContent = "Volume Entregue";
        DOM.kpiIf.textContent = `${totalVolumeEntregue.toFixed(0)} HL`;
        setRadialProgress(DOM.circleIf, pctIfVol);
        
        kpiCard4.querySelector("h3").textContent = "Corte Volumétrico";
        DOM.kpiTotal.textContent = `${totalVolumeCorte.toFixed(1)} HL`;
    } else {
        kpiCard1.querySelector("h3").textContent = "OTIF Global";
        DOM.kpiOtif.textContent = `${pctOtif.toFixed(1)}%`;
        setRadialProgress(DOM.circleOtif, pctOtif);
        
        kpiCard2.querySelector("h3").textContent = "On-Time (No Prazo)";
        DOM.kpiOt.textContent = `${pctOt.toFixed(1)}%`;
        setRadialProgress(DOM.circleOt, pctOt);
        
        kpiCard3.querySelector("h3").textContent = "In-Full (Completo)";
        DOM.kpiIf.textContent = `${pctIf.toFixed(1)}%`;
        setRadialProgress(DOM.circleIf, pctIf);
        
        kpiCard4.querySelector("h3").textContent = "Volume de Pedidos";
        DOM.kpiTotal.textContent = total;
    }
}

function setRadialProgress(circleElement, percentage) {
    if (!circleElement) return;
    const radius = circleElement.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    circleElement.style.strokeDasharray = `${circumference}`;
    const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;
    circleElement.style.strokeDashoffset = offset;
}

// Renderizar tabela de pedidos
function renderTable(data) {
    const sorted = sortData(data);
    const pag = state.pagination;
    const totalItems = sorted.length;
    const maxPage = Math.ceil(totalItems / pag.itemsPerPage) || 1;
    
    if (pag.currentPage > maxPage) {
        pag.currentPage = maxPage;
    }
    
    const startIndex = (pag.currentPage - 1) * pag.itemsPerPage;
    const endIndex = Math.min(startIndex + pag.itemsPerPage, totalItems);
    const paginatedItems = sorted.slice(startIndex, endIndex);
    
    DOM.btnPrevPage.disabled = pag.currentPage === 1;
    DOM.btnNextPage.disabled = pag.currentPage === maxPage || totalItems === 0;
    DOM.currentPageIndicator.textContent = `${pag.currentPage} de ${maxPage}`;
    DOM.tableInfo.textContent = totalItems > 0 
        ? `Exibindo ${startIndex + 1}-${endIndex} de ${totalItems} pedidos` 
        : "Nenhum pedido encontrado";
    
    let html = "";
    if (paginatedItems.length === 0) {
        html = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 40px;">Nenhum pedido atende aos filtros aplicados.</td></tr>`;
    } else {
        paginatedItems.forEach(order => {
            const isOt = isOrderOT(order);
            const isIf = isOrderIF(order);
            const isOtif = isOt && isIf;
            
            let statusHtml = "";
            if (isOtif) {
                statusHtml = `<span class="badge badge-success"><i data-lucide="check-circle" style="width:12px;height:12px;"></i> OTIF</span>`;
            } else {
                let badgeClass = "badge-danger";
                let text = "FALHA";
                if (isOt && !isIf) {
                    badgeClass = "badge-warning";
                    text = "Apenas OT";
                } else if (!isOt && isIf) {
                    badgeClass = "badge-warning";
                    text = "Apenas IF";
                }
                statusHtml = `<span class="badge ${badgeClass}">${text}</span>`;
            }
            
            const formattedDateOriginal = order.data_entrega_original ? formatarData(order.data_entrega_original) : '-';
            const formattedDateEntrega = order.data_entrega ? formatarData(order.data_entrega) : '-';
            
            html += `
                <tr>
                    <td><strong>${order.ped_id || '-'}</strong></td>
                    <td>${order.numero_pedido || '-'}</td>
                    <td>${order.cod_cliente || '-'}</td>
                    <td>${formattedDateOriginal}</td>
                    <td style="color: ${isOt ? 'inherit' : 'var(--danger)'}">${formattedDateEntrega}</td>
                    <td>${order.tipo_pedido || '-'}</td>
                    <td>${order.desc_tipo_movimento || '-'}</td>
                    <td>${parseFloat(order.volume_hectolitro || 0).toFixed(2)} HL</td>
                    <td>${order.situacao_item || '-'}</td>
                    <td>${order.situacao_atend_item || '-'}</td>
                    <td>${order.situacao_nf || '-'}</td>
                </tr>
            `;
        });
    }
    
    DOM.tableBody.innerHTML = html;
}

// Renderizar tabelas de ranking
function renderRankingTables(data) {
    if (data.length === 0) return;
    
    if (state.activeTab === "pdv") {
        const pdvAgg = {};
        const visitasMap = {};
        data.forEach(order => {
            const cli = order.cod_cliente || 'Desconhecido';
            const num = order.numero_pedido;
            if (!num) return;
            if (!visitasMap[num]) {
                visitasMap[num] = { cliente: cli, isOt: false, isIf: false };
            }
            if (isOrderOT(order) && isOrderIF(order)) {
                visitasMap[num].isOt = true;
                visitasMap[num].isIf = true;
            } else if (isOrderOT(order)) {
                visitasMap[num].isOt = true;
            } else if (isOrderIF(order)) {
                visitasMap[num].isIf = true;
            }
        });
        
        Object.values(visitasMap).forEach(v => {
            const name = v.cliente;
            if (!pdvAgg[name]) {
                pdvAgg[name] = { total: 0, ot: 0, corte: 0, otif: 0 };
            }
            pdvAgg[name].total++;
            if (v.isOt) pdvAgg[name].ot++;
            if (!v.isIf) pdvAgg[name].corte++;
            if (v.isOt && v.isIf) pdvAgg[name].otif++;
        });
        
        const sortedPdvs = Object.keys(pdvAgg).map(name => ({
            name,
            total: pdvAgg[name].total,
            ot: pdvAgg[name].ot,
            corte: pdvAgg[name].corte,
            otif: pdvAgg[name].otif,
            pct: (pdvAgg[name].otif / pdvAgg[name].total) * 100
        })).sort((a, b) => b.pct - a.pct || b.total - a.total);
        
        let html = "";
        sortedPdvs.forEach((p, idx) => {
            const isSuccess = p.pct >= 85;
            html += `
                <tr>
                    <td><span class="ranking-rank">${idx + 1}</span><strong>${p.name}</strong></td>
                    <td>${p.total}</td>
                    <td>${p.total - p.ot}</td>
                    <td>${p.corte}</td>
                    <td><span class="ranking-value ${isSuccess ? 'success' : 'danger'}">${p.pct.toFixed(1)}%</span></td>
                </tr>
            `;
        });
        DOM.rankingPdvBody.innerHTML = html;
    }
    
    if (state.activeTab === "hl") {
        const clientAgg = {};
        data.forEach(order => {
            const cli = order.cod_cliente || 'Desconhecido';
            const vol = parseFloat(order.volume_hectolitro) || 0;
            const volEntregue = isOrderIF(order) ? vol : 0;
            const otifVol = (isOrderOT(order) && isOrderIF(order)) ? volEntregue : 0;
            
            if (!clientAgg[cli]) {
                clientAgg[cli] = { totalVol: 0, entregueVol: 0, otifVol: 0 };
            }
            clientAgg[cli].totalVol += vol;
            clientAgg[cli].entregueVol += volEntregue;
            clientAgg[cli].otifVol += otifVol;
        });
        
        const sortedClients = Object.keys(clientAgg).map(name => {
            const d = clientAgg[name];
            return {
                name,
                totalVol: d.totalVol,
                entregueVol: d.entregueVol,
                otifVolPct: d.totalVol > 0 ? (d.otifVol / d.totalVol) * 100 : 0
            };
        }).sort((a, b) => b.totalVol - a.totalVol);
        
        let htmlClient = "";
        sortedClients.forEach((cl, idx) => {
            const isSuccess = cl.otifVolPct >= 85;
            htmlClient += `
                <tr>
                    <td><span class="ranking-rank">${idx + 1}</span><strong>${cl.name}</strong></td>
                    <td>${cl.totalVol.toFixed(1)} HL</td>
                    <td>${cl.entregueVol.toFixed(1)} HL</td>
                    <td><span class="ranking-value ${isSuccess ? 'success' : 'danger'}">${cl.otifVolPct.toFixed(1)}%</span></td>
                </tr>
            `;
        });
        if (DOM.rankingHlClientBody) DOM.rankingHlClientBody.innerHTML = htmlClient;
    }
    
    if (state.activeTab === "sku") {
        const skuAgg = {};
        data.forEach(order => {
            const cat = order.desc_tipo_movimento || 'Desconhecido';
            if (!skuAgg[cat]) {
                skuAgg[cat] = { total: 0, otif: 0, ifCount: 0, corte: 0 };
            }
            skuAgg[cat].total++;
            
            if (isOrderIF(order)) skuAgg[cat].ifCount++;
            else skuAgg[cat].corte++;
            
            if (isOrderOT(order) && isOrderIF(order)) skuAgg[cat].otif++;
        });
        
        const sortedSkus = Object.keys(skuAgg).map(name => {
            const d = skuAgg[name];
            const cutRate = (d.corte / d.total) * 100;
            return {
                name,
                total: d.total,
                cutRate,
                ifPct: (d.ifCount / d.total) * 100,
                otifPct: (d.otif / d.total) * 100
            };
        }).sort((a, b) => b.otifPct - a.otifPct);
        
        let htmlSku = "";
        sortedSkus.forEach((s, idx) => {
            const isSuccess = s.otifPct >= 85;
            htmlSku += `
                <tr>
                    <td><span class="ranking-rank">${idx + 1}</span><strong>${s.name}</strong></td>
                    <td>${s.total}</td>
                    <td style="color: ${s.cutRate > 0 ? 'var(--danger)' : 'inherit'}">${s.cutRate.toFixed(1)}%</td>
                    <td>${s.ifPct.toFixed(1)}%</td>
                    <td><span class="ranking-value ${isSuccess ? 'success' : 'danger'}">${s.otifPct.toFixed(1)}%</span></td>
                </tr>
            `;
        });
        if (DOM.rankingSkuBody) DOM.rankingSkuBody.innerHTML = htmlSku;
    }
}

// ⭐ Renderizar gráficos - Aqui é onde os gráficos ganham vida!
function renderCharts(data) {
    const isDark = state.theme === "dark";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const labelColor = isDark ? "#f8fafc" : "#0f172a";
    
    destroyAllCharts();
    
    if (data.length === 0) return;
    
    // Agrupar dados por semana
    const weeklyData = {};
    data.forEach(order => {
        const dateObj = new Date(order.data_entrega_original || order.data_entrega || new Date());
        const weekNum = getWeekNumber(dateObj);
        const label = `Semana ${weekNum}`;
        
        if (!weeklyData[label]) {
            weeklyData[label] = { total: 0, otif: 0, ot: 0, if: 0, volumePedido: 0, volumeEntregue: 0, otifVolume: 0 };
        }
        
        const isOt = isOrderOT(order);
        const isIf = isOrderIF(order);
        
        weeklyData[label].total++;
        if (isOt) weeklyData[label].ot++;
        if (isIf) weeklyData[label].if++;
        if (isOt && isIf) weeklyData[label].otif++;
        
        const vol = parseFloat(order.volume_hectolitro) || 0;
        weeklyData[label].volumePedido += vol;
        const volEntregue = isIf ? vol : 0;
        weeklyData[label].volumeEntregue += volEntregue;
        if (isOt && isIf) {
            weeklyData[label].otifVolume += volEntregue;
        }
    });
    
    const weekLabels = Object.keys(weeklyData).sort();
    
    // ABA PDV
    if (state.activeTab === "pdv") {
        const trendOtif = [];
        const trendOt = [];
        const trendIf = [];
        
        weekLabels.forEach(w => {
            const d = weeklyData[w];
            trendOtif.push(((d.otif / d.total) * 100).toFixed(1));
            trendOt.push(((d.ot / d.total) * 100).toFixed(1));
            trendIf.push(((d.if / d.total) * 100).toFixed(1));
        });
        
        const ctxTrend = document.getElementById("chart-trend-pdv").getContext("2d");
        charts.trendPdv = new Chart(ctxTrend, {
            type: "line",
            data: {
                labels: weekLabels,
                datasets: [
                    {
                        label: "OTIF %",
                        data: trendOtif,
                        borderColor: "#6366f1",
                        backgroundColor: "rgba(99, 102, 241, 0.1)",
                        borderWidth: 3,
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: "OT (Prazo) %",
                        data: trendOt,
                        borderColor: "#10b981",
                        backgroundColor: "transparent",
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3
                    },
                    {
                        label: "IF (Carga Completa) %",
                        data: trendIf,
                        borderColor: "#8b5cf6",
                        backgroundColor: "transparent",
                        borderWidth: 2,
                        borderDash: [2, 2],
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor, font: { family: "Outfit" } } }
                },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" } } },
                    y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" }, callback: v => v + "%" } }
                }
            }
        });
        
        const clientOtif = {};
        data.forEach(order => {
            const c = order.cod_cliente || 'Desconhecido';
            if (!clientOtif[c]) clientOtif[c] = { total: 0, otif: 0 };
            clientOtif[c].total++;
            if (isOrderOT(order) && isOrderIF(order)) {
                clientOtif[c].otif++;
            }
        });
        const clientNames = Object.keys(clientOtif);
        const clientValues = clientNames.map(n => ((clientOtif[n].otif / clientOtif[n].total) * 100).toFixed(1));
        
        const ctxClientOtif = document.getElementById("chart-pdv-otif").getContext("2d");
        charts.pdvOtif = new Chart(ctxClientOtif, {
            type: "bar",
            data: {
                labels: clientNames,
                datasets: [{
                    label: "OTIF % por Cliente",
                    data: clientValues,
                    backgroundColor: "rgba(99, 102, 241, 0.8)",
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" } } },
                    y: { ticks: { color: labelColor, font: { family: "Outfit" } } }
                }
            }
        });
        
        const clientFailures = {};
        data.forEach(order => {
            const isOt = isOrderOT(order);
            const isIf = isOrderIF(order);
            if ((!isOt || !isIf) && order.motivo_falha && order.motivo_falha !== "Nenhum") {
                clientFailures[order.motivo_falha] = (clientFailures[order.motivo_falha] || 0) + 1;
            }
        });
        const failLabels = Object.keys(clientFailures);
        const failCounts = Object.values(clientFailures);
        
        const ctxPdvCauses = document.getElementById("chart-pdv-causes").getContext("2d");
        charts.pdvCauses = new Chart(ctxPdvCauses, {
            type: "doughnut",
            data: {
                labels: failLabels.length > 0 ? failLabels : ["100% Sucesso"],
                datasets: [{
                    data: failCounts.length > 0 ? failCounts : [1],
                    backgroundColor: failLabels.length > 0 ? ["#f43f5e", "#f59e0b", "#8b5cf6", "#3b82f6"] : ["#10b981"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom", labels: { color: textColor, font: { family: "Outfit" } } } }
            }
        });
    }
    
    // ABA HL
    if (state.activeTab === "hl") {
        const trendHlPed = [];
        const trendHlEnt = [];
        
        weekLabels.forEach(w => {
            const d = weeklyData[w];
            trendHlPed.push(d.volumePedido.toFixed(1));
            trendHlEnt.push(d.volumeEntregue.toFixed(1));
        });
        
        const ctxHlTrend = document.getElementById("chart-trend-hl").getContext("2d");
        charts.trendHl = new Chart(ctxHlTrend, {
            type: "bar",
            data: {
                labels: weekLabels,
                datasets: [
                    {
                        label: "HL Pedido",
                        data: trendHlPed,
                        backgroundColor: "rgba(99, 102, 241, 0.4)",
                        borderColor: "#6366f1",
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: "HL Entregue",
                        data: trendHlEnt,
                        backgroundColor: "rgba(16, 185, 129, 0.8)",
                        borderColor: "#10b981",
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor, font: { family: "Outfit" } } }
                },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" } } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" }, callback: v => v + " HL" } }
                }
            }
        });
        
        const catHl = {};
        data.forEach(order => {
            const cat = order.desc_tipo_movimento || 'Desconhecido';
            const vol = parseFloat(order.volume_hectolitro) || 0;
            const volEntregue = isOrderIF(order) ? vol : 0;
            catHl[cat] = (catHl[cat] || 0) + volEntregue;
        });
        const catNames = Object.keys(catHl);
        const catValues = catNames.map(n => catHl[n].toFixed(1));
        
        const ctxHlCat = document.getElementById("chart-hl-categories").getContext("2d");
        charts.hlCategories = new Chart(ctxHlCat, {
            type: "doughnut",
            data: {
                labels: catNames,
                datasets: [{
                    data: catValues,
                    backgroundColor: ["#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#3b82f6"],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "right", labels: { color: textColor, font: { family: "Outfit" } } }
                }
            }
        });
    }
    
    // ABA SKU
    if (state.activeTab === "sku") {
        const catAgg = {};
        data.forEach(order => {
            const cat = order.desc_tipo_movimento || 'Desconhecido';
            if (!catAgg[cat]) {
                catAgg[cat] = { total: 0, otif: 0, ifCount: 0 };
            }
            catAgg[cat].total++;
            const isOt = isOrderOT(order);
            const isIf = isOrderIF(order);
            if (isOt && isIf) catAgg[cat].otif++;
            if (isIf) catAgg[cat].ifCount++;
        });
        
        const categories = Object.keys(catAgg);
        
        const ifRatios = categories.map(cat => {
            const d = catAgg[cat];
            return ((d.ifCount / d.total) * 100).toFixed(1);
        });
        
        const ctxSkuShare = document.getElementById("chart-sku-share").getContext("2d");
        charts.skuShare = new Chart(ctxSkuShare, {
            type: "bar",
            data: {
                labels: categories,
                datasets: [{
                    label: "Grau de Atendimento (Volume Entregue %)",
                    data: ifRatios,
                    backgroundColor: "rgba(139, 92, 246, 0.75)",
                    borderColor: "#8b5cf6",
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, font: { family: "Outfit" } } },
                    y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" }, callback: v => v + "%" } }
                }
            }
        });
        
        const catOtifValues = categories.map(cat => ((catAgg[cat].otif / catAgg[cat].total) * 100).toFixed(1));
        
        const ctxSkuOtif = document.getElementById("chart-sku-otif").getContext("2d");
        charts.skuOtif = new Chart(ctxSkuOtif, {
            type: "bar",
            data: {
                labels: categories,
                datasets: [{
                    label: "OTIF %",
                    data: catOtifValues,
                    backgroundColor: "rgba(99, 102, 241, 0.8)",
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { min: 0, max: 100, grid: { color: gridColor }, ticks: { color: textColor, font: { family: "Outfit" } } },
                    y: { ticks: { color: labelColor, font: { family: "Outfit" } } }
                }
            }
        });
    }
}

// Helpers
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function formatarData(dataString) {
    if (!dataString) return '-';
    try {
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return dataString;
        return data.toLocaleDateString('pt-BR');
    } catch (e) {
        return dataString;
    }
}

// === IMPORTAÇÃO DE EXCEL ===

let dadosProntosParaEnviar = [];

function limparNomeColuna(nome) {
    if (!nome) return 'coluna_sem_nome';
    let novoNome = nome.toString().trim().toLowerCase();
    novoNome = novoNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    novoNome = novoNome.replace(/\s+/g, '_');
    novoNome = novoNome.replace(/[^a-z0-9_]/g, '');
    return novoNome;
}

document.getElementById('btn-importar').addEventListener('click', function() {
    document.getElementById('excel-file-input').click();
});

document.getElementById('excel-file-input').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    const statusDiv = document.getElementById('import-status');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    
    const btnVisual = document.getElementById('btn-importar');
    const inputArquivo = this;
    
    if (!file) return;

    btnVisual.disabled = true;
    inputArquivo.disabled = true;

    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.style.backgroundColor = "#24b47e"; 
    progressPercentage.innerText = "0%";
    statusDiv.innerText = "Conectando ao banco...";

    try {
        const { data: testeEstrutura, error: erroEstrutura } = await banco
            .from('Pedidos')
            .select('*')
            .limit(1);

        if (erroEstrutura) throw new Error(`Erro de estrutura: ${erroEstrutura.message}`);

        let colunasPermitidas = [];
        if (testeEstrutura && testeEstrutura.length > 0) {
            colunasPermitidas = Object.keys(testeEstrutura[0]);
        } else {
            colunasPermitidas = [
                'ped_id', 'numero_pedido', 'cod_cliente', 'data_entrega_original', 
                'data_entrega', 'tipo_pedido', 'desc_tipo_movimento', 
                'volume_hectolitro', 'situacao_item', 'situacao_atend_item', 'situacao_nf'
            ];
        }
        const conjuntoColunasPermitidas = new Set(colunasPermitidas);

        statusDiv.innerText = "Lendo arquivo...";

        const reader = new FileReader();
        
        reader.onload = async function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const matrizDados = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (matrizDados.length <= 1) {
                    throw new Error("O arquivo Excel está vazio.");
                }

                const cabecalhos = matrizDados[0];
                dadosProntosParaEnviar = [];
                const totalLinhas = matrizDados.length;

                for (let i = 1; i < totalLinhas; i++) {
                    const linhaAtual = matrizDados[i];
                    if (!linhaAtual || linhaAtual.length === 0) continue;

                    const linhaLimpa = {};
                    cabecalhos.forEach((colunaOriginal, indexColuna) => {
                        const colunaLimpa = limparNomeColuna(colunaOriginal);
                        if (conjuntoColunasPermitidas.has(colunaLimpa)) {
                            linhaLimpa[colunaLimpa] = linhaAtual[indexColuna] !== undefined ? linhaAtual[indexColuna] : null;
                        }
                    });

                    dadosProntosParaEnviar.push(linhaLimpa);

                    if (i % 3000 === 0 || i === totalLinhas - 1) {
                        const parcial = Math.round((i / totalLinhas) * 15);
                        progressBar.style.width = `${parcial}%`;
                        progressPercentage.innerText = `${parcial}%`;
                        statusDiv.innerText = `Tratando dados... (${i}/${totalLinhas - 1})`;
                        await new Promise(resolve => setTimeout(resolve, 5));
                    }
                }

                const tamanhoDoLote = 1000;
                const totalRegistros = dadosProntosParaEnviar.length;

                for (let i = 0; i < totalRegistros; i += tamanhoDoLote) {
                    const lote = dadosProntosParaEnviar.slice(i, i + tamanhoDoLote);
                    
                    const { error } = await banco
                        .from('Pedidos')
                        .insert(lote);

                    if (error) throw error;
                    
                    const enviadosAteAgora = Math.min(i + tamanhoDoLote, totalRegistros);
                    const porcentagemEnvio = Math.round(15 + ((enviadosAteAgora / totalRegistros) * 85));
                    
                    progressBar.style.width = `${porcentagemEnvio}%`;
                    progressPercentage.innerText = `${porcentagemEnvio}%`;
                    statusDiv.innerText = `Salvando no banco... (${enviadosAteAgora}/${totalRegistros})`;

                    await new Promise(resolve => setTimeout(resolve, 40));
                }

                statusDiv.innerHTML = "🎉 Planilha importada com sucesso!";
                inputArquivo.value = ""; 
                
                btnVisual.disabled = false;
                inputArquivo.disabled = false;
                
                // Recarregar dados após importação
                await loadInitialData();

            } catch (erroInterno) {
                console.error(erroInterno);
                statusDiv.innerHTML = `❌ Erro: <span style="color:red;">${erroInterno.message}</span>`;
                progressBar.style.backgroundColor = "#ff4d4d";
                btnVisual.disabled = false;
                inputArquivo.disabled = false;
            }
        };

        reader.readAsArrayBuffer(file);

    } catch (err) {
        console.error(err);
        statusDiv.innerHTML = `❌ Conexão: <span style="color:red;">${err.message}</span>`;
        progressBar.style.backgroundColor = "#ff4d4d";
        btnVisual.disabled = false;
        inputArquivo.disabled = false;
    }
});
