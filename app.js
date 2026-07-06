// Controle de Estado do Dashboard
let state = {
    orders: [],
    filters: {
        search: "",
        startDate: "",
        endDate: "",
        cliente: "",
        transportadora: "",
        categoria: ""
    },
    pagination: {
        currentPage: 1,
        itemsPerPage: 10
    },
    sorting: {
        column: "data_pedido",
        direction: "desc" // 'asc' ou 'desc'
    },
    theme: "dark",
    editingOrderId: null,
    activeTab: "pdv" // 'pdv', 'hl' ou 'sku'
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
    filterSearch: document.getElementById("filter-search"),
    filterStartDate: document.getElementById("filter-start-date"),
    filterEndDate: document.getElementById("filter-end-date"),
    filterCliente: document.getElementById("filter-cliente"),
    filterTransportadora: document.getElementById("filter-transportadora"),
    filterCategoria: document.getElementById("filter-categoria"),
    btnClearFilters: document.getElementById("btn-clear-filters"),
    btnNewOrder: document.getElementById("btn-new-order"),
    btnExportCsv: document.getElementById("btn-export-csv"),
    btnResetData: document.getElementById("btn-reset-data"),
    btnImportExcel: document.getElementById("btn-import-excel"),
    btnClearImport: document.getElementById("btn-clear-import"),
    excelUpload: document.getElementById("excel-upload"),
    
    // KPI Cards Containers
    cardOtif: document.getElementById("kpi-card-otif"),
    cardOt: document.getElementById("kpi-card-ot"),
    cardIf: document.getElementById("kpi-card-if"),
    cardTotal: document.getElementById("kpi-card-total"),
    
    // KPI Card Titles
    titleOtif: document.getElementById("kpi-otif-title"),
    titleOt: document.getElementById("kpi-ot-title"),
    titleIf: document.getElementById("kpi-if-title"),
    titleTotal: document.getElementById("kpi-total-title"),
    
    // KPI Card Values
    kpiOtif: document.getElementById("kpi-otif-value"),
    kpiOt: document.getElementById("kpi-ot-value"),
    kpiIf: document.getElementById("kpi-if-value"),
    kpiTotal: document.getElementById("kpi-total-value"),
    
    // KPI Card Metas
    metaOtif: document.getElementById("kpi-otif-meta"),
    metaOt: document.getElementById("kpi-ot-meta"),
    metaIf: document.getElementById("kpi-if-meta"),
    metaTotal: document.getElementById("kpi-total-meta"),
    
    // Radials
    circleOtif: document.querySelector("#kpi-card-otif .progress"),
    circleOt: document.querySelector("#kpi-card-ot .progress"),
    circleIf: document.querySelector("#kpi-card-if .progress"),
    circleTotal: document.querySelector("#kpi-card-total .progress"),
    
    // Radial labels
    labelOtif: document.getElementById("kpi-otif-radial-label"),
    labelOt: document.getElementById("kpi-ot-radial-label"),
    labelIf: document.getElementById("kpi-if-radial-label"),
    labelTotal: document.getElementById("kpi-total-radial-label"),
    
    // Tabela Operacional Geral
    tableBody: document.getElementById("table-body"),
    tableInfo: document.getElementById("table-info"),
    btnPrevPage: document.getElementById("btn-prev-page"),
    btnNextPage: document.getElementById("btn-next-page"),
    currentPageIndicator: document.getElementById("current-page-indicator"),
    tableHeaders: document.querySelectorAll(".orders-table th[data-sort]"),
    
    // Insights
    insightsText: document.getElementById("insights-text"),
    insightsList: document.getElementById("insights-list"),
    
    // Modal
    modal: document.getElementById("order-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalClose: document.getElementById("modal-close"),
    modalForm: document.getElementById("order-form"),
    btnCancelModal: document.getElementById("btn-cancel-modal"),
    
    // Form do Modal
    formId: document.getElementById("form-id"),
    formCliente: document.getElementById("form-cliente"),
    formTransportadora: document.getElementById("form-transportadora"),
    formCategoria: document.getElementById("form-categoria"),
    formValor: document.getElementById("form-valor"),
    formPedidoDate: document.getElementById("form-pedido-date"),
    formPrevistaDate: document.getElementById("form-prevista-date"),
    formEntregaDate: document.getElementById("form-entrega-date"),
    formQtdPedida: document.getElementById("form-qtd-pedida"),
    formQtdEntregue: document.getElementById("form-qtd-entregue"),
    formVolumeHl: document.getElementById("form-volume-hl"),
    formMotivoFalha: document.getElementById("form-motivo-falha"),
    formMotivoFalhaGroup: document.getElementById("form-motivo-falha-group"),
    
    // Abas de Classificação (Rankings)
    rankingPdvBody: document.getElementById("ranking-pdv-body"),
    rankingHlCarrierBody: document.getElementById("ranking-hl-carrier-body"),
    rankingHlClientBody: document.getElementById("ranking-hl-client-body"),
    rankingSkuBody: document.getElementById("ranking-sku-body")
};

// Inicialização do App
document.addEventListener("DOMContentLoaded", async () => {
    loadTheme();
    await loadData();
    populateFilterDropdowns();
    setupEventListeners();
    updateDashboard();
});

// Carregar Tema (Dark/Light)
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
    
    // Forçar re-renderização de gráficos sob a nova paleta do tema
    renderCharts(getFilteredData());
}

// Carregar Dados
async function loadData() {
    // 1. Prioridade: dados importados do Excel
    const importedData = localStorage.getItem("otif-imported-orders");
    if (importedData) {
        state.orders = JSON.parse(importedData);
        state.dataSource = "excel";
        showImportBadge(true);
        return;
    }

    // 2. Dados salvos manualmente (edições do usuário)
    const savedData = localStorage.getItem("otif-orders");
    if (savedData) {
        state.orders = JSON.parse(savedData);
        state.dataSource = "local";
    } else {
        // 3. Fallback: dados iniciais do data.js
        if (typeof INITIAL_ORDERS_DATA !== 'undefined' && INITIAL_ORDERS_DATA.length > 0) {
            state.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS_DATA));
            localStorage.setItem("otif-orders", JSON.stringify(state.orders));
            state.dataSource = "initial";
        } else {
            // 4. Último recurso: tentar API
            try {
                const response = await fetch('/api/otif');
                if (!response.ok) throw new Error('Network response was not ok');
                const data = await response.json();
                state.orders = data;
                localStorage.setItem("otif-orders", JSON.stringify(state.orders));
                state.dataSource = "api";
            } catch (error) {
                console.warn('API indisponível, usando dados estáticos:', error.message);
                state.orders = [];
                state.dataSource = "empty";
            }
        }
    }
    showImportBadge(false);
}

