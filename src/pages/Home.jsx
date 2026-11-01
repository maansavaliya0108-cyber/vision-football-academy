import { useCallback, useState } from 'react'
import { scrollToId } from '../router'
import { Story } from '../site/Story'
import { Marquee } from '../site/Marquee'
import { ProofBar } from '../site/ProofBar'
import { FilmTeaser } from '../site/FilmTeaser'
import { WhyVision } from '../site/WhyVision'
import { Method } from '../site/Method'
import { Programs } from '../site/Programs'
import { Pathway } from '../site/Pathway'
import { GameTeaser } from '../site/GameTeaser'
import { Reputation } from '../site/Reputation'
import { Visit } from '../site/Visit'
import { Faq } from '../site/Faq'
import { Enquiry } from '../site/Enquiry'

// Built like a pitch: the story, the proof, the film, the reasons, what training covers, the programs, where
// it leads, the game, what families say, where and when, the questions, then booking a visit.
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
      <ProofBar />
      <FilmTeaser />
      <WhyVision />
      <Method more />
      <Programs onEnquire={enquireAbout} />
      <Pathway />
      <GameTeaser />
      <Reputation />
      <Visit />
      <Faq />
      <Enquiry program={program} onProgramChange={setProgram} />
    </>
  )
}
