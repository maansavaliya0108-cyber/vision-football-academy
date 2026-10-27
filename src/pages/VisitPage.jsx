import { useState } from 'react'
import { academy } from '../../shared/academy.js'
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
        title="Find us at the ground"
        lede={`${academy.address.venue}, Adajan, Surat. Training runs Monday to Friday from 6 to 9 PM. Come and watch a session, or send an enquiry first.`}
        marks={[[100, 150]]}
      >
        <a className="btn btn--volt" href={academy.maps.directions} target="_blank" rel="noreferrer">
          Get directions
        </a>
        <a className="btn btn--ghost" href={`tel:${academy.phone.tel}`}>
          Call {academy.phone.display}
        </a>
      </PageHero>
      <Visit />
      <Faq />
      <Enquiry program={program} onProgramChange={setProgram} />
    </>
  )
}