// Exibir/ocultar botão "Limpar Importação"
function showImportBadge(show) {
    if (DOM.btnClearImport) {
        DOM.btnClearImport.style.display = show ? "inline-flex" : "none";
    }
}

// Preencher Dropdowns com dados exclusivos da base
function populateFilterDropdowns() {
    const clientes = [...new Set(state.orders.map(o => o.cliente))].sort();
    const transportadoras = [...new Set(state.orders.map(o => o.transportadora))].sort();
    const categorias = [...new Set(state.orders.map(o => o.categoria))].sort();

    fillDropdown(DOM.filterCliente, clientes, "Todos os Clientes");
    fillDropdown(DOM.filterTransportadora, transportadoras, "Todas as Transportadoras");
    fillDropdown(DOM.filterCategoria, categorias, "Todas as Categorias");

    // Formulário do modal
    fillDropdown(DOM.formCliente, clientes, "Selecione o Cliente", false);
    fillDropdown(DOM.formTransportadora, transportadoras, "Selecione a Transportadora", false);
    fillDropdown(DOM.formCategoria, categorias, "Selecione a Categoria", false);
}

function fillDropdown(element, list, defaultText, includeAllOption = true) {
    let html = includeAllOption ? `<option value="">${defaultText}</option>` : `<option value="" disabled selected>${defaultText}</option>`;
    list.forEach(item => {
        html += `<option value="${item}">${item}</option>`;
    });
    element.innerHTML = html;
}

