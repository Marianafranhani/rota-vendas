import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ===== CLIENTES =====
export async function carregarClientes() {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('num', { ascending: true })
  if (error) throw error
  return data || []
}

export async function salvarCliente(cliente) {
  const { data, error } = await supabase
    .from('clientes')
    .upsert(cliente, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarCategoria(id, categoria) {
  const { error } = await supabase
    .from('clientes')
    .update({ categoria })
    .eq('id', id)
  if (error) throw error
}

export async function atualizarTratativa(id, tratativa) {
  const { error } = await supabase
    .from('clientes')
    .update({ tratativa })
    .eq('id', id)
  if (error) throw error
}

export async function inserirClientesLote(clientes) {
  // Upsert em lote por nome (normalizado)
  const { data, error } = await supabase
    .from('clientes')
    .upsert(clientes, { onConflict: 'nome' })
    .select()
  if (error) throw error
  return data
}

// ===== VISITAS =====
export async function carregarVisitas() {
  const { data, error } = await supabase
    .from('visitas')
    .select('*')
    .order('data', { ascending: false })
  if (error) throw error
  return data || []
}

export async function registrarVisita(visita) {
  const { data, error } = await supabase
    .from('visitas')
    .insert(visita)
    .select()
    .single()
  if (error) throw error
  return data
}

// ===== AGENDA =====
export async function carregarAgenda() {
  const { data, error } = await supabase
    .from('agenda')
    .select('*')
    .order('data', { ascending: true })
  if (error) throw error
  return data || []
}

export async function agendarVisita(item) {
  const { data, error } = await supabase
    .from('agenda')
    .insert(item)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function marcarAgendaFeita(id) {
  const { error } = await supabase
    .from('agenda')
    .update({ feita: true })
    .eq('id', id)
  if (error) throw error
}
