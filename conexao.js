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
let cacheProdutos = null;
let totalMesesNoBanco = 0;
let mesUnico = null;

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

async function carregarProdutosCompletos() {
  const { count } = await banco.from('Produtos').select('codigo_produto', { count: 'exact', head: true });
  const total = count || 0;
  const pageSize = 1000;
  const all = [];
  for (let from = 0; from < total; from += pageSize) {
    const { data } = await banco.from('Produtos').select('codigo_produto, descricao_produto').range(from, from + pageSize - 1);
    if (data) all.push(...data);
  }
  return all;
}

async function obterDescricaoProduto(codigo) {
  if (!cacheProdutos) {
    const data = await carregarProdutosCompletos();
    cacheProdutos = {};
    (data || []).forEach(p => {
      cacheProdutos[p.codigo_produto] = p.descricao_produto || null;
    });
  }
  return cacheProdutos[codigo] || `Produto ${codigo}`;
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
  if (filtros.mes != null) {
    args.p_mes = filtros.mes;
    args.p_ano = filtros.ano;
  }
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
  if (filtros.dataInicio) q = q.gte('data_entrega', filtros.dataInicio);
  if (filtros.dataFim) q = q.lte('data_entrega', filtros.dataFim);

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

const TITULOS_RANKING_PRODUTO = {
  otif: 'Ranking de Impacto no OTIF por Produto',
  ot: 'Ranking de Impacto no OT por Produto',
  if: 'Ranking de Impacto no IF por Produto'
};

function mudarRankingProduto(indicador) {
  document.querySelectorAll('.ranking-produto-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.indicador === indicador);
  });
  document.getElementById('ranking-produto-title').textContent = TITULOS_RANKING_PRODUTO[indicador];
  carregarRankingProduto(indicador);
}

