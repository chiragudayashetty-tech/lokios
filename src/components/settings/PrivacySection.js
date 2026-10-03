'use client'

import { Lock } from 'lucide-react'
import { Section } from './controls'
import PublicShareCard from '@/components/profile/PublicShareCard'
import { useOSSlice } from '@/lib/context/OSContext'

export default function PrivacySection({ user }) {
  const { profile, fetchProfile } = useOSSlice('profile')
  return (
    <Section id="privacy" icon={Lock} title="Privacy" hint="Everything is private unless you switch on the public profile.">
      <PublicShareCard profile={profile} userId={user?.id} fallbackName={profile?.full_name || user?.user_metadata?.full_name} onSaved={fetchProfile} />
    </Section>
  )
}
