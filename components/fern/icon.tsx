import React from 'react'

type IconName =
  | 'home' | 'list' | 'repeat' | 'pie' | 'plus' | 'minus'
  | 'search' | 'filter' | 'x' | 'check' | 'chevronDown' | 'chevronRight'
  | 'chevronLeft' | 'moon' | 'sun' | 'more' | 'trash' | 'edit' | 'calendar'
  | 'wallet' | 'arrowUp' | 'arrowDown' | 'sparkle' | 'bank' | 'tag' | 'store'
  | 'cat-cart' | 'cat-house' | 'cat-bus' | 'cat-fork' | 'cat-film' | 'cat-heart'
  | 'cat-shirt' | 'cat-bulb' | 'cat-plane' | 'cat-book' | 'cat-briefcase'
  | 'cat-pen' | 'cat-gift' | 'cat-chart' | 'cat-dots' | 'cat-coffee'
  | 'cat-phone' | 'cat-fuel' | 'cat-paw' | 'cat-seed' | 'cat-bank' | 'cat-education' | 'cat-gov'
  | 'cat-holidays' | 'cat-divorce' | 'cat-receipt'
  | 'upload' | 'fileText' | 'flask' | 'target' | 'settings' | 'info' | string

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

const paths: Record<string, React.ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1v-9.5Z" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" /><circle cx="3.5" cy="12" r="1.2" /><circle cx="3.5" cy="18" r="1.2" /></>,
  repeat: <><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
  pie: <><path d="M21 12A9 9 0 1 1 12 3v9h9Z" /><path d="M15 3.5A9 9 0 0 1 20.5 9" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  minus: <><path d="M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  filter: <><path d="M3 5h18l-7 9v5l-4 2v-7L3 5Z" /></>,
  x: <><path d="M6 6l12 12M18 6l-12 12" /></>,
  check: <><path d="m5 12 5 5L20 7" /></>,
  chevronDown: <><path d="m6 9 6 6 6-6" /></>,
  chevronRight: <><path d="m9 6 6 6-6 6" /></>,
  chevronLeft: <><path d="m15 6-6 6 6 6" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></>,
  more: <><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" /></>,
  edit: <><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" /><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M17 15h.01" /></>,
  arrowUp: <><path d="M12 19V5M5 12l7-7 7 7" /></>,
  arrowDown: <><path d="M12 5v14M19 12l-7 7-7-7" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" /></>,
  bank: <><path d="M3 21h18M4 10h16M5 10V8l7-4 7 4v2M6 10v8M10 10v8M14 10v8M18 10v8" /></>,
  tag: <><path d="M20 12.5 12.5 20a1.4 1.4 0 0 1-2 0L3 12.5V4h8.5L20 12.5a1.4 1.4 0 0 1 0 2Z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></>,
  store: <><path d="M3 9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1-3 3 3 3 0 0 1-3-3V9Z" /><path d="M5 21V13h3v4h8v-4h3v8H5Z" /></>,
  receipt: <><path d="M4 3v18l3-2 3 2 3-2 3 2 3-2V3l-3 2-3-2-3 2-3-2-3 2Z" /><path d="M8 10h8M8 14h5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.6" fill="currentColor" /></>,
  
  // Category icons
  'cat-cart': <><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /><path d="M3 4h3l2.5 11h10l2-7H7" /></>,
  'cat-house': <><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-4v-6h-8v6H4a1 1 0 0 1-1-1v-9Z" /></>,
  'cat-bus': <><rect x="4" y="4" width="16" height="13" rx="2" /><path d="M4 11h16M8 17v2M16 17v2" /><circle cx="8" cy="14" r="1" fill="currentColor" /><circle cx="16" cy="14" r="1" fill="currentColor" /></>,
  'cat-fork': <><path d="M7 3v7a2 2 0 0 0 2 2v9M5 3v7M9 3v7M17 3c-1.5 1-2.5 3-2.5 5s1 3 2.5 3v10" /></>,
  'cat-film': <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 9h4M3 15h4M17 9h4M17 15h4M7 5v14M17 5v14" /></>,
  'cat-heart': <><path d="M12 20s-7-4.5-9-9.5C1.5 6 5 3 8 4.5 10 5.5 12 8 12 8s2-2.5 4-3.5C19 3 22.5 6 21 10.5c-2 5-9 9.5-9 9.5Z" /></>,
  'cat-shirt': <><path d="M4 7 8 4l4 2 4-2 4 3-2 3h-2v10H8V10H6L4 7Z" /></>,
  'cat-bulb': <><path d="M9 18h6M10 21h4M8 13a5 5 0 1 1 8 0c-1 1.2-1.5 2-1.5 3.5h-5C9.5 15 9 14.2 8 13Z" /></>,
  'cat-plane': <><path d="M21 12 14 9l-3-7-2 6-7 2 7 2 2 6 3-6 7-2Z" /></>,
  'cat-book': <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z" /><path d="M4 19a2 2 0 0 1 2-2h13" /></>,
  'cat-briefcase': <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  'cat-pen': <><path d="M14 3.5 20.5 10 10 20.5l-6.5 1.5 1.5-6.5L14 3.5Z" /><path d="m13 5 6 6" /></>,
  'cat-gift': <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M12 8v13M5 13v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" /><path d="M12 8c-1-3-5-4-5-1s4 1 5 1ZM12 8c1-3 5-4 5-1s-4 1-5 1Z" /></>,
  'cat-chart': <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>,
  'cat-dots': <><circle cx="5" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="19" cy="12" r="2" fill="currentColor" /></>,
  'cat-coffee': <><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" /><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2" /></>,
  'cat-phone': <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  'cat-fuel': <><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M4 10h10M14 8l3 2v8a2 2 0 0 1-2 2" /></>,
  'cat-paw': <><circle cx="7" cy="8" r="1.8" /><circle cx="17" cy="8" r="1.8" /><circle cx="4" cy="13" r="1.8" /><circle cx="20" cy="13" r="1.8" /><path d="M8 16a4 4 0 0 1 8 0c0 2-1.5 4-4 4s-4-2-4-4Z" /></>,
  'cat-seed': <><path d="M12 21c-5 0-8-4-8-8 0-3 2-5 4-5 3 0 4 3 4 6v7ZM12 21c5 0 8-4 8-8 0-3-2-5-4-5-3 0-4 3-4 6v7Z" /></>,
  'cat-bank': <><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></>,
  'cat-education': <><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></>,
  'cat-gov': <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M7 12h5"/><path d="M15 9.4a4 4 0 1 0 0 5.2"/></>,
  'cat-divorce': <><path d="M12 3v18"/><path d="m19 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1"/><path d="m5 8 3 8a5 5 0 0 1-6 0zV7"/><path d="M7 21h10"/></>,
  'cat-holidays': <><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8 12 3 7 8"/><path d="M12 3v12" /></>,
  fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8" /></>,
  flask: <><path d="M9 3h6M10 3v6.5L4.5 18.5A2 2 0 0 0 6.2 21.5h11.6a2 2 0 0 0 1.7-3L14 9.5V3" /><path d="M7.5 15h9" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></>,
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {paths[name] ?? null}
    </svg>
  )
}
