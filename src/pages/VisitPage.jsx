import { useState } from 'react'
import { academy } from '../../shared/academy.js'
import { Link } from '../router'
import { Enquiry } from '../site/Enquiry'
import { Faq } from '../site/Faq'
import { Visit } from '../site/Visit'
import { PageHero } from './PageHero'

export default function VisitPage() {
  const [program, setProgram] = useState('')
  return (
    <>
      <PageHero
        crumbs={[{ label: 'Timings and ground' }]}
        title="See it for yourself"
        lede={`${academy.address.venue}, Adajan, Surat. Training runs Monday to Friday, 6 to 9 PM. Book a visit and the academy will call you back to arrange it.`}
        marks={[[100, 150]]}
      >
        <Link className="btn btn--volt" to="#join">
          Book a visit
        </Link>
        <a className="btn btn--ghost" href={academy.maps.directions} target="_blank" rel="noreferrer">
          Get directions
        </a>
      </PageHero>
      <Visit />
      <Faq />
      <Enquiry program={program} onProgramChange={setProgram} />
    </>
  )
}
