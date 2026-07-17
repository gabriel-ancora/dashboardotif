const supabaseUrl = 'https://eqvlivvaqnadasfchnzp.supabase.co';
const supabaseKey = 'sb_publishable_3oBtpCUNfmUx2rAk3UYlLg_tcN_66JD';
const banco = supabase.createClient(supabaseUrl, supabaseKey);

let paginaAtual = 1;
const itensPorPagina = 10;
let totalRegistros = 0;

const TIPO_PEDIDO_FILTRO = 'ENTREGA';

const filtros = { mes: null, ano: null, dataInicio: null, dataFim: null, codCliente: null };

let chartOTIF = null;
let chartOT = null;
let chartIF = null;
let indicadorAtual = 'otif';
let filtrosColuna = {};
let modoVisualizacao = 'sku';
let cacheClientes = null;

const METAS = {
  sku: { otif: 93, ot: 97, if_: 98 },
  hl:  { otif: 91.01, ot: 95.06, if_: 98 },
  pdv: { otif: 95.05, ot: 97, if_: 98 }
};

function obterMeta(indicador) {
  const m = METAS[modoVisualizacao];
  if (indicador === 'otif') return m.otif;
  if (indicador === 'ot') return m.ot;
  return m.if_;
}

async function carregarClientesCompletos() {
  const { count } = await banco.from('Clientes').select('cli_id', { count: 'exact', head: true });
  const total = count || 0;
  const pageSize = 1000;
  const all = [];
  for (let from = 0; from < total; from += pageSize) {
    const { data } = await banco.from('Clientes').select('cod_cliente, nome_fantasia, razao_social').range(from, from + pageSize - 1);
    if (data) all.push(...data);
  }
  return all;
}

async function obterNomeCliente(codigo) {
  if (!cacheClientes) {
    const data = await carregarClientesCompletos();
    cacheClientes = {};
    (data || []).forEach(c => {
      const key = String(c.cod_cliente).replace(/\./g, '');
      cacheClientes[key] = c.nome_fantasia || c.razao_social || null;
    });
  }
  const key = String(codigo).replace(/\./g, '');
  return cacheClientes[key] || `Cliente ${codigo}`;
}

function atualizarTitulosGraficos() {
  const sufixoModo = modoVisualizacao === 'hl' ? 'HL' : modoVisualizacao === 'pdv' ? 'Visitas' : 'SKU';
  const periodo = isModoDiario() ? 'dia' : 'mês';
  const chartHeaders = document.querySelectorAll('#tab-panel-pdv .chart-header h2');
  if (chartHeaders[0]) chartHeaders[0].textContent = `% OTIF ${sufixoModo} por ${periodo}`;
  if (chartHeaders[1]) chartHeaders[1].textContent = `% OT por ${periodo}`;
  if (chartHeaders[2]) chartHeaders[2].textContent = `%IF por ${periodo}`;
}

function mudarAba(modo) {
  modoVisualizacao = modo;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === modo);
  });

  const titulos = { sku: 'Total de Linhas', hl: 'Total de HL', pdv: 'Total de Visitas' };
  document.getElementById('kpi-total-title').textContent = titulos[modo] || 'Total de Linhas';

  atualizarTitulosGraficos();
  carregarTudo();
}

function carregarSKU() { mudarAba('sku'); }
function carregarHL() { mudarAba('hl'); }
function carregarPDV() { mudarAba('pdv'); }

const NOMES_MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const NOMES_MESES_ABREV = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function isModoDiario() {
  return filtros.mes != null && filtros.ano != null;
}

function buildFilterArgs() {
  const args = {};
  if (filtros.mes != null) args.p_mes = filtros.mes;
  if (filtros.ano != null) args.p_ano = filtros.ano;
  if (filtros.dataInicio) args.p_data_inicio = filtros.dataInicio;
  if (filtros.dataFim) args.p_data_fim = filtros.dataFim;
  if (filtros.codCliente != null) args.p_cod_cliente = filtros.codCliente;
  return args;
}

