import { useCallback, useState } from 'react'
import { scrollToId } from '../router'
import { Story } from '../site/Story'
import { Marquee } from '../site/Marquee'
import { Method } from '../site/Method'
import { Programs } from '../site/Programs'
import { Pathway } from '../site/Pathway'
import { Reputation } from '../site/Reputation'
import { Visit } from '../site/Visit'
import { Faq } from '../site/Faq'
import { Enquiry } from '../site/Enquiry'

export default function Home() {
  const [program, setProgram] = useState('')
  const enquireAbout = useCallback((id) => {
    setProgram(id)
    scrollToId('join')
  }, [])
  return (
    <>
      <Story />
      <Marquee />
      <Method more />
      <Programs onEnquire={enquireAbout} />
      <Pathway />
      <Reputation />
      <Visit />
      <Faq />
      <Enquiry program={program} onProgramChange={setProgram} />
    </>
  )
}
