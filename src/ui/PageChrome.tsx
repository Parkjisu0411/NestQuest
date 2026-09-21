import { Link } from 'react-router'
import styles from './PageChrome.module.css'
import { Icon } from './Icon.tsx'

export function PageChrome({
  backTo,
  backLabel,
}: {
  backTo: string
  backLabel: string
}) {
  return (
    <header className={styles.topbar}>
      <Link to={backTo} className={styles.back} aria-label={backLabel}>
        <Icon name="back" />
      </Link>
    </header>
  )
}
