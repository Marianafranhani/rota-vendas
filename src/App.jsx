import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapPin, Users, Calendar, Upload, Phone, Search, ChevronRight, TrendingUp, Clock, CheckCircle2, X, Download, Map, BarChart3, Navigation, Star, AlertCircle, FileText, ChevronLeft, Sparkles, CalendarDays, Settings, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as db from './supabase';

const INITIAL_DATA = [];

const CITY_COLORS = {
  'Diadema': { bg: '#E6F1FB', text: '#0C447C', dot: '#378ADD' },
  'São Bernardo do Campo': { bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' },
  'São Caetano do Sul': { bg: '#FAECE7', text: '#712B13', dot: '#D85A30' },
  'São Paulo': { bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD' },
  'Santo André': { bg: '#FBEAF0', text: '#72243E', dot: '#D4537E' },
  '': { bg: '#F1EFE8', text: '#444441', dot: '#888780' }
};

const CAT_STYLES = {
  'A': { bg: '#EAF3DE', text: '#27500A', border: '#639922', label: 'Grande', curto: 'G' },
  'B': { bg: '#FAEEDA', text: '#633806', border: '#BA7517', label: 'Médio', curto: 'M' },
  'C': { bg: '#FCEBEB', text: '#791F1F', border: '#E24B4A', label: 'Pequeno', curto: 'P' }
};

function parseAddress(addr) {
  if (!addr) return { rua: '', bairro: '', cidade: '', cep: '' };
  const s = String(addr);
  const cepM = s.match(/(\d{5}-?\d{3})/);
  const cep = cepM ? cepM[1] : '';
  const m1 = s.match(/-\s*([^,-]+),\s*([^-]+?)\s*-\s*[A-Z]{2}/);
  const m2 = s.match(/-\s*([A-Z][^,]+),\s*[A-Z]{2}\s*,/);
  const m3 = s.match(/^([^,]+),\s*([^-]+?)\s*-\s*[A-Z]{2}/);
  let bairro = '', cidade = '';
  if (m1) { bairro = m1[1].trim(); cidade = m1[2].trim(); }
  else if (m2) { cidade = m2[1].trim(); }
  else if (m3) { bairro = m3[1].trim(); cidade = m3[2].trim(); }
  const ruaM = s.match(/^([^-]+)/);
  const rua = ruaM ? ruaM[1].trim() : '';
  return { rua, bairro, cidade, cep };
}

function categorizar(t) {
  if (!t) return 'C';
  const s = String(t).toLowerCase();
  if (/interessad|mandou os dados|cadastro|compra |oportunidade|solicitou|campanha/.test(s)) return 'A';
  if (/aguardando|enviado o cat|balconista|apresenta/.test(s)) return 'B';
  return 'C';
}

// Retorna número da semana ISO e ano
function semanaDoAno(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { ano: d.getUTCFullYear(), semana: weekNum };
}

function formatarSemana(ano, semana) {
  // Primeiro dia da semana ISO
  const simple = new Date(ano, 0, 1 + (semana - 1) * 7);
  const dow = simple.getDay();
  const segunda = new Date(simple);
  if (dow <= 4) segunda.setDate(simple.getDate() - simple.getDay() + 1);
  else segunda.setDate(simple.getDate() + 8 - simple.getDay());
  const sexta = new Date(segunda);
  sexta.setDate(segunda.getDate() + 4);
  const fmt = (d) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
  return `${fmt(segunda)} – ${fmt(sexta)}`;
}

export default function App() {
  const [autenticado, setAutenticado] = useState(() => {
    // Verifica no navegador se já está autenticado (expira em 30 dias)
    try {
      const dados = localStorage.getItem('rota_auth');
      if (!dados) return false;
      const { expira } = JSON.parse(dados);
      if (Date.now() > expira) {
        localStorage.removeItem('rota_auth');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  const handleLogin = (senha) => {
    const senhaCorreta = import.meta.env.VITE_APP_PASSWORD || '17195477';
    if (senha === senhaCorreta) {
      const trintaDias = 30 * 24 * 60 * 60 * 1000;
      localStorage.setItem('rota_auth', JSON.stringify({ expira: Date.now() + trintaDias }));
      setAutenticado(true);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem('rota_auth');
    setAutenticado(false);
  };

  if (!autenticado) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <AppInterno onLogout={handleLogout} />;
}

function AppInterno({ onLogout }) {
  const [view, setView] = useState('dashboard');
  const [clientes, setClientes] = useState(INITIAL_DATA);
  const [visitas, setVisitas] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(''); // 'saving' | 'saved' | 'error'

  // Carregar dados do Supabase na montagem
  useEffect(() => {
    async function loadData() {
      try {
        const [cli, vis, ag] = await Promise.all([
          db.carregarClientes(),
          db.carregarVisitas(),
          db.carregarAgenda()
        ]);
        setClientes(cli);
        // Normalizar cliente_id → clienteId
        setVisitas(vis.map(v => ({ ...v, clienteId: v.cliente_id })));
        setAgenda(ag.map(a => ({ ...a, clienteId: a.cliente_id })));
      } catch (err) {
        console.error('Erro ao carregar:', err);
        setSaveStatus('error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);
  const [filtros, setFiltros] = useState({ cidade: 'todas', categoria: 'todas', busca: '' });
  const [selectedClient, setSelectedClient] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [visitasPorDia, setVisitasPorDia] = useState(6);
  const [showConfig, setShowConfig] = useState(false);
  const [showClienteForm, setShowClienteForm] = useState(false); // 'novo' | { ...cliente } (pra editar) | false

  // Sincroniza selectedClient com clientes quando atualiza
  useEffect(() => {
    if (selectedClient) {
      const updated = clientes.find(c => c.id === selectedClient.id);
      if (updated && updated !== selectedClient) {
        setSelectedClient(updated);
      }
    }
  }, [clientes]);

  const stats = useMemo(() => {
    const total = clientes.length;
    const porCat = { A: 0, B: 0, C: 0 };
    const porCidade = {};
    clientes.forEach(c => {
      porCat[c.categoria] = (porCat[c.categoria] || 0) + 1;
      const cid = c.cidade || 'Outros';
      porCidade[cid] = (porCidade[cid] || 0) + 1;
    });
    return { total, porCat, porCidade, totalVisitas: visitas.length };
  }, [clientes, visitas]);

  const filtered = useMemo(() => {
    return clientes.filter(c => {
      if (filtros.cidade !== 'todas' && c.cidade !== filtros.cidade) return false;
      if (filtros.categoria !== 'todas' && c.categoria !== filtros.categoria) return false;
      if (filtros.busca) {
        const q = filtros.busca.toLowerCase();
        if (!c.nome.toLowerCase().includes(q) &&
            !c.bairro.toLowerCase().includes(q) &&
            !(c.comprador || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clientes, filtros]);

  const cidades = useMemo(() => {
    const s = new Set();
    clientes.forEach(c => { if (c.cidade) s.add(c.cidade); });
    return Array.from(s).sort();
  }, [clientes]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      let headerIdx = 0;
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        const r = rows[i].map(x => String(x).toLowerCase());
        if (r.some(c => /loja|cliente/.test(c))) { headerIdx = i; break; }
      }
      const headers = rows[headerIdx].map(h => String(h).toLowerCase());
      const dataRows = rows.slice(headerIdx + 1);

      const findCol = (patterns) => {
        for (let i = 0; i < headers.length; i++) {
          if (patterns.some(p => headers[i].includes(p))) return i;
        }
        return -1;
      };
      const colNum = findCol(['num', '#']);
      const colLoja = findCol(['loja', 'cliente', 'nome']);
      const colEnd = findCol(['localiz', 'endere']);
      const colComp = findCol(['comprad', 'contat']);
      const colTel = findCol(['telef', 'fone']);
      const colTrat = findCol(['tratat', 'obs', 'nota', 'visita']);

      const novos = dataRows
        .filter(r => {
          const loja = String(r[colLoja] || '').trim();
          return loja && !['LOJAS', 'LOCALIZAÇÃO', 'NAN'].includes(loja.toUpperCase()) && loja.toLowerCase() !== 'miral';
        })
        .map((r, i) => {
          const end = String(r[colEnd] || '');
          const parts = parseAddress(end);
          const trat = String(r[colTrat] || '');
          return {
            id: Date.now() + i,
            num: (typeof r[colNum] === 'number') ? r[colNum] : i + 1,
            nome: String(r[colLoja] || ''),
            endereco: end,
            ...parts,
            comprador: String(r[colComp] || ''),
            telefone: String(r[colTel] || ''),
            tratativa: trat,
            categoria: categorizar(trat),
            status: 'ativo'
          };
        });

      // Merge por nome + registrar visita automaticamente se tratativa mudou
      const merged = [...clientes];
      const novasVisitas = [];
      const clientesParaSalvar = [];
      let added = 0, updated = 0;

      novos.forEach(n => {
        const idx = merged.findIndex(c => c.nome.trim().toLowerCase() === n.nome.trim().toLowerCase());
        if (idx >= 0) {
          const antigo = merged[idx];
          if (n.tratativa && n.tratativa.trim() !== (antigo.tratativa || '').trim()) {
            novasVisitas.push({
              cliente_id: antigo.id,
              data: new Date().toISOString(),
              obs: n.tratativa,
              resultado: n.categoria === 'A' ? 'interesse' : (n.categoria === 'C' ? 'sem_interesse' : 'revisita'),
              origem: 'import'
            });
          }
          const atualizado = { ...antigo, ...n, id: antigo.id };
          merged[idx] = atualizado;
          clientesParaSalvar.push(atualizado);
          updated++;
        } else {
          // Novo cliente - sem id, Supabase gera
          const { id, ...semId } = n;
          clientesParaSalvar.push(semId);
          added++;
        }
      });

      try {
        setSaveStatus('saving');
        // Salvar clientes em lote
        const salvos = await db.inserirClientesLote(clientesParaSalvar);
        // Salvar visitas novas
        if (novasVisitas.length > 0) {
          for (const v of novasVisitas) {
            await db.registrarVisita(v);
          }
        }
        // Recarregar do banco pra ter IDs corretos
        const [cli, vis] = await Promise.all([db.carregarClientes(), db.carregarVisitas()]);
        setClientes(cli);
        setVisitas(vis);
        setSaveStatus('saved');
        setUploadMsg(`✓ ${added} novos · ${updated} atualizados · ${novasVisitas.length} visitas registradas`);
        setTimeout(() => { setShowUpload(false); setUploadMsg(''); setSaveStatus(''); }, 2500);
      } catch (err) {
        console.error('Erro ao salvar upload:', err);
        setUploadMsg(`Erro: ${err.message}`);
        setSaveStatus('error');
      }
    } catch (err) {
      setUploadMsg(`Erro: ${err.message}`);
    }
  };

  const registrarVisita = async (clienteId, obs, resultado, dataCustom = null) => {
    const v = {
      cliente_id: clienteId,
      data: dataCustom || new Date().toISOString(),
      obs,
      resultado,
      origem: 'manual'
    };
    try {
      setSaveStatus('saving');
      const saved = await db.registrarVisita(v);
      setVisitas(prev => [{ ...saved, clienteId: saved.cliente_id }, ...prev]);
      if (resultado === 'compra' || resultado === 'interesse') {
        await db.atualizarCategoria(clienteId, 'A');
        setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, categoria: 'A' } : c));
      }
      await db.atualizarTratativa(clienteId, obs);
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, tratativa: obs } : c));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Erro ao registrar visita:', err);
      setSaveStatus('error');
    }
  };

  const agendarVisita = async (clienteId, data, hora, obs) => {
    try {
      setSaveStatus('saving');
      const a = { cliente_id: clienteId, data, hora, obs, feita: false };
      const saved = await db.agendarVisita(a);
      setAgenda(prev => [...prev, { ...saved, clienteId: saved.cliente_id }].sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora)));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Erro ao agendar:', err);
      setSaveStatus('error');
    }
  };

  const marcarFeita = async (agendaId) => {
    try {
      await db.marcarAgendaFeita(agendaId);
      setAgenda(prev => prev.map(a => a.id === agendaId ? { ...a, feita: true } : a));
    } catch (err) {
      console.error('Erro ao marcar feita:', err);
    }
  };

  const excluirVisita = async (visitaId) => {
    if (!confirm('Tem certeza que deseja excluir esta visita? Esta ação não pode ser desfeita.')) return;
    try {
      setSaveStatus('saving');
      const { error } = await db.supabase.from('visitas').delete().eq('id', visitaId);
      if (error) throw error;
      setVisitas(prev => prev.filter(v => v.id !== visitaId));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Erro ao excluir visita:', err);
      setSaveStatus('error');
    }
  };

  const excluirAgendamento = async (agendaId) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;
    try {
      setSaveStatus('saving');
      const { error } = await db.supabase.from('agenda').delete().eq('id', agendaId);
      if (error) throw error;
      setAgenda(prev => prev.filter(a => a.id !== agendaId));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Erro ao excluir agendamento:', err);
      setSaveStatus('error');
    }
  };

  const atualizarCategoria = async (clienteId, novaCat) => {
    try {
      await db.atualizarCategoria(clienteId, novaCat);
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, categoria: novaCat } : c));
    } catch (err) {
      console.error('Erro ao atualizar categoria:', err);
    }
  };

  const criarCliente = async (dadosCliente) => {
    try {
      setSaveStatus('saving');
      // Próximo num disponível
      const maxNum = clientes.reduce((max, c) => Math.max(max, c.num || 0), 0);
      const novo = {
        num: maxNum + 1,
        nome: dadosCliente.nome,
        endereco: dadosCliente.endereco || '',
        rua: dadosCliente.rua || '',
        bairro: dadosCliente.bairro || '',
        cidade: dadosCliente.cidade || '',
        cep: dadosCliente.cep || '',
        comprador: dadosCliente.comprador || '',
        telefone: dadosCliente.telefone || '',
        tratativa: dadosCliente.tratativa || '',
        categoria: dadosCliente.categoria || 'C',
        status: 'ativo'
      };
      const { data, error } = await db.supabase.from('clientes').insert(novo).select().single();
      if (error) throw error;
      setClientes(prev => [...prev, data]);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
      return data;
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      setSaveStatus('error');
      if (err.message?.includes('duplicate')) {
        alert('Já existe um cliente com esse nome. Use um nome único.');
      } else {
        alert('Erro ao criar cliente: ' + (err.message || 'tente novamente'));
      }
      return null;
    }
  };

  const editarCliente = async (clienteId, dadosAtualizados) => {
    try {
      setSaveStatus('saving');
      const { error } = await db.supabase.from('clientes').update(dadosAtualizados).eq('id', clienteId);
      if (error) throw error;
      setClientes(prev => prev.map(c => c.id === clienteId ? { ...c, ...dadosAtualizados } : c));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Erro ao editar cliente:', err);
      setSaveStatus('error');
      alert('Erro ao editar cliente: ' + (err.message || 'tente novamente'));
    }
  };

  const exportData = () => {
    const ws = XLSX.utils.json_to_sheet(clientes.map(c => ({
      '#': c.num,
      'LOJAS': c.nome,
      'LOCALIZAÇÃO': c.endereco,
      'BAIRRO': c.bairro,
      'CIDADE': c.cidade,
      'COMPRADOR': c.comprador,
      'TELEFONE': c.telefone,
      'CATEGORIA': c.categoria,
      'TRATATIVA': c.tratativa
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: '#FAFAF7', minHeight: '100vh' }}>
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>ROTA<span style={{ color: '#D85A30' }}>.</span></div>
          <div style={{ fontSize: 13, color: '#888780' }}>Carregando sua carteira...</div>
          <div style={{ width: 120, height: 3, background: '#EBE9E0', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: '40%', height: '100%', background: '#1A1A1A', animation: 'load 1.2s ease-in-out infinite' }} />
          </div>
          <style>{`@keyframes load { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }`}</style>
        </div>
      )}
      {saveStatus && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 500, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: saveStatus === 'error' ? '#FCEBEB' : saveStatus === 'saving' ? '#FAEEDA' : '#EAF3DE',
          color: saveStatus === 'error' ? '#791F1F' : saveStatus === 'saving' ? '#633806' : '#27500A',
          border: '1px solid ' + (saveStatus === 'error' ? '#E24B4A' : saveStatus === 'saving' ? '#BA7517' : '#639922'),
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          {saveStatus === 'saving' && '💾 Salvando...'}
          {saveStatus === 'saved' && '✓ Salvo'}
          {saveStatus === 'error' && '⚠️ Erro ao salvar'}
        </div>
      )}
      <style>{`
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; border: none; background: none; }
        input, select, textarea { font-family: inherit; }
        .nav-btn { transition: all 0.15s ease; }
        .nav-btn:hover { background: rgba(0,0,0,0.04); }
        .nav-btn.active { background: #1A1A1A; color: white; }
        .card { background: white; border: 1px solid #EBE9E0; border-radius: 12px; transition: all 0.15s; }
        .card:hover { border-color: #D3D1C7; }
        .client-card { cursor: pointer; }
        .client-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); transform: translateY(-1px); }
        .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; }
        .btn-primary { background: #1A1A1A; color: white; padding: 10px 18px; border-radius: 8px; font-weight: 500; font-size: 14px; transition: all 0.15s; }
        .btn-primary:hover { background: #000; }
        .btn-secondary { background: white; color: #1A1A1A; padding: 10px 18px; border-radius: 8px; font-weight: 500; font-size: 14px; border: 1px solid #E5E3DC; transition: all 0.15s; }
        .btn-secondary:hover { background: #F5F3EC; }
        .chip { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 500; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; background: white; color: #444441; border-color: #E5E3DC; }
        .chip:hover { background: #F5F3EC; }
        .chip.active { background: #1A1A1A; color: white; border-color: #1A1A1A; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; }}
        .modal-content { animation: slideUp 0.25s ease; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        .region-dot { animation: pulse 2s ease-in-out infinite; }
        @media (max-width: 768px) {
          .sidebar { position: fixed; bottom: 0; left: 0; right: 0; flex-direction: row !important; border-right: none !important; border-top: 1px solid #EBE9E0; width: 100% !important; height: auto !important; z-index: 100; padding: 0 !important; }
          .sidebar .logo { display: none; }
          .sidebar .sidebar-footer { display: none; }
          .sidebar .nav-btn { flex: 1; justify-content: center !important; border-radius: 0 !important; padding: 10px 4px !important; flex-direction: column; gap: 2px !important; font-size: 10px !important; min-width: 0; }
          .sidebar .nav-btn span { font-size: 9px; overflow: hidden; white-space: nowrap; }
          .main { padding: 20px 16px 90px !important; }
          .grid-cols { grid-template-columns: 1fr !important; }
          .grid-cols-2 { grid-template-columns: repeat(2, 1fr) !important; }
          .hide-mobile { display: none !important; }
          .show-mobile-upload { display: flex !important; }
          h1 { font-size: 22px !important; }
        }
        .show-mobile-upload { display: none; }
      `}</style>

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <nav className="sidebar" style={{ width: 240, background: 'white', borderRight: '1px solid #EBE9E0', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="logo" style={{ padding: '0 12px 24px', borderBottom: '1px solid #EBE9E0', marginBottom: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>ROTA<span style={{ color: '#D85A30' }}>.</span></div>
            <div style={{ fontSize: 12, color: '#888780', marginTop: 2 }}>Gestão de carteira</div>
          </div>

          {[
            { id: 'dashboard', label: 'Dashboard', Icon: BarChart3 },
            { id: 'clientes', label: 'Clientes', Icon: Users },
            { id: 'mapa', label: 'Regiões', Icon: Map },
            { id: 'sugestoes', label: 'Sugestões', Icon: Sparkles },
            { id: 'calendario', label: 'Calendário', Icon: CalendarDays },
            { id: 'relatorio', label: 'Relatório', Icon: FileText },
            { id: 'agenda', label: 'Agenda', Icon: Calendar }
          ].map(({ id, label, Icon }) => (
            <button key={id} className={`nav-btn ${view === id ? 'active' : ''}`} onClick={() => setView(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, textAlign: 'left', color: view === id ? 'white' : '#444441' }}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}

          <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #EBE9E0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setShowConfig(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13 }}>
              <Settings size={14} /> Configurar
            </button>
            <button className="btn-secondary" onClick={() => setShowUpload(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Upload size={16} /> Subir planilha
            </button>
          </div>
        </nav>

        <main className="main" style={{ flex: 1, padding: '32px 40px', maxWidth: 1280 }}>
          {/* Botão upload mobile */}
          <div className="show-mobile-upload" style={{ position: 'fixed', top: 16, right: 16, zIndex: 50 }}>
            <button className="btn-primary" onClick={() => setShowUpload(true)} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Upload size={14} /> Subir
            </button>
          </div>

          {view === 'dashboard' && <Dashboard stats={stats} clientes={clientes} agenda={agenda} visitas={visitas} onSelectClient={setSelectedClient} setView={setView} />}
          {view === 'clientes' && <ClientesList clientes={filtered} cidades={cidades} filtros={filtros} setFiltros={setFiltros} onSelect={setSelectedClient} total={clientes.length} onNovoCliente={() => setShowClienteForm('novo')} />}
          {view === 'mapa' && <Regioes clientes={clientes} stats={stats} onSelect={setSelectedClient} />}
          {view === 'sugestoes' && <Sugestoes clientes={clientes} visitas={visitas} agenda={agenda} visitasPorDia={visitasPorDia} onSelect={setSelectedClient} onAgendar={agendarVisita} setShowConfig={setShowConfig} />}
          {view === 'calendario' && <Calendario visitas={visitas} agenda={agenda} clientes={clientes} onSelectClient={setSelectedClient} />}
          {view === 'relatorio' && <Relatorio visitas={visitas} clientes={clientes} onSelectClient={setSelectedClient} />}
          {view === 'agenda' && <Agenda agenda={agenda} clientes={clientes} onMarcarFeita={marcarFeita} onSelectClient={setSelectedClient} onExcluir={excluirAgendamento} />}
        </main>
      </div>

      {selectedClient && (
        <ClientDetail
          cliente={selectedClient}
          onClose={() => setSelectedClient(null)}
          visitas={visitas.filter(v => v.clienteId === selectedClient.id)}
          agendamentos={agenda.filter(a => a.clienteId === selectedClient.id && !a.feita)}
          onRegistrarVisita={(obs, res, data) => registrarVisita(selectedClient.id, obs, res, data)}
          onAgendar={(data, hora, obs) => agendarVisita(selectedClient.id, data, hora, obs)}
          onUpdateCategoria={(cat) => atualizarCategoria(selectedClient.id, cat)}
          onExcluirVisita={excluirVisita}
          onExcluirAgendamento={excluirAgendamento}
          onEditar={() => setShowClienteForm(selectedClient)}
        />
      )}

      {showConfig && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={() => setShowConfig(false)}>
          <div className="modal-content card" style={{ padding: 32, maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Configurações</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888780' }}>Ajuste a plataforma ao seu ritmo de trabalho</p>
              </div>
              <button onClick={() => setShowConfig(false)} style={{ padding: 4 }}><X size={20} /></button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Visitas por dia</label>
              <p style={{ fontSize: 12, color: '#888780', margin: '0 0 12px' }}>Usado para calcular as sugestões de roteiro</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="range" min="2" max="15" value={visitasPorDia} onChange={e => setVisitasPorDia(Number(e.target.value))} style={{ flex: 1 }} />
                <div style={{ minWidth: 60, textAlign: 'center', padding: '8px 12px', background: '#1A1A1A', color: 'white', borderRadius: 8, fontWeight: 700, fontSize: 18 }}>
                  {visitasPorDia}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 8 }}>
                = {visitasPorDia * 5} visitas em uma semana útil (seg-sex)
              </div>
            </div>

            <button className="btn-primary" onClick={() => setShowConfig(false)} style={{ width: '100%' }}>Salvar</button>

            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #E5E3DC' }}>
              <button onClick={() => { if (confirm('Deseja sair do app? Você precisará digitar a senha novamente.')) { setShowConfig(false); onLogout(); } }}
                style={{ width: '100%', padding: 10, color: '#791F1F', fontSize: 13, fontWeight: 500, borderRadius: 8, border: '1px solid #FCEBEB', background: 'white' }}>
                Sair do app
              </button>
            </div>
          </div>
        </div>
      )}

      {showClienteForm && (
        <ClienteForm
          clienteExistente={showClienteForm === 'novo' ? null : showClienteForm}
          onClose={() => setShowClienteForm(false)}
          onSalvar={async (dados) => {
            if (showClienteForm === 'novo') {
              const novo = await criarCliente(dados);
              if (novo) {
                setShowClienteForm(false);
                setSelectedClient(novo);
              }
            } else {
              await editarCliente(showClienteForm.id, dados);
              setShowClienteForm(false);
            }
          }}
        />
      )}

      {showUpload && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={() => setShowUpload(false)}>
          <div className="modal-content card" style={{ padding: 32, maxWidth: 480, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Atualizar carteira</h2>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888780' }}>Ao subir sua planilha semanal: tratativas diferentes viram visitas registradas automaticamente</p>
              </div>
              <button onClick={() => setShowUpload(false)} style={{ padding: 4 }}><X size={20} /></button>
            </div>
            <label style={{ display: 'block', border: '2px dashed #D3D1C7', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer', background: '#FAFAF7' }}>
              <Upload size={32} style={{ color: '#888780', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 500 }}>Clique para escolher arquivo</div>
              <div style={{ fontSize: 12, color: '#888780', marginTop: 4 }}>.xlsx ou .csv</div>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            {uploadMsg && (
              <div style={{ marginTop: 16, padding: 12, background: uploadMsg.startsWith('✓') ? '#EAF3DE' : '#FCEBEB', color: uploadMsg.startsWith('✓') ? '#27500A' : '#791F1F', borderRadius: 8, fontSize: 13 }}>
                {uploadMsg}
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={exportData} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Download size={14} /> Exportar atual
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ DASHBOARD ============
function Dashboard({ stats, clientes, agenda, visitas, onSelectClient, setView }) {
  const hoje = new Date().toISOString().slice(0,10);
  const proximasVisitas = agenda.filter(a => !a.feita).slice(0, 5);
  const clientesA = clientes.filter(c => c.categoria === 'A').slice(0, 4);

  // Visitas da semana atual
  const hoje2 = new Date();
  const semAtual = semanaDoAno(hoje2);
  const visitasSemana = visitas.filter(v => {
    const d = new Date(v.data);
    const s = semanaDoAno(d);
    return s.ano === semAtual.ano && s.semana === semAtual.semana;
  }).length;

  return (
    <div>
      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: '#888780', marginBottom: 4 }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>Bom dia. Vamos vender?</h1>
      </header>

      <div className="grid-cols grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Carteira" value={stats.total} Icon={Users} color="#1A1A1A" />
        <StatCard label="Grande" value={stats.porCat.A} Icon={Star} color="#639922" sub="alto potencial" />
        <StatCard label="Médio" value={stats.porCat.B} Icon={TrendingUp} color="#BA7517" sub="em negociação" />
        <StatCard label="Visitas na semana" value={visitasSemana} Icon={CheckCircle2} color="#378ADD" sub={`${stats.totalVisitas} no total`} />
      </div>

      <div className="grid-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Próximas visitas</h2>
            <button onClick={() => setView('agenda')} style={{ fontSize: 13, color: '#888780', display: 'flex', alignItems: 'center', gap: 2 }}>
              Ver todas <ChevronRight size={14} />
            </button>
          </div>
          {proximasVisitas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#888780' }}>
              <Calendar size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
              <div style={{ fontSize: 13 }}>Nenhuma visita agendada</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Abra um cliente e clique em "Agendar"</div>
            </div>
          ) : proximasVisitas.map(a => {
            const c = clientes.find(cl => cl.id === a.clienteId);
            if (!c) return null;
            const isHoje = a.data === hoje;
            return (
              <div key={a.id} onClick={() => onSelectClient(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #F0EEE5', cursor: 'pointer' }}>
                <div style={{ width: 42, textAlign: 'center', padding: '6px 0', background: isHoje ? '#1A1A1A' : '#F5F3EC', color: isHoje ? 'white' : '#1A1A1A', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase' }}>{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{a.data.split('-')[2]}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: '#888780' }}>{a.hora} · {c.bairro}</div>
                </div>
                <ChevronRight size={16} style={{ color: '#888780' }} />
              </div>
            );
          })}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Por região</h2>
            <button onClick={() => setView('mapa')} style={{ fontSize: 13, color: '#888780', display: 'flex', alignItems: 'center', gap: 2 }}>
              Ver mapa <ChevronRight size={14} />
            </button>
          </div>
          {Object.entries(stats.porCidade).sort((a,b) => b[1] - a[1]).map(([cid, count]) => {
            const color = CITY_COLORS[cid] || CITY_COLORS[''];
            const pct = (count / stats.total * 100);
            return (
              <div key={cid} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color.dot }} />
                    {cid || 'Outros'}
                  </div>
                  <div style={{ fontSize: 12, color: '#888780' }}>{count} · {pct.toFixed(0)}%</div>
                </div>
                <div style={{ height: 6, background: '#F5F3EC', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color.dot, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {clientesA.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>Prioridade alta</h2>
          <div className="grid-cols grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {clientesA.map(c => (
              <div key={c.id} onClick={() => onSelectClient(c)} className="card client-card" style={{ padding: 16 }}>
                <div className="badge" style={{ background: CAT_STYLES.A.bg, color: CAT_STYLES.A.text, marginBottom: 8 }}>
                  <Star size={10} /> A
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: '#888780', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {c.bairro}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, Icon, color, sub }) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>{label}</div>
        <Icon size={16} style={{ color }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: '#1A1A1A' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ============ CLIENTES ============
function ClientesList({ clientes, cidades, filtros, setFiltros, onSelect, total, onNovoCliente }) {
  return (
    <div>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>Clientes</h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888780' }}>{clientes.length} de {total} exibidos</p>
        </div>
        <button className="btn-primary" onClick={onNovoCliente} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Novo cliente
        </button>
      </header>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888780' }} />
        <input type="text" placeholder="Buscar por nome, bairro ou comprador..."
          value={filtros.busca} onChange={e => setFiltros({ ...filtros, busca: e.target.value })}
          style={{ width: '100%', padding: '12px 14px 12px 42px', border: '1px solid #E5E3DC', borderRadius: 10, fontSize: 14, background: 'white', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, paddingRight: 12, borderRight: '1px solid #E5E3DC', flexWrap: 'wrap' }}>
          <button className={`chip ${filtros.categoria === 'todas' ? 'active' : ''}`} onClick={() => setFiltros({ ...filtros, categoria: 'todas' })}>Todas</button>
          {['A', 'B', 'C'].map(cat => (
            <button key={cat} className={`chip ${filtros.categoria === cat ? 'active' : ''}`} onClick={() => setFiltros({ ...filtros, categoria: cat })}>{CAT_STYLES[cat].label}</button>
          ))}
        </div>
        <button className={`chip ${filtros.cidade === 'todas' ? 'active' : ''}`} onClick={() => setFiltros({ ...filtros, cidade: 'todas' })}>Todas cidades</button>
        {cidades.map(c => (
          <button key={c} className={`chip ${filtros.cidade === c ? 'active' : ''}`} onClick={() => setFiltros({ ...filtros, cidade: c })}>{c}</button>
        ))}
      </div>

      <div className="grid-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {clientes.map(c => <ClientCard key={c.id} c={c} onClick={() => onSelect(c)} />)}
      </div>

      {clientes.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, color: '#888780' }}>
          <AlertCircle size={32} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
          <div>Nenhum cliente encontrado</div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ c, onClick }) {
  const cat = CAT_STYLES[c.categoria];
  const cidColor = CITY_COLORS[c.cidade] || CITY_COLORS[''];
  return (
    <div className="card client-card" onClick={onClick} style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <div className="badge" style={{ background: cat.bg, color: cat.text }}>
          {c.categoria === 'A' && <Star size={10} />} {CAT_STYLES[c.categoria].curto}
        </div>
        <div style={{ fontSize: 10, color: '#888780' }}>#{c.num}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.nome}</div>
      <div style={{ fontSize: 12, color: '#5F5E5A', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MapPin size={11} /> {c.bairro || '—'}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <div className="badge" style={{ background: cidColor.bg, color: cidColor.text }}>{c.cidade || 'Outros'}</div>
        {c.comprador && <div className="badge" style={{ background: '#F5F3EC', color: '#5F5E5A' }}>{c.comprador}</div>}
      </div>
    </div>
  );
}

// ============ REGIÕES ============
function Regioes({ clientes, stats, onSelect }) {
  const [selectedCidade, setSelectedCidade] = useState(null);

  const bairrosPorCidade = useMemo(() => {
    const m = {};
    clientes.forEach(c => {
      const cid = c.cidade || 'Outros';
      if (!m[cid]) m[cid] = {};
      const b = c.bairro || 'Sem bairro';
      m[cid][b] = (m[cid][b] || 0) + 1;
    });
    return m;
  }, [clientes]);

  const clientesFiltrados = selectedCidade ? clientes.filter(c => c.cidade === selectedCidade) : [];

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>Regiões</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888780' }}>Carteira por cidade e bairro</p>
      </header>

      <div style={{ background: 'linear-gradient(135deg, #FAFAF7 0%, #F5F3EC 100%)', borderRadius: 16, padding: 32, border: '1px solid #EBE9E0', marginBottom: 24, position: 'relative', minHeight: 280 }}>
        <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>Grande ABC Paulista</div>
        <div className="grid-cols grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginTop: 20 }}>
          {Object.entries(stats.porCidade).sort((a,b) => b[1] - a[1]).map(([cid, count]) => {
            const color = CITY_COLORS[cid] || CITY_COLORS[''];
            const isSelected = selectedCidade === cid;
            const size = Math.max(80, Math.min(140, 60 + count * 1.2));
            return (
              <button key={cid} onClick={() => setSelectedCidade(isSelected ? null : cid)}
                style={{ padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s', transform: isSelected ? 'scale(1.05)' : 'scale(1)' }}>
                <div style={{ width: size, height: size, borderRadius: '50%', background: color.bg, border: `3px solid ${isSelected ? color.dot : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'all 0.2s' }}>
                  <div className="region-dot" style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: color.dot }} />
                  <div style={{ fontSize: size * 0.24, fontWeight: 700, color: color.text, letterSpacing: '-0.02em' }}>{count}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', textAlign: 'center' }}>{cid || 'Outros'}</div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedCidade && bairrosPorCidade[selectedCidade] && (
        <div className="card modal-content" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Bairros em {selectedCidade}</h2>
            <button onClick={() => setSelectedCidade(null)} style={{ padding: 4 }}><X size={18} /></button>
          </div>
          <div className="grid-cols grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {Object.entries(bairrosPorCidade[selectedCidade]).sort((a,b) => b[1] - a[1]).map(([bairro, count]) => (
              <div key={bairro} style={{ padding: '10px 14px', background: '#FAFAF7', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{bairro}</div>
                <div style={{ fontSize: 12, color: '#888780', fontWeight: 600 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCidade && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Clientes em {selectedCidade} ({clientesFiltrados.length})</h3>
          <div className="grid-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {clientesFiltrados.map(c => <ClientCard key={c.id} c={c} onClick={() => onSelect(c)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ RELATÓRIO DE VISITAS ============
function Relatorio({ visitas, clientes, onSelectClient }) {
  const [periodoOffset, setPeriodoOffset] = useState(0); // 0 = semana atual, -1 = anterior, etc
  const [modo, setModo] = useState('semana'); // semana | mes

  const hoje = new Date();

  // Calcular período selecionado
  const { inicio, fim, labelPeriodo } = useMemo(() => {
    if (modo === 'semana') {
      const d = new Date(hoje);
      d.setDate(d.getDate() + periodoOffset * 7);
      const dow = d.getDay();
      const segunda = new Date(d);
      segunda.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
      segunda.setHours(0,0,0,0);
      const domingo = new Date(segunda);
      domingo.setDate(segunda.getDate() + 6);
      domingo.setHours(23,59,59,999);
      const { ano, semana } = semanaDoAno(segunda);
      const label = periodoOffset === 0 ? `Semana atual · ${formatarSemana(ano, semana)}` : `Semana ${semana} · ${formatarSemana(ano, semana)}`;
      return { inicio: segunda, fim: domingo, labelPeriodo: label };
    } else {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + periodoOffset, 1);
      const primeiro = new Date(d);
      const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { inicio: primeiro, fim: ultimo, labelPeriodo: label.charAt(0).toUpperCase() + label.slice(1) };
    }
  }, [periodoOffset, modo]);

  const visitasPeriodo = useMemo(() => {
    return visitas.filter(v => {
      const d = new Date(v.data);
      return d >= inicio && d <= fim;
    });
  }, [visitas, inicio, fim]);

  // Agrupar por dia
  const porDia = useMemo(() => {
    const m = {};
    visitasPeriodo.forEach(v => {
      const d = new Date(v.data);
      const key = d.toISOString().slice(0,10);
      if (!m[key]) m[key] = [];
      m[key].push(v);
    });
    return m;
  }, [visitasPeriodo]);

  const diasOrdenados = Object.keys(porDia).sort((a,b) => b.localeCompare(a));

  // Stats do período
  const statsPeriodo = useMemo(() => {
    const porResultado = {};
    const porCidade = {};
    visitasPeriodo.forEach(v => {
      porResultado[v.resultado] = (porResultado[v.resultado] || 0) + 1;
      const c = clientes.find(cl => cl.id === v.clienteId);
      if (c) {
        const cid = c.cidade || 'Outros';
        porCidade[cid] = (porCidade[cid] || 0) + 1;
      }
    });
    return { porResultado, porCidade, total: visitasPeriodo.length };
  }, [visitasPeriodo, clientes]);

  const exportarRelatorio = () => {
    if (visitasPeriodo.length === 0) return;
    const rows = visitasPeriodo.map(v => {
      const c = clientes.find(cl => cl.id === v.clienteId) || {};
      const d = new Date(v.data);
      return {
        'DATA': d.toLocaleDateString('pt-BR'),
        'DIA_SEMANA': d.toLocaleDateString('pt-BR', { weekday: 'long' }),
        'SEMANA': semanaDoAno(d).semana,
        'MÊS': d.toLocaleDateString('pt-BR', { month: 'long' }),
        'CLIENTE': c.nome || '',
        'CIDADE': c.cidade || '',
        'BAIRRO': c.bairro || '',
        'RESULTADO': v.resultado,
        'OBSERVAÇÃO': v.obs
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visitas');
    XLSX.writeFile(wb, `relatorio_visitas_${inicio.toISOString().slice(0,10)}.xlsx`);
  };

  const RESULTADO_LABEL = {
    compra: { label: 'Compra', bg: '#EAF3DE', text: '#27500A' },
    interesse: { label: 'Interesse', bg: '#E6F1FB', text: '#0C447C' },
    revisita: { label: 'Revisita', bg: '#FAEEDA', text: '#633806' },
    sem_interesse: { label: 'Sem interesse', bg: '#FCEBEB', text: '#791F1F' }
  };

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>Relatório de visitas</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888780' }}>Visitas realizadas no período selecionado</p>
      </header>

      {/* Controles */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`chip ${modo === 'semana' ? 'active' : ''}`} onClick={() => { setModo('semana'); setPeriodoOffset(0); }}>Semana</button>
            <button className={`chip ${modo === 'mes' ? 'active' : ''}`} onClick={() => { setModo('mes'); setPeriodoOffset(0); }}>Mês</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setPeriodoOffset(p => p - 1)} style={{ padding: 8 }}><ChevronLeft size={16} /></button>
            <div style={{ fontSize: 14, fontWeight: 600, minWidth: 200, textAlign: 'center' }}>{labelPeriodo}</div>
            <button className="btn-secondary" onClick={() => setPeriodoOffset(p => p + 1)} disabled={periodoOffset >= 0} style={{ padding: 8, opacity: periodoOffset >= 0 ? 0.5 : 1 }}><ChevronRight size={16} /></button>
          </div>
          {statsPeriodo.total > 0 && (
            <button className="btn-secondary" onClick={exportarRelatorio} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Download size={14} /> Exportar
            </button>
          )}
        </div>
      </div>

      {/* Stats do período */}
      {statsPeriodo.total > 0 ? (
        <>
          <div className="grid-cols grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total de visitas" value={statsPeriodo.total} Icon={CheckCircle2} color="#1A1A1A" />
            <StatCard label="Compras" value={statsPeriodo.porResultado.compra || 0} Icon={Star} color="#639922" />
            <StatCard label="Interessados" value={statsPeriodo.porResultado.interesse || 0} Icon={TrendingUp} color="#378ADD" />
            <StatCard label="Revisitar" value={statsPeriodo.porResultado.revisita || 0} Icon={Clock} color="#BA7517" />
          </div>

          {/* Por cidade */}
          {Object.keys(statsPeriodo.porCidade).length > 1 && (
            <div className="card" style={{ padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#888780' }}>Por cidade</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(statsPeriodo.porCidade).sort((a,b) => b[1] - a[1]).map(([cid, count]) => {
                  const color = CITY_COLORS[cid] || CITY_COLORS[''];
                  return (
                    <div key={cid} style={{ padding: '8px 14px', background: color.bg, color: color.text, borderRadius: 999, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {cid} <span style={{ opacity: 0.6, fontSize: 12 }}>·</span> <strong>{count}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline por dia */}
          <div>
            {diasOrdenados.map(dia => {
              const d = new Date(dia + 'T12:00');
              const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
              const dataFmt = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
              return (
                <div key={dia} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 12px', background: '#1A1A1A', color: 'white', borderRadius: 10, minWidth: 54 }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{d.getDate()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{diaSemana}</div>
                      <div style={{ fontSize: 12, color: '#888780' }}>{porDia[dia].length} visita{porDia[dia].length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 12, paddingLeft: 22, borderLeft: '2px solid #EBE9E0' }}>
                    {porDia[dia].map(v => {
                      const c = clientes.find(cl => cl.id === v.clienteId);
                      if (!c) return null;
                      const res = RESULTADO_LABEL[v.resultado] || { label: v.resultado, bg: '#F5F3EC', text: '#5F5E5A' };
                      const hora = new Date(v.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <div key={v.id} className="card client-card" onClick={() => onSelectClient(c)} style={{ padding: 14, position: 'relative' }}>
                          <div style={{ position: 'absolute', left: -29, top: 18, width: 10, height: 10, borderRadius: '50%', background: res.text, border: '2px solid white' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{c.nome}</div>
                            <div className="badge" style={{ background: res.bg, color: res.text }}>{res.label}</div>
                          </div>
                          <div style={{ fontSize: 12, color: '#888780', display: 'flex', alignItems: 'center', gap: 10, marginBottom: v.obs ? 8 : 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} /> {hora}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {c.bairro}, {c.cidade}</span>
                            {v.origem === 'import' && <span style={{ padding: '1px 6px', background: '#F5F3EC', borderRadius: 4, fontSize: 10 }}>importada</span>}
                          </div>
                          {v.obs && <div style={{ fontSize: 13, color: '#444441', lineHeight: 1.5, padding: 10, background: '#FAFAF7', borderRadius: 8, marginTop: 4 }}>{v.obs}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: 64, textAlign: 'center' }}>
          <FileText size={40} style={{ margin: '0 auto 16px', display: 'block', color: '#D3D1C7' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Nenhuma visita neste período</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888780' }}>Registre visitas na ficha do cliente ou importe uma planilha atualizada</p>
        </div>
      )}
    </div>
  );
}

// ============ SUGESTÕES INTELIGENTES ============
function Sugestoes({ clientes, visitas, agenda, visitasPorDia, onSelect, onAgendar, setShowConfig }) {
  // Calcula score pra cada cliente
  const sugestoesBase = useMemo(() => {
    const hoje = new Date();
    
    return clientes.map(c => {
      let score = 0;
      const razoes = [];

      // 1. CATEGORIA (peso alto - A=40, B=25, C=10)
      if (c.categoria === 'A') { score += 40; razoes.push({ tipo: 'cat', texto: 'Cliente grande', cor: '#27500A' }); }
      else if (c.categoria === 'B') { score += 25; razoes.push({ tipo: 'cat', texto: 'Cliente médio', cor: '#633806' }); }
      else { score += 10; }

      // 2. INTERESSE na tratativa (palavras-chave que sugerem ação necessária)
      const t = (c.tratativa || '').toLowerCase();
      if (/solicitou|pediu.*visita|marcou|agendou|revisita/.test(t)) {
        score += 35;
        razoes.push({ tipo: 'acao', texto: 'Cliente solicitou visita', cor: '#D85A30' });
      }
      if (/interessad|mandou.*dados|cadastro/.test(t)) {
        score += 30;
        razoes.push({ tipo: 'acao', texto: 'Demonstrou interesse', cor: '#0C447C' });
      }
      if (/aguardando|enviado.*cat|balconista/.test(t)) {
        score += 20;
        razoes.push({ tipo: 'acao', texto: 'Aguardando retorno', cor: '#BA7517' });
      }
      if (/oportunidade|chateado.*gama|compra.*direto|compra.*mensal/.test(t)) {
        score += 25;
        razoes.push({ tipo: 'acao', texto: 'Oportunidade identificada', cor: '#085041' });
      }

      // 3. TEMPO SEM VISITAR
      const visitasCliente = visitas.filter(v => v.clienteId === c.id);
      const ultimaVisita = visitasCliente.length > 0 
        ? new Date(Math.max(...visitasCliente.map(v => new Date(v.data).getTime())))
        : null;
      
      let diasSemVisitar = null;
      if (ultimaVisita) {
        diasSemVisitar = Math.floor((hoje - ultimaVisita) / (1000 * 60 * 60 * 24));
        if (diasSemVisitar > 30) { score += 15; razoes.push({ tipo: 'tempo', texto: `${diasSemVisitar} dias sem visitar`, cor: '#791F1F' }); }
        else if (diasSemVisitar > 14) { score += 8; razoes.push({ tipo: 'tempo', texto: `${diasSemVisitar} dias`, cor: '#BA7517' }); }
      } else {
        score += 12;
        razoes.push({ tipo: 'tempo', texto: 'Nunca visitado', cor: '#888780' });
      }

      // 4. Penalizar "sem interesse" recente
      const ultimoResultado = visitasCliente.sort((a,b) => new Date(b.data) - new Date(a.data))[0];
      if (ultimoResultado?.resultado === 'sem_interesse' && diasSemVisitar < 30) {
        score -= 20;
      }

      // 5. Penalizar se já está agendado
      const jaAgendado = agenda.some(a => a.clienteId === c.id && !a.feita);
      if (jaAgendado) score = -1;

      return { cliente: c, score, razoes, diasSemVisitar, ultimoResultado };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  }, [clientes, visitas, agenda]);

  // Monta roteiro inicial agrupando por cidade
  const roteiroInicial = useMemo(() => {
    const totalSugestoes = visitasPorDia * 5;
    const topSugestoes = sugestoesBase.slice(0, totalSugestoes);
    const dias = [[], [], [], [], []];
    
    const porCidade = {};
    topSugestoes.forEach(s => {
      const cid = s.cliente.cidade || 'Outros';
      if (!porCidade[cid]) porCidade[cid] = [];
      porCidade[cid].push(s);
    });

    let diaAtual = 0;
    const cidadesOrdenadas = Object.keys(porCidade).sort((a,b) => porCidade[b].length - porCidade[a].length);
    
    cidadesOrdenadas.forEach(cid => {
      const lista = porCidade[cid].sort((a,b) => (a.cliente.bairro || '').localeCompare(b.cliente.bairro || ''));
      lista.forEach(s => {
        let tentativas = 0;
        while (dias[diaAtual].length >= visitasPorDia && tentativas < 5) {
          diaAtual = (diaAtual + 1) % 5;
          tentativas++;
        }
        if (dias[diaAtual].length < visitasPorDia) {
          dias[diaAtual].push(s);
        }
      });
      diaAtual = (diaAtual + 1) % 5;
    });

    return dias;
  }, [sugestoesBase, visitasPorDia]);

  // Estado local - permite reordenação manual
  const [dias, setDias] = useState(() => roteiroInicial);

  // Ref pra detectar mudança real (não apenas recriação)
  const prevKeyRef = useRef(null);
  useEffect(() => {
    // Gera chave baseada em IDs dos clientes pra comparar mudança real
    const key = JSON.stringify(roteiroInicial.map(d => d.map(s => s?.cliente?.id)));
    if (prevKeyRef.current !== null && prevKeyRef.current !== key) {
      setDias(roteiroInicial);
    }
    prevKeyRef.current = key;
  }, [roteiroInicial]);

  // Drag state
  const [draggedItem, setDraggedItem] = useState(null); // { diaIdx, clienteIdx, sug }
  const [dragOver, setDragOver] = useState(null); // { diaIdx, clienteIdx }
  const [touchDragging, setTouchDragging] = useState(false);
  const [touchPos, setTouchPos] = useState({ x: 0, y: 0 });

  const diasNomes = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
  const diasDaSemana = useMemo(() => {
    const hoje = new Date();
    const d0 = new Date(hoje);
    d0.setDate(hoje.getDate() - hoje.getDay());
    return [1, 2, 3, 4, 5].map(i => {
      const d = new Date(d0);
      d.setDate(d0.getDate() + 7 + i);
      return d;
    });
  }, []);

  const moverItem = (origemDia, origemIdx, destinoDia, destinoIdx) => {
    setDias(prev => {
      const novo = prev.map(d => [...d]);
      // Validação: item de origem existe?
      if (!novo[origemDia] || !novo[origemDia][origemIdx]) return prev;
      const [item] = novo[origemDia].splice(origemIdx, 1);
      if (!item) return prev;
      
      // Ajustar índice se estiver movendo dentro do mesmo dia após remoção
      let targetIdx = destinoIdx;
      if (origemDia === destinoDia && destinoIdx > origemIdx) {
        targetIdx = destinoIdx - 1;
      }
      if (targetIdx === null || targetIdx === undefined || targetIdx > novo[destinoDia].length) {
        targetIdx = novo[destinoDia].length;
      }
      novo[destinoDia].splice(targetIdx, 0, item);
      return novo;
    });
  };

  // ===== Desktop: HTML5 drag and drop =====
  const handleDragStart = (e, diaIdx, clienteIdx, sug) => {
    setDraggedItem({ diaIdx, clienteIdx, sug });
    e.dataTransfer.effectAllowed = 'move';
    // Imagem de drag customizada (opcional)
    if (e.dataTransfer.setDragImage) {
      const ghost = e.currentTarget.cloneNode(true);
      ghost.style.opacity = '0.8';
      ghost.style.position = 'absolute';
      ghost.style.top = '-1000px';
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => document.body.removeChild(ghost), 0);
    }
  };

  const handleDragOver = (e, diaIdx, clienteIdx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver({ diaIdx, clienteIdx });
  };

  const handleDrop = (e, destinoDia, destinoIdx) => {
    e.preventDefault();
    if (draggedItem) {
      moverItem(draggedItem.diaIdx, draggedItem.clienteIdx, destinoDia, destinoIdx);
    }
    setDraggedItem(null);
    setDragOver(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOver(null);
  };

  // ===== Mobile: touch drag =====
  const handleTouchStart = (e, diaIdx, clienteIdx, sug) => {
    const touch = e.touches[0];
    setDraggedItem({ diaIdx, clienteIdx, sug });
    setTouchPos({ x: touch.clientX, y: touch.clientY });
    setTouchDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!touchDragging || !draggedItem) return;
    e.preventDefault();
    const touch = e.touches[0];
    setTouchPos({ x: touch.clientX, y: touch.clientY });
    
    // Detectar elemento sob o dedo
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const card = el.closest('[data-sug-card]');
      const diaDrop = el.closest('[data-sug-day]');
      if (card) {
        const dia = Number(card.dataset.dia);
        const idx = Number(card.dataset.idx);
        setDragOver({ diaIdx: dia, clienteIdx: idx });
      } else if (diaDrop) {
        const dia = Number(diaDrop.dataset.sugDay);
        setDragOver({ diaIdx: dia, clienteIdx: null });
      }
    }
  };

  const handleTouchEnd = () => {
    if (draggedItem && dragOver) {
      const destIdx = dragOver.clienteIdx !== null ? dragOver.clienteIdx : dias[dragOver.diaIdx].length;
      moverItem(draggedItem.diaIdx, draggedItem.clienteIdx, dragOver.diaIdx, destIdx);
    }
    setDraggedItem(null);
    setDragOver(null);
    setTouchDragging(false);
  };

  const agendarDia = (diaIdx) => {
    const horaBase = 9;
    const data = diasDaSemana[diaIdx];
    if (!data) return;
    dias[diaIdx].forEach((s, idx) => {
      if (!s || !s.cliente) return;
      const hora = `${String(horaBase + Math.floor(idx * 1.5)).padStart(2,'0')}:${idx % 2 === 0 ? '00' : '30'}`;
      const dataISO = data.toISOString().slice(0,10);
      onAgendar(s.cliente.id, dataISO, hora, s.razoes.map(r => r.texto).join(' · '));
    });
  };

  const agendarTudo = () => {
    dias.forEach((_, idx) => agendarDia(idx));
  };

  const resetarSugestoes = () => {
    setDias(roteiroInicial);
  };

  const diasPreenchidos = dias.filter(d => d.length > 0).length;
  const totalVisitas = dias.reduce((acc, d) => acc + d.length, 0);

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
              <Sparkles size={24} style={{ display: 'inline', marginRight: 8, color: '#D85A30' }} />
              Sugestões de visita
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888780' }}>Roteiro para a próxima semana · {visitasPorDia} visitas/dia · arraste pra reordenar</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={resetarSugestoes} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              Resetar
            </button>
            <button className="btn-secondary" onClick={() => setShowConfig(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Settings size={14} /> Ajustar ritmo
            </button>
          </div>
        </div>
      </header>

      {/* Como funciona */}
      <div className="card" style={{ padding: 20, marginBottom: 20, background: 'linear-gradient(135deg, #FAFAF7 0%, #F5F3EC 100%)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Como funciona</div>
        <div style={{ fontSize: 13, color: '#444441', lineHeight: 1.6 }}>
          As sugestões combinam <strong>categoria</strong> (Grande {'>'} Médio {'>'} Pequeno), <strong>interesse do cliente</strong>, <strong>tempo sem contato</strong> e <strong>agrupamento por região</strong>. <strong>Arraste um cliente</strong> entre os dias pra ajustar o roteiro à sua preferência.
        </div>
      </div>

      {/* Cabeçalho com ações */}
      {totalVisitas > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Próxima semana · {totalVisitas} visitas</h2>
          <button className="btn-primary" onClick={agendarTudo} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Calendar size={14} /> Agendar tudo
          </button>
        </div>
      )}

      {/* Roteiro semanal */}
      {diasPreenchidos > 0 ? (
        <div style={{ touchAction: touchDragging ? 'none' : 'auto' }}
             onTouchMove={touchDragging ? handleTouchMove : undefined}
             onTouchEnd={touchDragging ? handleTouchEnd : undefined}>
          {dias.map((sugsDoDia, diaIdx) => {
            const data = diasDaSemana[diaIdx];
            const isDropTarget = dragOver && dragOver.diaIdx === diaIdx;
            return (
              <div key={diaIdx}
                   data-sug-day={diaIdx}
                   onDragOver={(e) => { e.preventDefault(); if (sugsDoDia.length === 0) setDragOver({ diaIdx, clienteIdx: null }); }}
                   onDrop={(e) => handleDrop(e, diaIdx, sugsDoDia.length)}
                   style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 12px', background: '#1A1A1A', color: 'white', borderRadius: 10, minWidth: 54 }}>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>{data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{data.getDate()}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{diasNomes[diaIdx]}</div>
                    <div style={{ fontSize: 12, color: '#888780' }}>{sugsDoDia.length} visita{sugsDoDia.length !== 1 ? 's' : ''}</div>
                  </div>
                  {sugsDoDia.length > 0 && (
                    <button className="btn-secondary" onClick={() => agendarDia(diaIdx)} style={{ fontSize: 12, padding: '6px 12px' }}>
                      Agendar este dia
                    </button>
                  )}
                </div>
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  minHeight: sugsDoDia.length === 0 ? 72 : 'auto',
                  padding: sugsDoDia.length === 0 ? 16 : 0,
                  border: sugsDoDia.length === 0 ? '2px dashed #D3D1C7' : 'none',
                  borderRadius: 10,
                  background: isDropTarget && sugsDoDia.length === 0 ? '#FAEEDA' : 'transparent',
                  transition: 'all 0.15s'
                }}>
                  {sugsDoDia.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#888780', fontSize: 12, padding: '8px 0' }}>
                      Solte um cliente aqui pra mover pra {diasNomes[diaIdx]}
                    </div>
                  )}
                  {sugsDoDia.filter(s => s && s.cliente).map((s, idx) => {
                    const cidColor = CITY_COLORS[s.cliente.cidade] || CITY_COLORS[''];
                    const cat = CAT_STYLES[s.cliente.categoria];
                    const isDragging = draggedItem && draggedItem.diaIdx === diaIdx && draggedItem.clienteIdx === idx;
                    const isDragOverThis = dragOver && dragOver.diaIdx === diaIdx && dragOver.clienteIdx === idx;
                    return (
                      <div key={s.cliente.id}
                           data-sug-card
                           data-dia={diaIdx}
                           data-idx={idx}
                           draggable
                           onDragStart={(e) => handleDragStart(e, diaIdx, idx, s)}
                           onDragOver={(e) => handleDragOver(e, diaIdx, idx)}
                           onDrop={(e) => handleDrop(e, diaIdx, idx)}
                           onDragEnd={handleDragEnd}
                           onTouchStart={(e) => handleTouchStart(e, diaIdx, idx, s)}
                           className="card client-card sug-card"
                           style={{
                             padding: 14, display: 'flex', alignItems: 'center', gap: 12,
                             cursor: 'grab',
                             opacity: isDragging ? 0.3 : 1,
                             borderTop: isDragOverThis ? '3px solid #D85A30' : '1px solid #EBE9E0',
                             transition: 'opacity 0.15s, border-color 0.15s',
                             userSelect: 'none',
                             WebkitUserSelect: 'none'
                           }}>
                        {/* Handle de arrastar */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#D3D1C7', padding: '0 2px', flexShrink: 0 }}>
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#B4B2A9' }} />
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#B4B2A9' }} />
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#B4B2A9' }} />
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#B4B2A9' }} />
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#B4B2A9' }} />
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#B4B2A9' }} />
                        </div>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: cidColor.bg, color: cidColor.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onSelect(s.cliente); }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            <div className="badge" style={{ background: cat.bg, color: cat.text }}>{CAT_STYLES[s.cliente.categoria].curto}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.cliente.nome}</div>
                          </div>
                          <div style={{ fontSize: 11, color: '#888780', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                            <MapPin size={10} /> {s.cliente.bairro}, {s.cliente.cidade}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {s.razoes.slice(0, 3).map((r, ri) => (
                              <div key={ri} style={{ fontSize: 10, padding: '2px 6px', background: '#FAFAF7', border: '1px solid #EBE9E0', borderRadius: 4, color: r.cor, fontWeight: 500 }}>{r.texto}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Ghost card durante touch drag */}
          {touchDragging && draggedItem && draggedItem.sug && draggedItem.sug.cliente && (
            <div style={{
              position: 'fixed',
              left: touchPos.x - 140,
              top: touchPos.y - 30,
              pointerEvents: 'none',
              zIndex: 1000,
              background: 'white',
              border: '2px solid #D85A30',
              borderRadius: 10,
              padding: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              width: 280,
              opacity: 0.95
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {draggedItem.sug.cliente.nome}
              </div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>
                Arraste pra outro dia
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 64, textAlign: 'center' }}>
          <Sparkles size={40} style={{ margin: '0 auto 16px', display: 'block', color: '#D3D1C7' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Todos os clientes prioritários já estão agendados</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888780' }}>Marque algumas visitas como feitas ou aguarde chegar mais dados</p>
        </div>
      )}
    </div>
  );
}

// ============ CALENDÁRIO ============
function Calendario({ visitas, agenda, clientes, onSelectClient }) {
  const [mesOffset, setMesOffset] = useState(0);
  const [diaSelecionado, setDiaSelecionado] = useState(null);

  const hoje = new Date();
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const primeiroDia = new Date(mesAtual);
  const ultimoDia = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
  const diasNoMes = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay(); // 0=domingo

  // Agrupar visitas e agendamentos por dia
  const eventosPorDia = useMemo(() => {
    const m = {};
    visitas.forEach(v => {
      const d = new Date(v.data);
      if (d.getFullYear() === mesAtual.getFullYear() && d.getMonth() === mesAtual.getMonth()) {
        const key = d.getDate();
        if (!m[key]) m[key] = { visitas: [], agendamentos: [] };
        m[key].visitas.push(v);
      }
    });
    agenda.forEach(a => {
      if (a.feita) return;
      const d = new Date(a.data + 'T12:00');
      if (d.getFullYear() === mesAtual.getFullYear() && d.getMonth() === mesAtual.getMonth()) {
        const key = d.getDate();
        if (!m[key]) m[key] = { visitas: [], agendamentos: [] };
        m[key].agendamentos.push(a);
      }
    });
    return m;
  }, [visitas, agenda, mesAtual]);

  const mesNome = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const totalVisitasMes = Object.values(eventosPorDia).reduce((acc, d) => acc + d.visitas.length, 0);
  const diasVisitados = Object.values(eventosPorDia).filter(d => d.visitas.length > 0).length;

  // Construir grid de dias
  const cells = [];
  for (let i = 0; i < diaSemanaInicio; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const diaHoje = hoje.getDate();
  const mesHoje = hoje.getMonth() === mesAtual.getMonth() && hoje.getFullYear() === mesAtual.getFullYear();

  const eventosDiaSelecionado = diaSelecionado && eventosPorDia[diaSelecionado] ? eventosPorDia[diaSelecionado] : null;

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>Calendário</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888780' }}>Histórico mensal de visitas realizadas e agendadas</p>
      </header>

      {/* Controles */}
      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn-secondary" onClick={() => setMesOffset(p => p - 1)} style={{ padding: 8 }}><ChevronLeft size={16} /></button>
          <div style={{ fontSize: 16, fontWeight: 600, minWidth: 180, textAlign: 'center', textTransform: 'capitalize' }}>{mesNome}</div>
          <button className="btn-secondary" onClick={() => setMesOffset(p => p + 1)} style={{ padding: 8 }}><ChevronRight size={16} /></button>
          {mesOffset !== 0 && (
            <button className="chip" onClick={() => { setMesOffset(0); setDiaSelecionado(null); }}>Hoje</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <div><span style={{ color: '#888780' }}>Visitas: </span><strong>{totalVisitasMes}</strong></div>
          <div><span style={{ color: '#888780' }}>Dias ativos: </span><strong>{diasVisitados}</strong></div>
        </div>
      </div>

      {/* Grid do calendário */}
      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 8 }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} style={{ padding: 8, textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((d, idx) => {
            if (d === null) return <div key={idx} />;
            const ev = eventosPorDia[d];
            const temVisita = ev && ev.visitas.length > 0;
            const temAgenda = ev && ev.agendamentos.length > 0;
            const ehHoje = mesHoje && d === diaHoje;
            const ehSelecionado = diaSelecionado === d;
            const intensidade = temVisita ? Math.min(3, ev.visitas.length) : 0;
            const bgCores = ['white', '#EAF3DE', '#C0DD97', '#97C459'];
            const textCores = ['#1A1A1A', '#27500A', '#27500A', '#173404'];

            return (
              <button key={idx} onClick={() => setDiaSelecionado(ehSelecionado ? null : d)} style={{
                aspectRatio: '1', padding: 6,
                background: ehSelecionado ? '#1A1A1A' : bgCores[intensidade],
                color: ehSelecionado ? 'white' : textCores[intensidade],
                border: ehHoje ? '2px solid #D85A30' : '1px solid #EBE9E0',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 2,
                transition: 'all 0.15s',
                fontWeight: temVisita ? 600 : 400,
                fontSize: 13,
                position: 'relative'
              }}>
                <div style={{ fontSize: 13, fontWeight: ehHoje || temVisita ? 700 : 500 }}>{d}</div>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  {temVisita && <div style={{ fontSize: 9, fontWeight: 700 }}>{ev.visitas.length}</div>}
                  {temAgenda && !ehSelecionado && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#BA7517' }} />}
                </div>
              </button>
            );
          })}
        </div>
        {/* Legenda */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, padding: '12px 0 0', borderTop: '1px solid #F0EEE5', fontSize: 11, color: '#888780', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, background: '#EAF3DE', borderRadius: 3, border: '1px solid #EBE9E0' }} />
            1 visita
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, background: '#C0DD97', borderRadius: 3 }} />
            2 visitas
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, background: '#97C459', borderRadius: 3 }} />
            3+ visitas
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#BA7517' }} />
            Visita agendada
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, border: '2px solid #D85A30', borderRadius: 3 }} />
            Hoje
          </div>
        </div>
      </div>

      {/* Detalhes do dia selecionado */}
      {eventosDiaSelecionado && diaSelecionado && (
        <div className="card modal-content" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
              Dia {diaSelecionado} de {mesAtual.toLocaleDateString('pt-BR', { month: 'long' })}
            </h2>
            <button onClick={() => setDiaSelecionado(null)} style={{ padding: 4 }}><X size={18} /></button>
          </div>

          {eventosDiaSelecionado.visitas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#27500A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                ✓ {eventosDiaSelecionado.visitas.length} visita{eventosDiaSelecionado.visitas.length !== 1 ? 's realizadas' : ' realizada'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eventosDiaSelecionado.visitas.map(v => {
                  const c = clientes.find(cl => cl.id === v.clienteId);
                  if (!c) return null;
                  const RESULTADO_LABEL = {
                    compra: { label: 'Compra', bg: '#EAF3DE', text: '#27500A' },
                    interesse: { label: 'Interesse', bg: '#E6F1FB', text: '#0C447C' },
                    revisita: { label: 'Revisita', bg: '#FAEEDA', text: '#633806' },
                    sem_interesse: { label: 'Sem interesse', bg: '#FCEBEB', text: '#791F1F' }
                  };
                  const res = RESULTADO_LABEL[v.resultado] || { label: v.resultado, bg: '#F5F3EC', text: '#5F5E5A' };
                  return (
                    <div key={v.id} className="client-card" onClick={() => onSelectClient(c)} style={{ padding: 12, background: '#FAFAF7', borderRadius: 10, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nome}</div>
                        <div className="badge" style={{ background: res.bg, color: res.text }}>{res.label}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#888780', marginBottom: v.obs ? 6 : 0 }}>
                        <MapPin size={10} style={{ display: 'inline', marginRight: 3 }} /> {c.bairro}, {c.cidade}
                      </div>
                      {v.obs && <div style={{ fontSize: 12, color: '#444441', lineHeight: 1.4, marginTop: 6 }}>{v.obs}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {eventosDiaSelecionado.agendamentos.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#BA7517', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                📅 {eventosDiaSelecionado.agendamentos.length} visita{eventosDiaSelecionado.agendamentos.length !== 1 ? 's agendadas' : ' agendada'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eventosDiaSelecionado.agendamentos.sort((a,b) => a.hora.localeCompare(b.hora)).map(a => {
                  const c = clientes.find(cl => cl.id === a.clienteId);
                  if (!c) return null;
                  return (
                    <div key={a.id} className="client-card" onClick={() => onSelectClient(c)} style={{ padding: 12, background: '#FAEEDA', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#633806', minWidth: 44 }}>{a.hora}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{c.nome}</div>
                        <div style={{ fontSize: 12, color: '#633806' }}>{c.bairro}, {c.cidade}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {diaSelecionado && !eventosDiaSelecionado && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#888780' }}>Nenhuma visita neste dia</div>
        </div>
      )}
    </div>
  );
}

// ============ AGENDA ============
function Agenda({ agenda, clientes, onMarcarFeita, onSelectClient, onExcluir }) {
  const agendaFutura = agenda.filter(a => !a.feita);
  const hoje = new Date().toISOString().slice(0,10);

  const porData = useMemo(() => {
    const m = {};
    agendaFutura.forEach(a => {
      if (!m[a.data]) m[a.data] = [];
      m[a.data].push(a);
    });
    return m;
  }, [agendaFutura]);

  const datasOrdenadas = Object.keys(porData).sort();

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>Agenda</h1>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: '#888780' }}>{agendaFutura.length} visita{agendaFutura.length !== 1 ? 's' : ''} programada{agendaFutura.length !== 1 ? 's' : ''}</p>
      </header>

      {datasOrdenadas.length === 0 ? (
        <div className="card" style={{ padding: 64, textAlign: 'center' }}>
          <Calendar size={40} style={{ margin: '0 auto 16px', display: 'block', color: '#D3D1C7' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Nenhuma visita agendada</h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#888780' }}>Abra um cliente e clique em "Agendar visita"</p>
        </div>
      ) : datasOrdenadas.map(data => {
        const isHoje = data === hoje;
        const d = new Date(data + 'T12:00');
        return (
          <div key={data} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: isHoje ? '#D85A30' : '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isHoje ? 'HOJE' : d.toLocaleDateString('pt-BR', { weekday: 'long' })}
              </div>
              <div style={{ fontSize: 13, color: '#888780' }}>{d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</div>
              <div style={{ flex: 1, height: 1, background: '#EBE9E0' }} />
              <div style={{ fontSize: 12, color: '#888780' }}>{porData[data].length} visita{porData[data].length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {porData[data].sort((a,b) => a.hora.localeCompare(b.hora)).map(a => {
                const c = clientes.find(cl => cl.id === a.clienteId);
                if (!c) return null;
                const cat = CAT_STYLES[c.categoria];
                return (
                  <div key={a.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, minWidth: 52, color: '#1A1A1A' }}>{a.hora}</div>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onSelectClient(c)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div className="badge" style={{ background: cat.bg, color: cat.text }}>{CAT_STYLES[c.categoria].curto}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#888780', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={11} /> {c.bairro}, {c.cidade}
                      </div>
                      {a.obs && <div style={{ fontSize: 12, color: '#5F5E5A', marginTop: 6, fontStyle: 'italic' }}>"{a.obs}"</div>}
                    </div>
                    <button className="btn-secondary" onClick={() => onMarcarFeita(a.id)} style={{ padding: '8px 14px', fontSize: 13 }}>
                      <CheckCircle2 size={14} style={{ marginRight: 4, display: 'inline' }} /> Feita
                    </button>
                    <button onClick={() => onExcluir(a.id)} title="Excluir agendamento" style={{ padding: 8, borderRadius: 8, color: '#791F1F', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ CLIENT DETAIL ============
function ClientDetail({ cliente, onClose, visitas, agendamentos, onRegistrarVisita, onAgendar, onUpdateCategoria, onExcluirVisita, onExcluirAgendamento, onEditar }) {
  const [tab, setTab] = useState('info');
  const [obs, setObs] = useState('');
  const [resultado, setResultado] = useState('interesse');
  const [dataVisita, setDataVisita] = useState(new Date().toISOString().slice(0,10));
  const [agendaData, setAgendaData] = useState('');
  const [agendaHora, setAgendaHora] = useState('09:00');
  const [agendaObs, setAgendaObs] = useState('');
  const cat = CAT_STYLES[cliente.categoria];
  const cidColor = CITY_COLORS[cliente.cidade] || CITY_COLORS[''];

  const handleRegistrar = () => {
    if (!obs.trim()) return;
    // Converte a data escolhida para ISO completa (mantém horário de agora)
    const agora = new Date();
    const [ano, mes, dia] = dataVisita.split('-').map(Number);
    const dataFinal = new Date(ano, mes - 1, dia, agora.getHours(), agora.getMinutes()).toISOString();
    onRegistrarVisita(obs, resultado, dataFinal);
    setObs(''); setResultado('interesse');
    setDataVisita(new Date().toISOString().slice(0,10));
    setTab('info');
  };

  const handleAgendar = () => {
    if (!agendaData) return;
    onAgendar(agendaData, agendaHora, agendaObs);
    setAgendaData(''); setAgendaObs('');
    setTab('info');
  };

  const hojeISO = new Date().toISOString().slice(0,10);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.endereco || cliente.nome)}`;
  const telDigits = (cliente.telefone || '').replace(/\D/g, '');
  const whatsappUrl = telDigits ? `https://wa.me/55${telDigits.startsWith('55') ? telDigits.slice(2) : telDigits}` : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0 }} onClick={onClose}>
      <div className="modal-content" style={{ background: 'white', borderRadius: '16px 16px 0 0', maxWidth: 640, width: '100%', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '24px 24px 0', position: 'sticky', top: 0, background: 'white', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <div className="badge" style={{ background: cat.bg, color: cat.text }}>{cliente.categoria === 'A' && <Star size={10} />} {CAT_STYLES[cliente.categoria].label}</div>
                <div className="badge" style={{ background: cidColor.bg, color: cidColor.text }}>{cliente.cidade || 'Outros'}</div>
              </div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em' }}>{cliente.nome}</h2>
            </div>
            <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
              {onEditar && (
                <button onClick={onEditar} title="Editar cliente" style={{ padding: 8, borderRadius: 8, fontSize: 13, fontWeight: 500, color: '#1A1A1A', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Settings size={16} /> Editar
                </button>
              )}
              <button onClick={onClose} style={{ padding: 8, borderRadius: 8 }}><X size={20} /></button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={14} /> Rota
            </a>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Phone size={14} /> WhatsApp
              </a>
            )}
          </div>

          <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #EBE9E0', overflow: 'auto' }}>
            {[
              { id: 'info', label: 'Informações' },
              { id: 'visita', label: 'Nova visita' },
              { id: 'agenda', label: 'Agendar' },
              { id: 'historico', label: `Histórico (${visitas.length})` }
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '10px 14px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                color: tab === t.id ? '#1A1A1A' : '#888780',
                borderBottom: tab === t.id ? '2px solid #1A1A1A' : '2px solid transparent',
                marginBottom: -1
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {tab === 'info' && (
            <div>
              <InfoRow label="Endereço" value={cliente.endereco || '—'} />
              <InfoRow label="Comprador" value={cliente.comprador || '—'} />
              <InfoRow label="Telefone" value={cliente.telefone || '—'} />
              <div style={{ marginTop: 16, padding: 16, background: '#FAFAF7', borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', fontWeight: 500, letterSpacing: '0.05em', marginBottom: 6 }}>Última tratativa</div>
                <div style={{ fontSize: 13, color: '#444441', lineHeight: 1.5 }}>{cliente.tratativa || 'Sem observações'}</div>
              </div>

              {agendamentos.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', marginBottom: 8 }}>Próximas visitas</div>
                  {agendamentos.map(a => (
                    <div key={a.id} style={{ padding: 10, background: '#FAEEDA', borderRadius: 8, marginBottom: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} style={{ color: '#BA7517' }} />
                      <span style={{ color: '#633806', fontWeight: 500, flex: 1 }}>{new Date(a.data + 'T12:00').toLocaleDateString('pt-BR')} às {a.hora}</span>
                      <button onClick={() => onExcluirAgendamento(a.id)} title="Excluir agendamento" style={{ padding: 4, color: '#791F1F', display: 'flex' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Mudar categoria</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['A', 'B', 'C'].map(c => {
                    const ativo = cliente.categoria === c;
                    return (
                      <button key={c} onClick={() => onUpdateCategoria(c)}
                        style={{
                          padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                          background: ativo ? CAT_STYLES[c].text : 'white',
                          color: ativo ? 'white' : CAT_STYLES[c].text,
                          border: `1px solid ${CAT_STYLES[c].border}`
                        }}>
                        {CAT_STYLES[c].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'visita' && (
            <div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Data da visita</label>
                <input
                  type="date"
                  value={dataVisita}
                  max={new Date().toISOString().slice(0,10)}
                  onChange={e => setDataVisita(e.target.value)}
                  style={{ width: '100%', padding: 12, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }}
                />
                <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>
                  {dataVisita === new Date().toISOString().slice(0,10) ? '📍 Hoje' : '📅 Registrando visita retroativa'}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Resultado</label>
                <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { v: 'compra', l: 'Compra realizada' },
                    { v: 'interesse', l: 'Interesse' },
                    { v: 'revisita', l: 'Agendar revisita' },
                    { v: 'sem_interesse', l: 'Sem interesse' }
                  ].map(o => (
                    <button key={o.v} onClick={() => setResultado(o.v)} style={{
                      padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500, textAlign: 'left',
                      border: `1px solid ${resultado === o.v ? '#1A1A1A' : '#E5E3DC'}`,
                      background: resultado === o.v ? '#1A1A1A' : 'white',
                      color: resultado === o.v ? 'white' : '#1A1A1A'
                    }}>{o.l}</button>
                  ))}
                </div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Anotações da visita</label>
              <textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="O que foi conversado? Próximos passos?" rows={5}
                style={{ width: '100%', padding: 12, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
              <button onClick={handleRegistrar} disabled={!obs.trim()} className="btn-primary" style={{ width: '100%', marginTop: 12, opacity: obs.trim() ? 1 : 0.5 }}>
                Registrar visita
              </button>
            </div>
          )}

          {tab === 'agenda' && (
            <div>
              <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Data</label>
                  <input type="date" value={agendaData} min={hojeISO} onChange={e => setAgendaData(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Hora</label>
                  <input type="time" value={agendaHora} onChange={e => setAgendaHora(e.target.value)} style={{ width: '100%', padding: 12, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
                </div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Observação (opcional)</label>
              <textarea value={agendaObs} onChange={e => setAgendaObs(e.target.value)} placeholder="Ex: Levar catálogo da Eucatex, apresentar campanha de Abril" rows={3}
                style={{ width: '100%', padding: 12, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none' }} />
              <button onClick={handleAgendar} disabled={!agendaData} className="btn-primary" style={{ width: '100%', marginTop: 12, opacity: agendaData ? 1 : 0.5 }}>
                <Calendar size={14} style={{ marginRight: 6, display: 'inline' }} /> Agendar visita
              </button>
            </div>
          )}

          {tab === 'historico' && (
            <div>
              {visitas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#888780' }}>
                  <Clock size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.5 }} />
                  <div style={{ fontSize: 13 }}>Nenhuma visita registrada</div>
                </div>
              ) : visitas.map(v => {
                const d = new Date(v.data);
                return (
                  <div key={v.id} style={{ padding: 14, background: '#FAFAF7', borderRadius: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{v.resultado.replace('_', ' ')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 11, color: '#888780' }}>{d.toLocaleDateString('pt-BR')}</div>
                        <button onClick={() => onExcluirVisita(v.id)} title="Excluir visita" style={{ padding: 4, color: '#791F1F', display: 'flex' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: '#444441', lineHeight: 1.5 }}>{v.obs}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ CLIENTE FORM (novo/editar) ============
function ClienteForm({ clienteExistente, onClose, onSalvar }) {
  const modoEdicao = !!clienteExistente;
  const [form, setForm] = useState({
    nome: clienteExistente?.nome || '',
    endereco: clienteExistente?.endereco || '',
    rua: clienteExistente?.rua || '',
    bairro: clienteExistente?.bairro || '',
    cidade: clienteExistente?.cidade || '',
    cep: clienteExistente?.cep || '',
    comprador: clienteExistente?.comprador || '',
    telefone: clienteExistente?.telefone || '',
    tratativa: clienteExistente?.tratativa || '',
    categoria: clienteExistente?.categoria || 'C'
  });
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      alert('O nome do cliente é obrigatório.');
      return;
    }
    setSalvando(true);
    await onSalvar(form);
    setSalvando(false);
  };

  const set = (campo, valor) => setForm(prev => ({ ...prev, [campo]: valor }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E3DC', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            {modoEdicao ? 'Editar cliente' : 'Novo cliente'}
          </h2>
          <button onClick={onClose} style={{ padding: 4 }}><X size={20} /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome do cliente *</label>
              <input type="text" value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Depósito São João"
                style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Endereço completo</label>
              <input type="text" value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Ex: Av. das Flores, 123 - Centro, São Bernardo do Campo - SP, 09700-000"
                style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
              <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>Esse é o que aparece no botão de rota. Preenche bairro e cidade abaixo também pra aparecer nos filtros.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Bairro</label>
                <input type="text" value={form.bairro} onChange={e => set('bairro', e.target.value)} placeholder="Centro"
                  style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Cidade</label>
                <input type="text" value={form.cidade} onChange={e => set('cidade', e.target.value)} placeholder="São Bernardo do Campo"
                  style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>CEP</label>
                <input type="text" value={form.cep} onChange={e => set('cep', e.target.value)} placeholder="09700-000"
                  style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Categoria</label>
                <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                  style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14, background: 'white' }}>
                  <option value="A">Grande</option>
                  <option value="B">Médio</option>
                  <option value="C">Pequeno</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Comprador / contato</label>
              <input type="text" value={form.comprador} onChange={e => set('comprador', e.target.value)} placeholder="Nome do responsável"
                style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Telefone</label>
              <input type="text" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 99999-9999"
                style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Tratativa / observações</label>
              <textarea value={form.tratativa} onChange={e => set('tratativa', e.target.value)} rows={3} placeholder="Histórico, produtos de interesse, próximos passos..."
                style={{ width: '100%', padding: 10, border: '1px solid #E5E3DC', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E3DC', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary" disabled={salvando}>Cancelar</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={salvando || !form.nome.trim()}>
            {salvando ? 'Salvando...' : (modoEdicao ? 'Salvar alterações' : 'Cadastrar cliente')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ LOGIN SCREEN ============
function LoginScreen({ onLogin }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!senha.trim()) return;
    setCarregando(true);
    setTimeout(() => {
      const ok = onLogin(senha);
      if (!ok) {
        setErro(true);
        setSenha('');
        setCarregando(false);
      }
    }, 300);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A1A1A', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'white', letterSpacing: '-0.03em', marginBottom: 8 }}>ROTA<span style={{ color: '#BA7517' }}>.</span></div>
          <div style={{ fontSize: 13, color: '#888780' }}>Gestão de carteira de clientes</div>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: 28 }}>
          <h1 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 700 }}>Acessar o app</h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888780' }}>Digite sua senha para continuar.</p>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
              autoFocus
              placeholder="Digite a senha"
              style={{
                width: '100%',
                padding: 12,
                border: `1px solid ${erro ? '#E24B4A' : '#E5E3DC'}`,
                borderRadius: 10,
                fontSize: 15,
                outline: 'none',
                marginBottom: 4
              }}
            />
            {erro && (
              <div style={{ fontSize: 12, color: '#791F1F', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> Senha incorreta. Tente novamente.
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!senha.trim() || carregando}
            className="btn-primary"
            style={{ width: '100%', marginTop: 16, opacity: (!senha.trim() || carregando) ? 0.5 : 1 }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#5F5E5A' }}>
          O acesso fica salvo por 30 dias neste dispositivo.
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #F0EEE5' }}>
      <div style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1A1A1A' }}>{value}</div>
    </div>
  );
}