function obterPeriodoLabel() {
  const parts = [];
  if (filtros.mes != null && filtros.ano != null) {
    parts.push(`${NOMES_MESES[filtros.mes]} ${filtros.ano}`);
  }
  if (filtros.dataInicio && filtros.dataFim) {
    parts.push(`${filtros.dataInicio} a ${filtros.dataFim}`);
  } else if (filtros.dataInicio) {
    parts.push(`a partir de ${filtros.dataInicio}`);
  } else if (filtros.dataFim) {
    parts.push(`até ${filtros.dataFim}`);
  }
  if (filtros.codCliente != null) {
    parts.push(`Cliente ${filtros.codCliente}`);
  }
  return parts.length > 0 ? parts.join(' | ') : 'Todos os períodos';
}

function montarFiltrosTabela() {
  let q = banco.from('Pedidos')
    .select('*', { count: 'exact' })
    .eq('tipo_pedido', TIPO_PEDIDO_FILTRO);

  if (filtros.codCliente != null) q = q.eq('cod_cliente', filtros.codCliente);
  if (filtros.dataInicio) q = q.gte('data_entrega_original', filtros.dataInicio);
  if (filtros.dataFim) q = q.lte('data_entrega_original', filtros.dataFim);

  for (const [col, valores] of Object.entries(filtrosColuna)) {
    if (col === '_status' || !valores || valores.length === 0) continue;
    q = q.in(col, valores);
  }

  return q;
}

async function carregar() {
  try {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina - 1;

    const { data, count, error } = await montarFiltrosTabela().range(inicio, fim);
    if (error) { console.error("Erro ao carregar tabela:", error); return; }
    totalRegistros = count || 0;

    let rows = data || [];

    if (filtrosColuna['_status'] && filtrosColuna['_status'].length > 0) {
      rows = rows.filter(r => filtrosColuna['_status'].includes(obterStatusOTIF(r)));
    }

    dadosFiltradosTabela = rows;
    renderizarTabela(rows);
    atualizarPaginacao();
    document.getElementById('periodo-label').textContent = obterPeriodoLabel();
  } catch (e) {
    console.error("Erro na função carregar:", e);
  }
}

function atualizarPaginacao() {
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / itensPorPagina));
  const pageInfo = document.getElementById('paginaInfo');
  const btnAnterior = document.getElementById('btnAnterior');
  const btnProxima = document.getElementById('btnProxima');

  pageInfo.textContent = `Página ${paginaAtual} de ${totalPaginas}`;
  btnAnterior.disabled = paginaAtual <= 1;
  btnProxima.disabled = paginaAtual >= totalPaginas;
}

function proximaPagina() {
  const totalPaginas = Math.ceil(totalRegistros / itensPorPagina);
  if (paginaAtual < totalPaginas) { paginaAtual++; carregar(); }
}

function paginaAnterior() {
  if (paginaAtual > 1) { paginaAtual--; carregar(); }
}

async function carregarKPIs() {
  const args = buildFilterArgs();
  const rpcMap = { sku: 'kpis_otif', hl: 'kpis_hl', pdv: 'kpis_pdv' };
  const { data, error } = await banco.rpc(rpcMap[modoVisualizacao], args);
  if (error) { console.error(error); return; }
  if (!data) return;

  const row = Array.isArray(data) ? data[0] : data;

  if (modoVisualizacao === 'hl') {
    const total = Number(row.total) || 1;
    const ot = ((Number(row.ot) / total) * 100).toFixed(1);
    const ifs = ((Number(row.in_full) / total) * 100).toFixed(1);
    const otif = ((Number(row.otif) / total) * 100).toFixed(1);
    atualizarKPIs(otif, ot, ifs, Number(row.total).toFixed(1), Number(row.ot).toFixed(1), Number(row.otif).toFixed(1), Number(row.in_full).toFixed(1), 'HL');
  } else {
    const total = row.total || 1;
    const ot = ((row.ot / total) * 100).toFixed(1);
    const ifs = ((row.in_full / total) * 100).toFixed(1);
    const otif = ((row.otif / total) * 100).toFixed(1);
    const unidade = modoVisualizacao === 'pdv' ? 'visitas' : 'pedidos';
    atualizarKPIs(otif, ot, ifs, row.total, row.ot, row.otif, row.in_full, unidade);
  }
}