async function carregarRankingProduto(indicador) {
  indicador = indicador || 'otif';
  const args = buildFilterArgs();
  args.p_indicador = indicador;
  const rpcMap = { sku: 'ranking_produto_otif', hl: 'ranking_produto_hl', pdv: 'ranking_produto_pdv' };
  const { data, error } = await banco.rpc(rpcMap[modoVisualizacao], args);
  if (error) { console.error("Erro ao carregar ranking produto:", error); return; }

  const container = document.getElementById('rankingProdutos');

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">Nenhum dado de impacto encontrado</p>';
    return;
  }

  const nomes = [];
  for (const item of data) {
    nomes.push(await obterDescricaoProduto(item.cod_produto));
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
            <div style="font-size: 12px; color: var(--text-muted);">${item.cod_produto}</div>
          </div>
        </div>
        <span style="font-weight: 700; font-size: 16px; color: ${cor};">${item.impacto}%</span>
      </div>
    `;
  });

  container.innerHTML = html;
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
  if (!dataStr || typeof dataStr !== 'string') return null;
  const limpo = dataStr.trim();
  if (!limpo) return null;
  if (limpo.includes('/')) {
    const [dia, mes, ano] = limpo.split('/');
    if (!dia || !mes || !ano) return null;
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  if (limpo.includes('-')) {
    const [ano, mes, dia] = limpo.split('-');
    if (!ano || !mes || !dia) return null;
    return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  }
  return null;
}

function calculoONTIME(dataEntrega, dataOriginal) {
  const entrega = parseDataBR(dataEntrega);
  const original = parseDataBR(dataOriginal);
  if (!entrega || !original) return false;
  return entrega.getTime() <= original.getTime();
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
  if (isOt && !isIf) return "In Full";
  if (!isOt && isIf) return "On Time";
  return "FALHA";
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
    valoresOrdenados = ['OTIF', 'On Time', 'In Full', 'FALHA'];
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
  
  totalMesesNoBanco = meses.length;
  if (totalMesesNoBanco === 1) {
    mesUnico = meses[0];
  } else {
    mesUnico = null;
  }

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
    carregarRanking(),
    carregarRankingProduto(indicadorAtual)
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

function normalizarColuna(str) {
  return String(str || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
}

function showProgress(id) {
  const el = document.getElementById(id);
  el.classList.add('active');
  el.querySelector('.import-progress-bar').style.width = '0%';
  el.querySelector('.import-progress-text').textContent = '';
}
function updateProgress(id, current, total) {
  const el = document.getElementById(id);
  const pct = Math.round((current / total) * 100);
  el.querySelector('.import-progress-bar').style.width = pct + '%';
  el.querySelector('.import-progress-text').textContent = `${current}/${total}`;
}
function hideProgress(id) {
  const el = document.getElementById(id);
  el.classList.remove('active');
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
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) { alert('Planilha vazia.'); return; }

      const colunasPlanilhaAliases = {
        'codigo_produto': ['codigo_produto', 'cod_produto', 'produto', 'cod_prod', 'codigo', 'cod'],
        'descricao_produto': ['descricao_produto', 'descricao', 'desc_produto', 'nome_produto', 'desc'],
        'tipo_marca': ['tipo_marca', 'marca', 'tipo'],
        'embalagem': ['embalagem', 'emb']
      };
      const primeirasChaves = Object.keys(rows[0]);
      const colEncontradas = {};
      const usadas = new Set();

      for (const [colBanco, aliases] of Object.entries(colunasPlanilhaAliases)) {
        const found = primeirasChaves.find(k => {
          if (usadas.has(k)) return false;
          const norm = normalizarColuna(k);
          return aliases.includes(norm) || norm.includes(colBanco.replace(/_/g, ''));
        });
        if (found) { colEncontradas[found] = colBanco; usadas.add(found); }
      }

      if (Object.keys(colEncontradas).length === 0) {
        alert('Nenhuma coluna reconhecida.\nColunas na planilha: ' + primeirasChaves.join(', '));
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
      showProgress('progress-produtos');
      await banco.from('Produtos').delete().in('codigo_produto', codigos);

      const BATCH_P = 500;
      for (let i = 0; i < registros.length; i += BATCH_P) {
        const lote = registros.slice(i, i + BATCH_P);
        const { error } = await banco.from('Produtos').insert(lote);
        if (error) { hideProgress('progress-produtos'); console.error('Erro ao importar produtos:', error); alert('Erro: ' + error.message); return; }
        updateProgress('progress-produtos', Math.min(i + BATCH_P, registros.length), registros.length);
        if (i + BATCH_P < registros.length) await new Promise(r => setTimeout(r, 0));
      }
      hideProgress('progress-produtos');

      alert(`${registros.length} produtos importados com sucesso!`);
      cacheProdutos = null;
      fileInput.value = '';
    } catch (err) {
      console.error('Erro ao processar planilha:', err);
      alert('Erro ao processar a planilha:\n' + (err.message || err));
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
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rows.length === 0) { alert('Planilha vazia.'); return; }

      const colunasPlanilhaAliases = {
        'cod_cliente': ['cod_cliente', 'codigo_cliente', 'cliente', 'cod_cli', 'codigo', 'cod'],
        'razao_social': ['razao_social', 'razao', 'rzsocial'],
        'bairro': ['bairro'],
        'nome_fantasia': ['nome_fantasia', 'fantasia'],
        'cnpj': ['cnpj', 'cgc'],
        'nome_estabelecimento': ['nome_estabelecimento', 'estabelecimento', 'nome_estab'],
        'cidade': ['cidade']
      };
      const primeirasChaves = Object.keys(rows[0]);
      const colEncontradas = {};
      const usadas = new Set();

      for (const [colBanco, aliases] of Object.entries(colunasPlanilhaAliases)) {
        const found = primeirasChaves.find(k => {
          if (usadas.has(k)) return false;
          const norm = normalizarColuna(k);
          return aliases.includes(norm) || norm.includes(colBanco.replace(/_/g, ''));
        });
        if (found) { colEncontradas[found] = colBanco; usadas.add(found); }
      }

      if (Object.keys(colEncontradas).length === 0) {
        alert('Nenhuma coluna reconhecida.\nColunas na planilha: ' + primeirasChaves.join(', '));
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
      showProgress('progress-clientes');
      await banco.from('Clientes').delete().in('cod_cliente', codigos);

      const BATCH_C = 500;
      for (let i = 0; i < registros.length; i += BATCH_C) {
        const lote = registros.slice(i, i + BATCH_C);
        const { error } = await banco.from('Clientes').insert(lote);
        if (error) { hideProgress('progress-clientes'); console.error('Erro ao importar clientes:', error); alert('Erro: ' + error.message); return; }
        updateProgress('progress-clientes', Math.min(i + BATCH_C, registros.length), registros.length);
        if (i + BATCH_C < registros.length) await new Promise(r => setTimeout(r, 0));
      }
      hideProgress('progress-clientes');

      alert(`${registros.length} clientes importados com sucesso!`);
      cacheClientes = null;
      fileInput.value = '';
    } catch (err) {
      console.error('Erro ao processar planilha:', err);
      alert('Erro ao processar a planilha:\n' + (err.message || err));
    }
  };
  reader.readAsArrayBuffer(file);
}

async function limparBanco() {
  if (!confirm('Tem certeza que deseja excluir TODOS os dados do banco? Essa ação não pode ser desfeita.')) return;
  if (!confirm('Última chance: confirmar exclusão de todos os pedidos, produtos e clientes?')) return;

  const tabelas = [
    { nome: 'Pedidos', coluna: 'ped_id', tipo: 'bigint' },
    { nome: 'Produtos', coluna: 'codigo_produto', tipo: 'text' },
    { nome: 'Clientes', coluna: 'cli_id', tipo: 'bigint' }
  ];
  const erros = [];

  for (const { nome, coluna, tipo } of tabelas) {
    const { data, error: selErr } = await banco.from(nome).select(coluna).limit(1);
    if (selErr || !data || data.length === 0) continue;
    let query = banco.from(nome).delete();
    query = tipo === 'text' ? query.neq(coluna, '\0') : query.gte(coluna, 0);
    const { error } = await query;
    if (error) erros.push(`${nome}: ${error.message}`);
  }

  cacheClientes = null;
  cacheProdutos = null;

  if (erros.length > 0) {
    alert('Exclusão concluída com avisos:\n' + erros.join('\n'));
  } else {
    alert('Todos os dados foram excluídos com sucesso!');
  }

  carregarTudo();
}

async function importarExcel() {
  const fileInput = document.getElementById('excel-file-input');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });

      if (rows.length === 0) { alert('Planilha vazia.'); return; }

      const colunasPlanilhaAliases = {
        'numero_pedido': ['numero_pedido', 'n_pedido', 'pedido', 'numero'],
        'cod_cliente': ['cod_cliente', 'codigo_cliente', 'cliente', 'cod_cli'],
        'cod_produto': ['cod_produto', 'codigo_produto', 'produto', 'cod_prod'],
        'data_entrega_original': ['data_entrega_original', 'data_original', 'previsao_entrega', 'previsao'],
        'data_entrega': ['data_entrega', 'entrega', 'data_de_entrega', 'dt_entrega'],
        'tipo_pedido': ['tipo_pedido'],
        'desc_tipo_movimento': ['desc_tipo_movimento', 'descricao_tipo_movimento', 'tipo_movimento', 'movimento'],
        'volume_hectolitro': ['volume_hectolitro', 'volume_hl', 'hl', 'volume'],
        'situacao_item': ['situacao_item', 'status_item', 'sit_item'],
        'situacao_atend_item': ['situacao_atend_item', 'sit_atend_item', 'situacao_atendimento', 'status_atendimento'],
        'situacao_nf': ['situacao_nf', 'sit_nf', 'status_nf', 'situacao_da_nf', 'nota_fiscal']
      };

      const primeirasChaves = Object.keys(rows[0]);
      const colEncontradas = {};
      const usadas = new Set();

      for (const [colBanco, aliases] of Object.entries(colunasPlanilhaAliases)) {
        const found = primeirasChaves.find(k => {
          if (usadas.has(k)) return false;
          const norm = normalizarColuna(k);
          return aliases.includes(norm) || norm.includes(colBanco.replace(/_/g, ''));
        });
        if (found) { colEncontradas[found] = colBanco; usadas.add(found); }
      }

      if (Object.keys(colEncontradas).length === 0) {
        alert('Nenhuma coluna reconhecida.\nColunas na planilha: ' + primeirasChaves.join(', '));
        return;
      }

      const colEntries = Object.entries(colEncontradas);
      const registros = [];
      const CHUNK = 1000;
      for (let c = 0; c < rows.length; c += CHUNK) {
        const slice = rows.slice(c, c + CHUNK);
        for (const row of slice) {
          const obj = {
             numero_pedido: null,
             cod_cliente: null,
             data_entrega_original: null,
             data_entrega: null,
             tipo_pedido: null,
             desc_tipo_movimento: null,
             volume_hectolitro: null,
             situacao_item: null,
             situacao_atend_item: null,
             cod_produto: '',
             situacao_nf: ''
          };
          for (let j = 0; j < colEntries.length; j++) {
            const [colOriginal, colBanco] = colEntries[j];
            const val = row[colOriginal];
            if (val == null || val === '') continue;
            if (colBanco === 'numero_pedido' || colBanco === 'cod_cliente') {
              obj[colBanco] = parseInt(String(val).replace(/\D/g, ''), 10);
            } else {
              obj[colBanco] = String(val).trim();
            }
          }
          if (obj.numero_pedido != null && !isNaN(obj.numero_pedido)) registros.push(obj);
        }
        if (c + CHUNK < rows.length) await new Promise(r => setTimeout(r, 0));
      }

      if (registros.length === 0) { alert('Nenhum registro válido encontrado.'); return; }

      const BATCH = 500;
      showProgress('progress-pedidos');
      for (let i = 0; i < registros.length; i += BATCH) {
        const lote = registros.slice(i, i + BATCH);
        const { error } = await banco.from('Pedidos').insert(lote);
        if (error) { hideProgress('progress-pedidos'); console.error('Erro ao importar pedidos:', error); alert('Erro: ' + error.message); return; }
        updateProgress('progress-pedidos', Math.min(i + BATCH, registros.length), registros.length);
        if (i + BATCH < registros.length) await new Promise(r => setTimeout(r, 0));
      }
      hideProgress('progress-pedidos');

      alert(`${registros.length} pedidos importados com sucesso!`);
      cacheClientes = null;
      fileInput.value = '';
      carregarTudo();
    } catch (err) {
      console.error('Erro ao processar planilha:', err);
      alert('Erro ao processar a planilha:\n' + (err.message || err));
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
  document.getElementById("btn-limpar-banco").addEventListener("click", limparBanco);
  document.getElementById("btn-importar").addEventListener("click", () => {
    document.getElementById('excel-file-input').click();
  });
  document.getElementById("excel-file-input").addEventListener("change", importarExcel);

  document.getElementById("filter-month").addEventListener("change", onFiltroChange);
  document.getElementById("filter-start-date").addEventListener("change", onFiltroChange);
  document.getElementById("filter-end-date").addEventListener("change", onFiltroChange);
  document.getElementById("filter-cliente").addEventListener("change", onFiltroChange);

  carregarFiltros().then(() => carregarTudo());
});
