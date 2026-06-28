import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { useAuth } from '../../hooks/useAuth'
import type { TipoOS, StatusOS, Atendimento, User } from '@flowops/types'
import s from './OrdemServicoForm.module.css'

interface OSFormData {
  tipo: TipoOS
  clienteId: string
  cidade: string
  estado: string
  loja: string
  veiculo: string
  regiao: string
  dataAbertura: string
  entrada: string
  saida: string
  tecnicoId: string
  atendimentos: Atendimento[]
  comentarios: string
  solicitacaoMaterial: string
  status: StatusOS
}

const ATENDIMENTO_VAZIO: Atendimento = {
  chamado: '',
  modelo: '',
  nSerie: '',
  mauUso: false,
  nInmetro: '',
  seloInmetro: '',
  seloAtual: '',
  portaria: '',
  etqReparado: false,
  descricaoIntervencao: '',
}

const FORM_INICIAL: OSFormData = {
  tipo: 'corretiva',
  clienteId: '',
  cidade: '',
  estado: '',
  loja: '',
  veiculo: '',
  regiao: '',
  dataAbertura: new Date().toISOString().slice(0, 10),
  entrada: '',
  saida: '',
  tecnicoId: '',
  atendimentos: [{ ...ATENDIMENTO_VAZIO }],
  comentarios: '',
  solicitacaoMaterial: '',
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
  const [tecnicos, setTecnicos] = useState<Pick<User, 'uid' | 'nome' | 'regiao'>[]>([])
  const [carregandoTecnicos, setCarregandoTecnicos] = useState(false)
  const [todasRegioes, setTodasRegioes] = useState(false)
  const [regioes, setRegioes] = useState<{ id: string; nome: string }[]>([])
  const [carregandoRegioes, setCarregandoRegioes] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'regioes'), orderBy('nome'))
    return onSnapshot(q,
      snap => {
        setRegioes(snap.docs.map(d => ({ id: d.id, nome: d.data().nome as string })))
        setCarregandoRegioes(false)
      },
      () => setCarregandoRegioes(false),
    )
  }, [])

  useEffect(() => {
    if (!todasRegioes && !form.regiao) { setTecnicos([]); return }
    setCarregandoTecnicos(true)
    const q = todasRegioes
      ? query(collection(db, 'users'), where('role', '==', 'tecnico'))
      : query(collection(db, 'users'), where('role', '==', 'tecnico'), where('regiao', '==', form.regiao))
    getDocs(q)
      .then(snap => setTecnicos(snap.docs
        .filter(d => d.data().ativo !== false)
        .map(d => ({
          uid: d.id,
          nome: d.data().nome as string,
          regiao: d.data().regiao as string,
        }))))
      .catch(() => setTecnicos([]))
      .finally(() => setCarregandoTecnicos(false))
  }, [form.regiao, todasRegioes])

  useEffect(() => {
    if (!isEdicao || !id) return
    setCarregando(true)
    getDoc(doc(db, 'ordens_servico', id))
      .then(snap => {
        if (!snap.exists()) { setErro('OS não encontrada.'); return }
        const d = snap.data()
        setForm({
          tipo: d.tipo,
          clienteId: d.clienteId,
          cidade: d.cidade,
          estado: d.estado,
          loja: d.loja,
          veiculo: d.veiculo,
          regiao: d.regiao ?? '',
          dataAbertura:
            d.dataAbertura instanceof Timestamp
              ? d.dataAbertura.toDate().toISOString().slice(0, 10)
              : d.dataAbertura ?? '',
          entrada: d.entrada,
          saida: d.saida,
          tecnicoId: d.tecnicoId,
          atendimentos: d.atendimentos?.length ? d.atendimentos : [{ ...ATENDIMENTO_VAZIO }],
          comentarios: d.comentarios ?? '',
          solicitacaoMaterial: d.solicitacaoMaterial ?? '',
          status: d.status,
        })
      })
      .catch(() => setErro('Erro ao carregar OS.'))
      .finally(() => setCarregando(false))
  }, [id, isEdicao])

  function setField<K extends keyof OSFormData>(key: K, value: OSFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
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
    setForm(prev => ({
      ...prev,
      atendimentos: [...prev.atendimentos, { ...ATENDIMENTO_VAZIO }],
    }))
  }

  function removerAtendimento(index: number) {
    setForm(prev => ({
      ...prev,
      atendimentos: prev.atendimentos.filter((_, i) => i !== index),
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro('')

    if (!form.clienteId.trim()) { setErro('Informe o cliente.'); return }
    if (!form.regiao.trim()) { setErro('Informe a região.'); return }
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
        // TODO: número sequencial será atribuído pela Cloud Function após sincronização
        await addDoc(collection(db, 'ordens_servico'), {
          ...payload,
          status: 'aberta',
          criadoPorId: user?.uid ?? '',
          createdAt: serverTimestamp(),
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
            <div className={s.campo}>
              <label className={s.label}>Região</label>
              <select
                className={s.select}
                value={form.regiao}
                onChange={e => setForm(prev => ({ ...prev, regiao: e.target.value, tecnicoId: '' }))}
                disabled={carregandoRegioes}
              >
                <option value="">
                  {carregandoRegioes ? 'Carregando regiões…' : 'Selecione uma região'}
                </option>
                {regioes.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
              {!carregandoRegioes && regioes.length === 0 && (
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                  Nenhuma região cadastrada.{' '}
                  <Link to="/regioes" style={{ color: '#7c9bfa' }}>Cadastrar agora</Link>
                </span>
              )}
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
                      : !form.regiao && !todasRegioes
                      ? 'Selecione a região primeiro'
                      : 'Selecione um técnico'}
                  </option>
                  {tecnicos.map(t => (
                    <option key={t.uid} value={t.uid}>
                      {t.nome}{todasRegioes ? ` (${t.regiao})` : ''}
                    </option>
                  ))}
                </select>
                <label className={s.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={todasRegioes}
                    onChange={e => { setTodasRegioes(e.target.checked); setField('tecnicoId', '') }}
                  />
                  Mostrar técnicos de todas as regiões
                </label>
              </div>
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <h2 className={s.secaoTitulo}>Cliente</h2>
          <div className={s.grade}>
            <div className={s.campo}>
              <label className={s.label}>Cliente</label>
              <input type="text" className={s.input} value={form.clienteId} onChange={e => setField('clienteId', e.target.value)} placeholder="Nome ou ID do cliente" />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Cidade</label>
              <input type="text" className={s.input} value={form.cidade} onChange={e => setField('cidade', e.target.value)} />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Estado</label>
              <input type="text" className={s.input} value={form.estado} onChange={e => setField('estado', e.target.value)} maxLength={2} placeholder="UF" />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Loja</label>
              <input type="text" className={s.input} value={form.loja} onChange={e => setField('loja', e.target.value)} />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Veículo</label>
              <input type="text" className={s.input} value={form.veiculo} onChange={e => setField('veiculo', e.target.value)} />
            </div>
          </div>
        </section>

        <section className={s.secao}>
          <div className={s.secaoCabecalho}>
            <h2 className={s.secaoTitulo}>Atendimentos</h2>
            <button type="button" className={s.botaoAdicionar} onClick={adicionarAtendimento}>
              + Adicionar linha
            </button>
          </div>
          <div className={s.tabelaScroll}>
            <table className={s.tabela}>
              <thead>
                <tr>
                  <th>Chamado</th>
                  <th>Modelo</th>
                  <th>N° Série</th>
                  <th>Mau Uso</th>
                  <th>N° INMETRO</th>
                  <th>Selo INMETRO</th>
                  <th>Selo Atual</th>
                  <th>Portaria</th>
                  <th>Etq. Reparado</th>
                  <th>Descrição da Intervenção</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.atendimentos.map((at, i) => (
                  <tr key={i}>
                    <td><input className={s.inputTabela} value={at.chamado} onChange={e => setAtendimento(i, 'chamado', e.target.value)} /></td>
                    <td><input className={s.inputTabela} value={at.modelo} onChange={e => setAtendimento(i, 'modelo', e.target.value)} /></td>
                    <td><input className={s.inputTabela} value={at.nSerie} onChange={e => setAtendimento(i, 'nSerie', e.target.value)} /></td>
                    <td className={s.tdCheck}><input type="checkbox" checked={at.mauUso} onChange={e => setAtendimento(i, 'mauUso', e.target.checked)} /></td>
                    <td><input className={s.inputTabela} value={at.nInmetro} onChange={e => setAtendimento(i, 'nInmetro', e.target.value)} /></td>
                    <td><input className={s.inputTabela} value={at.seloInmetro} onChange={e => setAtendimento(i, 'seloInmetro', e.target.value)} /></td>
                    <td><input className={s.inputTabela} value={at.seloAtual} onChange={e => setAtendimento(i, 'seloAtual', e.target.value)} /></td>
                    <td><input className={s.inputTabela} value={at.portaria} onChange={e => setAtendimento(i, 'portaria', e.target.value)} /></td>
                    <td className={s.tdCheck}><input type="checkbox" checked={at.etqReparado} onChange={e => setAtendimento(i, 'etqReparado', e.target.checked)} /></td>
                    <td><input className={`${s.inputTabela} ${s.inputDescricao}`} value={at.descricaoIntervencao} onChange={e => setAtendimento(i, 'descricaoIntervencao', e.target.value)} /></td>
                    <td>
                      <button
                        type="button"
                        className={s.botaoRemover}
                        onClick={() => removerAtendimento(i)}
                        disabled={form.atendimentos.length === 1}
                        title="Remover linha"
                      >×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={s.secao}>
          <h2 className={s.secaoTitulo}>Observações</h2>
          <div className={s.gradeColuna}>
            <div className={s.campo}>
              <label className={s.label}>Comentários</label>
              <textarea className={s.textarea} value={form.comentarios} onChange={e => setField('comentarios', e.target.value)} rows={3} />
            </div>
            <div className={s.campo}>
              <label className={s.label}>Solicitação de Material</label>
              <textarea className={s.textarea} value={form.solicitacaoMaterial} onChange={e => setField('solicitacaoMaterial', e.target.value)} rows={3} />
            </div>
          </div>
        </section>

        {/* TODO: assinatura do cliente, assinatura do técnico, fotos */}

        {erro && <p className={s.erro} role="alert">{erro}</p>}

        <div className={s.rodape}>
          <button type="button" className={s.botaoCancelar} onClick={() => navigate('/')} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" className={s.botaoSalvar} disabled={loading}>
            {loading ? 'Salvando…' : isEdicao ? 'Salvar alterações' : 'Criar OS'}
          </button>
        </div>
      </form>
    </div>
  )
}
