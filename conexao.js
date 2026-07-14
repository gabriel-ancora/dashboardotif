//Link com o banco de dados
const supabaseUrl = 'https://eqvlivvaqnadasfchnzp.supabase.co';
//Chave de acesso ao banco de dados
const supabaseKey = 'sb_publishable_3oBtpCUNfmUx2rAk3UYlLg_tcN_66JD';
//Conexão com o banco de dados
const banco = supabase.createClient(supabaseUrl, supabaseKey);

let paginaAtual = 1;
const itensPorPagina = 10;

// 🔹 Carregar dados
async function carregar() {
  mostrarLoading(true);

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina - 1;

  const { data, error } = await banco
    .from('Pedidos')
    .select('*')
    .range(inicio, fim);

  mostrarLoading(false);

  if (error) {
    console.error(error);
    return;
  }

  dadosCompletos = data;

  renderizarTabela(data);
}

// 🔹 Paginação
function proximaPagina() {
  paginaAtual++;
  carregar();
}
function paginaAnterior() {
  if (paginaAtual > 1) {
    paginaAtual--;
    carregar();
  }
}

async function carregarKPIs() {
  const { data, error } = await banco.rpc('kpis_otif');

  console.log("KPI:", data);

  if (error) {
    console.error(error);
    return;
  }

  if (!data) return;

  const total = data.total || 1;

  const ot = ((data.ot / total) * 100).toFixed(1);
  const ifs = ((data.if / total) * 100).toFixed(1);
  const otif = ((data.otif / total) * 100).toFixed(1);

  atualizarKPIs(otif, ot, ifs, data.total);
}

// 🔹 Eventos
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("btnProxima")
    .addEventListener("click", proximaPagina);

  document
    .getElementById("btnAnterior")
    .addEventListener("click", paginaAnterior);

  carregar();
  carregarKPIs();
  carregarGraficoOTIF();
  console.log("OTIF por mês:", data);
});

// 🔹 Loading
function mostrarLoading(ativo) {
  const el = document.getElementById("loading");
  if (el) {
    el.style.display = ativo ? "block" : "none";
  }
}

// 🔹 ON TIME
function calculoONTIME(dataEntrega, dataOriginal) {
  return new Date(dataEntrega) <= new Date(dataOriginal);
}

// 🔹 IN FULL
function calculoINFULL(item) {
  const nfValida =
    item.situacao_nf?.toLowerCase().trim() === "nota emitida" ||
    item.situacao_nf?.toLowerCase().trim() === "nota calculada";

  return (
    item.situacao_item?.toLowerCase().trim() === "entregue" &&
    item.situacao_atend_item?.toLowerCase().trim() === "atendido" &&
    nfValida
  );
}

// 🔹 OTIF
function calculoOTIF(item) {
  return (
    calculoONTIME(item.data_entrega, item.data_entrega_original) &&
    calculoINFULL(item)
  );
}

// 🔹 KPIs
function calcularKPIs(data) {
  const total = data.length || 1;

  const ot = data.filter(p =>
    calculoONTIME(p.data_entrega, p.data_entrega_original)
  ).length;

  const ifs = data.filter(p =>
    calculoINFULL(p)
  ).length;

  const otif = data.filter(p =>
    calculoOTIF(p)
  ).length;

  document.getElementById("kpi-total").innerText = total;
  document.getElementById("kpi-ot").innerText = ((ot / total) * 100).toFixed(1) + "%";
  document.getElementById("kpi-if").innerText = ((ifs / total) * 100).toFixed(1) + "%";
  document.getElementById("kpi-otif").innerText = ((otif / total) * 100).toFixed(1) + "%";
}

// 🔹 Atualizar KPIs
function atualizarKPIs(otif, ot, ifVal, total) {
  const elOtif = document.getElementById("kpi-otif");
  const elOt = document.getElementById("kpi-ot");
  const elIf = document.getElementById("kpi-if");
  const elTotal = document.getElementById("kpi-total");

  elOtif.innerText = `${otif}%`;
  elOt.innerText = `${ot}%`;
  elIf.innerText = `${ifVal}%`;
  elTotal.innerText = total;

  aplicarCor(elOtif, Number(otif));
  aplicarCor(elOt, Number(ot));
  aplicarCor(elIf, Number(ifVal));
}

// 🔹 Aplicar Cor
function aplicarCor(elemento, valor) {
  elemento.classList.remove("kpi-success", "kpi-warning", "kpi-danger");

  if (valor >= 95) {
    elemento.classList.add("kpi-success");
  } else if (valor >= 80) {
    elemento.classList.add("kpi-warning");
  } else {
    elemento.classList.add("kpi-danger");
  }
}

// 🔹 Carregar OTIF por mês
async function carregarGraficoOTIF() {
  const { data, error } = await banco.rpc('otif_por_mes');

  if (error) {
    console.error(error);
    return;
  }

  console.log("OTIF por mês:", data);

  montarGrafico(data);
}

// 🔹 Montar Gráfico
function montarGrafico(data) {
  const nomesMeses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  const labels = data.map(d => nomesMeses[d.mes - 1]);
  const valores = data.map(d => Number(d.percentual));

  renderGrafico(labels, valores);
}

// 🔹 Renderização do Gráfico
function renderGrafico(labels, valores) {
  const ctx = document.getElementById("graficoOtif");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "% OTIF",
        borderColor: "#6366f1",
        data: valores,
        tension: 0.3
      },
      {
        label: "% Meta OTIF",
        data: valores.map(() => 95),
        borderColor: "#10b981",
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3
      }
    ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: v => v + "%"
          }
        }
      }
    }
  });
}

// 🔹 Renderização
function renderizarTabela(data) {
  let html = "";

  if (!data || data.length === 0) {
    html = `
      <tr>
        <td colspan="15" style="text-align:center; padding:20px;">
          Nenhum pedido encontrado
        </td>
      </tr>
    `;
  } else {
    data.forEach(pedidos => {

      const isOt = calculoONTIME(
        pedidos.data_entrega,
        pedidos.data_entrega_original
      );

      const isIf = calculoINFULL(pedidos);
      const isOtif = isOt && isIf;

      // 🔹 Status OTIF
      let status = "";
      let classe = "";

      if (isOtif) {
        status = "OTIF";
        classe = "badge-success";
      } else if (isOt && !isIf) {
        status = "Apenas OT";
        classe = "badge-warning";
      } else if (!isOt && isIf) {
        status = "Apenas IF";
        classe = "badge-warning";
      } else {
        status = "Falha";
        classe = "badge-danger";
      }

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
          <td>
            <span class="badge ${classe}">
              ${status}
            </span>
          </td>
        </tr>
      `;
    });
  }

  document.getElementById("resultado").innerHTML = html;
}