async function carregarGraficoOTIF() {
  const args = buildFilterArgs();
  const diario = isModoDiario();
  const sufixoMap = { sku: '', hl: '_hl', pdv: '_pdv' };
  const sufixo = sufixoMap[modoVisualizacao];
  const rpcName = diario ? `otif_por_dia${sufixo}` : `otif_por_mes${sufixo}`;
  const { data, error } = await banco.rpc(rpcName, args);
  if (error) { console.error(error); return; }
  if (diario) {
    const labels = data.map(d => `${d.dia}`);
    const valores = data.map(d => Number(d.percentual));
    renderGraficoOTIF(labels, valores);
  } else {
    montarGraficoOTIF(data);
  }
}

async function carregarGraficoOT() {
  const args = buildFilterArgs();
  const diario = isModoDiario();
  const sufixoMap = { sku: '', hl: '_hl', pdv: '_pdv' };
  const sufixo = sufixoMap[modoVisualizacao];
  const rpcName = diario ? `ot_por_dia${sufixo}` : `ot_por_mes${sufixo}`;
  const { data, error } = await banco.rpc(rpcName, args);
  if (error) { console.error("Erro ao carregar OT:", error); return; }
  if (!data || data.length === 0) { console.warn("Nenhum dado OT retornado"); return; }

  if (diario) {
    const labels = data.map(d => `${d.dia}`);
    const valores = data.map(d => Number(d.percentual));
    renderGraficoOT(labels, valores);
    return;
  }

  const dadosFiltrados = data.filter(d => {
    const total = Number(d.total);
    const percentual = Number(d.percentual);
    return total > 0 && !isNaN(percentual) && percentual > 0;
  });

  const labels = dadosFiltrados.map(d => NOMES_MESES_ABREV[d.mes - 1]);
  const valores = dadosFiltrados.map(d => Number(d.percentual));

  renderGraficoOT(labels, valores);
}

async function carregarGraficoIF() {
  const args = buildFilterArgs();
  const diario = isModoDiario();
  const sufixoMap = { sku: '', hl: '_hl', pdv: '_pdv' };
  const sufixo = sufixoMap[modoVisualizacao];
  const rpcName = diario ? `if_por_dia${sufixo}` : `if_por_mes${sufixo}`;
  const { data, error } = await banco.rpc(rpcName, args);
  if (error) { console.error("Erro ao carregar IF:", error); return; }
  if (!data || data.length === 0) { console.warn("Nenhum dado IF retornado"); return; }

  if (diario) {
    const labels = data.map(d => `${d.dia}`);
    const valores = data.map(d => Number(d.percentual));
    renderGraficoIF(labels, valores);
    return;
  }

  const dadosFiltrados = data.filter(d => {
    const total = Number(d.total);
    const percentual = Number(d.percentual);
    return total > 0 && !isNaN(percentual) && percentual > 0;
  });

  const labels = dadosFiltrados.map(d => NOMES_MESES_ABREV[d.mes - 1]);
  const valores = dadosFiltrados.map(d => Number(d.percentual));

  renderGraficoIF(labels, valores);
}

function montarGraficoOTIF(data) {
  const dadosFiltrados = data.filter(d => d.total > 0 && d.percentual != null);
  const labels = dadosFiltrados.map(d => NOMES_MESES_ABREV[d.mes - 1]);
  const valores = dadosFiltrados.map(d => Number(d.percentual));

  renderGraficoOTIF(labels, valores);
}

