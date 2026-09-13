import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { can, canAny, PERMISSIONS } from './rbac'

const migrationPath = path.resolve('supabase/migrations/20260910120000_phase2_2_1_rbac_consistency.sql')
const contractsMigrationPath = path.resolve('supabase/migrations/20260910210000_phase2_4_contracts_core.sql')
const seedPath = path.resolve('supabase/seed.sql')
const migration = fs.readFileSync(migrationPath, 'utf8')
const contractsMigration = fs.readFileSync(contractsMigrationPath, 'utf8')
const seed = fs.readFileSync(seedPath, 'utf8')
const grantsBlock = migration.match(/with grants\(role_code, permission_code\) as \(values([\s\S]*?)\)\s*insert into public\.role_permissions/)?.[1] ?? ''
const contractsGrantsBlock = contractsMigration.match(/with grants\(role_code, permission_code\) as \(values([\s\S]*?)\)\s*insert into public\.role_permissions/)?.[1] ?? ''
const grants = new Set(
  [...grantsBlock.matchAll(/\('([^']+)','([^']+)'\)/g)].map((match) => `${match[1]}:${match[2]}`)
)
const contractGrants = new Set(
  [...contractsGrantsBlock.matchAll(/\('([^']+)','([^']+)'\)/g)].map((match) => `${match[1]}:${match[2]}`)
)

describe('RBAC boundaries', () => {
  it('mantém ADMIN com todo o catálogo atual', () => {
    expect(migration).toContain("where r.code = 'ADMIN'")
  })

  it('mantém gerente com acesso amplo ao CRM e cursos', () => {
    expect(grants).toContain('GERENTE_COMERCIAL:crm.view_all')
    expect(grants).toContain('GERENTE_COMERCIAL:courses.manage')
  })

  it('limita vendedor a leads próprios e operação comercial', () => {
    expect(grants).toContain('VENDEDOR:crm.move_stage')
    expect(grants).toContain('VENDEDOR:crm.activities.manage')
    expect(grants).not.toContain('VENDEDOR:crm.view_all')
  })

  it('permite cursos ao pedagógico sem conceder CRM', () => {
    expect(grants).toContain('PEDAGOGICO:courses.view')
    expect(grants).not.toContain('PEDAGOGICO:crm.view')
  })

  it('mantém recepção sem edição de lead', () => {
    expect(grants).toContain('RECEPCAO:crm.view')
    expect(grants).toContain('RECEPCAO:crm.create')
    expect(grants).not.toContain('RECEPCAO:crm.edit')
  })

  it('não permite que o seed altere catálogo ou grants de RBAC', () => {
    expect(seed).not.toMatch(/(?:insert|update|delete)\s+(?:into|from)?\s*public\.(?:roles|permissions|role_permissions)/i)
  })
})

describe('Contracts RBAC boundaries', () => {
  const contractsPermissions = [
    'contracts.view', 'contracts.view_all', 'contracts.view_sensitive', 'contracts.create',
    'contracts.edit_draft', 'contracts.issue', 'contracts.mark_signed', 'contracts.cancel'
  ]

  it('declara as 8 permissões de contracts na migration', () => {
    contractsPermissions.forEach((code) => {
      expect(contractsMigration).toContain(`'${code}'`)
    })
  })

  it('concede as 8 permissões ao ADMIN via cross join', () => {
    expect(contractsMigration).toContain("where r.code = 'ADMIN'")
    contractsPermissions.forEach((code) => {
      expect(contractsMigration).toContain(code)
    })
  })

  it('mantém DIRECAO e GERENTE_COMERCIAL com listener completo', () => {
    expect(contractGrants).toContain('DIRECAO:contracts.view_all')
    expect(contractGrants).toContain('DIRECAO:contracts.cancel')
    expect(contractGrants).toContain('GERENTE_COMERCIAL:contracts.issue')
    expect(contractGrants).toContain('GERENTE_COMERCIAL:contracts.cancel')
  })

  it('limita vendedor a view/create/edit_draft sem acesso ampliado', () => {
    expect(contractGrants).toContain('VENDEDOR:contracts.view')
    expect(contractGrants).toContain('VENDEDOR:contracts.create')
    expect(contractGrants).toContain('VENDEDOR:contracts.edit_draft')
    expect(contractGrants).not.toContain('VENDEDOR:contracts.view_all')
    expect(contractGrants).not.toContain('VENDEDOR:contracts.view_sensitive')
    expect(contractGrants).not.toContain('VENDEDOR:contracts.issue')
    expect(contractGrants).not.toContain('VENDEDOR:contracts.mark_signed')
    expect(contractGrants).not.toContain('VENDEDOR:contracts.cancel')
  })

it('mantém recepção com tudo exceto cancel', () => {
    expect(contractGrants).toContain('RECEPCAO:contracts.view')
    expect(contractGrants).toContain('RECEPCAO:contracts.view_all')
    expect(contractGrants).toContain('RECEPCAO:contracts.create')
    expect(contractGrants).toContain('RECEPCAO:contracts.issue')
    expect(contractGrants).toContain('RECEPCAO:contracts.mark_signed')
    expect(contractGrants).not.toContain('RECEPCAO:contracts.cancel')
  })

  it('confere people.create à recepção para cadastro de contratante', () => {
    expect(contractsMigration).toMatch(/p\.code = 'people\.create'[\s\S]*?where r\.code = 'RECEPCAO'/)
  })

  it('não concede contracts a FINANCEIRO, PEDAGOGICO ou PROFESSOR', () => {
    expect(contractsMigration).not.toContain("'FINANCEIRO','contracts.")
    expect(contractsMigration).not.toContain("'PEDAGOGICO','contracts.")
    expect(contractsMigration).not.toContain("'PROFESSOR','contracts.")
  })
})

describe('permission helpers', () => {
  it('avalia uma permissão exata', () => {
    expect(can(['students.view'], PERMISSIONS.STUDENTS_VIEW)).toBe(true)
    expect(can(['students.view'], PERMISSIONS.STUDENTS_EDIT)).toBe(false)
  })

  it('aceita qualquer permissão autorizada sem criar aliases implícitos', () => {
    expect(canAny(['users.manage'], PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE)).toBe(true)
    expect(canAny(['crm.view'], PERMISSIONS.COURSES_VIEW, PERMISSIONS.COURSES_MANAGE)).toBe(false)
  })
})
