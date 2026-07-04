import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TextInput, Switch, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, Image, Modal,
} from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { SignaturePad } from '../../src/components/SignaturePad'
import { useLocalSearchParams, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import firestore from '@react-native-firebase/firestore'
import type { Atendimento } from '@flowops/types'
import { useAuth } from '../../src/context/AuthContext'
import { STATUS_CONFIG, TIPO_CONFIG, ATENDIMENTO_VAZIO, STATUS_READONLY } from '../../src/utils/osConfig'
import { computeSyncStatus, type SyncStatus } from '../../src/utils/syncStatus'
import { SyncStatusBar } from '../../src/components/SyncStatusBar'

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

type CampoPicker = 'dataAbertura' | 'entrada' | 'saida'

interface PickerAtivo {
  campo: CampoPicker
  mode: 'date' | 'time'
  valor: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoParaDate(val: string | null | undefined): Date | null {
  if (!val) return null
  // Legado: "HH:MM" — assume hoje
  if (/^\d{2}:\d{2}$/.test(val)) {
    const d = new Date()
    const [h, m] = val.split(':').map(Number)
    d.setHours(h, m, 0, 0)
    return d
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function formatarDataHora(val: string | null | undefined): string {
  if (!val) return '—'
  // Legado: exibe só a hora sem data
  if (/^\d{2}:\d{2}$/.test(val)) return val
  const d = isoParaDate(val)
  if (!d) return val
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${data}  ${hora}`
}

function calcularTempo(entrada: string, saida: string): string {
  const eD = isoParaDate(entrada)
  const sD = isoParaDate(saida)
  if (!eD || !sD) return ''
  const diffMin = Math.round((sD.getTime() - eD.getTime()) / 60000)
  if (diffMin <= 0) return ''
  const h = Math.floor(diffMin / 60), m = diffMin % 60
  return h > 0 ? `${h}h ${m}min` : `${m}min`
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

function DateTimePickerField({ label, value, onPress }: {
  label: string
  value: string
  onPress: () => void
}) {
  const temValor = !!value
  return (
    <View style={dtp.wrap}>
      <Text style={dtp.label}>{label}</Text>
      <TouchableOpacity style={dtp.btn} onPress={onPress} activeOpacity={0.75}>
        <Text style={[dtp.valor, !temValor && dtp.placeholder]}>
          {temValor ? formatarDataHora(value) : 'Toque para definir'}
        </Text>
        <Text style={dtp.icone}>📅</Text>
      </TouchableOpacity>
    </View>
  )
}
const dtp = StyleSheet.create({
  wrap:        { marginBottom: 12 },
  label:       { fontSize: 11, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#fff' },
  valor:       { fontSize: 14, color: '#1f2937', fontWeight: '500' },
  placeholder: { color: '#9ca3af', fontStyle: 'italic' },
  icone:       { fontSize: 16 },
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
  const [syncMeta, setSyncMeta] = useState<{ fromCache: boolean; hasPendingWrites: boolean } | null>(null)
  const syncStatus: SyncStatus = computeSyncStatus([syncMeta])

  // Formulário
  const [formAtendimentos, setFormAtendimentos] = useState<Atendimento[]>([{ ...ATENDIMENTO_VAZIO }])
  const [formComentarios, setFormComentarios]   = useState('')
  const [formSolicitacao, setFormSolicitacao]   = useState('')
  const [formEntrada, setFormEntrada]           = useState('')
  const [formSaida, setFormSaida]               = useState('')
  const [formDataAbertura, setFormDataAbertura] = useState<Date | null>(null)

  // Assinaturas
  const [sigCliente, setSigCliente]             = useState('')
  const [nomeLegivel, setNomeLegivel]            = useState('')
  const [matriculaCliente, setMatriculaCliente]  = useState('')
  const [sigTecnico, setSigTecnico]              = useState('')
  const [rgTecnico, setRgTecnico]                = useState('')
  const [modalSig, setModalSig]                  = useState<'cliente' | 'tecnico' | null>(null)

  // Picker de data/hora
  const [pickerAtivo, setPickerAtivo] = useState<PickerAtivo | null>(null)

  const formInitialized = useRef(false)

  // ── Carregar OS em tempo real ───────────────────────────────────────────
  useEffect(() => {
    if (!id) return

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
        { includeMetadataChanges: true },
        snap => {
          setSyncMeta({ fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites })
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
            setFormEntrada(data.entrada ?? '')
            setFormSaida(data.saida ?? '')
            setFormDataAbertura(data.dataAbertura?.toDate() ?? null)
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
  const podeIniciarFinalizar =
    role === 'admin' || role === 'gestor' || os.tecnicoId === user?.uid
  const tempo = calcularTempo(formEntrada, formSaida)

  // ── Handlers do formulário ──────────────────────────────────────────────

  function setAt<K extends keyof Atendimento>(idx: number, key: K, val: Atendimento[K]) {
    setFormAtendimentos(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: val }
      return next
    })
  }

  function addAt() { setFormAtendimentos(prev => [...prev, { ...ATENDIMENTO_VAZIO }]) }
  function removeAt(idx: number) { setFormAtendimentos(prev => prev.filter((_, i) => i !== idx)) }

  // ── Date/Time picker ────────────────────────────────────────────────────

  function abrirPicker(campo: CampoPicker) {
    let inicial: Date
    if (campo === 'entrada') inicial = isoParaDate(formEntrada) ?? new Date()
    else if (campo === 'saida') inicial = isoParaDate(formSaida) ?? new Date()
    else inicial = formDataAbertura ?? new Date()
    setPickerAtivo({ campo, mode: 'date', valor: inicial })
  }

  function aplicarPicker(date: Date) {
    if (!pickerAtivo) return
    const iso = date.toISOString()
    if (pickerAtivo.campo === 'entrada') setFormEntrada(iso)
    else if (pickerAtivo.campo === 'saida') setFormSaida(iso)
    else setFormDataAbertura(date)
    setPickerAtivo(null)
  }

  // Android: dialog que auto-fecha após cada seleção; dois passos (data → hora)
  function onPickerAndroid(event: DateTimePickerEvent, date?: Date) {
    if (!pickerAtivo) return
    if (event.type === 'dismissed' || !date) { setPickerAtivo(null); return }
    if (pickerAtivo.mode === 'date') {
      setPickerAtivo({ ...pickerAtivo, mode: 'time', valor: date })
    } else {
      aplicarPicker(date)
    }
  }

  // iOS: spinner inline no Modal; onChange apenas atualiza valor temporário
  function onPickerIOS(_: DateTimePickerEvent, date?: Date) {
    if (date) setPickerAtivo(p => p ? { ...p, valor: date } : null)
  }

  function confirmarPickerIOS() {
    if (!pickerAtivo) return
    if (pickerAtivo.mode === 'date') {
      setPickerAtivo({ ...pickerAtivo, mode: 'time' })
    } else {
      aplicarPicker(pickerAtivo.valor)
    }
  }

  // ── Ações Firestore ─────────────────────────────────────────────────────

  async function iniciarAtendimento() {
    if (!id || !user) return
    setSalvando(true)
    const iso = new Date().toISOString()
    try {
      await firestore().collection('ordens_servico').doc(id).update({
        status:          'em_andamento',
        entrada:         iso,
        updatedAt:       firestore.FieldValue.serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setFormEntrada(iso)
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
    const iso = new Date().toISOString()
    try {
      await firestore().collection('ordens_servico').doc(id).update({
        status:          'concluida',
        saida:           iso,
        fechadaEm:       firestore.FieldValue.serverTimestamp(),
        updatedAt:       firestore.FieldValue.serverTimestamp(),
        atualizadoPorId: user.uid,
      })
      setFormSaida(iso)
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
        atendimentos:            formAtendimentos,
        comentarios:             formComentarios,
        solicitacaoMaterial:     formSolicitacao,
        entrada:                 formEntrada || null,
        saida:                   formSaida || null,
        dataAbertura:            formDataAbertura
                                   ? firestore.Timestamp.fromDate(formDataAbertura)
                                   : null,
        assinaturaClienteBase64: sigCliente,
        nomeLegivel,
        matriculaCliente,
        assinaturaTecnicoBase64: sigTecnico,
        rgTecnico,
        updatedAt:               firestore.FieldValue.serverTimestamp(),
        atualizadoPorId:         user.uid,
      })
      Alert.alert('Salvo', 'OS atualizada com sucesso.')
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar.\n(Offline: será sincronizado quando houver conexão.)')
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

        <SyncStatusBar status={syncStatus} />

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
              <View style={s.flex}>
                {!readOnly
                  ? <DateTimePickerField
                      label="Data de Abertura"
                      value={formDataAbertura?.toISOString() ?? ''}
                      onPress={() => abrirPicker('dataAbertura')}
                    />
                  : <InfoField
                      label="Data de Abertura"
                      value={formDataAbertura
                        ? formatarDataHora(formDataAbertura.toISOString())
                        : '—'}
                    />
                }
              </View>
              <View style={s.flex}>
                <InfoField label="Tipo" value={TIPO_CONFIG[os.tipo] ?? os.tipo} />
              </View>
            </View>
          </View>

          {/* ── Horário ──────────────────────────────────────────────── */}
          <Text style={s.secTitulo}>Horário</Text>
          <View style={s.card}>
            {!readOnly
              ? <DateTimePickerField label="Entrada" value={formEntrada} onPress={() => abrirPicker('entrada')} />
              : <InfoField label="Entrada" value={formatarDataHora(formEntrada)} />
            }
            {!readOnly
              ? <DateTimePickerField label="Saída" value={formSaida} onPress={() => abrirPicker('saida')} />
              : <InfoField label="Saída" value={formatarDataHora(formSaida)} />
            }
            {tempo ? (
              <View style={s.tempoTotalLinha}>
                <Text style={s.tempoLabel}>Tempo total</Text>
                <Text style={s.tempoTotal}>{tempo}</Text>
              </View>
            ) : null}
          </View>

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
              <InputField label="N° INMETRO"    value={at.nInmetro}    onChange={v => setAt(idx, 'nInmetro', v)}    editable={!readOnly} />
              <InputField label="Selo INMETRO"  value={at.seloInmetro} onChange={v => setAt(idx, 'seloInmetro', v)} editable={!readOnly} />
              <InputField label="Selo Atual"    value={at.seloAtual}   onChange={v => setAt(idx, 'seloAtual', v)}   editable={!readOnly} />
              <InputField label="Portaria"      value={at.portaria}    onChange={v => setAt(idx, 'portaria', v)}    editable={!readOnly} />
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
            <InputField label="Nome legível" value={nomeLegivel}      onChange={setNomeLegivel}      editable={!readOnly} />
            <InputField label="Matrícula"    value={matriculaCliente} onChange={setMatriculaCliente} editable={!readOnly} />
            {sigCliente ? (
              <View style={s.sigWrap}>
                <Image source={{ uri: sigCliente }} style={s.sigImg} resizeMode="contain" />
                {!readOnly && (
                  <TouchableOpacity style={s.btnLimparSig} onPress={() => setSigCliente('')}>
                    <Text style={s.btnLimparSigTxt}>Limpar assinatura</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : !readOnly && (
              <TouchableOpacity style={s.btnAssinar} onPress={() => setModalSig('cliente')}>
                <Text style={s.btnAssinarTxt}>✍️ Assinar</Text>
              </TouchableOpacity>
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
            ) : !readOnly && (
              <TouchableOpacity style={s.btnAssinar} onPress={() => setModalSig('tecnico')}>
                <Text style={s.btnAssinarTxt}>✍️ Assinar</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Modais de assinatura ─────────────────────────────────────── */}
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

        {/* ── Date/Time Picker ─────────────────────────────────────────── */}

        {/* Android: dialog nativo auto-fecha; dois passos data → hora */}
        {Platform.OS === 'android' && pickerAtivo && (
          <DateTimePicker
            value={pickerAtivo.valor}
            mode={pickerAtivo.mode}
            is24Hour
            display="default"
            onChange={onPickerAndroid}
          />
        )}

        {/* iOS: spinner dentro de bottom sheet modal */}
        {Platform.OS === 'ios' && (
          <Modal visible={pickerAtivo !== null} transparent animationType="slide">
            <TouchableOpacity
              style={s.pickerOverlay}
              activeOpacity={1}
              onPress={() => setPickerAtivo(null)}
            />
            <View style={s.pickerSheet}>
              <View style={s.pickerBar}>
                <TouchableOpacity onPress={() => setPickerAtivo(null)}>
                  <Text style={s.pickerCancelar}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={s.pickerTitulo}>
                  {pickerAtivo?.mode === 'date' ? 'Selecionar data' : 'Selecionar hora'}
                </Text>
                <TouchableOpacity onPress={confirmarPickerIOS}>
                  <Text style={s.pickerOk}>OK</Text>
                </TouchableOpacity>
              </View>
              {pickerAtivo && (
                <DateTimePicker
                  value={pickerAtivo.valor}
                  mode={pickerAtivo.mode}
                  display="spinner"
                  is24Hour
                  onChange={onPickerIOS}
                />
              )}
            </View>
          </Modal>
        )}

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
  flex:   { flex: 1, backgroundColor: '#f5f6f8' },
  scroll: { padding: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  backBtn:      { padding: 8 },
  backTxt:      { fontSize: 18, color: '#2563eb', fontWeight: '600' },
  headerCenter: { alignItems: 'center', gap: 4 },
  osNum:        { fontSize: 14, fontWeight: '700', color: '#1f2937' },

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

  // Horário
  tempoTotalLinha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 10, marginTop: 4,
  },
  tempoLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  tempoTotal: { fontSize: 15, color: '#2563eb', fontWeight: '800' },

  // Atendimento
  atHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  atNum:      { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  removerBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#fee2e2', borderRadius: 8 },
  removerTxt: { fontSize: 13, color: '#dc2626', fontWeight: '600' },

  addAtBtn: {
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 12, borderStyle: 'dashed',
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  addAtTxt: { color: '#2563eb', fontSize: 15, fontWeight: '700' },

  // Assinaturas
  sigWrap:         { marginTop: 8 },
  sigImg:          { width: '100%', height: 140, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  btnLimparSig:    { marginTop: 8, alignItems: 'center', paddingVertical: 8 },
  btnLimparSigTxt: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  btnAssinar: {
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 10, borderStyle: 'dashed',
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnAssinarTxt: { color: '#2563eb', fontSize: 15, fontWeight: '700' },

  // Date/Time picker (iOS modal)
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32,
  },
  pickerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  pickerTitulo:   { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  pickerCancelar: { fontSize: 16, color: '#6b7280' },
  pickerOk:       { fontSize: 16, color: '#2563eb', fontWeight: '700' },

  // Action bar
  actionBar: {
    flexDirection: 'row', gap: 10, padding: 16,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  btnIniciar:    { flex: 1, backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, borderColor: '#bfdbfe', paddingVertical: 14, alignItems: 'center' },
  btnIniciarTxt: { color: '#1d4ed8', fontSize: 15, fontWeight: '700' },
  btnFinalizar:    { flex: 1, backgroundColor: '#15803d', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnFinalizarTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnSalvar:     { flex: 1, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnSalvarTxt:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled:   { opacity: 0.6 },
})