async function carregarRanking() {
  const args = buildFilterArgs();
  args.p_indicador = indicadorAtual;
  const rpcMap = { sku: 'ranking_impacto_otif', hl: 'ranking_impacto_hl', pdv: 'ranking_impacto_pdv' };
  const { data, error } = await banco.rpc(rpcMap[modoVisualizacao], args);
  if (error) { console.error("Erro ao carregar ranking:", error); return; }

  const container = document.getElementById('rankingClientes');

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Nenhum dado de impacto encontrado</p>';
    return;
  }

  const nomes = [];
  for (const item of data) {
    nomes.push(await obterNomeCliente(item.cod_cliente));
  }

  let html = '';
  data.forEach((item, index) => {
    const impacto = Number(item.impacto);
    const cor = impacto >= 3 ? 'var(--danger)' : impacto >= 2 ? 'var(--warning)' : 'var(--success)';
    const bgCor = impacto >= 3 ? 'var(--danger-light)' : impacto >= 2 ? 'var(--warning-light)' : 'var(--success-light)';

    html += `
      <div class="ranking-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border-color);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 28px; height: 28px; border-radius: 50%; background: ${bgCor}; color: ${cor}; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;">${index + 1}</span>
          <div>
            <div style="font-weight: 600; font-size: 14px; color: var(--text-primary);">${nomes[index]}</div>
          </div>
        </div>
        <span style="font-weight: 700; font-size: 16px; color: ${cor};">${item.impacto}%</span>
      </div>
    `;
  });

  container.innerHTML = html;
}

const TITULOS_RANKING = {
  otif: 'Ranking de Impacto no OTIF por Cliente',
  ot: 'Ranking de Impacto no OT por Cliente',
  if: 'Ranking de Impacto no IF por Cliente'
};

function mudarRanking(indicador) {
  indicadorAtual = indicador;

  document.querySelectorAll('.ranking-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.indicador === indicador);
  });

  document.getElementById('ranking-title').textContent = TITULOS_RANKING[indicador];

  carregarRanking();
}

function renderGraficoOTIF(labels, valores) {
  const ctx = document.getElementById("graficoOtif");
  if (chartOTIF) chartOTIF.destroy();

  chartOTIF = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "% OTIF",
        borderColor: "#6366f1",
        data: valores,
        tension: 0.3,
        fill: true,
        backgroundColor: "#6366f133",
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointStyle: "circle",
        pointBackgroundColor: "#6366f1",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "% Meta OTIF",
        data: valores.map(() => obterMeta('otif')),
        borderColor: "#10b981",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: false, ticks: { callback: v => v + "%" } } }
    }
  });
}

function renderGraficoOT(labels, valores) {
  const ctx = document.getElementById("graficoOt");
  if (chartOT) chartOT.destroy();

  chartOT = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "% OT",
        borderColor: "#ef4444",
        data: valores,
        tension: 0.3,
        fill: true,
        backgroundColor: "#ef444433",
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointStyle: "circle",
        pointBackgroundColor: "#ef4444",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "% Meta OT",
        data: valores.map(() => obterMeta('ot')),
        borderColor: "#10b981",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: false, ticks: { callback: v => v + "%" } } }
    }
  });
}

function renderGraficoIF(labels, valores) {
  const ctx = document.getElementById("graficoIf");
  if (chartIF) chartIF.destroy();

  chartIF = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "% IF",
        borderColor: "#f59e0b",
        data: valores,
        tension: 0.3,
        fill: true,
        backgroundColor: "#f59e0b33",
        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointStyle: "circle",
        pointBackgroundColor: "#f59e0b",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
      },
      {
        label: "% Meta IF",
        data: valores.map(() => obterMeta('if_')),
        borderColor: "#10b981",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: false, ticks: { callback: v => v + "%" } } }
    }
  });
}

function parseDataBR(dataStr) {
  if (!dataStr) return null;
  const [dia, mes, ano] = dataStr.split('/');
  return new Date(`${ano}-${mes}-${dia}`);
}

