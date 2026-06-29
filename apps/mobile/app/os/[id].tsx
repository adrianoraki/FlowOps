import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Switch, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { SignaturePad } from '../../src/components/SignaturePad'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import firestore from '@react-native-firebase/firestore'
import type { Atendimento } from '@flowops/types'
import { useAuth } from '../../src/context/AuthContext'
import { STATUS_CONFIG, TIPO_CONFIG, ATENDIMENTO_VAZIO, STATUS_READONLY } from '../../src/utils/osConfig'

const SEEN_KEY = '@flowops/seenOSIds'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface OSDetalhe {
  id: string
  numero?: number
  tipo: string
  status: string
  clienteId: string
  cidade: string
  estado: string
  loja: string
  veiculo: string
  regiao: string
  dataAbertura: { toDate(): Date } | null
  entrada: string
  saida: string
  tecnicoId: string
  atendimentos: Atendimento[]
  comentarios: string
  solicitacaoMaterial: string
  assinaturaClienteBase64?: string
  assinaturaClienteUrl?: string
  nomeLegivel?: string
  matriculaCliente?: string
  assinaturaTecnicoBase64?: string
  assinaturaTecnicoUrl?: string
  rgTecnico?: string
  fechadaEm?: { toDate(): Date } | null
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280' }
  return (
    <View style={[sbg.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[sbg.txt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  )
}
const sbg = StyleSheet.create({
  wrap: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  txt:  { fontSize: 12, fontWeight: '700' },
})

function InfoField({ label, value }: { label: string; value?: string }) {
  return (
    <View style={inf.wrap}>
      <Text style={inf.label}>{label}</Text>
      <Text style={inf.value}>{value || '—'}</Text>
    </View>
  )
}
const inf = StyleSheet.create({
  wrap:  { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
})

function InputField({ label, value, onChange, multiline, editable = true }: {
  label: string; value: string; onChange?: (v: string) => void
  multiline?: boolean; editable?: boolean
}) {
  return (
    <View style={inp.wrap}>
      <Text style={inp.label}>{label}</Text>
      <TextInput
        style={[inp.input, multiline && inp.multi, !editable && inp.disabled]}
        value={value}
        onChangeText={onChange}
        editable={editable}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'auto'}
        placeholderTextColor="#9ca3af"
      />
    </View>
  )
}
const inp = StyleSheet.create({
  wrap:     { marginBottom: 10 },
  label:    { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  input:    { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937', backgroundColor: '#fff' },
  multi:    { minHeight: 80, paddingTop: 10 },
  disabled: { backgroundColor: '#f5f6f8', color: '#9ca3af' },
})

function SwitchField({ label, value, onChange, disabled }: {
  label: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <View style={sw.wrap}>
      <Text style={sw.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#e5e7eb', true: '#bfdbfe' }}
        thumbColor={value ? '#2563eb' : '#9ca3af'}
        ios_backgroundColor="#e5e7eb"
      />
    </View>
  )
}
const sw = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingVertical: 4 },
  label: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
})

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function OSDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { user, role } = useAuth()

  const [os, setOs] = useState<OSDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Estado do formulário
  const [formAtendimentos, setFormAtendimentos] = useState<Atendimento[]>([{ ...ATENDIMENTO_VAZIO }])
  const [formComentarios, setFormComentarios] = useState('')
  const [formSolicitacao, setFormSolicitacao] = useState('')

  // Assinaturas
  const [sigCliente, setSigCliente]             = useState('')
  const [nomeLegivel, setNomeLegivel]            = useState('')
  const [matriculaCliente, setMatriculaCliente]  = useState('')
  const [sigTecnico, setSigTecnico]              = useState('')
  const [rgTecnico, setRgTecnico]                = useState('')
  const [modalSig, setModalSig]                  = useState<'cliente' | 'tecnico' | null>(null)

  const formInitialized = useRef(false)

  // ── Carregar OS em tempo real ───────────────────────────────────────────
  useEffect(() => {
    if (!id) return

    // Marcar como vista ao abrir
    AsyncStorage.getItem(SEEN_KEY)
      .then(val => {
        const seen = new Set<string>(val ? JSON.parse(val) as string[] : [])
        seen.add(id)
        return AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
      })
      .catch(() => {})

    const unsub = firestore()
      .collection('ordens_servico')
      .doc(id)
      .onSnapshot(
        snap => {
          if (!snap.exists) { setErro('OS não encontrada.'); setLoading(false); return }
          const data = snap.data() as Omit<OSDetalhe, 'id'>
          setOs({ id: snap.id, ...data })

          if (!formInitialized.current) {
            setFormAtendimentos(
              data.atendimentos?.length > 0
                ? data.atendimentos.map(a => ({ ...ATENDIMENTO_VAZIO, ...a }))
                : [{ ...ATENDIMENTO_VAZIO }]
            )
            setFormComentarios(data.comentarios ?? '')
            setFormSolicitacao(data.solicitacaoMaterial ?? '')
            setSigCliente(data.assinaturaClienteBase64 ?? '')
            setNomeLegivel(data.nomeLegivel ?? '')
            setMatriculaCliente(data.matriculaCliente ?? '')
            setSigTecnico(data.assinaturaTecnicoBase64 ?? '')
            setRgTecnico(data.rgTecnico ?? '')
            formInitialized.current = true
          }
          setLoading(false)
        },
        () => { setErro('Erro ao carregar OS.'); setLoading(false) },
      )
    return unsub
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={s.flex}>
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  if (erro || !os) {
    return (
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backTxt}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={s.erroTxt}>{erro || 'OS não encontrada.'}</Text>
      </SafeAreaView>
    )
  }

  const readOnly = STATUS_READONLY.has(os.status)
  const dataFmt = os.dataAbertura?.toDate().toLocaleDateString('pt-BR') ?? '—'

  const podeIniciarFinalizar =
    role === 'admin' || role === 'gestor' || os.tecnicoId === user?.uid

  function calcularTempo(entrada: string, saida: string): string {
    if (!entrada || !saida) return ''
    const [eh, em] = entrada.split(':').map(Number)
    const [sh, sm] = saida.split(':').map(Number)
    const total = (sh * 60 + sm) - (eh * 60 + em)
    if (total <= 0) return ''
    const h = Math.floor(total / 60)
    const m = total % 60
    return h > 0 ? `${h}h ${m}min` : `${m}min`
  }

  // ── Handlers do formulário ──────────────────────────────────────────────

  function setAt<K extends keyof Atendimento>(idx: number, key: K, val: Atendimento[K]) {
    setFormAtendimentos(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: val }
      return next
    })
  }

  function addAt() {
    setFormAtendimentos(prev => [...prev, { ...ATENDIMENTO_VAZIO }])
  }

  function removeAt(idx: number) {
    setFormAtendimentos(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Ações Firestore ─────────────────────────────────────────────────────

  async function iniciarAtendimento() {
    if (!id || !user) return
    setSalvando(true)
    const agora = new Date()
    const hora = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`
    try {
      await firestore().collection('ordens_servico').doc(id).update({
        status: 'em_andamento',
        entrada: hora,
        updatedAt: firestore.FieldValue.serverTimestamp(),
        atualizadoPorId: user.uid,
      })
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar o atendimento.')
    } finally {
      setSalvando(false)
    }
  }

  function handleFinalizar() {
    if (!os) return
    const temSigCliente = !!(os.assinaturaClienteBase64 || os.assinaturaClienteUrl)
    const temSigTecnico = !!(os.assinaturaTecnicoBase64 || os.assinaturaTecnicoUrl)
    if (!temSigCliente || !temSigTecnico) {
      Alert.alert('Assinaturas necessárias', 'É necessário coletar as assinaturas antes de finalizar.')
      return
    }
    Alert.alert(
      'Finalizar OS',
      'Finalizar a OS? Ela não poderá mais ser editada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: executarFinalizar },
      ]
    )
  }

  async function executarFinalizar() {
    if (!id || !user) return
    setSalvando(true)
    const agora = new Date()
    const hora = `${agora.getHours().toString().padStart(2, '0')}:${agora.getMinutes().toString().padStart(2, '0')}`
    try {
      await firestore().collection('ordens_servico').doc(id).update({
        status: 'concluida',
        saida: hora,
        fechadaEm: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        atualizadoPorId: user.uid,
      })
    } catch {
      Alert.alert('Erro', 'Não foi possível finalizar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function salvar() {
    if (!id || !user) return
    setSalvando(true)
    try {
      await firestore().collection('ordens_servico').doc(id).update({
        atendimentos:             formAtendimentos,
        comentarios:              formComentarios,
        solicitacaoMaterial:      formSolicitacao,
        assinaturaClienteBase64:  sigCliente,
        nomeLegivel,
        matriculaCliente,
        assinaturaTecnicoBase64:  sigTecnico,
        rgTecnico,
        updatedAt:                firestore.FieldValue.serverTimestamp(),
        atualizadoPorId:          user.uid,
      })
      Alert.alert('Salvo', 'OS atualizada com sucesso.')
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.\n(Offline: será sincronizado quando houver conexão.)')
    } finally {
      setSalvando(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.flex}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backTxt}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.osNum}>OS {os.numero ? `#${os.numero}` : `…${id.slice(-6)}`}</Text>
            <StatusBadge status={os.status} />
          </View>
          <View style={{ width: 40 }} />
        </View>

        {readOnly && (
          <View style={s.avisoSoLeitura}>
            <Text style={s.avisoTxt}>🔒 OS encerrada — somente leitura</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* ── Informações ─────────────────────────────────────────── */}
          <Text style={s.secTitulo}>Informações</Text>
          <View style={s.card}>
            <InfoField label="Cliente / Parceiro" value={os.clienteId} />
            <View style={s.linha}>
              <View style={s.flex}><InfoField label="Cidade" value={os.cidade} /></View>
              <View style={{ width: 56 }}><InfoField label="UF" value={os.estado} /></View>
            </View>
            <InfoField label="Loja" value={os.loja} />
            <InfoField label="Veículo" value={os.veiculo} />
            <View style={s.linha}>
              <View style={s.flex}><InfoField label="Data" value={dataFmt} /></View>
              <View style={s.flex}><InfoField label="Tipo" value={TIPO_CONFIG[os.tipo] ?? os.tipo} /></View>
            </View>
            <View style={s.linha}>
              <View style={s.flex}><InfoField label="Entrada" value={os.entrada} /></View>
              <View style={s.flex}><InfoField label="Saída" value={os.saida} /></View>
            </View>
          </View>

          {/* ── Entrada / Saída / Tempo ─────────────────────────────── */}
          {(os.entrada || os.saida) && (
            <View style={s.tempoCard}>
              {os.entrada ? (
                <View style={s.tempoLinha}>
                  <Text style={s.tempoLabel}>Entrada</Text>
                  <Text style={s.tempoValor}>{os.entrada}</Text>
                </View>
              ) : null}
              {os.saida ? (
                <View style={s.tempoLinha}>
                  <Text style={s.tempoLabel}>Saída</Text>
                  <Text style={s.tempoValor}>{os.saida}</Text>
                </View>
              ) : null}
              {os.entrada && os.saida && calcularTempo(os.entrada, os.saida) ? (
                <View style={[s.tempoLinha, s.tempoTotalLinha]}>
                  <Text style={s.tempoLabel}>Tempo total</Text>
                  <Text style={s.tempoTotal}>{calcularTempo(os.entrada, os.saida)}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ── Atendimentos ────────────────────────────────────────── */}
          <Text style={s.secTitulo}>Atendimentos</Text>

          {formAtendimentos.map((at, idx) => (
            <View key={idx} style={s.card}>
              <View style={s.atHeader}>
                <Text style={s.atNum}>Balança {idx + 1}</Text>
                {!readOnly && formAtendimentos.length > 1 && (
                  <TouchableOpacity onPress={() => removeAt(idx)} style={s.removerBtn}>
                    <Text style={s.removerTxt}>Remover</Text>
                  </TouchableOpacity>
                )}
              </View>
              <InputField label="Chamado"    value={at.chamado}    onChange={v => setAt(idx, 'chamado', v)}    editable={!readOnly} />
              <InputField label="Modelo"     value={at.modelo}     onChange={v => setAt(idx, 'modelo', v)}     editable={!readOnly} />
              <InputField label="N° Série"   value={at.nSerie}     onChange={v => setAt(idx, 'nSerie', v)}     editable={!readOnly} />
              <SwitchField label="Mau Uso"   value={at.mauUso}     onChange={v => setAt(idx, 'mauUso', v)}     disabled={readOnly} />
              <InputField label="N° INMETRO"   value={at.nInmetro}    onChange={v => setAt(idx, 'nInmetro', v)}    editable={!readOnly} />
              <InputField label="Selo INMETRO" value={at.seloInmetro} onChange={v => setAt(idx, 'seloInmetro', v)} editable={!readOnly} />
              <InputField label="Selo Atual"   value={at.seloAtual}   onChange={v => setAt(idx, 'seloAtual', v)}   editable={!readOnly} />
              <InputField label="Portaria"     value={at.portaria}    onChange={v => setAt(idx, 'portaria', v)}    editable={!readOnly} />
              <SwitchField label="Etq. Reparado" value={at.etqReparado} onChange={v => setAt(idx, 'etqReparado', v)} disabled={readOnly} />
              <InputField
                label="Descrição da Intervenção"
                value={at.descricaoIntervencao}
                onChange={v => setAt(idx, 'descricaoIntervencao', v)}
                multiline
                editable={!readOnly}
              />
            </View>
          ))}

          {!readOnly && (
            <TouchableOpacity style={s.addAtBtn} onPress={addAt}>
              <Text style={s.addAtTxt}>+ Adicionar balança</Text>
            </TouchableOpacity>
          )}

          {/* ── Observações ─────────────────────────────────────────── */}
          <Text style={s.secTitulo}>Observações</Text>
          <View style={s.card}>
            <InputField label="Comentários" value={formComentarios} onChange={setFormComentarios} multiline editable={!readOnly} />
            <InputField label="Solicitação de Material" value={formSolicitacao} onChange={setFormSolicitacao} multiline editable={!readOnly} />
          </View>

          {/* ── Assinatura do cliente ────────────────────────────── */}
          <Text style={s.secTitulo}>Assinatura do Cliente</Text>
          <View style={s.card}>
            <InputField label="Nome legível"    value={nomeLegivel}      onChange={setNomeLegivel}      editable={!readOnly} />
            <InputField label="Matrícula"        value={matriculaCliente} onChange={setMatriculaCliente} editable={!readOnly} />
            {sigCliente ? (
              <View style={s.sigWrap}>
                <Image source={{ uri: sigCliente }} style={s.sigImg} resizeMode="contain" />
                {!readOnly && (
                  <TouchableOpacity style={s.btnLimparSig} onPress={() => setSigCliente('')}>
                    <Text style={s.btnLimparSigTxt}>Limpar assinatura</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              !readOnly && (
                <TouchableOpacity style={s.btnAssinar} onPress={() => setModalSig('cliente')}>
                  <Text style={s.btnAssinarTxt}>✍️ Assinar</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          {/* ── Assinatura do técnico ────────────────────────────── */}
          <Text style={s.secTitulo}>Assinatura do Técnico</Text>
          <View style={s.card}>
            <InputField label="RG do técnico" value={rgTecnico} onChange={setRgTecnico} editable={!readOnly} />
            {sigTecnico ? (
              <View style={s.sigWrap}>
                <Image source={{ uri: sigTecnico }} style={s.sigImg} resizeMode="contain" />
                {!readOnly && (
                  <TouchableOpacity style={s.btnLimparSig} onPress={() => setSigTecnico('')}>
                    <Text style={s.btnLimparSigTxt}>Limpar assinatura</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              !readOnly && (
                <TouchableOpacity style={s.btnAssinar} onPress={() => setModalSig('tecnico')}>
                  <Text style={s.btnAssinarTxt}>✍️ Assinar</Text>
                </TouchableOpacity>
              )
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Modais de assinatura */}
        <SignaturePad
          visible={modalSig === 'cliente'}
          titulo="Assinatura do Cliente"
          onConfirmar={data => { setSigCliente(data); setModalSig(null) }}
          onCancelar={() => setModalSig(null)}
        />
        <SignaturePad
          visible={modalSig === 'tecnico'}
          titulo="Assinatura do Técnico"
          onConfirmar={data => { setSigTecnico(data); setModalSig(null) }}
          onCancelar={() => setModalSig(null)}
        />

        {/* ── Barra de ações ──────────────────────────────────────────── */}
        {!readOnly && (
          <View style={s.actionBar}>
            {os.status === 'aberta' && podeIniciarFinalizar && (
              <TouchableOpacity
                style={[s.btnIniciar, salvando && s.btnDisabled]}
                onPress={iniciarAtendimento}
                disabled={salvando}
              >
                <Text style={s.btnIniciarTxt}>Iniciar</Text>
              </TouchableOpacity>
            )}
            {os.status === 'em_andamento' && podeIniciarFinalizar && (
              <TouchableOpacity
                style={[s.btnFinalizar, salvando && s.btnDisabled]}
                onPress={handleFinalizar}
                disabled={salvando}
              >
                <Text style={s.btnFinalizarTxt}>Finalizar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.btnSalvar, salvando && s.btnDisabled]}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnSalvarTxt}>Salvar</Text>
              }
            </TouchableOpacity>
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f5f6f8' },
  scroll: { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:    { padding: 8 },
  backTxt:    { fontSize: 18, color: '#2563eb', fontWeight: '600' },
  headerCenter: { alignItems: 'center', gap: 4 },
  osNum:      { fontSize: 14, fontWeight: '700', color: '#1f2937' },

  avisoSoLeitura: {
    backgroundColor: '#fef3c7', borderBottomWidth: 1, borderBottomColor: '#fde68a',
    paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center',
  },
  avisoTxt: { fontSize: 13, color: '#92400e', fontWeight: '600' },

  erroTxt: { textAlign: 'center', color: '#dc2626', marginTop: 40, fontSize: 16 },

  secTitulo: {
    fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 8, marginTop: 4,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },

  linha: { flexDirection: 'row', gap: 12 },

  // Atendimento card
  atHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  atNum:    { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  removerBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#fee2e2', borderRadius: 8 },
  removerTxt: { fontSize: 13, color: '#dc2626', fontWeight: '600' },

  addAtBtn: {
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, borderStyle: 'dashed',
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  addAtTxt: { color: '#2563eb', fontSize: 15, fontWeight: '700' },

  // Assinaturas
  sigWrap:       { marginTop: 8 },
  sigImg:        { width: '100%', height: 140, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  btnLimparSig:  { marginTop: 8, alignItems: 'center', paddingVertical: 8 },
  btnLimparSigTxt: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  btnAssinar: {
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnAssinarTxt: { color: '#2563eb', fontSize: 15, fontWeight: '700' },

  // Tempo entrada/saída
  tempoCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb',
    gap: 6,
  },
  tempoLinha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tempoTotalLinha: {
    borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, marginTop: 2,
  },
  tempoLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tempoValor: { fontSize: 13, color: '#1f2937', fontWeight: '600' },
  tempoTotal: { fontSize: 15, color: '#2563eb', fontWeight: '800' },

  // Action bar
  actionBar: {
    flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  btnIniciar: {
    flex: 1, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1,
    borderColor: '#bfdbfe', paddingVertical: 14, alignItems: 'center',
  },
  btnIniciarTxt: { color: '#1d4ed8', fontSize: 15, fontWeight: '700' },
  btnFinalizar: {
    flex: 1, backgroundColor: '#15803d', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  btnFinalizarTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSalvar:     { flex: 1, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSalvarTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled:   { opacity: 0.6 },
})
