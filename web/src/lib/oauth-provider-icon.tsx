import type { ComponentType, SVGProps } from 'react'
import { Layers } from 'lucide-react'
import { FaSlack } from 'react-icons/fa'
import {
  SiAtlassian,
  SiAuth0,
  SiAuthentik,
  SiBitbucket,
  SiDiscord,
  SiDropbox,
  SiFacebook,
  SiGitea,
  SiGithub,
  SiGitlab,
  SiGoogle,
  SiKeycloak,
  SiNextcloud,
  SiNotion,
  SiOkta,
  SiOpenid,
  SiReddit,
  SiTelegram,
  SiTwitch,
  SiWechat,
  SiX,
} from 'react-icons/si'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

type IconComponent = ComponentType<{ size?: number; className?: string }>

const oauthProviderIconMap: Record<string, IconComponent> = {
  github: SiGithub,
  gitlab: SiGitlab,
  gitea: SiGitea,
  google: SiGoogle,
  discord: SiDiscord,
  facebook: SiFacebook,
  linkedin: SiOpenid,
  x: SiX,
  twitter: SiX,
  slack: FaSlack,
  telegram: SiTelegram,
  wechat: SiWechat,
  keycloak: SiKeycloak,
  nextcloud: SiNextcloud,
  authentik: SiAuthentik,
  openid: SiOpenid,
  okta: SiOkta,
  auth0: SiAuth0,
  atlassian: SiAtlassian,
  bitbucket: SiBitbucket,
  notion: SiNotion,
  twitch: SiTwitch,
  reddit: SiReddit,
  dropbox: SiDropbox,
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isSimpleEmoji(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 4 && !isHttpUrl(trimmed)
}

function normalizeOAuthIconKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^ri:/, '')
    .replace(/^react-icons:/, '')
    .replace(/^si:/, '')
}

/**
 * Render custom OAuth provider icon with react-icons or URL/emoji fallback.
 */
export function getOAuthProviderIcon(
  iconName: string | null | undefined,
  size = 20
): React.ReactNode {
  const raw = String(iconName || '').trim()
  const iconSize = Number(size) > 0 ? Number(size) : 20
  const className = cn('shrink-0')

  if (!raw) {
    return (
      <Layers
        className={cn(className, 'text-muted-foreground')}
        size={iconSize}
        aria-hidden
      />
    )
  }

  if (isHttpUrl(raw)) {
    return (
      <img
        src={raw}
        alt=''
        width={iconSize}
        height={iconSize}
        className={cn(className, 'rounded object-cover')}
      />
    )
  }

  if (isSimpleEmoji(raw)) {
    return (
      <span
        className={cn(className, 'inline-flex items-center justify-center')}
        style={{
          width: iconSize,
          height: iconSize,
          fontSize: Math.max(Math.floor(iconSize * 0.8), 14),
        }}
        aria-hidden
      >
        {raw}
      </span>
    )
  }

  const key = normalizeOAuthIconKey(raw)
  const IconComp = oauthProviderIconMap[key] as
    | ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
    | undefined
  if (IconComp) {
    return <IconComp size={iconSize} className={className} aria-hidden />
  }

  return (
    <Avatar className={className} style={{ width: iconSize, height: iconSize }}>
      <AvatarFallback className='text-[10px]'>
        {raw.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