function calculoONTIME(dataEntrega, dataOriginal) {
  const entrega = parseDataBR(dataEntrega);
  const original = parseDataBR(dataOriginal);
  if (!entrega || !original) return false;
  return entrega <= original;
}

function calculoINFULL(item) {
  return (
    item.situacao_item?.toLowerCase().trim() === "entregue" &&
    item.situacao_atend_item?.toLowerCase().trim() === "atendido"
  );
}

function calculoOTIF(item) {
  return calculoONTIME(item.data_entrega, item.data_entrega_original) && calculoINFULL(item);
}

function atualizarKPIs(otif, ot, ifVal, total, otCount, otifCount, ifCount, unidade) {
  const label = unidade || 'pedidos';
  document.getElementById("kpi-otif").innerText = `${otif}%`;
  document.getElementById("kpi-ot").innerText = `${ot}%`;
  document.getElementById("kpi-if").innerText = `${ifVal}%`;
  document.getElementById("kpi-total").innerText = total;

  document.getElementById("kpi-otif-count").innerText = `${otifCount || 0} ${label}`;
  document.getElementById("kpi-ot-count").innerText = `${otCount || 0} ${label}`;
  document.getElementById("kpi-if-count").innerText = `${ifCount || 0} ${label}`;

  document.getElementById("kpi-otif-meta").innerHTML = `<i data-lucide="target" style="width:14px;height:14px;"></i> Meta: ${obterMeta('otif')}%`;
  document.getElementById("kpi-ot-meta").innerHTML = `<i data-lucide="target" style="width:14px;height:14px;"></i> Meta: ${obterMeta('ot')}%`;
  document.getElementById("kpi-if-meta").innerHTML = `<i data-lucide="target" style="width:14px;height:14px;"></i> Meta: ${obterMeta('if_')}%`;
  lucide.createIcons();

  const progressOtif = document.querySelector('#kpi-card-otif .progress');
  const progressOt = document.querySelector('#kpi-card-ot .progress');
  const progressIf = document.querySelector('#kpi-card-if .progress');

  if (progressOtif) progressOtif.style.strokeDashoffset = 100 - parseFloat(otif);
  if (progressOt) progressOt.style.strokeDashoffset = 100 - parseFloat(ot);
  if (progressIf) progressIf.style.strokeDashoffset = 100 - parseFloat(ifVal);
}

function obterStatusOTIF(pedidos) {
  const isOt = calculoONTIME(pedidos.data_entrega, pedidos.data_entrega_original);
  const isIf = calculoINFULL(pedidos);
  if (isOt && isIf) return "OTIF";
  if (!isOt && isIf) return "On Time";
  if (isOt && !isIf) return "In Full";
  return "On Time";
}

function renderizarTabela(data) {
  let html = "";

  if (!data || data.length === 0) {
    html = `<tr><td colspan="9" style="text-align:center; padding:20px;">Nenhum pedido encontrado</td></tr>`;
  } else {
    data.forEach(pedidos => {
      const status = obterStatusOTIF(pedidos);
      const classe = status === "OTIF" ? "badge-success" : "badge-danger";

      html += `
        <tr>
          <td>${pedidos.ped_id}</td>
          <td>${pedidos.numero_pedido}</td>
          <td>${pedidos.cod_cliente}</td>
          <td>${pedidos.data_entrega_original}</td>
          <td>${pedidos.data_entrega}</td>
          <td>${pedidos.tipo_pedido}</td>
          <td>${pedidos.desc_tipo_movimento}</td>
          <td>${pedidos.volume_hectolitro}</td>
          <td><span class="badge ${classe}">${status}</span></td>
        </tr>
      `;
    });
  }

  document.getElementById("resultado").innerHTML = html;
}

let colunaFiltroAberta = null;

