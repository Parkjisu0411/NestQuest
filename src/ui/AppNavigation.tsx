import { NavLink, useLocation } from 'react-router'
import { Icon } from './Icon.tsx'
export function AppNavigation() {
  const { pathname } = useLocation()
  if (!['/', '/compare', '/settings'].includes(pathname)) return null
  return <nav className="app-nav" aria-label="주 메뉴">
    <NavLink to="/" end><Icon name="map" /><span>탐색</span></NavLink>
    <NavLink to="/compare"><Icon name="compare" /><span>비교</span></NavLink>
    <NavLink to="/settings"><Icon name="settings" /><span>설정</span></NavLink>
  </nav>
}
