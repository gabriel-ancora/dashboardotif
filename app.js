// Carregar dados iniciais do Supabase com paginação para todos os registros
async function loadInitialData() {
    try {
        let allData = [];
        let page = 0;
        const pageSize = 5000; // Aumentado de 1000 para 5000
        let hasMore = true;

        console.log('📥 Iniciando carregamento de dados do Supabase...');

        while (hasMore) {
            const { data, error } = await banco
                .from('Pedidos')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;
            
            if (!data || data.length === 0) {
                hasMore = false;
            } else {
                allData = allData.concat(data);
                page++;
            }
        }

        state.orders = allData;
        console.log(`✅ Carregados ${state.orders.length} pedidos do banco`);
    } catch (error) {
        console.warn('⚠️ Erro ao carregar dados:', error.message);
        state.orders = [];
    }
    
    populateFilterDropdowns();
    updateDashboard();
}