async function toggleFiltroColuna(event, coluna) {
  event.stopPropagation();
  const dropdown = document.getElementById('coluna-filtro-dropdown');

  if (colunaFiltroAberta === coluna) {
    dropdown.style.display = 'none';
    colunaFiltroAberta = null;
    return;
  }

  colunaFiltroAberta = coluna;

  let valoresOrdenados = [];

  if (coluna === '_status') {
    valoresOrdenados = ['OTIF', 'On Time', 'In Full'];
  } else {
    const { data } = await banco.rpc('valores_coluna', { p_coluna: coluna });
    valoresOrdenados = (data || []).map(r => r.valor).filter(Boolean).sort((a, b) => {
      const na = Number(a), nb = Number(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }

  const selecionados = filtrosColuna[coluna] || valoresOrdenados.slice();

  let html = `
    <div class="coluna-filtro-busca">
      <input type="text" id="filtroBuscaInput" placeholder="Buscar..." oninput="filtrarOpcoesDropdown()">
    </div>
    <div class="coluna-filtro-lista" id="filtroLista">
      <label class="coluna-filtro-item">
        <input type="checkbox" checked onchange="toggleTodosFiltro(this)"> <strong>(Selecionar todos)</strong>
      </label>
  `;

  valoresOrdenados.forEach(v => {
    const checked = selecionados.includes(v) ? 'checked' : '';
    html += `
      <label class="coluna-filtro-item">
        <input type="checkbox" value="${v}" ${checked}> ${v}
      </label>
    `;
  });

  html += `
    </div>
    <div class="coluna-filtro-acoes">
      <button class="btn-filtro-aplicar" onclick="aplicarFiltroColuna('${coluna}')">Aplicar</button>
      <button onclick="fecharFiltroColuna()">Cancelar</button>
    </div>
  `;

  dropdown.innerHTML = html;

  const th = event.currentTarget.closest('th');
  const rect = th.getBoundingClientRect();
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 2) + 'px';
  dropdown.style.display = 'flex';

  setTimeout(() => {
    document.getElementById('filtroBuscaInput').focus();
  }, 10);
}

function filtrarOpcoesDropdown() {
  const busca = document.getElementById('filtroBuscaInput').value.toLowerCase();
  const itens = document.querySelectorAll('#filtroLista .coluna-filtro-item');
  itens.forEach((item, i) => {
    if (i === 0) return;
    const texto = item.textContent.toLowerCase();
    item.style.display = texto.includes(busca) ? '' : 'none';
  });
}

function toggleTodosFiltro(checkbox) {
  const itens = document.querySelectorAll('#filtroLista .coluna-filtro-item input[type="checkbox"]');
  itens.forEach(cb => { cb.checked = checkbox.checked; });
}

function aplicarFiltroColuna(coluna) {
  const checkboxes = document.querySelectorAll('#filtroLista .coluna-filtro-item input[type="checkbox"]');
  const todos = [];
  const selecionados = [];
  checkboxes.forEach((cb, i) => {
    if (i === 0) return;
    todos.push(cb.value);
    if (cb.checked) selecionados.push(cb.value);
  });

  if (selecionados.length === todos.length || selecionados.length === 0) {
    delete filtrosColuna[coluna];
  } else {
    filtrosColuna[coluna] = selecionados;
  }

  document.getElementById('coluna-filtro-dropdown').style.display = 'none';
  colunaFiltroAberta = null;

  paginaAtual = 1;
  carregar();
}

function fecharFiltroColuna() {
  document.getElementById('coluna-filtro-dropdown').style.display = 'none';
  colunaFiltroAberta = null;
}

function atualizarIconesFiltro() {
  document.querySelectorAll('.filter-icon').forEach(icon => {
    const col = icon.dataset.col;
    icon.classList.toggle('active', !!filtrosColuna[col]);
  });
}

document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('coluna-filtro-dropdown');
  if (!dropdown || dropdown.style.display === 'none') return;
  if (!dropdown.contains(e.target) && !e.target.classList.contains('filter-icon')) {
    dropdown.style.display = 'none';
    colunaFiltroAberta = null;
  }
});

