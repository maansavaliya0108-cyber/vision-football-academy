import { fitStyle } from './fit'

/** A section's big uppercase title, capped so its widest word always fits between a phone's gutters. */
export function SectionTitle({ id, children }) {
  return (
    <h2 id={id} className="section-title" style={fitStyle(String(children))}>
      {children}
    </h2>
  )
}
