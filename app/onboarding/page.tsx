import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getUserSettings } from '@/lib/queries/user-settings'
import { OnboardingClient } from './onboarding-client'

export const metadata: Metadata = { title: 'Welcome | FinAlly' }

export default async function OnboardingPage() {
  const settings = await getUserSettings()
  if (settings?.onboarded) redirect('/dashboard')
  return <OnboardingClient />
}