async function carregarFiltros() {
  const [mesesRes, clientesRes] = await Promise.all([
    banco.rpc('meses_disponiveis'),
    banco.rpc('clientes_disponiveis')
  ]);

  const meses = mesesRes.data || [];
  const clientes = clientesRes.data || [];

  const mesSelect = document.getElementById('filter-month');
  mesSelect.innerHTML = '<option value="">Todos os meses</option>';
  meses.forEach(({ mes, ano }) => {
    const option = document.createElement('option');
    option.value = `${ano}-${String(mes).padStart(2, '0')}`;
    option.textContent = `${NOMES_MESES[mes]} ${ano}`;
    mesSelect.appendChild(option);
  });

  const clienteSelect = document.getElementById('filter-cliente');
  clienteSelect.innerHTML = '<option value="">Todos os clientes</option>';
  clientes.forEach(({ cod_cliente }) => {
    const option = document.createElement('option');
    option.value = cod_cliente;
    option.textContent = `Cliente ${cod_cliente}`;
    clienteSelect.appendChild(option);
  });
}

async function carregarTudo() {
  paginaAtual = 1;
  await Promise.all([
    carregar(),
    carregarKPIs(),
    carregarGraficoOTIF(),
    carregarGraficoOT(),
    carregarGraficoIF(),
    carregarRanking()
  ]);
}

function onFiltroChange() {
  const mesVal = document.getElementById('filter-month').value;
  const dataInicio = document.getElementById('filter-start-date').value;
  const dataFim = document.getElementById('filter-end-date').value;
  const clienteVal = document.getElementById('filter-cliente').value;

  if (mesVal) {
    const [ano, mes] = mesVal.split('-');
    filtros.mes = parseInt(mes);
    filtros.ano = parseInt(ano);
  } else {
    filtros.mes = null;
    filtros.ano = null;
  }

  if (dataInicio) {
    const [a, m, d] = dataInicio.split('-');
    filtros.dataInicio = `${d}/${m}/${a}`;
  } else {
    filtros.dataInicio = null;
  }

  if (dataFim) {
    const [a, m, d] = dataFim.split('-');
    filtros.dataFim = `${d}/${m}/${a}`;
  } else {
    filtros.dataFim = null;
  }

  filtros.codCliente = clienteVal ? parseInt(clienteVal) : null;

  atualizarTitulosGraficos();
  carregarTudo();
}

function limparFiltros() {
  document.getElementById('filter-month').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('filter-cliente').value = '';

  filtros.mes = null;
  filtros.ano = null;
  filtros.dataInicio = null;
  filtros.dataFim = null;
  filtros.codCliente = null;

  atualizarTitulosGraficos();
  carregarTudo();
}

function sanitizarParaBanco(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
}

function normalizarTexto(str) {
  return String(str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
}

async function importarProdutos() {
  const fileInput = document.getElementById('produto-file-input');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) { alert('Planilha vazia.'); return; }

      const colunasPlanilha = { 'codigo': 'codigo_produto', 'descricao': 'descricao_produto', 'tipo marca': 'tipo_marca', 'embalagem': 'embalagem' };
      const primeirasChaves = Object.keys(rows[0]);
      const colEncontradas = {};

      console.log('Colunas encontradas na planilha:', primeirasChaves);

      for (const [colPlanilha, colBanco] of Object.entries(colunasPlanilha)) {
        const found = primeirasChaves.find(k => normalizarTexto(k) === colPlanilha);
        if (found) colEncontradas[found] = colBanco;
      }

      console.log('Colunas mapeadas:', colEncontradas);

      if (Object.keys(colEncontradas).length === 0) {
        alert('Nenhuma coluna reconhecida.\nColunas na planilha: ' + primeirasChaves.join(', ') + '\nColunas esperadas: Código, Descrição, Tipo marca, Embalagem');
        return;
      }

      const registros = rows.map(row => {
        const obj = {};
        for (const [colOriginal, colBanco] of Object.entries(colEncontradas)) {
          obj[colBanco] = row[colOriginal] != null ? String(row[colOriginal]).trim() : null;
        }
        return obj;
      }).filter(r => r.codigo_produto);

      if (registros.length === 0) { alert('Nenhum registro válido encontrado.'); return; }

      const codigos = registros.map(r => r.codigo_produto);
      await banco.from('Produtos').delete().in('codigo_produto', codigos);

      const { error } = await banco.from('Produtos').insert(registros);
      if (error) { console.error('Erro ao importar produtos:', error); alert('Erro: ' + error.message); return; }

      alert(`${registros.length} produtos importados com sucesso!`);
      fileInput.value = '';
    } catch (err) {
      console.error('Erro ao processar planilha:', err);
      alert('Erro ao processar a planilha.');
    }
  };
  reader.readAsArrayBuffer(file);
}

