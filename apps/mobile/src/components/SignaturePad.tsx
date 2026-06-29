import { useRef, useState } from 'react'
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, SafeAreaView,
} from 'react-native'
// @ts-ignore — tipos do react-native-signature-canvas são limitados
import SignatureCanvas from 'react-native-signature-canvas'

// Canvas pequeno = PNG enxuto no Firestore (< 30 KB típico)
const WEB_STYLE = `
  body, html { margin: 0; padding: 0; background: #ffffff; }
  .m-signature-pad {
    box-shadow: none !important;
    border: none !important;
    margin: 0;
    width: 100%;
  }
  .m-signature-pad--body {
    border: 1.5px solid #d1d5db !important;
    border-radius: 12px;
    background: #ffffff;
  }
  .m-signature-pad--footer { display: none !important; }
`

interface Props {
  visible:     boolean
  titulo:      string
  onConfirmar: (dataUrl: string) => void
  onCancelar:  () => void
}

export function SignaturePad({ visible, titulo, onConfirmar, onCancelar }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<any>(null)
  const [assinado, setAssinado] = useState(false)

  function handleClear() {
    ref.current?.clearSignature()
    setAssinado(false)
  }

  function handleConfirmar() {
    if (!assinado) return
    ref.current?.readSignature() // aciona onOK com o PNG data URL
  }

  function handleOK(dataUrl: string) {
    onConfirmar(dataUrl)
    setAssinado(false)
  }

  function handleClose() {
    handleClear()
    onCancelar()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={s.container}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} style={s.btn}>
            <Text style={s.btnCancelar}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={s.titulo}>{titulo}</Text>
          <TouchableOpacity onPress={handleClear} style={s.btn}>
            <Text style={s.btnLimpar}>Limpar</Text>
          </TouchableOpacity>
        </View>

        {/* Instrução */}
        <View style={s.dica}>
          <Text style={s.dicaTxt}>Assine no espaço abaixo com o dedo</Text>
        </View>

        {/* Canvas de assinatura */}
        <View style={s.canvasWrap}>
          <SignatureCanvas
            ref={ref}
            onOK={handleOK}
            onBegin={() => setAssinado(true)}
            imageType="image/png"
            webStyle={WEB_STYLE}
            style={{ flex: 1 }}
          />
        </View>

        {/* Confirmar */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.btnConfirmar, !assinado && s.btnDisabled]}
            onPress={handleConfirmar}
            disabled={!assinado}
          >
            <Text style={s.btnConfirmarTxt}>
              {assinado ? 'Confirmar assinatura' : 'Assine acima para confirmar'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6f8' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  btn:         { minWidth: 60 },
  titulo:      { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  btnCancelar: { fontSize: 15, color: '#6b7280' },
  btnLimpar:   { fontSize: 15, color: '#dc2626', textAlign: 'right' },

  dica:    { paddingVertical: 10, alignItems: 'center' },
  dicaTxt: { fontSize: 13, color: '#9ca3af' },

  canvasWrap: {
    flex: 1, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff',
  },

  footer: { padding: 16 },
  btnConfirmar: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  btnDisabled:    { backgroundColor: '#9ca3af' },
  btnConfirmarTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
