import { CheckCircle2, Globe, Download, MoreVertical, PlusSquare, Share, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { Button, Card } from '../../components/ui'
import { IOSInstallModal, useInstall } from '../../components/Pwa'
import { useDocumentTitle } from '../../hooks/useAsync'
import { PageHero } from './About'

export default function InstallPage() {
  useDocumentTitle('Install the app')
  const install = useInstall()
  const [ios, setIos] = useState(false)
  return (
    <>
      <PageHero eyebrow="Mobile app" title="Install Mythree on your phone">
        Mythree works like an app – full-screen, with its own icon – without visiting an app store.
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-14">
        {install.isStandalone ? (
          <Card className="flex items-center gap-4 p-6">
            <CheckCircle2 className="size-10 text-success" />
            <div>
              <p className="font-display text-xl text-ink">Mythree is installed</p>
              <p className="text-sm text-ink-3">You are using the installed app. Enjoy learning!</p>
            </div>
          </Card>
        ) : install.canPrompt ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <img src="/icons/icon-64.png" alt="" width={56} height={56} className="size-14 rounded-2xl" />
              <div>
                <p className="font-display text-xl text-ink">Ready to install</p>
                <p className="text-sm text-ink-3">Your browser supports one-tap installation.</p>
              </div>
            </div>
            <Button size="lg" icon={<Download className="size-5" />} onClick={() => install.prompt()}>
              Install Mythree
            </Button>
          </Card>
        ) : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Smartphone className="size-7 text-success" />
              <h2 className="text-2xl text-ink">Android</h2>
            </div>
            <ol className="mt-5 space-y-3 text-sm text-ink-2">
              <li className="flex gap-3"><Globe className="size-5 shrink-0 text-ink-3" /> Open this website in <strong>Globe</strong> (or Edge / Samsung Internet).</li>
              <li className="flex gap-3"><Download className="size-5 shrink-0 text-ink-3" /> Tap <strong>Install app</strong> when prompted, or</li>
              <li className="flex gap-3"><MoreVertical className="size-5 shrink-0 text-ink-3" /> tap the ⋮ menu and choose <strong>Install app</strong> / <strong>Add to Home screen</strong>.</li>
              <li className="flex gap-3"><CheckCircle2 className="size-5 shrink-0 text-success" /> Open Mythree from your home screen.</li>
            </ol>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <Smartphone className="size-7 text-info" />
              <h2 className="text-2xl text-ink">iPhone & iPad</h2>
            </div>
            <ol className="mt-5 space-y-3 text-sm text-ink-2">
              <li className="flex gap-3"><Globe className="size-5 shrink-0 text-ink-3" /> Open this website in <strong>Safari</strong>. (Other iPhone browsers may not offer installation.)</li>
              <li className="flex gap-3"><Share className="size-5 shrink-0 text-info" /> Tap the <strong>Share</strong> button.</li>
              <li className="flex gap-3"><PlusSquare className="size-5 shrink-0 text-ink-3" /> Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
              <li className="flex gap-3"><CheckCircle2 className="size-5 shrink-0 text-success" /> Open Mythree from your home screen.</li>
            </ol>
            {install.isIOS && (
              <Button variant="secondary" className="mt-5" onClick={() => setIos(true)}>
                Show me step by step
              </Button>
            )}
          </Card>
        </div>
        <p className="mt-8 text-center text-sm text-ink-3">
          The installed app keeps the same account and progress. Tests, challenges and payments need an internet connection.
        </p>
      </div>
      <IOSInstallModal open={ios} onClose={() => setIos(false)} />
    </>
  )
}
