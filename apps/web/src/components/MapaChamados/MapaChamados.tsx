import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CRITICIDADE_CORES, CRITICIDADE_LABEL, type Criticidade, type FonteCoordenada } from '@flowops/types'
import s from './MapaChamados.module.css'

// Mapa de chamados sobre OpenStreetMap via Leaflet.
//
// Por que Leaflet + OSM e não Google Maps: o projeto é Spark/Free e a premissa
// é não gerar custo (ver "Estratégia de Sustentabilidade" no CLAUDE.md). O
// Google Maps JS API exige billing habilitado; o OSM serve tiles gratuitamente
// desde que a atribuição seja exibida — por isso o `attribution` abaixo não é
// decorativo, é a condição de uso.
//
// Usa a API imperativa do Leaflet direto, sem react-leaflet: é um único mapa
// numa página só, e o wrapper custaria mais dependência do que economiza.

/** Marcadores usam CircleMarker (vetorial) e não Marker: evita depender dos PNGs de
 *  ícone do Leaflet, que quebram em build de bundler sem configuração extra. */
const RAIO_PADRAO = 7
const RAIO_IMPRECISO = 5

export interface PontoMapa {
  id: string
  lat: number
  lng: number
  fonte: FonteCoordenada
  criticidade: Criticidade
  titulo: string
  /** Linhas de detalhe exibidas no popup, já formatadas. */
  linhas: string[]
}

const FONTE_LABEL: Record<FonteCoordenada, string> = {
  checkin: 'GPS do check-in do técnico',
  loja:    'Coordenada cadastrada na loja',
  estado:  'Centro do estado (posição aproximada)',
}

/**
 * Espalha pontos que caem exatamente na mesma coordenada (o caso do centróide
 * de UF, onde toda OS do estado teria a mesma posição e viraria um ponto só).
 * O deslocamento é determinístico pelo índice para o pin não "pular" a cada render.
 */
function espalhar(lat: number, lng: number, indice: number): [number, number] {
  if (indice === 0) return [lat, lng]
  const angulo = indice * 2.399963 // ângulo áureo — distribui sem alinhar em fileira
  // ~0.18° por passo (≈20 km) separa os pontos já no zoom nacional; o teto de 1°
  // impede que um estado com dezenas de OS espalhe pins para fora do próprio estado.
  const raio = Math.min(1, 0.18 * Math.sqrt(indice))
  return [lat + raio * Math.sin(angulo), lng + raio * Math.cos(angulo)]
}

function popupHtml(p: PontoMapa): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = s.popup

  const titulo = document.createElement('strong')
  titulo.textContent = p.titulo
  wrap.appendChild(titulo)

  for (const linha of p.linhas) {
    const el = document.createElement('div')
    el.textContent = linha
    wrap.appendChild(el)
  }

  const estado = document.createElement('div')
  estado.className = s.popupStatus
  estado.textContent = CRITICIDADE_LABEL[p.criticidade]
  estado.style.color = CRITICIDADE_CORES[p.criticidade]
  wrap.appendChild(estado)

  const fonte = document.createElement('div')
  fonte.className = s.popupFonte
  fonte.textContent = FONTE_LABEL[p.fonte]
  wrap.appendChild(fonte)

  return wrap
}

export function MapaChamados({ pontos, onSelecionar, altura = 460 }: {
  pontos: PontoMapa[]
  /** Chamado ao clicar em "Abrir OS" no popup. */
  onSelecionar?: (id: string) => void
  altura?: number
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const camadaRef = useRef<L.LayerGroup | null>(null)
  // onSelecionar entra por ref para não recriar os marcadores a cada render do pai.
  const selecionarRef = useRef(onSelecionar)
  selecionarRef.current = onSelecionar

  // Cria o mapa uma única vez.
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = L.map(divRef.current, { scrollWheelZoom: false })
      .setView([-14.5, -52.5], 4) // Brasil inteiro no enquadramento inicial
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)
    camadaRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; camadaRef.current = null }
  }, [])

  // Redesenha os marcadores quando a lista muda.
  useEffect(() => {
    const camada = camadaRef.current
    const map = mapRef.current
    if (!camada || !map) return
    camada.clearLayers()

    // Conta quantos pontos já caíram em cada coordenada para espalhar os repetidos.
    const ocupacao = new Map<string, number>()

    for (const p of pontos) {
      const chave = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
      const indice = ocupacao.get(chave) ?? 0
      ocupacao.set(chave, indice + 1)
      // Só espalha o que é impreciso: coordenada de GPS/loja é real e fica onde está.
      const [lat, lng] = p.fonte === 'estado' ? espalhar(p.lat, p.lng, indice) : [p.lat, p.lng]

      const marcador = L.circleMarker([lat, lng], {
        radius: p.fonte === 'checkin' ? RAIO_PADRAO : RAIO_IMPRECISO,
        color: '#ffffff',
        weight: 1.5,
        fillColor: CRITICIDADE_CORES[p.criticidade],
        fillOpacity: p.fonte === 'checkin' ? 0.95 : 0.65,
      })

      const conteudo = popupHtml(p)
      if (selecionarRef.current) {
        const botao = document.createElement('button')
        botao.type = 'button'
        botao.className = s.popupBotao
        botao.textContent = 'Abrir OS'
        botao.onclick = () => selecionarRef.current?.(p.id)
        conteudo.appendChild(botao)
      }
      marcador.bindPopup(conteudo)
      marcador.addTo(camada)
    }

    // Reenquadra para o conjunto atual; com um ponto só, mantém um zoom legível
    // em vez do zoom máximo, que deixaria a tela só com telhados.
    if (pontos.length > 0) {
      const limites = L.latLngBounds(pontos.map(p => [p.lat, p.lng] as [number, number]))
      map.fitBounds(limites, { padding: [40, 40], maxZoom: pontos.length === 1 ? 11 : 13 })
    }
  }, [pontos])

  return (
    <div>
      <div ref={divRef} className={s.mapa} style={{ height: altura }} />
      <div className={s.legenda}>
        {(Object.keys(CRITICIDADE_CORES) as Criticidade[]).map(c => (
          <span key={c} className={s.legendaItem}>
            <i className={s.bolinha} style={{ background: CRITICIDADE_CORES[c] }} />
            {CRITICIDADE_LABEL[c]}
          </span>
        ))}
        <span className={s.legendaNota}>
          Pontos menores e mais claros são posições aproximadas (sem GPS de check-in).
        </span>
      </div>
    </div>
  )
}
