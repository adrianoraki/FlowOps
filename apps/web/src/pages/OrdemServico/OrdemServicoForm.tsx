import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import { normalizarAtendimentos, limitarLinhas, type TipoOS, type StatusOS, type Atendimento, type Setor, type Modelo, type Peca, type ItemPecaUsada, type User, type Parceiro, type Loja } from '@flowops/types'
import s from './OrdemServicoForm.module.css'

/** Limite de linhas do campo "Descrição do problema relatado pelo cliente". */
const MAX_LINHAS_DESCRICAO_CLIENTE = 20

interface OSFormData {
  tipo: TipoOS
  parceiroId: string
  lojaId: string
  // Preenchidos automaticamente ao escolher a loja — não editáveis diretamente
  parceiroNome: string
  lojaNumero: string
  lojaNome: string
  cidade: string
  estado: string
  regiao: string
  solicitante: string
  dataAbertura: string
  entrada: string
  saida: string
  tecnicoId: string
  atendimentos: Atendimento[]
  comentarios: string
  descricaoServicoRealizado: string
  solicitacaoMaterial: string
  pecasUsadas: ItemPecaUsada[]
  status: StatusOS
}

const ATENDIMENTO_VAZIO: Atendimento = {
  chamado: '',
  modelo: '',
  nSerie: '',
  setor: '',
  mauUso: false,
  nInmetro: '',
  seloInmetro: '',
  seloAtual: '',
  portaria: '',
  etqReparado: '',
  descricaoIntervencao: '',
}

const FORM_INICIAL: OSFormData = {
  tipo: 'corretiva',
  parceiroId: '',
  lojaId: '',
  parceiroNome: '',
  lojaNumero: '',
  lojaNome: '',
  cidade: '',
  estado: '',
  regiao: '',
  solicitante: '',
  dataAbertura: new Date().toISOString().slice(0, 10),
  entrada: '',
  saida: '',
  tecnicoId: '',
  atendimentos: [{ ...ATENDIMENTO_VAZIO }],
  comentarios: '',
  descricaoServicoRealizado: '',
  solicitacaoMaterial: '',
  pecasUsadas: [],
  status: 'aberta',
}

