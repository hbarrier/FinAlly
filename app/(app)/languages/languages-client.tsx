'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { PageHeader } from '@/components/fern/page-header'
import { FernButton } from '@/components/fern/button'
import { Icon } from '@/components/fern/icon'
import { ISO_LANGUAGES } from '@/lib/iso-languages'
import { addLanguage, deleteLanguage, saveTranslations } from '@/lib/actions/languages'
import { confirmDialog } from '@/lib/dialogs-store'
import { useServerAction } from '@/hooks/use-server-action'

type Lang = { code: string; label: string }
type Entry = { key: string; value: string }

interface Props {
  languages: Lang[]
  english: Entry[]
  translations: Record<string, Record<string, string>>
}

export function LanguagesClient({ languages, english, translations }: Props) {
  const t = useTranslations('languagesAdmin')
  const { run, pending } = useServerAction()

  const taken = useMemo(() => new Set(['en', ...languages.map((l) => l.code)]), [languages])
  const addable = ISO_LANGUAGES.filter((l) => !taken.has(l.code))

  const [addCode, setAddCode] = useState('')
  const [selected, setSelected] = useState<string | null>(languages[0]?.code ?? null)

  const add = () => {
    const opt = addable.find((l) => l.code === addCode)
    if (!opt) return
    run(async () => {
      await addLanguage({ code: opt.code, label: opt.label })
      setSelected(opt.code)
      setAddCode('')
    })
  }

  const remove = async (lang: Lang) => {
    const ok = await confirmDialog({
      message: t('deleteConfirm', { label: lang.label }),
      confirmLabel: t('deleteLabel'),
      tone: 'danger',
    })
    if (!ok) return
    run(async () => {
      await deleteLanguage(lang.code)
      setSelected((s) => (s === lang.code ? null : s))
    })
  }

  const selectedLang = languages.find((l) => l.code === selected) ?? null

  return (
    <div>
      <PageHeader kicker={t('kicker')} title={<em>{t('title')}</em>} />
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', maxWidth: 640, margin: '0 0 24px' }}>{t('intro')}</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
        <div className="fern-card" style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label className="fern-field-label wide">{t('listHeading')}</label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', padding: '6px 0' }}>{t('englishRow')}</div>
            {languages.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{t('noLanguages')}</div>
            )}
            {languages.map((l) => (
              <div key={l.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelected(l.code)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: selected === l.code ? 'var(--teal-bg)' : 'transparent',
                    color: selected === l.code ? 'var(--teal-ink)' : 'var(--ink)',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 13,
                    fontWeight: selected === l.code ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {l.label} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>({l.code})</span>
                </button>
                <button
                  type="button"
                  onClick={() => remove(l)}
                  disabled={pending}
                  aria-label={t('deleteLabel')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--ink-faint)', cursor: 'pointer', padding: 4 }}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>

          {addable.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="fern-field-label">{t('addHeading')}</label>
              <select className="fern-input" value={addCode} onChange={(e) => setAddCode(e.target.value)}>
                <option value="">—</option>
                {addable.map((l) => (
                  <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
                ))}
              </select>
              <FernButton onClick={add} disabled={!addCode || pending}>
                <Icon name="plus" size={15} /> {t('addButton')}
              </FernButton>
            </div>
          )}
        </div>

        <div className="fern-card" style={{ flex: '2 1 460px', minWidth: 0 }}>
          <label className="fern-field-label wide">{t('editorHeading')}</label>
          {selectedLang ? (
            <Editor
              key={selectedLang.code}
              lang={selectedLang}
              english={english}
              initial={translations[selectedLang.code] ?? {}}
            />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '16px 0' }}>{t('editorPrompt')}</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Editor({ lang, english, initial }: { lang: Lang; english: Entry[]; initial: Record<string, string> }) {
  const t = useTranslations('languagesAdmin')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const { run, pending } = useServerAction()

  const [saved, setSaved] = useState<Record<string, string>>(initial)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')

  const valueOf = (key: string) => (key in drafts ? drafts[key] : (saved[key] ?? ''))

  const dirty = Object.keys(drafts).some((k) => (drafts[k] ?? '') !== (saved[k] ?? ''))
  const translated = english.filter((e) => valueOf(e.key).trim() !== '').length

  const q = search.trim().toLowerCase()
  const visible = q
    ? english.filter((e) => e.key.toLowerCase().includes(q) || e.value.toLowerCase().includes(q))
    : english

  const groups = useMemo(() => {
    const out = new Map<string, Entry[]>()
    for (const e of visible) {
      const ns = e.key.split('.')[0]
      const list = out.get(ns) ?? []
      list.push(e)
      out.set(ns, list)
    }
    return [...out]
  }, [visible])

  const save = () => {
    const entries = Object.keys(drafts).map((key) => ({ key, value: drafts[key] }))
    run(async () => {
      await saveTranslations(lang.code, entries)
      setSaved((s) => {
        const next = { ...s }
        for (const { key, value } of entries) {
          if (value.trim() === '') delete next[key]
          else next[key] = value.trim()
        }
        return next
      })
      setDrafts({})
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
          {t('translatedCount', { done: translated, total: english.length })}
        </div>
        <input
          className="fern-input"
          style={{ maxWidth: 240 }}
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span>{t('sourceColumn')}</span>
        <span>{t('translationColumn')}</span>
      </div>

      {groups.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '12px 0' }}>{t('noMatches')}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 520, overflowY: 'auto' }}>
        {groups.map(([ns, entries]) => (
          <div key={ns} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-ink)', fontFamily: 'var(--mono-fern)', letterSpacing: '0.08em' }}>
              {ns}
            </div>
            {entries.map((e) => (
              <div key={e.key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  <div style={{ fontFamily: 'var(--mono-fern)', fontSize: 10, color: 'var(--ink-faint)' }}>{e.key}</div>
                  {e.value}
                </div>
                <input
                  className="fern-input"
                  value={valueOf(e.key)}
                  placeholder={e.value}
                  onChange={(ev) => setDrafts((d) => ({ ...d, [e.key]: ev.target.value }))}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <FernButton onClick={save} disabled={!dirty || pending}>
          <Icon name="check" size={15} /> {tCommon('saveChanges')}
        </FernButton>
      </div>
    </div>
  )
}
