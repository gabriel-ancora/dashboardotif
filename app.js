const supabaseUrl = 'https://eqvlivvaqnadasfchnzp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdmxpdnZhcW5hZGFzZmNobnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDA4NDAsImV4cCI6MjA5ODk3Njg0MH0.szN2eZVtOi8-MVXgvgy_UZRJFA6L0UDpy_t0b9nsgKo';
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
    return sItem === 'ENTREGUE' && sAtend === 'ATENDIDO' && sNf === 'NOTA EMITIDA';
}

// Controle de Estado do Dashboard
let state = {
    orders: [],
    filters: {
        month: "",
        startDate: "",
        endDate: "",
        cliente: ""
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
    filterMonth: document.getElementById("filter-month"),
    filterStartDate: document.getElementById("filter-start-date"),
    filterEndDate: document.getElementById("filter-end-date"),
    filterCliente: document.getElementById("filter-cliente"),
    btnClearFilters: document.getElementById("btn-clear-filters"),
    btnClearFiltersTable: document.getElementById("btn-clear-filters-table"),
    btnNewOrder: document.getElementById("btn-new-order"),
    btnExportCsv: document.getElementById("btn-export-csv"),
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
    try {
        const { data, error } = await banco.from('Pedidos').select('*');
        if (error) throw error;
        state.orders = data || [];
        state.dataSource = "api";
    } catch (error) {
        console.warn('Supabase indisponível:', error.message);
        state.orders = [];
        state.dataSource = "empty";
    }
}

// Exibir/ocultar botão "Limpar Importação"
function showImportBadge(show) {
    if (DOM.btnClearImport) {
        DOM.btnClearImport.style.display = show ? "inline-flex" : "none";
    }
}

// Preencher Dropdowns com dados exclusivos da base
function populateFilterDropdowns() {
    const clientes = [...new Set(state.orders.map(o => o.cod_cliente).filter(Boolean))].sort();
    const categorias = [...new Set(state.orders.map(o => o.desc_tipo_movimento).filter(Boolean))].sort();

    fillDropdown(DOM.filterCliente, clientes, "Todos os Clientes");

    // Formulário do modal
    if (DOM.formCliente) fillDropdown(DOM.formCliente, clientes, "Selecione o Cliente", false);
    if (DOM.formCategoria) fillDropdown(DOM.formCategoria, categorias, "Selecione a Categoria", false);

    populateMonthDropdown();
}

// Meses do ano em português para exibição no filtro (ex: "Junho/2026")
const MONTH_NAMES_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Preencher dropdown de Mês/Ano com base nos meses realmente presentes na base de pedidos
function populateMonthDropdown() {
    if (!DOM.filterMonth) return;

    const monthKeys = [...new Set(state.orders
        .filter(o => o.data_entrega_original)
        .map(o => o.data_entrega_original.slice(0, 7)) // "YYYY-MM"
    )].sort().reverse(); // meses mais recentes primeiro

    let html = `<option value="">Todos os Meses</option>`;
    monthKeys.forEach(key => {
        const [year, month] = key.split("-");
        const label = `${MONTH_NAMES_PT[parseInt(month, 10) - 1]}/${year}`;
        html += `<option value="${key}">${label}</option>`;
    });

    DOM.filterMonth.innerHTML = html;
    DOM.filterMonth.value = state.filters.month || "";
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
    DOM.filterMonth.addEventListener("change", (e) => {
        state.filters.month = e.target.value;
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
    
    if (DOM.btnClearFilters) DOM.btnClearFilters.addEventListener("click", clearFilters);
    if (DOM.btnClearFiltersTable) DOM.btnClearFiltersTable.addEventListener("click", clearFilters);
    
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
    DOM.filterMonth.value = "";
    DOM.filterStartDate.value = "";
    DOM.filterEndDate.value = "";
    DOM.filterCliente.value = "";
    
    state.filters = {
        month: "",
        startDate: "",
        endDate: "",
        cliente: ""
    };
    state.pagination.currentPage = 1;
    updateDashboard();
}

// Filtrar Dados da Base
function getFilteredData() {
    return state.orders.filter(order => {
        const matchesMonth = !state.filters.month || (order.data_entrega_original && order.data_entrega_original.slice(0, 7) === state.filters.month);
        const matchesStartDate = !state.filters.startDate || order.data_entrega_original >= state.filters.startDate;
        const matchesEndDate = !state.filters.endDate || order.data_entrega_original <= state.filters.endDate;
        const matchesCliente = !state.filters.cliente || order.cod_cliente === state.filters.cliente;
        
        return matchesMonth && matchesStartDate && matchesEndDate && matchesCliente;
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
    let processedData = data;
    if (state.activeTab === "pdv") {
        const visitas = {};
        data.forEach(order => {
            const num = order.numero_pedido;
            if (!num) return; // ignora se não tiver numero de pedido
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
        if (DOM.kpiRevenue) DOM.kpiRevenue.textContent = "";
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
    
    processedData.forEach(order => {
        let isOt = false;
        let isIf = false;
        
        if (order.fake) {
            isOt = order.isOt;
            isIf = order.isIf;
        } else {
            isOt = isOrderOT(order);
            isIf = isOrderIF(order);
        }
        
        if (isOt) otCount++;
        else lateCount++;
        
        if (isIf) ifCount++;
        else incompleteCount++;
        
        if (isOt && isIf) otifCount++;
    });

    data.forEach(order => {
        // Volumetria (HL)
        const vol = parseFloat(order.volume_hectolitro) || 0;
        totalVolumePedido += vol;
        
        // Volume entregue proporcional a quantidade entregue
        const volEntregue = isOrderIF(order) ? vol : 0;
        totalVolumeEntregue += volEntregue;
        
        if (isOrderOT(order)) otVolume += vol;
        if (isOrderIF(order)) ifVolume += volEntregue;
        if (isOrderOT(order) && isOrderIF(order)) otifVolume += volEntregue;
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
    const formattedRevenue = "";
    
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
        
        // Card de volume
        kpiCard4.querySelector("h3").textContent = "Corte Volumétrico";
        DOM.kpiTotal.textContent = `${totalVolumeCorte.toFixed(1)} HL`;
        
        const detailsContainer = kpiCard4.querySelector("div[style*='display: flex']");
        if (detailsContainer) {
            detailsContainer.innerHTML = ``;
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
            detailsContainer.innerHTML = ``;
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
            
            const formattedDateOriginal = order.data_entrega_original ? formatDate(order.data_entrega_original) : '-';
            const formattedDateEntrega = order.data_entrega ? formatDate(order.data_entrega) : '-';
            
            html += `
                <tr>
                    <td><strong>${order.ped_id || '-'}</strong></td>
                    <td>${order.numero_pedido || '-'}</td>
                    <td>${order.cod_cliente || '-'}</td>
                    <td>${formattedDateOriginal}</td>
                    <td>
                        <span style="color: ${isOt ? 'inherit' : 'var(--danger)'}">
                            ${formattedDateEntrega}
                        </span>
                    </td>
                    <td>${order.tipo_pedido || '-'}</td>
                    <td>${order.desc_tipo_movimento || '-'}</td>
                    <td>${parseFloat(order.volume_hectolitro || 0).toFixed(2)}</td>
                    <td>${order.situacao_item || '-'}</td>
                    <td>${order.situacao_atend_item || '-'}</td>
                    <td>${order.situacao_nf || '-'}</td>
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
    
    // --- 2. Aba HL: Rankings Volumétricos de Clientes (HL) ---
    if (state.activeTab === "hl") {
        const clientAgg = {};
        
        data.forEach(order => {
            const cli = order.cod_cliente || 'Desconhecido';
            const vol = parseFloat(order.volume_hectolitro) || 0;
            const volEntregue = isOrderIF(order) ? vol : 0;
            
            const otifVol = (isOrderOT(order) && isOrderIF(order)) ? volEntregue : 0;
            
            // Clientes
            if (!clientAgg[cli]) {
                clientAgg[cli] = { totalVol: 0, entregueVol: 0, otifVol: 0 };
            }
            clientAgg[cli].totalVol += vol;
            clientAgg[cli].entregueVol += volEntregue;
            clientAgg[cli].otifVol += otifVol;
        });
        
        if (DOM.rankingHlCarrierBody) DOM.rankingHlCarrierBody.innerHTML = "";
        
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
        if (DOM.rankingHlClientBody) DOM.rankingHlClientBody.innerHTML = htmlClient;
    }
    
    // --- 3. Aba SKU: Rankings de Tipo de Movimento ---
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
                    <td>
                        <span class="ranking-value ${isSuccess ? 'success' : 'danger'}">
                            ${s.otifPct.toFixed(1)}%
                        </span>
                    </td>
                </tr>
            `;
        });
        if (DOM.rankingSkuBody) DOM.rankingSkuBody.innerHTML = htmlSku;
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
        
        // Volumetria (HL)
        const vol = parseFloat(order.volume_hectolitro) || 0;
        weeklyData[label].volumePedido += vol;
        const volEntregue = isIf ? vol : 0;
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
        
        // Gráfico 1.3: Causa de Falhas nos PDVs
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
        
        // Gráfico 2.2: HL Delivered por Tipo de Movimento
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
    
    // --- RENDERING DA ABA 3: SKU ---
    if (state.activeTab === "sku") {
        // Agrupamento por Tipo de Movimento
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
        
        // Gráfico 3.1: Share de atendimento volumétrico / Grau de Atendimento (IF %)
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

// const supabaseUrl = 'https://eqvlivvaqnadasfchnzp.supabase.co';
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxdmxpdnZhcW5hZGFzZmNobnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDA4NDAsImV4cCI6MjA5ODk3Njg0MH0.szN2eZVtOi8-MVXgvgy_UZRJFA6L0UDpy_t0b9nsgKo';
// const banco = supabase.createClient(supabaseUrl, supabaseKey);

// VARIÁVEIS DE CONTROLE DA PAGINAÇÃO E FILTROS
let paginaAtual = 1;
const registrosPorPagina = 10;

// Estado global dos filtros e ordenação
let filtrosColunas = {};
let filtroDataInicio = '';
let filtroDataFim = '';
let ordenacaoAtual = { coluna: 'ped_id', ascendente: true }; // Ordenação padrão inicial

// Inicialização dos eventos assim que a página carregar
document.addEventListener('DOMContentLoaded', () => {
    inicializarEventosFiltros();
    inicializarEventosOrdenacao();
    inicializarEventosPaginacao();
    carregarPedidosReais(); // Primeira carga de dados
});

// 1. CAPTURA DOS FILTROS POR COLUNA E DATAS
function inicializarEventosFiltros() {
    // Inputs das colunas (Debounce de 400ms)
    let timeoutBusca;
    document.querySelectorAll('.filters-row input').forEach(input => {
        input.addEventListener('input', (e) => {
            clearTimeout(timeoutBusca);
            timeoutBusca = setTimeout(() => {
                const coluna = e.target.getAttribute('data-filter');
                const valor = e.target.value.trim();

                if (valor) {
                    filtrosColunas[coluna] = valor;
                } else {
                    delete filtrosColunas[coluna];
                }
                
                paginaAtual = 1;
                carregarPedidosReais();
            }, 400);
        });
    });

    // Inputs de data global (Mudamos para 'input' para garantir captura em qualquer navegador)
    const dateStart = document.getElementById('date-start');
    const dateEnd = document.getElementById('date-end');

    if (dateStart) {
        dateStart.addEventListener('input', (e) => {
            filtroDataInicio = e.target.value;
            console.log("📅 Data Início Capturada:", filtroDataInicio); // Verifique no F12
            paginaAtual = 1;
            carregarPedidosReais();
        });
    }

    if (dateEnd) {
        dateEnd.addEventListener('input', (e) => {
            filtroDataFim = e.target.value;
            console.log("📅 Data Fim Capturada:", filtroDataFim); // Verifique no F12
            paginaAtual = 1;
            carregarPedidosReais();
        });
    }

    // Botão Limpar Filtros
    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            if (dateStart) dateStart.value = '';
            if (dateEnd) dateEnd.value = '';
            document.querySelectorAll('.filters-row input').forEach(input => input.value = '');
            
            filtrosColunas = {};
            filtroDataInicio = '';
            filtroDataFim = '';
            ordenacaoAtual = { coluna: 'ped_id', ascendente: true };

            document.querySelectorAll('.sortable').forEach(h => h.classList.remove('asc', 'desc'));

            paginaAtual = 1;
            carregarPedidosReais();
        });
    }
}

// 2. CAPTURA DOS CLIQUES DE ORDENAÇÃO
function inicializarEventosOrdenacao() {
    document.querySelectorAll('.sortable').forEach(header => {
        header.addEventListener('click', () => {
            let coluna = header.getAttribute('data-sort');
            
            // Correção caso o nome do atributo HTML divirja da coluna do banco
            if (coluna === 'num_pedido') coluna = 'numero_pedido'; 

            let ascendente = true;

            if (ordenacaoAtual.coluna === coluna && ordenacaoAtual.ascendente === true) {
                ascendente = false;
            }

            ordenacaoAtual = { coluna, ascendente };

            // Atualiza classes visuais do CSS
            document.querySelectorAll('.sortable').forEach(h => h.classList.remove('asc', 'desc'));
            header.classList.add(ascendente ? 'asc' : 'desc');

            carregarPedidosReais();
        });
    });
}

// 3. EVENTOS DE PAGINAÇÃO SEPARADOS
function inicializarEventosPaginacao() {
    document.getElementById('btn-prev-page').addEventListener('click', () => {
        if (paginaAtual > 1) {
            paginaAtual--;
            carregarPedidosReais();
        }
    });

    document.getElementById('btn-next-page').addEventListener('click', () => {
        paginaAtual++;
        carregarPedidosReais();
    });
}

// 4. FUNÇÃO PRINCIPAL (CONSTRÓI A QUERY DINÂMICA DO SUPABASE)
async function carregarPedidosReais() {
    const tbody = document.getElementById('table-body');
    const infoTexto = document.getElementById('table-info');
    const indicator = document.getElementById('current-page-indicator');

    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Carregando pedidos...</td></tr>';

    const deOnde = (paginaAtual - 1) * registrosPorPagina;
    const ateOnde = deOnde + registrosPorPagina - 1;

    // Inicia a query base
    let query = banco
        .from('Pedidos')
        .select(`
            ped_id, 
            numero_pedido, 
            cod_cliente, 
            data_entrega_original, 
            data_entrega, 
            tipo_pedido, 
            desc_tipo_movimento, 
            volume_hectolitro, 
            situacao_item, 
            situacao_atend_item, 
            situacao_nf
        `, { count: 'exact' });

    // Injeta dinamicamente os filtros por coluna de texto aplicados
    // Injeta dinamicamente os filtros por coluna de texto ou número
    Object.keys(filtrosColunas).forEach(coluna => {
        let campoBanco = coluna;
        if (coluna === 'num_pedido') campoBanco = 'numero_pedido'; // Mapeamento correto

        const valor = filtrosColunas[coluna];
        
        // Lista de colunas que são NÚMEROS (bigint / integer) no seu banco de dados
        // Adicione aqui 'numero_pedido' ou 'cod_cliente' se eles também forem números puros no banco
        const colunasNumericas = ['ped_id', 'numero_pedido', 'cod_cliente'];

        if (colunasNumericas.includes(campoBanco)) {
            // Se for uma coluna numérica e o usuário digitou um número válido, usa .eq()
            if (!isNaN(valor) && valor.trim() !== '') {
                query = query.eq(campoBanco, parseInt(valor));
            } else {
                // Se o usuário digitou texto onde deveria ser número, forçamos um resultado vazio 
                // para não quebrar a query com erro de sintaxe do Postgres
                query = query.eq(campoBanco, -1); 
            }
        } else {
            // Se for texto de verdade (ex: tipo_pedido, situacao_nf), usa ilike normalmente
            query = query.ilike(campoBanco, `%${valor}%`);
        }
    });

    // Injeta filtros de Período de Datas (Baseado estritamente na Data Entrega Original)
    if (filtroDataInicio) {
        // gte = Greater Than or Equal (Maior ou igual à data de início)
        query = query.gte('data_entrega_original', filtroDataInicio); 
    }
    if (filtroDataFim) {
        // lte = Less Than or Equal (Menor ou igual à data de fim)
        query = query.lte('data_entrega_original', filtroDataFim); 
    }

    // Injeta a Ordenação ativa do sistema
    query = query.order(ordenacaoAtual.coluna, { ascending: ordenacaoAtual.ascendente });

    // Aplica o Range da paginação por fim
    const { data: pedidos, error, count } = await query.range(deOnde, ateOnde);

    if (error) {
        console.error('Erro ao buscar dados:', error.message);
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:red;">Erro: ${error.message}</td></tr>`;
        return;
    }

    if (!pedidos || pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">Nenhum pedido encontrado com os parâmetros informados.</td></tr>';
        infoTexto.innerText = `Exibindo 0 de 0 pedidos`;
        indicator.innerText = `1 de 1`;
        document.getElementById('btn-prev-page').disabled = true;
        document.getElementById('btn-next-page').disabled = true;
        return;
    }

    tbody.innerHTML = '';

    pedidos.forEach(pedido => {
        const linha = document.createElement('tr');
        linha.innerHTML = `
            <td><strong>${pedido.ped_id}</strong></td>
            <td>${pedido.numero_pedido || '-'}</td>
            <td>${pedido.cod_cliente || '-'}</td>
            <td>${formatarData(pedido.data_entrega_original)}</td>
            <td>${formatarData(pedido.data_entrega)}</td>
            <td>${pedido.tipo_pedido || '-'}</td>
            <td>${pedido.desc_tipo_movimento || '-'}</td>
            <td>${pedido.volume_hectolitro ? pedido.volume_hectolitro : '0'} HL</td>
            <td><span class="status-badge">${pedido.situacao_item || '-'}</span></td>
            <td>${pedido.situacao_atend_item || '-'}</td>
            <td>${pedido.situacao_nf || '-'}</td>
        `;
        tbody.appendChild(linha);
    });

    // ATUALIZA OS TEXTOS DO RODAPÉ DA TABELA
    const totalPaginas = Math.ceil(count / registrosPorPagina) || 1;
            
    infoTexto.innerText = `Exibindo ${deOnde + 1}-${deOnde + pedidos.length} de ${count} pedidos`;
    indicator.innerText = `${paginaAtual} de ${totalPaginas}`;

    document.getElementById('btn-prev-page').disabled = (paginaAtual === 1);
    document.getElementById('btn-next-page').disabled = (paginaAtual === totalPages);

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Garanta que a sua função formatarData(data) continue declarada no seu script externo

// CONFIGURAÇÃO DOS EVENTOS DE CLIQUE DOS BOTÕES
document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (paginaAtual > 1) {
        paginaAtual--;
        carregarPedidosReais();
    }
});

document.getElementById('btn-next-page').addEventListener('click', () => {
    paginaAtual++;
    carregarPedidosReais();
});

// Função auxiliar de tratamento de data
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

// Inicia o app carregando a primeira página
document.addEventListener('DOMContentLoaded', carregarPedidosReais);

// Variável global para controle dos dados
let dadosProntosParaEnviar = [];

// 1. FUNÇÃO DE LIMPEZA DO NOME DAS COLUNAS
function limparNomeColuna(nome) {
    if (!nome) return 'coluna_sem_nome';
    let novoNome = nome.toString().trim().toLowerCase();
    novoNome = novoNome.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    novoNome = novoNome.replace(/\s+/g, '_'); // Espaços para _
    novoNome = novoNome.replace(/[^a-z0-9_]/g, ''); // Remove caracteres especiais
    return novoNome;
}

document.getElementById('btn-importar').addEventListener('click', function() {
    document.getElementById('excel-file-input').click();
});

// 2. PROCESSO AUTOMÁTICO: SELECIONOU, PROCESSA E ENVIA DIRETO
document.getElementById('excel-file-input').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    const statusDiv = document.getElementById('import-status');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');
    
    // Pegamos o seu botão de estilo para poder desativá-lo durante o envio
    const btnVisual = document.getElementById('btn-importar');
    const inputArquivo = this;
    
    if (!file) return;

    // Desativa o botão visual e o input para evitar cliques duplos
    btnVisual.disabled = true;
    inputArquivo.disabled = true;

    // Exibe e reseta a barra de progresso
    progressContainer.style.display = "block";
    progressBar.style.width = "0%";
    progressBar.style.backgroundColor = "#24b47e"; 
    progressPercentage.innerText = "0%";
    statusDiv.innerText = "Conectando ao banco...";

    try {
        // --- PASSO A: BUSCAR COLUNAS EXISTENTES NO SUPABASE ---
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

        // --- PASSO B: LEITURA DO ARQUIVO ---
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

                // --- PASSO C: PROCESSAMENTO E FILTRO ---
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

                // --- PASSO D: ENVIO DIRETO EM LOTES ---
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

                // SUCESSO COLETIVO
                statusDiv.innerHTML = "🎉 Planilha importada com sucesso!";
                inputArquivo.value = ""; 
                
                // Libera o botão visual novamente
                btnVisual.disabled = false;
                inputArquivo.disabled = false;
                
                if (typeof carregarPedidosReais === "function") carregarPedidosReais();

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