async function importarClientes() {
  const fileInput = document.getElementById('cliente-file-input');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) { alert('Planilha vazia.'); return; }

      const colunasPlanilha = {
        'codigo cliente': 'cod_cliente',
        'razao social': 'razao_social',
        'bairro': 'bairro',
        'nome fantasia': 'nome_fantasia',
        'cnpj': 'cnpj',
        'nome estabelecimento': 'nome_estabelecimento',
        'cidade': 'cidade'
      };
      const primeirasChaves = Object.keys(rows[0]);
      const colEncontradas = {};

      for (const [colPlanilha, colBanco] of Object.entries(colunasPlanilha)) {
        const found = primeirasChaves.find(k => normalizarTexto(k) === colPlanilha);
        if (found) colEncontradas[found] = colBanco;
      }

      if (Object.keys(colEncontradas).length === 0) {
        alert('Nenhuma coluna reconhecida.\nColunas na planilha: ' + primeirasChaves.join(', ') + '\nColunas esperadas: Código Cliente, Razão Social, Bairro, Nome Fantasia, CNPJ, Nome Estabelecimento, Cidade');
        return;
      }

      const registros = rows.map(row => {
        const obj = {};
        for (const [colOriginal, colBanco] of Object.entries(colEncontradas)) {
          let val = row[colOriginal] != null ? String(row[colOriginal]).trim() : null;
          if (colBanco === 'cod_cliente' && val) val = parseInt(val.replace(/\./g, ''), 10);
          obj[colBanco] = val;
        }
        return obj;
      }).filter(r => r.cod_cliente);

      if (registros.length === 0) { alert('Nenhum registro válido encontrado.'); return; }

      const codigos = registros.map(r => r.cod_cliente);
      await banco.from('Clientes').delete().in('cod_cliente', codigos);

      const { error } = await banco.from('Clientes').insert(registros);
      if (error) { console.error('Erro ao importar clientes:', error); alert('Erro: ' + error.message); return; }

      alert(`${registros.length} clientes importados com sucesso!`);
      cacheClientes = null;
      fileInput.value = '';
    } catch (err) {
      console.error('Erro ao processar planilha:', err);
      alert('Erro ao processar a planilha.');
    }
  };
  reader.readAsArrayBuffer(file);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnProxima").addEventListener("click", proximaPagina);
  document.getElementById("btnAnterior").addEventListener("click", paginaAnterior);
  document.getElementById("btn-clear-filters").addEventListener("click", limparFiltros);
  document.getElementById("btn-importar-produtos").addEventListener("click", () => {
    document.getElementById('produto-file-input').click();
  });
  document.getElementById("produto-file-input").addEventListener("change", importarProdutos);
  document.getElementById("btn-importar-clientes").addEventListener("click", () => {
    document.getElementById('cliente-file-input').click();
  });
  document.getElementById("cliente-file-input").addEventListener("change", importarClientes);

  document.getElementById("filter-month").addEventListener("change", onFiltroChange);
  document.getElementById("filter-start-date").addEventListener("change", onFiltroChange);
  document.getElementById("filter-end-date").addEventListener("change", onFiltroChange);
  document.getElementById("filter-cliente").addEventListener("change", onFiltroChange);

  carregarFiltros().then(() => carregarTudo());
});
