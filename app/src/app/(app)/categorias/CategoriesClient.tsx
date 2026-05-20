'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, TrendingDown, Pencil, Trash2 } from 'lucide-react'
import { DynamicIcon } from '@/components/DynamicIcon'
import { colorIconBg } from '@/lib/colors'
import { formatEUR } from '@/lib/format'
import { CategoryModal } from './CategoryModal'
import { deleteCategory } from './actions'
import type { CategoryWithStats } from './page'

export function CategoriesClient({ categories }: { categories: CategoryWithStats[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<CategoryWithStats | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [defaultTipo, setDefaultTipo] = useState<'ENTRADA' | 'SAIDA'>('SAIDA')
  const [, startTransition] = useTransition()

  const receitas = categories.filter((c) => c.tipo === 'ENTRADA')
  const despesas = categories.filter((c) => c.tipo === 'SAIDA')

  function buildTree(items: CategoryWithStats[]) {
    const roots = items.filter((c) => !c.parentId)
    return roots.map((r) => ({
      parent: r,
      children: items.filter((c) => c.parentId === r.id),
    }))
  }

  const orphans = (items: CategoryWithStats[]) =>
    items.filter((c) => c.parentId && !items.some((p) => p.id === c.parentId))

  function openNew(tipo: 'ENTRADA' | 'SAIDA') {
    setDefaultTipo(tipo)
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(cat: CategoryWithStats) {
    setEditing(cat)
    setModalOpen(true)
  }

  function handleDelete(cat: CategoryWithStats) {
    if (!confirm(`Eliminar a categoria "${cat.nome}"?${cat.count > 0 ? `\nHá ${cat.count} movimento(s) associado(s). A categoria será arquivada.` : ''}`)) return
    startTransition(async () => {
      await deleteCategory(cat.id)
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Categorias</h1>
          <p className="text-zinc-500 text-sm">Organiza os teus movimentos com categorias personalizadas.</p>
        </div>
        <button onClick={() => openNew('SAIDA')} className="btn-primary">
          <Plus className="w-4 h-4" />
          <span>Nova categoria</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryColumn
          title="Receitas"
          tipo="ENTRADA"
          Icon={TrendingUp}
          accent="bg-emerald-100 text-emerald-600"
          tree={buildTree(receitas)}
          orphans={orphans(receitas)}
          onAdd={() => openNew('ENTRADA')}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
        <CategoryColumn
          title="Despesas"
          tipo="SAIDA"
          Icon={TrendingDown}
          accent="bg-red-100 text-red-600"
          tree={buildTree(despesas)}
          orphans={orphans(despesas)}
          onAdd={() => openNew('SAIDA')}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </div>

      <CategoryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        category={editing}
        defaultTipo={defaultTipo}
        allCategories={categories}
      />
    </>
  )
}

function CategoryColumn({
  title,
  Icon,
  accent,
  tree,
  orphans,
  onAdd,
  onEdit,
  onDelete,
}: {
  title: string
  tipo: 'ENTRADA' | 'SAIDA'
  Icon: React.ComponentType<{ className?: string }>
  accent: string
  tree: { parent: CategoryWithStats; children: CategoryWithStats[] }[]
  orphans: CategoryWithStats[]
  onAdd: () => void
  onEdit: (c: CategoryWithStats) => void
  onDelete: (c: CategoryWithStats) => void
}) {
  const totalCount = tree.reduce((s, t) => s + 1 + t.children.length, 0) + orphans.length
  return (
    <div className="card overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${accent} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-zinc-900">
            {title} <span className="text-zinc-400 font-normal">({totalCount})</span>
          </h3>
        </div>
        <button
          onClick={onAdd}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Adicionar
        </button>
      </div>
      <div className="divide-y divide-zinc-100">
        {totalCount === 0 && (
          <div className="p-8 text-center text-sm text-zinc-400">
            Sem categorias registadas
          </div>
        )}
        {tree.map(({ parent, children }) => (
          <div key={parent.id}>
            <CategoryRow cat={parent} onEdit={onEdit} onDelete={onDelete} />
            {children.map((child) => (
              <CategoryRow
                key={child.id}
                cat={child}
                indent
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ))}
        {orphans.map((cat) => (
          <CategoryRow key={cat.id} cat={cat} indent onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}

function CategoryRow({
  cat,
  indent,
  onEdit,
  onDelete,
}: {
  cat: CategoryWithStats
  indent?: boolean
  onEdit: (c: CategoryWithStats) => void
  onDelete: (c: CategoryWithStats) => void
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 hover:bg-zinc-50 group ${indent ? 'pl-12 bg-zinc-50/30' : ''}`}
    >
      {indent && (
        <span className="absolute ml-[-1.25rem] text-zinc-300 select-none">└</span>
      )}
      <div
        className={`w-9 h-9 rounded-lg ${colorIconBg[cat.cor] || colorIconBg.violet} flex items-center justify-center`}
      >
        <DynamicIcon name={cat.icone} className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-zinc-900">{cat.nome}</div>
        <div className="text-xs text-zinc-500">
          {cat.count} {cat.count === 1 ? 'movimento' : 'movimentos'} · {formatEUR(cat.total)}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={() => onEdit(cat)}
          className="w-7 h-7 rounded-lg hover:bg-white text-zinc-500"
          aria-label="Editar"
        >
          <Pencil className="w-3.5 h-3.5 mx-auto" />
        </button>
        <button
          onClick={() => onDelete(cat)}
          className="w-7 h-7 rounded-lg hover:bg-white text-zinc-500"
          aria-label="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5 mx-auto" />
        </button>
      </div>
    </div>
  )
}
