import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1'
import type { ContractDocumentPayload } from './contract-document.ts'

const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 52
const BODY_SIZE = 10
const LINE_HEIGHT = 15

function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function date(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value))
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export async function renderContractPdf(payload: ContractDocumentPayload): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const pages: PDFPage[] = []
  let page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  pages.push(page)
  let cursor = PAGE_HEIGHT - MARGIN

  const newPage = () => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    pages.push(page)
    cursor = PAGE_HEIGHT - MARGIN
  }
  const ensureSpace = (height: number) => {
    if (cursor - height < 58) newPage()
  }
  const line = (text: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = options.bold ? bold : regular
    const size = options.size ?? BODY_SIZE
    const lines = wrap(text, font, size, PAGE_WIDTH - MARGIN * 2)
    ensureSpace(lines.length * LINE_HEIGHT)
    for (const value of lines) {
      page.drawText(value, { x: MARGIN, y: cursor, size, font, color: options.color ?? rgb(0.12, 0.15, 0.2) })
      cursor -= LINE_HEIGHT
    }
  }
  const gap = (height = 8) => { cursor -= height }
  const heading = (text: string) => {
    ensureSpace(30)
    cursor -= 6
    line(text.toUpperCase(), { bold: true, size: 11, color: rgb(0.05, 0.23, 0.35) })
    cursor -= 3
  }
  const field = (label: string, value: string) => line(`${label}: ${value}`)

  page.drawText(payload.institution.tradeName, { x: MARGIN, y: cursor, size: 18, font: bold, color: rgb(0.04, 0.19, 0.3) })
  cursor -= 24
  line(payload.institution.legalName, { size: 9 })
  line(`CNPJ: ${payload.institution.cnpj} · ${payload.institution.address} · ${payload.institution.city}/${payload.institution.state}`, { size: 8 })
  gap(16)
  page.drawText('CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS', { x: MARGIN, y: cursor, size: 13, font: bold, color: rgb(0.04, 0.19, 0.3) })
  cursor -= 22
  field('Código do contrato', payload.contract.code)
  field('Código documental', payload.document.documentCode ?? '—')
  field('Data', date(payload.contract.date))
  gap()

  heading('Partes')
  field('Contratante', payload.contractor.name)
  field('CPF', payload.contractor.cpf ?? '—')
  field('E-mail', payload.contractor.email ?? '—')
  field('Telefone', payload.contractor.phone ?? '—')
  const address = payload.contractor.address
  if (address) field('Endereço', [address.street, address.number, address.complement, address.district, address.city, address.state].filter(Boolean).join(', ') || '—')
  field('Aluno', `${payload.student.name} (${payload.student.code})`)
  gap()

  heading('Curso')
  field('Curso', payload.course.name)
  field('Modalidade', payload.course.modality)
  field('Carga horária', payload.course.workloadHours == null ? '—' : `${payload.course.workloadHours} horas`)
  gap()

  heading('Condições comerciais')
  field('Valor bruto', money(payload.commercial.grossValue))
  field('Desconto', money(payload.commercial.discountValue))
  field('Valor líquido', money(payload.commercial.netValue))
  field('Forma de pagamento', payload.commercial.paymentMethod)
  field('Parcelas', String(payload.commercial.installments))
  if (payload.commercial.notes) field('Observações', payload.commercial.notes)
  gap()

  heading('Cláusulas')
  line('LEGAL_TEXT_PENDING_APPROVAL — o texto jurídico definitivo será inserido após aprovação formal.')
  line('Este documento estrutural registra os dados comerciais e acadêmicos congelados no momento da geração.')
  gap()

  heading('Formalização')
  line('Métodos previstos: Gov.br ou assinatura física presencial.')
  line('Estado atual: aguardando formalização. Este PDF ainda não representa um contrato assinado.')
  gap()

  heading('Controle documental')
  field('Template', payload.document.templateVersion)
  field('Versão', String(payload.document.version))
  field('Snapshot SHA-256', payload.document.canonicalPayloadHash?.slice(0, 16) ?? '—')
  field('Gerado em', date(payload.dates.createdAt))
  gap(28)

  ensureSpace(70)
  page.drawLine({ start: { x: MARGIN, y: cursor }, end: { x: PAGE_WIDTH - MARGIN, y: cursor }, thickness: 0.7, color: rgb(0.65, 0.68, 0.72) })
  cursor -= 26
  page.drawText('Assinatura do contratante', { x: MARGIN, y: cursor, size: 9, font: regular })
  page.drawText('Representante da instituição', { x: PAGE_WIDTH / 2 + 10, y: cursor, size: 9, font: regular })
  cursor -= 32
  page.drawLine({ start: { x: MARGIN, y: cursor }, end: { x: PAGE_WIDTH / 2 - 20, y: cursor }, thickness: 0.6, color: rgb(0.2, 0.2, 0.2) })
  page.drawLine({ start: { x: PAGE_WIDTH / 2 + 10, y: cursor }, end: { x: PAGE_WIDTH - MARGIN, y: cursor }, thickness: 0.6, color: rgb(0.2, 0.2, 0.2) })

  pages.forEach((currentPage, index) => {
    currentPage.drawText(`${payload.document.documentCode ?? payload.contract.code} · ${payload.document.templateVersion} · Página ${index + 1}/${pages.length}`, {
      x: MARGIN, y: 28, size: 7, font: regular, color: rgb(0.35, 0.38, 0.42)
    })
  })

  return document.save({ useObjectStreams: false, addDefaultPage: false })
}