export function OrdemServicoForm() {
  const { id } = useParams<{ id: string }>()
  const isEdicao = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState<OSFormData>(FORM_INICIAL)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [carregando, setCarregando] = useState(isEdicao)
  const [tecnicos, setTecnicos] = useState<Pick<User, 'uid' | 'nome' | 'estados'>[]>([])
  const [carregandoTecnicos, setCarregandoTecnicos] = useState(false)
  const [todosEstados, setTodosEstados] = useState(false)
  const [readOnly,    setReadOnly]    = useState(false)
  const [editingRow,  setEditingRow]  = useState<number | null>(null)
  const [setores, setSetores] = useState<Setor[]>([])
  const [modelos, setModelos] = useState<Modelo[]>([])
  const [pecas, setPecas] = useState<Peca[]>([])
  const [novaPecaId, setNovaPecaId] = useState('')
  const [novaPecaQtd, setNovaPecaQtd] = useState(1)
  const [parceiros, setParceiros] = useState<Parceiro[]>([])
  const [lojas, setLojas] = useState<Loja[]>([])
  const [carregandoLojas, setCarregandoLojas] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'setores'), orderBy('nome'))
    return onSnapshot(q,
      snap => setSetores(snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Setor)
        .filter(s => s.ativo !== false)),
      () => {},
    )
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'modelos'), orderBy('nome'))
    return onSnapshot(q,
      snap => setModelos(snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Modelo)
        .filter(m => m.ativo !== false)),
      () => {},
    )
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'pecas'), orderBy('nome'))
    return onSnapshot(q,
      snap => setPecas(snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Peca)
        .filter(p => p.ativo !== false)),
      () => {},
    )
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'parceiros'), orderBy('nome'))
    return onSnapshot(q, snap => setParceiros(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Parceiro)), () => {})
  }, [])

  // Lojas do parceiro selecionado
  useEffect(() => {
    if (!form.parceiroId) { setLojas([]); return }
    setCarregandoLojas(true)
    getDocs(query(collection(db, 'lojas'), where('parceiroId', '==', form.parceiroId)))
      .then(snap => setLojas(snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Loja)
        .filter(l => l.ativo !== false)))
      .catch(() => setLojas([]))
      .finally(() => setCarregandoLojas(false))
  }, [form.parceiroId])

  useEffect(() => {
    if (!todosEstados && !form.estado) { setTecnicos([]); return }
    setCarregandoTecnicos(true)
    const q = todosEstados
      ? query(collection(db, 'users'), where('role', '==', 'tecnico'))
      : query(collection(db, 'users'), where('role', '==', 'tecnico'), where('estados', 'array-contains', form.estado))
    getDocs(q)
      .then(snap => setTecnicos(snap.docs
        .filter(d => d.data().ativo !== false)
        .map(d => ({
          uid: d.id,
          nome: d.data().nome as string,
          estados: (d.data().estados as string[]) ?? [],
        }))))
      .catch(() => setTecnicos([]))
      .finally(() => setCarregandoTecnicos(false))
  }, [form.estado, todosEstados])

  useEffect(() => {
    if (!isEdicao || !id) return
    setCarregando(true)
    getDoc(doc(db, 'ordens_servico', id))
      .then(snap => {
        if (!snap.exists()) { setErro('OS não encontrada.'); return }
        const d = snap.data()
        setForm({
          tipo: d.tipo,
          parceiroId: d.parceiroId ?? '',
          lojaId: d.lojaId ?? '',
          parceiroNome: d.parceiroNome ?? '',
          lojaNumero: d.lojaNumero ?? '',
          lojaNome: d.lojaNome ?? '',
          cidade: d.cidade ?? '',
          estado: d.estado ?? '',
          regiao: d.regiao ?? '',
          solicitante: d.solicitante,
          dataAbertura:
            d.dataAbertura instanceof Timestamp
              ? d.dataAbertura.toDate().toISOString().slice(0, 10)
              : d.dataAbertura ?? '',
          entrada: d.entrada,
          saida: d.saida,
          tecnicoId: d.tecnicoId,
          atendimentos: d.atendimentos?.length ? normalizarAtendimentos(d.atendimentos) : [{ ...ATENDIMENTO_VAZIO }],
          comentarios: d.comentarios ?? '',
          descricaoServicoRealizado: d.descricaoServicoRealizado ?? '',
          solicitacaoMaterial: d.solicitacaoMaterial ?? '',
          pecasUsadas: d.pecasUsadas ?? [],
          status: d.status,
        })
        setReadOnly(d.status === 'concluida' || d.status === 'cancelada')
      })
      .catch(() => setErro('Erro ao carregar OS.'))
      .finally(() => setCarregando(false))
  }, [id, isEdicao])

  function setField<K extends keyof OSFormData>(key: K, value: OSFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function selecionarParceiro(parceiroId: string) {
    const parceiro = parceiros.find(p => p.id === parceiroId)
    setForm(prev => ({
      ...prev,
      parceiroId,
      parceiroNome: parceiro?.nome ?? '',
      lojaId: '', lojaNumero: '', lojaNome: '',
      cidade: '', estado: '', regiao: '',
      tecnicoId: '',
    }))
  }

  function selecionarLoja(lojaId: string) {
    const loja = lojas.find(l => l.id === lojaId)
    setForm(prev => ({
      ...prev,
      lojaId,
      lojaNumero: loja?.numero ?? '',
      lojaNome: loja?.nome ?? '',
      cidade: loja?.cidade ?? '',
      estado: loja?.estado ?? '',
      regiao: loja?.regiao ?? '',
      tecnicoId: '',
    }))
  }

  function setAtendimento<K extends keyof Atendimento>(
    index: number,
    key: K,
    value: Atendimento[K],
  ) {
    setForm(prev => {
      const atendimentos = [...prev.atendimentos]
      atendimentos[index] = { ...atendimentos[index], [key]: value }
      return { ...prev, atendimentos }
    })
  }

  function adicionarAtendimento() {
    const novoIdx = form.atendimentos.length
    setForm(prev => ({
      ...prev,
      atendimentos: [...prev.atendimentos, { ...ATENDIMENTO_VAZIO }],
    }))
    setEditingRow(novoIdx)
  }

  function removerAtendimento(index: number) {
    setForm(prev => ({
      ...prev,
      atendimentos: prev.atendimentos.filter((_, i) => i !== index),
    }))
  }

  function adicionarPeca() {
    const peca = pecas.find(p => p.id === novaPecaId)
    if (!peca || novaPecaQtd <= 0) return
    setForm(prev => ({
      ...prev,
      pecasUsadas: [...prev.pecasUsadas, { pecaId: peca.id, nome: peca.nome, quantidade: novaPecaQtd }],
    }))
    setNovaPecaId('')
    setNovaPecaQtd(1)
  }

  function removerPeca(index: number) {
    setForm(prev => ({
      ...prev,
      pecasUsadas: prev.pecasUsadas.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (readOnly) return

    if (!form.parceiroId) { setErro('Selecione o parceiro.'); return }
    if (!form.lojaId) { setErro('Selecione a loja.'); return }
    if (!form.tecnicoId) { setErro('Selecione um técnico responsável.'); return }
    if (form.atendimentos.length === 0) { setErro('Adicione ao menos um atendimento.'); return }

    setLoading(true)
    try {
      const payload = {
        ...form,
        dataAbertura: form.dataAbertura
          ? Timestamp.fromDate(new Date(form.dataAbertura + 'T00:00:00'))
          : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      if (isEdicao && id) {
        // TODO: notificar técnico sobre reatribuição
        await updateDoc(doc(db, 'ordens_servico', id), payload)
      } else {
        // Numeração sequencial: transação atômica sobre counters/ordens (sem Cloud Function)
        const counterRef = doc(db, 'counters', 'ordens')
        const novaOSRef  = doc(collection(db, 'ordens_servico'))

        await runTransaction(db, async transaction => {
          const counterSnap = await transaction.get(counterRef)
          const proximo = counterSnap.exists() ? (counterSnap.data().proximo as number) : 1

          transaction.set(novaOSRef, {
            ...payload,
            numero: proximo,
            status: 'aberta',
            criadoPorId: user?.uid ?? '',
            createdAt: serverTimestamp(),
          })
          transaction.set(counterRef, { proximo: proximo + 1 }, { merge: true })
        })
      }
      navigate('/')
    } catch {
      setErro('Erro ao salvar OS. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (carregando) return <div className={s.carregando}>Carregando…</div>

  return (
    <div className={s.pagina}>
      <header className={s.cabecalho}>
        <h1 className={s.titulo}>{isEdicao ? 'Editar OS' : 'Nova Ordem de Serviço'}</h1>
      </header>

      {readOnly && (
        <div className={s.avisoSoLeitura}>
          🔒 OS encerrada — somente leitura. Não é possível editar.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className={s.form}>

        <section className={s.secao}>
          <h2 className={s.secaoTitulo}>Dados da OS</h2>
          <div className={s.grade}>
            <div className={s.campo}>
              <label className={s.label}>Tipo</label>
              <select className={s.select} value={form.tipo} onChange={e => setField('tipo', e.target.value as TipoOS)}>
                <option value="corretiva">Corretiva</option>
                <option value="preventiva">Preventiva</option>
                <option value="emergencia">Emergência</option>
              </select>
            </div>
            <div className={s.campo}>
              <label className={s.label}>Status</label>
              <select className={s.select} value={form.status} onChange={e => setField('status', e.target.value as StatusOS)}>
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="aguardando_peca">Aguardando peça</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className={s.campo}>
              <label className={s.label}>Data de Abertura</label>
              <input type="date" className={s.input} value={form.dataAbertura} onChange={e => setField('dataAbertura', e.target.value)} />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Entrada</label>
              <input type="time" className={s.input} value={form.entrada} onChange={e => setField('entrada', e.target.value)} />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Saída</label>
              <input type="time" className={s.input} value={form.saida} onChange={e => setField('saida', e.target.value)} />
            </div>
            <div className={`${s.campo} ${s.campoTecnico}`}>
              <label className={s.label}>Técnico responsável</label>
              <div className={s.tecnicoControle}>
                <select
                  className={s.select}
                  value={form.tecnicoId}
                  onChange={e => setField('tecnicoId', e.target.value)}
                  disabled={carregandoTecnicos}
                >
                  <option value="">
                    {carregandoTecnicos
                      ? 'Carregando…'
                      : !form.estado && !todosEstados
                      ? 'Selecione a loja primeiro'
                      : 'Selecione um técnico'}
                  </option>
                  {tecnicos.map(t => (
                    <option key={t.uid} value={t.uid}>
                      {t.nome}{todosEstados ? ` (${t.estados.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
                <label className={s.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={todosEstados}
                    onChange={e => { setTodosEstados(e.target.checked); setField('tecnicoId', '') }}
                  />
                  Mostrar todos os técnicos (cobertura/férias)
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <h2 className={s.secaoTitulo}>Parceiro / Loja</h2>
          <div className={s.grade}>
            <div className={s.campo}>
              <label className={s.label}>Parceiro</label>
              <select
                className={s.select}
                value={form.parceiroId}
                onChange={e => selecionarParceiro(e.target.value)}
              >
                <option value="">Selecione um parceiro</option>
                {parceiros.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}{p.tipo === 'rede' ? ' (rede)' : ''}</option>
                ))}
              </select>
            </div>
            <div className={s.campo}>
              <label className={s.label}>Loja</label>
              <select
                className={s.select}
                value={form.lojaId}
                onChange={e => selecionarLoja(e.target.value)}
                disabled={!form.parceiroId || carregandoLojas}
              >
                <option value="">
                  {!form.parceiroId
                    ? 'Selecione o parceiro primeiro'
                    : carregandoLojas
                    ? 'Carregando…'
                    : lojas.length === 0
                    ? 'Nenhuma loja cadastrada'
                    : 'Selecione uma loja'}
                </option>
                {lojas.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.numero ? `${l.numero} - ` : ''}{l.nome} - {l.cidade}/{l.estado}
                  </option>
                ))}
              </select>
            </div>
            {form.lojaId && (
              <div className={s.campo} style={{ gridColumn: '1 / -1' }}>
                <span className={s.label}>Estado / Cidade / Região (automáticos)</span>
                <span style={{ fontSize: '0.85rem' }}>{form.estado} · {form.cidade} · {form.regiao}</span>
              </div>
            )}
            <div className={s.campo}>
              <label className={s.label}>Solicitante</label>
              <input type="text" className={s.input} value={form.solicitante} onChange={e => setField('solicitante', e.target.value)} placeholder="Nome de quem abriu o chamado" />
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <div className={s.secaoCabecalho}>
            <h2 className={s.secaoTitulo}>Atendimentos</h2>
            {!readOnly && (
              <button type="button" className={s.botaoAdicionar} onClick={adicionarAtendimento}>
                + Adicionar linha
              </button>
            )}
          </div>
          {!readOnly && (
            <p className={s.dicaEdicao}>Clique em uma linha para editar seus campos</p>
          )}
          <div className={s.tabelaScroll}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Chamado</th>
                  <th>Modelo</th>
                  <th>N° Série</th>
                  <th>Setor</th>
                  <th>Mau Uso</th>
                  <th>N° INMETRO</th>
                  <th>Selo INMETRO</th>
                  <th>Selo Atual</th>
                  <th>Portaria</th>
                  <th>Etq. Reparado</th>
                  <th className={s.thDestaque}>Descrição do problema relatado pelo cliente:</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.atendimentos.map((at, i) => {
                  const isEditing = editingRow === i && !readOnly
                  return (
                    <tr
                      key={i}
                      className={isEditing ? s.trEditando : s.trPreview}
                      onClick={() => { if (!readOnly && editingRow !== i) setEditingRow(i) }}
                      style={{ cursor: !readOnly ? 'pointer' : 'default' }}
                    >
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.chamado} onChange={e => setAtendimento(i, 'chamado', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.chamado || '—'}</span>}</td>
                      <td>
                        {isEditing
                          ? (
                            <select className={s.inputTabela} value={at.modelo} onChange={e => setAtendimento(i, 'modelo', e.target.value)}>
                              <option value="">—</option>
                              {modelos.map(modelo => (
                                <option key={modelo.id} value={modelo.nome}>{modelo.nome}</option>
                              ))}
                            </select>
                          )
                          : <span className={s.tdPreviewVal}>{at.modelo || '—'}</span>}
                      </td>
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.nSerie} onChange={e => setAtendimento(i, 'nSerie', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.nSerie || '—'}</span>}</td>
                      <td>
                        {isEditing
                          ? (
                            <select className={s.inputTabela} value={at.setor} onChange={e => setAtendimento(i, 'setor', e.target.value)}>
                              <option value="">—</option>
                              {setores.map(setor => (
                                <option key={setor.id} value={setor.nome}>{setor.nome}</option>
                              ))}
                            </select>
                          )
                          : <span className={s.tdPreviewVal}>{at.setor || '—'}</span>}
                      </td>
                      <td className={s.tdCheck}>{isEditing ? <input type="checkbox" checked={at.mauUso} onChange={e => setAtendimento(i, 'mauUso', e.target.checked)} /> : <span>{at.mauUso ? '☑' : '☐'}</span>}</td>
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.nInmetro} onChange={e => setAtendimento(i, 'nInmetro', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.nInmetro || '—'}</span>}</td>
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.seloInmetro} onChange={e => setAtendimento(i, 'seloInmetro', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.seloInmetro || '—'}</span>}</td>
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.seloAtual} onChange={e => setAtendimento(i, 'seloAtual', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.seloAtual || '—'}</span>}</td>
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.portaria} onChange={e => setAtendimento(i, 'portaria', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.portaria || '—'}</span>}</td>
                      <td>{isEditing ? <input className={s.inputTabela} style={{ textTransform: 'uppercase' }} value={at.etqReparado} onChange={e => setAtendimento(i, 'etqReparado', e.target.value.toUpperCase())} /> : <span className={s.tdPreviewVal}>{at.etqReparado || '—'}</span>}</td>
                      <td>
                        {isEditing
                          ? (
                            <textarea
                              className={`${s.inputTabela} ${s.textareaDescricao}`}
                              style={{ textTransform: 'uppercase' }}
                              rows={6}
                              value={at.descricaoIntervencao}
                              onChange={e => setAtendimento(i, 'descricaoIntervencao', limitarLinhas(e.target.value.toUpperCase(), MAX_LINHAS_DESCRICAO_CLIENTE))}
                            />
                          )
                          : <span className={`${s.tdPreviewVal} ${s.tdDescricaoNegrito}`}>{at.descricaoIntervencao || '—'}</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {!readOnly && (
                          <button
                            type="button"
                            className={s.botaoRemover}
                            onClick={() => removerAtendimento(i)}
                            disabled={form.atendimentos.length === 1}
                            title="Remover linha"
                          >×</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={s.secao}>
          <h2 className={s.secaoTitulo}>Peças Utilizadas</h2>
          {!readOnly && (
            <div className={s.pecaAdicionarLinha}>
              <select className={s.select} value={novaPecaId} onChange={e => setNovaPecaId(e.target.value)}>
                <option value="">Selecione uma peça</option>
                {pecas.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                className={s.input}
                style={{ width: '90px' }}
                value={novaPecaQtd}
                onChange={e => setNovaPecaQtd(Number(e.target.value) || 1)}
              />
              <button type="button" className={s.botaoAdicionar} onClick={adicionarPeca} disabled={!novaPecaId}>
                + Adicionar peça
              </button>
            </div>
          )}
          {form.pecasUsadas.length === 0 && (
            <p className={s.dicaEdicao}>Nenhuma peça adicionada.</p>
          )}
          {form.pecasUsadas.length > 0 && (
            <ul className={s.pecaLista}>
              {form.pecasUsadas.map((item, i) => (
                <li key={i} className={s.pecaLinha}>
                  <span className={s.pecaNome}>{item.nome}</span>
                  <span className={s.pecaQtd}>x{item.quantidade}</span>
                  {!readOnly && (
                    <button type="button" className={s.botaoRemover} onClick={() => removerPeca(i)} title="Remover peça">×</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={s.secao}>
          <h2 className={s.secaoTitulo}>Observações</h2>
          <div className={s.gradeColuna}>
            <div className={s.campo}>
              <label className={s.label}>Descrição do Problema</label>
              <textarea className={s.textarea} value={form.comentarios} onChange={e => setField('comentarios', e.target.value)} rows={3} placeholder="O que o cliente relatou na abertura — o técnico vê este campo somente leitura no app" />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Descrição do Serviço Realizado</label>
              <textarea className={s.textarea} value={form.descricaoServicoRealizado} onChange={e => setField('descricaoServicoRealizado', e.target.value)} rows={3} placeholder="Preenchido pelo técnico no app" />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Solicitação de Material</label>
              <textarea className={s.textarea} value={form.solicitacaoMaterial} onChange={e => setField('solicitacaoMaterial', e.target.value)} rows={3} />
            </div>
          </div>
        </section>

        {/* TODO: assinatura do cliente, assinatura do técnico, fotos */}

        {erro && <p className={s.erro} role="alert">{erro}</p>}

        {!readOnly && (
          <div className={s.rodape}>
            <button type="button" className={s.botaoCancelar} onClick={() => navigate('/')} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className={s.botaoSalvar} disabled={loading}>
              {loading ? 'Salvando…' : isEdicao ? 'Salvar alterações' : 'Criar OS'}
            </button>
          </div>
        )}
        {readOnly && (
          <div className={s.rodape}>
            <button type="button" className={s.botaoCancelar} onClick={() => navigate('/')}>
              Voltar
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
