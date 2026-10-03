import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { calculateLevel } from '@/lib/utils/xp'
import Resume from '@/components/portfolio/Resume'
import PrintButton from '@/components/profile/PrintButton'

export async function generateMetadata({ params }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_profile', { p_slug: slug })
  if (error || !data) notFound()
  return { title: `Résumé · ${data.profile.name}` }
}

/** Public, printable résumé (#38) — only when the profile is public. */
export default async function PublicResumePage({ params }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_public_profile', { p_slug: slug })
  if (error || !data) notFound()
  const p = data.profile
  return (
    <div className="pub resume-page">
      <div className="resume-toolbar no-print"><PrintButton /></div>
      <Resume
        profile={{ ...p, level: calculateLevel(p.total_xp || 0) }}
        items={data.portfolio || []}
        missions={data.missions || []}
        achievements={(data.achievements || []).length}
      />
    </div>
  )
}
