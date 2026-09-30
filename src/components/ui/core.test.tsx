import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as React from 'react'
import { Button, CloseButton, Pagination, Select, Tabs } from './core'

function ControlledTabs({ initial = 'Resumo', onTrack }: { initial?: string; onTrack?: (next: string) => void }) {
  const [value, setValue] = React.useState(initial)
  return (
    <Tabs
      items={['Resumo', 'Atividades', 'Histórico']}
      value={value}
      onChange={(next) => {
        onTrack?.(next)
        setValue(next)
      }}
    />
  )
}

describe('Tabs — responsivo e alvo de toque (Fase 5)', () => {
  it('tablist rola horizontalmente sem quebrar e mantém labels sempre visíveis', () => {
    render(<Tabs items={['Detalhes', 'Matrículas', 'Histórico escolar completo', 'Pagamentos']} value="Detalhes" onChange={() => {}} />)

    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('overflow-x-auto')

    const tabs = screen.getAllByRole('tab')
    for (const tab of tabs) {
      expect(tab.className).toContain('whitespace-nowrap')
      expect(tab.className).toContain('min-h-11')
    }
  })

  it('aba ativa é marcada e cliques disparam onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Tabs items={['Resumo', 'Cronologia']} value="Resumo" onChange={onChange} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]!).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]!).toHaveAttribute('aria-selected', 'false')

    await user.click(tabs[1]!)
    expect(onChange).toHaveBeenCalledWith('Cronologia')
  })
})

describe('Tabs — navegação por teclado (Fase 11.4)', () => {
  it('ArrowRight foca e seleciona a próxima tab', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Resumo" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]!).toHaveAttribute('tabindex', '0')
    expect(tabs[1]!).toHaveAttribute('tabindex', '-1')
    tabs[0]!.focus()

    await user.keyboard('{ArrowRight}')

    expect(tabs[1]!).toHaveFocus()
    expect(tabs[1]!).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]!).toHaveAttribute('tabindex', '0')
    expect(tabs[0]!).toHaveAttribute('tabindex', '-1')
    expect(onTrack).toHaveBeenCalledWith('Atividades')
  })

  it('ArrowLeft foca e seleciona a tab anterior', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Atividades" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    tabs[1]!.focus()

    await user.keyboard('{ArrowLeft}')

    expect(tabs[0]!).toHaveFocus()
    expect(tabs[0]!).toHaveAttribute('aria-selected', 'true')
    expect(onTrack).toHaveBeenCalledWith('Resumo')
  })

  it('ArrowRight na última tab faz wrap para a primeira', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Histórico" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    tabs[2]!.focus()

    await user.keyboard('{ArrowRight}')

    expect(tabs[0]!).toHaveFocus()
    expect(tabs[0]!).toHaveAttribute('aria-selected', 'true')
    expect(onTrack).toHaveBeenCalledWith('Resumo')
  })

  it('ArrowLeft na primeira tab faz wrap para a última', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Resumo" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    tabs[0]!.focus()

    await user.keyboard('{ArrowLeft}')

    expect(tabs[2]!).toHaveFocus()
    expect(tabs[2]!).toHaveAttribute('aria-selected', 'true')
    expect(onTrack).toHaveBeenCalledWith('Histórico')
  })

  it('Home foca e seleciona a primeira tab', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Histórico" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    tabs[2]!.focus()

    await user.keyboard('{Home}')

    expect(tabs[0]!).toHaveFocus()
    expect(tabs[0]!).toHaveAttribute('aria-selected', 'true')
    expect(onTrack).toHaveBeenCalledWith('Resumo')
  })

  it('End foca e seleciona a última tab', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Resumo" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    tabs[0]!.focus()

    await user.keyboard('{End}')

    expect(tabs[2]!).toHaveFocus()
    expect(tabs[2]!).toHaveAttribute('aria-selected', 'true')
    expect(onTrack).toHaveBeenCalledWith('Histórico')
  })

  it('tabIndex segue a roving tabindex: 0 na selecionada, -1 nas demais', () => {
    render(<Tabs items={['Resumo', 'Atividades', 'Histórico']} value="Atividades" onChange={() => {}} />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]!).toHaveAttribute('tabindex', '-1')
    expect(tabs[1]!).toHaveAttribute('tabindex', '0')
    expect(tabs[2]!).toHaveAttribute('tabindex', '-1')
  })

  it('teclas não-navegacionais não disparam onChange', async () => {
    const user = userEvent.setup()
    const onTrack = vi.fn()
    render(<ControlledTabs initial="Resumo" onTrack={onTrack} />)

    const tabs = screen.getAllByRole('tab')
    tabs[0]!.focus()

    await user.keyboard('{x}')

    expect(onTrack).not.toHaveBeenCalled()
    expect(tabs[0]!).toHaveAttribute('aria-selected', 'true')
  })
})

describe('Button sm e compartilhados — targets mínimos (Fase 5)', () => {
  it('CloseButton tem alvo 44x44, ícone preservado e label acessível', () => {
    render(<CloseButton />)
    const button = screen.getByRole('button', { name: 'Fechar' })
    expect(button.className).toContain('size-11')
    expect(button.querySelector('svg')).toBeTruthy()
  })

  it('Pagination usa altura padrão de 44px nas ações Anterior/Próxima', () => {
    render(<Pagination page={2} />)
    expect(screen.getByRole('navigation', { name: 'Paginação' })).toBeTruthy()
    for (const label of ['Anterior', 'Próxima']) {
      expect(screen.getByRole('button', { name: label }).className).toContain('min-h-11')
    }
  })

  it('Select mantém min-heigh 44px sem forçar largura cheia', () => {
    render(<Select aria-label="Filtro" />)
    const select = screen.getByLabelText('Filtro')
    expect(select.className).toContain('min-h-11')
    expect(select.className).not.toContain('w-full')
  })

  it('Botão md padrão tem 44px e mantém override por className', () => {
    render(<Button className="w-[120px]">Ação</Button>)
    const button = screen.getByRole('button', { name: 'Ação' })
    expect(button.className).toContain('min-h-11')
    expect(button.className).toContain('w-[120px]')
  })
})