// Registro de Event Listeners
function setupEventListeners() {
    // Tema
    DOM.themeToggle.addEventListener("click", toggleTheme);
    
    // Abas de Navegação
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            switchTab(tab);
        });
    });
    
    // Filtros
    DOM.filterSearch.addEventListener("input", (e) => {
        state.filters.search = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterStartDate.addEventListener("change", (e) => {
        state.filters.startDate = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterEndDate.addEventListener("change", (e) => {
        state.filters.endDate = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterCliente.addEventListener("change", (e) => {
        state.filters.cliente = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterTransportadora.addEventListener("change", (e) => {
        state.filters.transportadora = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.filterCategoria.addEventListener("change", (e) => {
        state.filters.categoria = e.target.value;
        state.pagination.currentPage = 1;
        updateDashboard();
    });
    
    DOM.btnClearFilters.addEventListener("click", clearFilters);
    
    // Ações do Cabeçalho
    DOM.btnNewOrder.addEventListener("click", () => openOrderModal());
    DOM.btnExportCsv.addEventListener("click", exportToCsv);
    DOM.btnResetData.addEventListener("click", resetData);

    // Importação de Excel
    DOM.btnImportExcel.addEventListener("click", () => DOM.excelUpload.click());
    DOM.excelUpload.addEventListener("change", handleExcelUpload);
    DOM.btnClearImport.addEventListener("click", clearImportedData);
    
    // Paginação
    DOM.btnPrevPage.addEventListener("click", () => {
        if (state.pagination.currentPage > 1) {
            state.pagination.currentPage--;
            renderTable(getFilteredData());
        }
    });
    
    DOM.btnNextPage.addEventListener("click", () => {
        const filtered = getFilteredData();
        const maxPage = Math.ceil(filtered.length / state.pagination.itemsPerPage);
        if (state.pagination.currentPage < maxPage) {
            state.pagination.currentPage++;
            renderTable(filtered);
        }
    });
    
    // Ordenação da Tabela
    DOM.tableHeaders.forEach(th => {
        th.addEventListener("click", () => {
            const column = th.getAttribute("data-sort");
            if (state.sorting.column === column) {
                state.sorting.direction = state.sorting.direction === "asc" ? "desc" : "asc";
            } else {
                state.sorting.column = column;
                state.sorting.direction = "asc";
            }
            
            DOM.tableHeaders.forEach(h => {
                h.classList.remove("sorted-asc", "sorted-desc");
            });
            th.classList.add(state.sorting.direction === "asc" ? "sorted-asc" : "sorted-desc");
            
            renderTable(getFilteredData());
        });
    });
    
    // Controle do Modal
    DOM.modalClose.addEventListener("click", closeOrderModal);
    DOM.btnCancelModal.addEventListener("click", closeOrderModal);
    DOM.modalForm.addEventListener("submit", handleFormSubmit);
    
    // Lógica condicional do formulário para exibição de causas raiz
    const checkFormFailures = () => {
        const prevDate = DOM.formPrevistaDate.value;
        const entregaDate = DOM.formEntregaDate.value;
        const qtdPedida = parseFloat(DOM.formQtdPedida.value) || 0;
        const qtdEntregue = parseFloat(DOM.formQtdEntregue.value) || 0;
        
        let isLate = false;
        if (prevDate && entregaDate) {
            isLate = new Date(entregaDate) > new Date(prevDate);
        }
        
        const isIncomplete = qtdEntregue < qtdPedida;
        
        if (isLate || isIncomplete) {
            DOM.formMotivoFalhaGroup.style.display = "flex";
            DOM.formMotivoFalha.setAttribute("required", "required");
            if (DOM.formMotivoFalha.value === "Nenhum") {
                DOM.formMotivoFalha.value = isLate ? "Atraso na Transportadora" : "Quebra de Estoque";
            }
        } else {
            DOM.formMotivoFalhaGroup.style.display = "none";
            DOM.formMotivoFalha.removeAttribute("required");
            DOM.formMotivoFalha.value = "Nenhum";
        }
    };
    
    DOM.formPrevistaDate.addEventListener("change", checkFormFailures);
    DOM.formEntregaDate.addEventListener("change", checkFormFailures);
    DOM.formQtdPedida.addEventListener("input", checkFormFailures);
    DOM.formQtdEntregue.addEventListener("input", checkFormFailures);
}

// Alternância de Abas
function switchTab(tab) {
    state.activeTab = tab;
    
    // Atualizar classe ativa nos botões
    document.querySelectorAll(".tab-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === tab) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    // Atualizar classe ativa nos painéis
    document.querySelectorAll(".tab-panel-content").forEach(panel => {
        const panelId = panel.getAttribute("id");
        if (panelId === `tab-panel-${tab}`) {
            panel.classList.add("active");
        } else {
            panel.classList.remove("active");
        }
    });
    
    // Atualizar dashboard com novas métricas, gráficos e tabelas
    updateDashboard();
}

// Limpar Filtros
function clearFilters() {
    DOM.filterSearch.value = "";
    DOM.filterStartDate.value = "";
    DOM.filterEndDate.value = "";
    DOM.filterCliente.value = "";
    DOM.filterTransportadora.value = "";
    DOM.filterCategoria.value = "";
    
    state.filters = {
        search: "",
        startDate: "",
        endDate: "",
        cliente: "",
        transportadora: "",
        categoria: ""
    };
    state.pagination.currentPage = 1;
    updateDashboard();
}

// Resetar dados
function resetData() {
    if (confirm("Deseja realmente restaurar os dados originais de simulação? Suas alterações serão perdidas.")) {
        state.orders = [...INITIAL_ORDERS_DATA];
        localStorage.setItem("otif-orders", JSON.stringify(state.orders));
        populateFilterDropdowns();
        clearFilters();
    }
}

// Filtrar Dados da Base
function getFilteredData() {
    return state.orders.filter(order => {
        const query = state.filters.search.toLowerCase();
        const matchesSearch = !query || 
            order.id.toLowerCase().includes(query) ||
            order.cliente.toLowerCase().includes(query) ||
            order.transportadora.toLowerCase().includes(query);
            
        const matchesStartDate = !state.filters.startDate || order.data_pedido >= state.filters.startDate;
        const matchesEndDate = !state.filters.endDate || order.data_pedido <= state.filters.endDate;
        
        const matchesCliente = !state.filters.cliente || order.cliente === state.filters.cliente;
        const matchesTransportadora = !state.filters.transportadora || order.transportadora === state.filters.transportadora;
        const matchesCategoria = !state.filters.categoria || order.categoria === state.filters.categoria;
        
        return matchesSearch && matchesStartDate && matchesEndDate && matchesCliente && matchesTransportadora && matchesCategoria;
    });
}

// Ordenar Dados da Base
function sortData(data) {
    const col = state.sorting.column;
    const dir = state.sorting.direction === "asc" ? 1 : -1;
    
    return [...data].sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        if (col.includes("data")) {
            valA = new Date(valA || "1970-01-01").getTime();
            valB = new Date(valB || "1970-01-01").getTime();
        } else if (col === "valor" || col === "quantidade_pedida" || col === "quantidade_entregue" || col === "volume_hl") {
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

// Destruir gráficos anteriores
function destroyAllCharts() {
    Object.keys(charts).forEach(key => {
        if (charts[key]) {
            charts[key].destroy();
            charts[key] = null;
        }
    });
}

// Atualizar Tela Principal
function updateDashboard() {
    const filtered = getFilteredData();
    
    calculateMetrics(filtered);
    renderTable(filtered);
    renderRankingTables(filtered);
    renderCharts(filtered);
    generateInsights(filtered);
    
    lucide.createIcons();
}

// Calcular e Exibir Métricas baseadas na aba ativa
function calculateMetrics(data) {
    const total = data.length;
    
    // KPI Cards Domínio Geral
    const kpiCard1 = document.querySelector(".kpi-otif");
    const kpiCard2 = document.querySelector(".kpi-ot");
    const kpiCard3 = document.querySelector(".kpi-if");
    const kpiCard4 = document.querySelector(".kpi-total");
    
    if (total === 0) {
        DOM.kpiOtif.textContent = "0.0%";
        DOM.kpiOt.textContent = "0.0%";
        DOM.kpiIf.textContent = "0.0%";
        DOM.kpiTotal.textContent = "0";
        DOM.kpiRevenue.textContent = "R$ 0,00";
        DOM.kpiLate.textContent = "0";
        DOM.kpiIncomplete.textContent = "0";
        
        setRadialProgress(DOM.circleOtif, 0);
        setRadialProgress(DOM.circleOt, 0);
        setRadialProgress(DOM.circleIf, 0);
        return;
    }
    
    let otCount = 0;
    let ifCount = 0;
    let otifCount = 0;
    let totalRevenue = 0;
    let lateCount = 0;
    let incompleteCount = 0;
    
    // Volumétricas (Hectolitros)
    let totalVolumePedido = 0;
    let totalVolumeEntregue = 0;
    let otifVolume = 0;
    let otVolume = 0;
    let ifVolume = 0;
    
    data.forEach(order => {
        const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
        const isIf = order.quantidade_entregue >= order.quantidade_pedida;
        
        if (isOt) otCount++;
        else lateCount++;
        
        if (isIf) ifCount++;
        else incompleteCount++;
        
        if (isOt && isIf) otifCount++;
        
        totalRevenue += parseFloat(order.valor) || 0;
        
        // Volumetria (HL)
        const vol = parseFloat(order.volume_hl) || 0;
        totalVolumePedido += vol;
        
        // Volume entregue proporcional a quantidade entregue
        const ratio = order.quantidade_pedida > 0 ? (order.quantidade_entregue / order.quantidade_pedida) : 0;
        const volEntregue = vol * ratio;
        totalVolumeEntregue += volEntregue;
        
        if (isOt) otVolume += vol;
        if (isIf) ifVolume += volEntregue;
        if (isOt && isIf) otifVolume += volEntregue;
    });
    
    // Métricas Percentuais Operacionais (Baseadas em Pedidos)
    const pctOtif = (otifCount / total) * 100;
    const pctOt = (otCount / total) * 100;
    const pctIf = (ifCount / total) * 100;
    
    // Métricas Percentuais Volumétricas (Baseadas em Hectolitros)
    const pctOtifVol = totalVolumePedido > 0 ? (otifVolume / totalVolumePedido) * 100 : 0;
    const pctOtVol = totalVolumePedido > 0 ? (otVolume / totalVolumePedido) * 100 : 0;
    const pctIfVol = totalVolumePedido > 0 ? (totalVolumeEntregue / totalVolumePedido) * 100 : 0;
    const totalVolumeCorte = totalVolumePedido - totalVolumeEntregue;
    
    // Formatar moeda
    const formattedRevenue = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalRevenue);
    
    // Ajustar Layout e Títulos dos KPI Cards de acordo com a aba selecionada
    if (state.activeTab === "hl") {
        // --- VISÃO VOLUMÉTRICA (HL) ---
        kpiCard1.querySelector("h3").textContent = "OTIF Volumétrico";
        DOM.kpiOtif.textContent = `${pctOtifVol.toFixed(1)}%`;
        kpiCard1.querySelector(".radial-text").textContent = "Vol.";
        setRadialProgress(DOM.circleOtif, pctOtifVol);
        
        kpiCard2.querySelector("h3").textContent = "Volume Pedido";
        DOM.kpiOt.textContent = `${totalVolumePedido.toFixed(0)} HL`;
        kpiCard2.querySelector(".radial-text").textContent = "Solic.";
        setRadialProgress(DOM.circleOt, 100); // Fixo em 100% de volume planejado
        
        kpiCard3.querySelector("h3").textContent = "Volume Entregue";
        DOM.kpiIf.textContent = `${totalVolumeEntregue.toFixed(0)} HL`;
        kpiCard3.querySelector(".radial-text").textContent = "Realiz.";
        setRadialProgress(DOM.circleIf, pctIfVol);
        
        // Card de volume & faturamento adaptado
        kpiCard4.querySelector("h3").textContent = "Corte Volumétrico";
        DOM.kpiTotal.textContent = `${totalVolumeCorte.toFixed(1)} HL`;
        
        const detailsContainer = kpiCard4.querySelector("div[style*='display: flex']");
        if (detailsContainer) {
            detailsContainer.innerHTML = `Faturamento: <strong style="color:var(--text-primary)">${formattedRevenue}</strong>`;
        }
        
        const badgesContainer = kpiCard4.querySelector("div[style*='gap: 12px']");
        if (badgesContainer) {
            const lossPct = totalVolumePedido > 0 ? (totalVolumeCorte / totalVolumePedido * 100) : 0;
            badgesContainer.innerHTML = `
                <span class="badge badge-danger" style="padding: 2px 6px;">Perda de ${lossPct.toFixed(1)}% do HL</span>
                <span class="badge badge-outline" style="padding: 2px 6px;">Total Pedidos: ${total}</span>
            `;
        }
    } else {
        // --- VISÕES OPERACIONAIS (PDV / SKU) ---
        kpiCard1.querySelector("h3").textContent = "OTIF Global";
        DOM.kpiOtif.textContent = `${pctOtif.toFixed(1)}%`;
        kpiCard1.querySelector(".radial-text").textContent = "OTIF";
        setRadialProgress(DOM.circleOtif, pctOtif);
        
        kpiCard2.querySelector("h3").textContent = "On-Time (No Prazo)";
        DOM.kpiOt.textContent = `${pctOt.toFixed(1)}%`;
        kpiCard2.querySelector(".radial-text").textContent = "Prazo";
        setRadialProgress(DOM.circleOt, pctOt);
        
        kpiCard3.querySelector("h3").textContent = "In-Full (Completo)";
        DOM.kpiIf.textContent = `${pctIf.toFixed(1)}%`;
        kpiCard3.querySelector(".radial-text").textContent = "Carga";
        setRadialProgress(DOM.circleIf, pctIf);
        
        // Card 4: Detalhes gerais do volume
        kpiCard4.querySelector("h3").textContent = "Volume de Pedidos";
        DOM.kpiTotal.textContent = total;
        
        const detailsContainer = kpiCard4.querySelector("div[style*='display: flex']");
        if (detailsContainer) {
            detailsContainer.innerHTML = `Faturamento: <strong style="color:var(--text-primary)">${formattedRevenue}</strong>`;
        }
        
        const badgesContainer = kpiCard4.querySelector("div[style*='gap: 12px']");
        if (badgesContainer) {
            badgesContainer.innerHTML = `
                <span class="badge badge-danger" style="padding: 2px 6px;"><strong id="kpi-late-value">${lateCount}</strong> atrasos</span>
                <span class="badge badge-warning" style="padding: 2px 6px; color: #d97706; background-color: rgba(217, 119, 6, 0.15);"><strong id="kpi-incomplete-value">${incompleteCount}</strong> cortes</span>
            `;
        }
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

// Renderizar Tabela Geral de Pedidos (Rodapé)
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
        html = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 40px;">Nenhum pedido atende aos filtros aplicados.</td></tr>`;
    } else {
        paginatedItems.forEach(order => {
            const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
            const isIf = order.quantidade_entregue >= order.quantidade_pedida;
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
            
            const formattedDatePedido = formatDate(order.data_pedido);
            const formattedDatePrevista = formatDate(order.data_prevista);
            const formattedDateEntrega = formatDate(order.data_entrega);
            
            html += `
                <tr>
                    <td><strong>${order.id}</strong></td>
                    <td>${order.cliente}</td>
                    <td>${order.transportadora}</td>
                    <td>${order.categoria}</td>
                    <td>${formattedDatePedido}</td>
                    <td>${formattedDatePrevista}</td>
                    <td>
                        <span style="color: ${isOt ? 'inherit' : 'var(--danger)'}">
                            ${formattedDateEntrega}
                        </span>
                    </td>
                    <td>
                        <div class="otif-indicator">
                            <span class="dot ${isOt ? 'dot-success' : 'dot-danger'}"></span>
                            <span class="dot ${isIf ? 'dot-success' : 'dot-danger'}"></span>
                            ${statusHtml}
                        </div>
                    </td>
                    <td>
                        <div class="row-actions">
                            <button class="btn-icon-table" onclick="openOrderModal('${order.id}')" title="Editar Pedido">
                                <i data-lucide="edit-3" style="width:14px;height:14px;"></i>
                            </button>
                            <button class="btn-icon-table btn-delete" onclick="deleteOrder('${order.id}')" title="Excluir Pedido">
                                <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
    
    DOM.tableBody.innerHTML = html;
    lucide.createIcons();
}

// Renderizar Tabelas de Classificação/Ranking por Aba
function renderRankingTables(data) {
    if (data.length === 0) return;
    
    // --- 1. Aba PDV: Ranking de Clientes ---
    if (state.activeTab === "pdv") {
        const pdvAgg = {};
        data.forEach(order => {
            const name = order.cliente;
            if (!pdvAgg[name]) {
                pdvAgg[name] = { total: 0, ot: 0, corte: 0, otif: 0 };
            }
            pdvAgg[name].total++;
            const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
            const isIf = order.quantidade_entregue >= order.quantidade_pedida;
            
            if (isOt) pdvAgg[name].ot++;
            if (!isIf) pdvAgg[name].corte++;
            if (isOt && isIf) pdvAgg[name].otif++;
        });
        
        // Sort clients by OTIF % desc, then total orders desc
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
                    <td>
                        <span class="ranking-value ${isSuccess ? 'success' : 'danger'}">
                            ${p.pct.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        });
        DOM.rankingPdvBody.innerHTML = html;
    }
    
    // --- 2. Aba HL: Rankings Volumétricos de Transportadoras e Clientes (HL) ---
    if (state.activeTab === "hl") {
        // Ranking de Transportadoras
        const carrierAgg = {};
        // Ranking de Clientes
        const clientAgg = {};
        
        data.forEach(order => {
            const carr = order.transportadora;
            const cli = order.cliente;
            const vol = parseFloat(order.volume_hl) || 0;
            const ratio = order.quantidade_pedida > 0 ? (order.quantidade_entregue / order.quantidade_pedida) : 0;
            const volEntregue = vol * ratio;
            
            const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
            const isIf = order.quantidade_entregue >= order.quantidade_pedida;
            const otifVol = (isOt && isIf) ? volEntregue : 0;
            
            // Transportadoras
            if (!carrierAgg[carr]) {
                carrierAgg[carr] = { totalVol: 0, entregueVol: 0, otifVol: 0 };
            }
            carrierAgg[carr].totalVol += vol;
            carrierAgg[carr].entregueVol += volEntregue;
            carrierAgg[carr].otifVol += otifVol;
            
            // Clientes
            if (!clientAgg[cli]) {
                clientAgg[cli] = { totalVol: 0, entregueVol: 0, otifVol: 0 };
            }
            clientAgg[cli].totalVol += vol;
            clientAgg[cli].entregueVol += volEntregue;
            clientAgg[cli].otifVol += otifVol;
        });
        
        // Renderizar Transportadoras HL
        const sortedCarriers = Object.keys(carrierAgg).map(name => {
            const d = carrierAgg[name];
            return {
                name,
                totalVol: d.totalVol,
                entregueVol: d.entregueVol,
                perdaVol: d.totalVol - d.entregueVol,
                otifVolPct: d.totalVol > 0 ? (d.otifVol / d.totalVol) * 100 : 0
            };
        }).sort((a, b) => b.otifVolPct - a.otifVolPct);
        
        let htmlCarrier = "";
        sortedCarriers.forEach((c, idx) => {
            const isSuccess = c.otifVolPct >= 85;
            htmlCarrier += `
                <tr>
                    <td><span class="ranking-rank">${idx + 1}</span><strong>${c.name}</strong></td>
                    <td>${c.totalVol.toFixed(1)} HL</td>
                    <td>${c.entregueVol.toFixed(1)} HL</td>
                    <td style="color: ${c.perdaVol > 0 ? 'var(--warning)' : 'inherit'}">${c.perdaVol.toFixed(1)} HL</td>
                    <td>
                        <span class="ranking-value ${isSuccess ? 'success' : 'danger'}">
                            ${c.otifVolPct.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        });
        DOM.rankingHlCarrierBody.innerHTML = htmlCarrier;
        
        // Renderizar Clientes HL
        const sortedClients = Object.keys(clientAgg).map(name => {
            const d = clientAgg[name];
            return {
                name,
                totalVol: d.totalVol,
                entregueVol: d.entregueVol,
                otifVolPct: d.totalVol > 0 ? (d.otifVol / d.totalVol) * 100 : 0
            };
        }).sort((a, b) => b.totalVol - a.totalVol); // Ordenar por maior volume movimentado
        
        let htmlClient = "";
        sortedClients.forEach((cl, idx) => {
            const isSuccess = cl.otifVolPct >= 85;
            htmlClient += `
                <tr>
                    <td><span class="ranking-rank">${idx + 1}</span><strong>${cl.name}</strong></td>
                    <td>${cl.totalVol.toFixed(1)} HL</td>
                    <td>${cl.entregueVol.toFixed(1)} HL</td>
                    <td>
                        <span class="ranking-value ${isSuccess ? 'success' : 'danger'}">
                            ${cl.otifVolPct.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        });
        DOM.rankingHlClientBody.innerHTML = htmlClient;
    }
    
    // --- 3. Aba SKU: Rankings de Categorias ---
    if (state.activeTab === "sku") {
        const skuAgg = {};
        data.forEach(order => {
            const cat = order.categoria;
            if (!skuAgg[cat]) {
                skuAgg[cat] = { total: 0, otif: 0, ifCount: 0, totalPedida: 0, totalEntregue: 0 };
            }
            skuAgg[cat].total++;
            
            const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
            const isIf = order.quantidade_entregue >= order.quantidade_pedida;
            
            if (isIf) skuAgg[cat].ifCount++;
            if (isOt && isIf) skuAgg[cat].otif++;
            
            skuAgg[cat].totalPedida += order.quantidade_pedida;
            skuAgg[cat].totalEntregue += order.quantidade_entregue;
        });
        
        const sortedSkus = Object.keys(skuAgg).map(name => {
            const d = skuAgg[name];
            const cutRate = d.totalPedida > 0 ? (1 - (d.totalEntregue / d.totalPedida)) * 100 : 0;
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
                    <td>
                        <span class="ranking-value ${isSuccess ? 'success' : 'danger'}">
                            ${s.otifPct.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        });
        DOM.rankingSkuBody.innerHTML = htmlSku;
    }
}

// Renderização dos Gráficos com base na Aba Ativa
function renderCharts(data) {
    const isDark = state.theme === "dark";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94a3b8" : "#475569";
    const labelColor = isDark ? "#f8fafc" : "#0f172a";
    
    // Limpar todos os gráficos primeiro para evitar duplicidades
    destroyAllCharts();
    
    if (data.length === 0) return;
    
    // Agrupamento Semanal Geral
    const weeklyData = {};
    data.forEach(order => {
        const dateObj = new Date(order.data_pedido);
        const weekNum = getWeekNumber(dateObj);
        const label = `Semana ${weekNum}`;
        
        if (!weeklyData[label]) {
            weeklyData[label] = { total: 0, otif: 0, ot: 0, if: 0, volumePedido: 0, volumeEntregue: 0, otifVolume: 0 };
        }
        
        const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
        const isIf = order.quantidade_entregue >= order.quantidade_pedida;
        
        weeklyData[label].total++;
        if (isOt) weeklyData[label].ot++;
        if (isIf) weeklyData[label].if++;
        if (isOt && isIf) weeklyData[label].otif++;
        
        // Volumetria (HL)
        const vol = parseFloat(order.volume_hl) || 0;
        weeklyData[label].volumePedido += vol;
        const ratio = order.quantidade_pedida > 0 ? (order.quantidade_entregue / order.quantidade_pedida) : 0;
        const volEntregue = vol * ratio;
        weeklyData[label].volumeEntregue += volEntregue;
        if (isOt && isIf) {
            weeklyData[label].otifVolume += volEntregue;
        }
    });
    
    const weekLabels = Object.keys(weeklyData).sort();
    
    // --- RENDERING DA ABA 1: PDV ---
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
        
        // Gráfico 1.1: Evolução Semanal de Pedidos
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
        
        // Gráfico 1.2: OTIF por Cliente
        const clientOtif = {};
        data.forEach(order => {
            const c = order.cliente;
            if (!clientOtif[c]) clientOtif[c] = { total: 0, otif: 0 };
            clientOtif[c].total++;
            if (new Date(order.data_entrega) <= new Date(order.data_prevista) && order.quantidade_entregue >= order.quantidade_pedida) {
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
        
        // Gráfico 1.3: Causa de Falhas nos PDVs
        const clientFailures = {};
        data.forEach(order => {
            const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
            const isIf = order.quantidade_entregue >= order.quantidade_pedida;
            if ((!isOt || !isIf) && order.motivo_falha !== "Nenhum") {
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
    
    // --- RENDERING DA ABA 2: HL (Hectolitros) ---
    if (state.activeTab === "hl") {
        const trendHlPed = [];
        const trendHlEnt = [];
        
        weekLabels.forEach(w => {
            const d = weeklyData[w];
            trendHlPed.push(d.volumePedido.toFixed(1));
            trendHlEnt.push(d.volumeEntregue.toFixed(1));
        });
        
        // Gráfico 2.1: Volume Semanal (Hectolitros)
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
        
        // Gráfico 2.2: HL Delivered por Categoria
        const catHl = {};
        data.forEach(order => {
            const cat = order.categoria;
            const vol = parseFloat(order.volume_hl) || 0;
            const ratio = order.quantidade_pedida > 0 ? (order.quantidade_entregue / order.quantidade_pedida) : 0;
            catHl[cat] = (catHl[cat] || 0) + (vol * ratio);
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
    
    // --- RENDERING DA ABA 3: SKU ---
    if (state.activeTab === "sku") {
        // Agrupamento por Categorias
        const catAgg = {};
        data.forEach(order => {
            const cat = order.categoria;
            if (!catAgg[cat]) {
                catAgg[cat] = { total: 0, otif: 0, totalPedida: 0, totalEntregue: 0 };
            }
            catAgg[cat].total++;
            const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
            const isIf = order.quantidade_entregue >= order.quantidade_pedida;
            if (isOt && isIf) catAgg[cat].otif++;
            
            catAgg[cat].totalPedida += order.quantidade_pedida;
            catAgg[cat].totalEntregue += order.quantidade_entregue;
        });
        
        const categories = Object.keys(catAgg);
        
        // Gráfico 3.1: Share de atendimento volumétrico / Grau de Atendimento (IF %)
        const ifRatios = categories.map(cat => {
            const d = catAgg[cat];
            return d.totalPedida > 0 ? ((d.totalEntregue / d.totalPedida) * 100).toFixed(1) : 0;
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
        
        // Gráfico 3.2: OTIF % por Categoria
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

// Helpers para data
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

// Geração de Insights e Recomendações Logísticas
function generateInsights(data) {
    if (data.length === 0) {
        DOM.insightsText.innerHTML = "Sem dados disponíveis para gerar recomendações.";
        DOM.insightsList.innerHTML = "";
        return;
    }
    
    let otifCount = 0;
    let lateCount = 0;
    let incompleteCount = 0;
    const carrierMetrics = {};
    const failureCauses = {};
    let totalVolumePedido = 0;
    let totalVolumeEntregue = 0;
    let otifVolume = 0;
    
    data.forEach(order => {
        const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
        const isIf = order.quantidade_entregue >= order.quantidade_pedida;
        
        if (isOt && isIf) otifCount++;
        if (!isOt) lateCount++;
        if (!isIf) incompleteCount++;
        
        // Volumetria
        const vol = parseFloat(order.volume_hl) || 0;
        totalVolumePedido += vol;
        const ratio = order.quantidade_pedida > 0 ? (order.quantidade_entregue / order.quantidade_pedida) : 0;
        const volEntregue = vol * ratio;
        totalVolumeEntregue += volEntregue;
        if (isOt && isIf) {
            otifVolume += volEntregue;
        }
        
        // Transportadora
        const t = order.transportadora;
        if (!carrierMetrics[t]) {
            carrierMetrics[t] = { total: 0, otif: 0, totalVol: 0, otifVol: 0 };
        }
        carrierMetrics[t].total++;
        carrierMetrics[t].totalVol += vol;
        if (isOt && isIf) {
            carrierMetrics[t].otif++;
            carrierMetrics[t].otifVol += volEntregue;
        }
        
        // Falhas
        if (!isOt || !isIf) {
            const reason = order.motivo_falha || "Não informado";
            if (reason !== "Nenhum") {
                failureCauses[reason] = (failureCauses[reason] || 0) + 1;
            }
        }
    });
    
    const pctGeneral = (otifCount / data.length) * 100;
    const pctGeneralVol = totalVolumePedido > 0 ? (otifVolume / totalVolumePedido) * 100 : 0;
    
    let mainInsight = "";
    if (state.activeTab === "hl") {
        if (pctGeneralVol >= 85) {
            mainInsight = `<strong>Nível de serviço volumétrico excelente!</strong> O OTIF Volumétrico está em ${pctGeneralVol.toFixed(1)}%, acima da meta. O escoamento em Hectolitros está saudável.`;
        } else {
            mainInsight = `<strong>Gargalo de Volume (HL):</strong> O OTIF Volumétrico consolidado está em ${pctGeneralVol.toFixed(1)}%, indicando perdas físicas expressivas. Veja abaixo as causas:`;
        }
    } else {
        if (pctGeneral >= 85) {
            mainInsight = `<strong>Desempenho operacional sob controle!</strong> OTIF de pedidos está em ${pctGeneral.toFixed(1)}%, superando a meta logística consolidada de 85%.`;
        } else {
            mainInsight = `<strong>Atenção operacional necessária:</strong> Nível de serviço em pedidos está em ${pctGeneral.toFixed(1)}% (meta: 85%). Identificamos as seguintes anomalias:`;
        }
    }
    
    DOM.insightsText.innerHTML = mainInsight;
    
    // Insights de Linha
    const items = [];
    
    // 1. Causa Raiz Principal
    let mainCause = "";
    let mainCauseCount = 0;
    Object.keys(failureCauses).forEach(cause => {
        if (failureCauses[cause] > mainCauseCount) {
            mainCauseCount = failureCauses[cause];
            mainCause = cause;
        }
    });
    
    if (mainCause) {
        let solution = "Revisar estoques de segurança.";
        if (mainCause === "Atraso na Transportadora") solution = "Penalizar ou advertir transportadora parceira pelo não cumprimento de SLA.";
        else if (mainCause === "Quebra de Estoque") solution = "Programar produção urgente ou refaturar pedidos incompletos.";
        else if (mainCause === "Erro de Separação") solution = "Reforçar conferência e etiquetagem nas esteiras do CD.";
        
        items.push({
            type: "danger",
            text: `O principal motivo de desvio é <strong>"${mainCause}"</strong> (${mainCauseCount} ocorrências). Ação recomendada: ${solution}`
        });
    }
    
    // 2. Transportadora gargalo
    let worstCarrier = null;
    let worstPct = 100;
    Object.keys(carrierMetrics).forEach(t => {
        const m = carrierMetrics[t];
        if (m.total >= 3) {
            const pct = state.activeTab === "hl" 
                ? (m.otifVol / m.totalVol) * 100 
                : (m.otif / m.total) * 100;
            if (pct < worstPct) {
                worstPct = pct;
                worstCarrier = t;
            }
        }
    });
    
    if (worstCarrier && worstPct < 80) {
        items.push({
            type: "warning",
            text: `A transportadora <strong>${worstCarrier}</strong> apresenta nível crítico de SLA (${worstPct.toFixed(0)}%). Risco de ruptura no abastecimento.`
        });
    }
    
    // 3. Informações Volumétricas para HL
    if (state.activeTab === "hl") {
        const lossHl = totalVolumePedido - totalVolumeEntregue;
        if (lossHl > 0) {
            items.push({
                type: "info",
                text: `Houve corte de <strong>${lossHl.toFixed(1)} HL</strong> no período, representando perda direta de faturamento sobre o volume planejado.`
            });
        }
    } else {
        if (lateCount > incompleteCount && lateCount > 0) {
            items.push({
                type: "info",
                text: `A <strong>pontualidade (On-Time)</strong> é o principal gargalo atual. Concentre esforços nas janelas de expedição.`
            });
        } else if (incompleteCount > lateCount && incompleteCount > 0) {
            items.push({
                type: "info",
                text: `A <strong>completude de carga (In-Full)</strong> é o principal gargalo. Revise a taxa de corte de estoque (Fill Rate).`
            });
        }
    }
    
    let listHtml = "";
    items.forEach(item => {
        let icon = "alert-circle";
        let color = "var(--warning)";
        if (item.type === "danger") {
            icon = "alert-triangle";
            color = "var(--danger)";
        } else if (item.type === "success") {
            icon = "check-circle";
            color = "var(--success)";
        } else if (item.type === "info") {
            icon = "info";
            color = "var(--primary)";
        }
        
        listHtml += `
            <div class="insight-item">
                <i data-lucide="${icon}" style="width:16px;height:16px;color:${color}"></i>
                <span>${item.text}</span>
            </div>
        `;
    });
    
    DOM.insightsList.innerHTML = listHtml;
    lucide.createIcons();
}

// Abrir Modal para Inserção/Edição de Pedidos
function openOrderModal(orderId = null) {
    if (orderId) {
        state.editingOrderId = orderId;
        const order = state.orders.find(o => o.id === orderId);
        
        DOM.modalTitle.textContent = "Editar Pedido";
        DOM.formId.value = order.id;
        DOM.formId.setAttribute("disabled", "disabled");
        
        DOM.formCliente.value = order.cliente;
        DOM.formTransportadora.value = order.transportadora;
        DOM.formCategoria.value = order.categoria;
        DOM.formValor.value = order.valor;
        DOM.formPedidoDate.value = order.data_pedido;
        DOM.formPrevistaDate.value = order.data_prevista;
        DOM.formEntregaDate.value = order.data_entrega;
        DOM.formQtdPedida.value = order.quantidade_pedida;
        DOM.formQtdEntregue.value = order.quantidade_entregue;
        DOM.formVolumeHl.value = order.volume_hl || "";
        
        // Checar se houve falha
        const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista);
        const isIf = order.quantidade_entregue >= order.quantidade_pedida;
        
        if (!isOt || !isIf) {
            DOM.formMotivoFalhaGroup.style.display = "flex";
            DOM.formMotivoFalha.value = order.motivo_falha || "Atraso na Transportadora";
            DOM.formMotivoFalha.setAttribute("required", "required");
        } else {
            DOM.formMotivoFalhaGroup.style.display = "none";
            DOM.formMotivoFalha.value = "Nenhum";
            DOM.formMotivoFalha.removeAttribute("required");
        }
    } else {
        state.editingOrderId = null;
        DOM.modalTitle.textContent = "Novo Pedido";
        DOM.formId.removeAttribute("disabled");
        
        // Gerar ID sequencial dinâmico
        const nextIdNumber = state.orders.reduce((max, order) => {
            const num = parseInt(order.id.split("-").pop()) || 0;
            return num > max ? num : max;
        }, 0) + 1;
        DOM.formId.value = `PED-2026-${String(nextIdNumber).padStart(3, "0")}`;
        
        DOM.modalForm.reset();
        DOM.formMotivoFalhaGroup.style.display = "none";
        DOM.formMotivoFalha.removeAttribute("required");
        DOM.formMotivoFalha.value = "Nenhum";
        
        const today = new Date().toISOString().split("T")[0];
        DOM.formPedidoDate.value = today;
        DOM.formPrevistaDate.value = today;
        DOM.formEntregaDate.value = today;
    }
    
    DOM.modal.classList.add("active");
}

function closeOrderModal() {
    DOM.modal.classList.remove("active");
    state.editingOrderId = null;
}

// Salvar Pedido do Formulário
function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = DOM.formId.value.trim().toUpperCase();
    const cliente = DOM.formCliente.value;
    const transportadora = DOM.formTransportadora.value;
    const categoria = DOM.formCategoria.value;
    const valor = parseFloat(DOM.formValor.value) || 0;
    const data_pedido = DOM.formPedidoDate.value;
    const data_prevista = DOM.formPrevistaDate.value;
    const data_entrega = DOM.formEntregaDate.value;
    const quantidade_pedida = parseInt(DOM.formQtdPedida.value) || 0;
    const quantidade_entregue = parseInt(DOM.formQtdEntregue.value) || 0;
    const volume_hl = parseFloat(DOM.formVolumeHl.value) || 0;
    
    const isOt = new Date(data_entrega) <= new Date(data_prevista);
    const isIf = quantidade_entregue >= quantidade_pedida;
    
    const motivo_falha = (isOt && isIf) ? "Nenhum" : DOM.formMotivoFalha.value;
    
    if (!cliente || !transportadora || !categoria) {
        alert("Por favor, preencha todos os seletores!");
        return;
    }
    
    const orderObj = {
        id, cliente, transportadora, categoria, valor,
        data_pedido, data_prevista, data_entrega,
        quantidade_pedida, quantidade_entregue, volume_hl, motivo_falha
    };
    
    if (state.editingOrderId) {
        const index = state.orders.findIndex(o => o.id === state.editingOrderId);
        if (index !== -1) {
            state.orders[index] = orderObj;
        }
    } else {
        if (state.orders.some(o => o.id === id)) {
            alert(`O Pedido com ID ${id} já existe!`);
            return;
        }
        state.orders.push(orderObj);
    }
    
    localStorage.setItem("otif-orders", JSON.stringify(state.orders));
    closeOrderModal();
    populateFilterDropdowns();
    updateDashboard();
}

// Excluir Pedido
window.deleteOrder = function(orderId) {
    if (confirm(`Tem certeza que deseja excluir o pedido ${orderId}?`)) {
        state.orders = state.orders.filter(o => o.id !== orderId);
        localStorage.setItem("otif-orders", JSON.stringify(state.orders));
        updateDashboard();
    }
};

window.openOrderModal = function(orderId) {
    openOrderModal(orderId);
};

// Formatar data em string amigável
function formatDate(dateStr) {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Exportar Tabela para CSV (Compatível com Excel)
function exportToCsv() {
    const data = sortData(getFilteredData());
    if (data.length === 0) {
        alert("Não há dados para exportação!");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para UTF-8 no Excel
    csvContent += "ID Pedido;Cliente;Transportadora;Categoria;Data Pedido;Data Prevista;Data Entrega;Qtd Pedida;Qtd Entregue;Volume HL;Valor;No Prazo;Completo;OTIF;Motivo Falha\r\n";
    
    data.forEach(order => {
        const isOt = new Date(order.data_entrega) <= new Date(order.data_prevista) ? "Sim" : "Não";
        const isIf = order.quantidade_entregue >= order.quantidade_pedida ? "Sim" : "Não";
        const isOtif = (isOt === "Sim" && isIf === "Sim") ? "Sim" : "Não";
        
        const row = [
            order.id,
            `"${order.cliente}"`,
            `"${order.transportadora}"`,
            `"${order.categoria}"`,
            order.data_pedido,
            order.data_prevista,
            order.data_entrega,
            order.quantidade_pedida,
            order.quantidade_entregue,
            order.volume_hl.toFixed(1).replace(".", ","),
            order.valor.toFixed(2).replace(".", ","),
            isOt,
            isIf,
            isOtif,
            `"${order.motivo_falha}"`
        ];
        
        csvContent += row.join(";") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard_otif_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// =============================================
// IMPORTAÇÃO DE PLANILHA EXCEL
// =============================================

// Mapeamento flexível de colunas da planilha para campos do sistema
const COLUMN_MAP = {
    // ID
    "id": "id", "código": "id", "codigo": "id", "pedido": "id", "nº pedido": "id", "num_pedido": "id",
    // Cliente
    "cliente": "cliente", "client": "cliente", "nome_cliente": "cliente", "razão social": "cliente",
    // Transportadora
    "transportadora": "transportadora", "carrier": "transportadora", "transp": "transportadora",
    // Categoria
    "categoria": "categoria", "category": "categoria", "tipo": "categoria",
    // Datas
    "data_pedido": "data_pedido", "data pedido": "data_pedido", "dt_pedido": "data_pedido", "order_date": "data_pedido",
    "data_prevista": "data_prevista", "data prevista": "data_prevista", "previsão": "data_prevista", "previsao": "data_prevista", "dt_prevista": "data_prevista",
    "data_entrega": "data_entrega", "data entrega": "data_entrega", "entrega": "data_entrega", "dt_entrega": "data_entrega", "delivery_date": "data_entrega",
    // Valor
    "valor": "valor", "value": "valor", "total": "valor", "valor_pedido": "valor",
    // Quantidades
    "quantidade_pedida": "quantidade_pedida", "qtd_pedida": "quantidade_pedida", "qtd pedida": "quantidade_pedida", "qty_ordered": "quantidade_pedida",
    "quantidade_entregue": "quantidade_entregue", "qtd_entregue": "quantidade_entregue", "qtd entregue": "quantidade_entregue", "qty_delivered": "quantidade_entregue",
    // Volume
    "volume_hl": "volume_hl", "volume": "volume_hl", "hl": "volume_hl", "hectolitros": "volume_hl",
    // Motivo
    "motivo_falha": "motivo_falha", "motivo": "motivo_falha", "causa": "motivo_falha", "motivo do desvio": "motivo_falha", "causa raiz": "motivo_falha"
};

function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array", cellDates: true });

            // Ler a primeira aba da planilha
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

            if (rawRows.length === 0) {
                alert("⚠️ A planilha está vazia. Verifique o arquivo e tente novamente.");
                return;
            }

            // Mapear colunas
            const orders = rawRows.map((row, index) => {
                const mapped = {};
                for (const [excelCol, value] of Object.entries(row)) {
                    const normalizedCol = excelCol.toString().trim().toLowerCase();
                    const fieldName = COLUMN_MAP[normalizedCol];
                    if (fieldName) {
                        mapped[fieldName] = value;
                    }
                }

                // Gerar ID se não existir
                if (!mapped.id) {
                    mapped.id = `IMP-${String(index + 1).padStart(3, "0")}`;
                }

                // Formatar datas (aceita Date objects ou strings)
                mapped.data_pedido = formatExcelDate(mapped.data_pedido);
                mapped.data_prevista = formatExcelDate(mapped.data_prevista);
                mapped.data_entrega = formatExcelDate(mapped.data_entrega);

                // Garantir numéricos
                mapped.valor = parseFloat(mapped.valor) || 0;
                mapped.quantidade_pedida = parseInt(mapped.quantidade_pedida) || 0;
                mapped.quantidade_entregue = parseInt(mapped.quantidade_entregue) || 0;
                mapped.volume_hl = parseFloat(mapped.volume_hl) || 0;

                // Defaults
                mapped.cliente = mapped.cliente || "Não informado";
                mapped.transportadora = mapped.transportadora || "Não informado";
                mapped.categoria = mapped.categoria || "Geral";
                mapped.motivo_falha = mapped.motivo_falha || "Nenhum";

                return mapped;
            });

            // Salvar no localStorage e atualizar dashboard
            state.orders = orders;
            localStorage.setItem("otif-imported-orders", JSON.stringify(orders));
            state.dataSource = "excel";
            showImportBadge(true);
            populateFilterDropdowns();
            clearFilters();
            updateDashboard();

            alert(`✅ ${orders.length} pedidos importados com sucesso da planilha "${file.name}"!`);

        } catch (err) {
            console.error("Erro ao processar planilha:", err);
            alert("❌ Erro ao ler o arquivo. Verifique se é um arquivo Excel válido (.xlsx ou .xls).");
        }
    };

    reader.readAsArrayBuffer(file);
    // Limpar o input para permitir reimportação do mesmo arquivo
    event.target.value = "";
}

// Converte datas do Excel (Date object, serial number ou string) para formato YYYY-MM-DD
function formatExcelDate(value) {
    if (!value) return "";
    if (value instanceof Date) {
        return value.toISOString().split("T")[0];
    }
    if (typeof value === "number") {
        // Serial number do Excel (dias desde 1900-01-01)
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toISOString().split("T")[0];
    }
    // String — tentar interpretar
    const str = String(value).trim();
    // Formato DD/MM/YYYY
    const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (brMatch) {
        return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
    }
    // Formato YYYY-MM-DD (já correto)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return str;
    }
    return str;
}

// Limpar dados importados e voltar aos dados anteriores
function clearImportedData() {
    if (!confirm("Deseja remover os dados importados do Excel e voltar aos dados originais?")) return;

    localStorage.removeItem("otif-imported-orders");
    state.dataSource = "local";
    showImportBadge(false);

    // Recarregar dados originais
    const savedData = localStorage.getItem("otif-orders");
    if (savedData) {
        state.orders = JSON.parse(savedData);
    } else if (typeof INITIAL_ORDERS_DATA !== 'undefined') {
        state.orders = JSON.parse(JSON.stringify(INITIAL_ORDERS_DATA));
    } else {
        state.orders = [];
    }

    populateFilterDropdowns();
    clearFilters();
    updateDashboard();
    alert("✅ Dados importados removidos. Dashboard restaurado.");
}
