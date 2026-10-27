import { useEffect } from 'react'
import { academy } from '../../shared/academy.js'

/** Structured data so search engines can show these answers directly. */
function useFaqSchema() {
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: academy.faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
    document.head.appendChild(script)
    return () => script.remove()
  }, [])
}

export function Faq() {
  useFaqSchema()
  return (
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="wrap faq__grid">
        <div>
          <h2 id="faq-title" className="section-title">
            Questions parents ask
          </h2>
          <p className="faq__intro">
            Anything else? Call or WhatsApp <a href={`tel:${academy.phone.tel}`}>{academy.phone.display}</a>.
          </p>
        </div>
        <div className="faq__list">
          {academy.faq.map(({ q, a }, i) => (
            <details key={q} className="faq__item" open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
